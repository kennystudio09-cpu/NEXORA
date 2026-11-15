import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp, Data } from "../src/app";

test("M0 real PostgreSQL/Redis API acceptance", async t => {
  const app = await createApp();
  await app.listen(0, "127.0.0.1");
  const base = await app.getUrl();
  const data = app.get(Data);
  t.after(async () => { await app.close(); });
  const suffix = randomUUID();
  const password = `Test!${randomUUID()}`;
  type Actor = { cookie: string; email: string; id: string };
  async function request(path: string, actor?: Actor, method = "GET", body?: unknown, extra: Record<string,string> = {}) {
    return fetch(`${base}/api${path}`, { method, headers: { "content-type": "application/json", "x-nexora-request": "1", ...(actor ? { cookie: actor.cookie } : {}), ...extra }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  }
  async function register(label: string): Promise<Actor> {
    const email = `${label}-${suffix}@example.test`;
    const response = await request("/auth/register", undefined, "POST", { email, password });
    assert.equal(response.status, 201);
    assert.match(response.headers.get("set-cookie")!, /HttpOnly/);
    assert.match(response.headers.get("set-cookie")!, /SameSite=Lax/);
    const user = await response.json() as {id: string};
    return { cookie: response.headers.get("set-cookie")!.split(";")[0], email, id: user.id };
  }
  let owner: Actor, manager: Actor, staff: Actor, outsider: Actor;
  let first: {id:string;name:string}, second: {id:string;name:string};
  await t.test("database and Redis readiness", async () => {
    const response = await request("/health"); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { status: "ok", database: "up", redis: "up" });
  });
  await t.test("register with scrypt password and server-side session; reject duplicate", async () => {
    owner = await register("owner"); manager = await register("manager"); staff = await register("staff"); outsider = await register("outsider");
    const record = await data.db.user.findUniqueOrThrow({where:{id:owner.id}});
    assert.notEqual(record.passwordHash, password); assert.match(record.passwordHash, /^scrypt:/);
    const duplicate = await request("/auth/register", undefined, "POST", {email:owner.email,password}); assert.equal(duplicate.status,409);
  });
  await t.test("reject missing auth, malformed input, invalid password and cross-origin writes", async () => {
    assert.equal((await request("/tenants")).status,401);
    assert.equal((await request("/auth/register",undefined,"POST",{email:"bad",password:"short"})).status,400);
    assert.equal((await request("/auth/login",undefined,"POST",{email:owner.email,password:"Incorrect!password"})).status,401);
    assert.equal((await request("/auth/login",undefined,"POST",{email:owner.email,password},{origin:"https://attacker.example"})).status,403);
    const noHeader = await fetch(`${base}/api/tenants`,{method:"POST",headers:{cookie:owner.cookie,"content-type":"application/json"},body:JSON.stringify({name:"blocked"})}); assert.equal(noHeader.status,403);
  });
  await t.test("login rotates and revokes the prior session", async () => {
    const old = {...owner};
    const response = await request("/auth/login", owner,"POST",{email:owner.email,password}); assert.equal(response.status,201);
    owner.cookie=response.headers.get("set-cookie")!.split(";")[0];
    assert.notEqual(old.cookie,owner.cookie); assert.equal((await request("/auth/me",old)).status,401);
  });
  await t.test("create two merchants and switch active dashboard", async () => {
    const a=await request("/tenants",owner,"POST",{name:"M0 Merchant A"}); assert.equal(a.status,201);first=await a.json() as typeof first;
    const b=await request("/tenants",owner,"POST",{name:"M0 Merchant B"}); assert.equal(b.status,201);second=await b.json() as typeof second;
    const switched=await request(`/tenants/${first.id}/switch`,owner,"POST",{}); assert.equal(switched.status,201);
    const dashboard=await request("/dashboard",owner);assert.equal(dashboard.status,200);
    const body=await dashboard.json() as {tenant:{id:string};role:string};assert.equal(body.tenant.id,first.id);assert.equal(body.role,"OWNER");
    const list=await (await request("/tenants",owner)).json() as unknown[];assert.equal(list.length,2);
  });
  await t.test("Owner adds Manager and Staff; mass assignment cannot grant platform privilege", async () => {
    for(const [actor,role] of [[manager,"MANAGER"],[staff,"STAFF"]] as const) assert.equal((await request(`/tenants/${first.id}/members`,owner,"POST",{email:actor.email,role})).status,201);
    assert.equal((await request(`/tenants/${first.id}/members`,owner,"POST",{email:outsider.email,role:"OWNER"})).status,400);
    assert.equal((await request("/platform/overview",owner)).status,403);
  });
  await t.test("RBAC: Manager edits name and reads members; Staff cannot; only Owner manages memberships", async () => {
    assert.equal((await request(`/tenants/${first.id}`,manager,"PATCH",{name:"Managed merchant"})).status,200);
    assert.equal((await request(`/tenants/${first.id}/members`,manager)).status,200);
    assert.equal((await request(`/tenants/${first.id}/dashboard`,staff)).status,200);
    assert.equal((await request(`/tenants/${first.id}`,staff,"PATCH",{name:"forbidden"})).status,403);
    assert.equal((await request(`/tenants/${first.id}/members`,staff)).status,403);
    assert.equal((await request(`/tenants/${first.id}/members`,manager,"POST",{email:outsider.email,role:"STAFF"})).status,403);
  });
  await t.test("cross-tenant reads, writes, switching and forged tenantId are denied", async () => {
    for(const actor of [manager,staff,outsider]) {
      assert.equal((await request(`/tenants/${second.id}/dashboard`,actor)).status,403);
      assert.equal((await request(`/tenants/${second.id}`,actor,"PATCH",{name:"stolen"})).status,403);
      assert.equal((await request(`/tenants/${second.id}/switch`,actor,"POST",{})).status,403);
      const list=await (await request("/tenants",actor)).json() as Array<{tenant:{id:string}}>;
      assert.equal(list.some(m=>m.tenant.id===second.id),false);
    }
    assert.equal((await request(`/tenants/${first.id}`,manager,"PATCH",{name:"x",tenantId:second.id})).status,400);
    const response=await request(`/dashboard?tenantId=${second.id}`,owner);const body=await response.json() as {tenant:{id:string}};assert.equal(body.tenant.id,first.id);
  });
  await t.test("membership revocation is effective immediately even with active merchant cookie", async () => {
    assert.equal((await request(`/tenants/${first.id}/switch`,staff,"POST",{})).status,201);
    await data.db.membership.delete({where:{userId_tenantId:{userId:staff.id,tenantId:first.id}}});
    assert.equal((await request("/dashboard",staff)).status,403);
  });
  await t.test("platform permission is database-controlled", async () => {
    assert.equal((await request("/platform/overview",outsider)).status,403);
    await data.db.user.update({where:{id:outsider.id},data:{platformAdmin:true}});
    try { assert.equal((await request("/platform/overview",outsider)).status,200); }
    finally {await data.db.user.update({where:{id:outsider.id},data:{platformAdmin:false}});}
  });
  await t.test("expired sessions and logged-out cookie replay are rejected", async () => {
    const loggedOut={...owner};assert.equal((await request("/auth/logout",owner,"POST",{})).status,201);
    assert.equal((await request("/auth/me",loggedOut)).status,401);
    assert.equal((await request(`/tenants/${first.id}/dashboard`,loggedOut)).status,401);
    await data.db.session.updateMany({where:{userId:manager.id},data:{expiresAt:new Date(0)}});
    assert.equal((await request("/auth/me",manager)).status,401);
  });
});
