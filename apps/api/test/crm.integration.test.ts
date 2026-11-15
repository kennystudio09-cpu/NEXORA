import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { CustomerRecord, CustomerFollowUpRecord, PageResult } from "@nexora/shared";
import { Data } from "../src/app";
import { createAcceptanceApp as createApp } from "./support";

test("M1-A CRM real PostgreSQL tenant and role acceptance",async t=>{
  const app=await createApp();await app.listen(0,"127.0.0.1");const base=await app.getUrl();const data=app.get(Data);t.after(()=>app.close());
  const suffix=randomUUID();const password=`Crm!${randomUUID()}`;
  type Actor={cookie:string;email:string;id:string};
  async function request(path:string,actor?:Actor,method="GET",body?:unknown){return fetch(`${base}/api${path}`,{method,headers:{"content-type":"application/json","x-nexora-request":"1",...(actor?{cookie:actor.cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});}
  async function register(name:string):Promise<Actor>{
    const email=`crm-${name}-${suffix}@example.test`;const res=await request("/auth/register",undefined,"POST",{email,password});assert.equal(res.status,201);
    const body=await res.json() as {id:string};return {email,id:body.id,cookie:res.headers.get("set-cookie")!.split(";")[0]};
  }
  const owner=await register("owner"),manager=await register("manager"),staff=await register("staff"),customerAccount=await register("customer");
  const a=await request("/tenants",owner,"POST",{name:`CRM A ${suffix}`});assert.equal(a.status,201);const tenantA=(await a.json() as {id:string}).id;
  const b=await request("/tenants",owner,"POST",{name:`CRM B ${suffix}`});assert.equal(b.status,201);const tenantB=(await b.json() as {id:string}).id;
  for(const [actor,role] of [[manager,"MANAGER"],[staff,"STAFF"]] as const)assert.equal((await request(`/tenants/${tenantA}/members`,owner,"POST",{email:actor.email,role})).status,201);
  const pathA=`/tenants/${tenantA}/customers`,pathB=`/tenants/${tenantB}/customers`;
  let contact:CustomerRecord;
  await t.test("Owner creates tenant-bound contact without creating staff membership or linking account",async()=>{
    const res=await request(pathA,owner,"POST",{name:"Aisyah CRM",email:customerAccount.email,phone:"+60 12-345 6789",tags:["VIP","vip"],notes:"Prefers WhatsApp",status:"ACTIVE"});assert.equal(res.status,201);contact=await res.json() as CustomerRecord;
    assert.equal(contact.tenantId,tenantA);assert.deepEqual(contact.tags,["vip"]);assert.equal(contact.notes,"Prefers WhatsApp");
    assert.equal(await data.db.membership.count({where:{tenantId:tenantA,userId:customerAccount.id}}),0);
    assert.equal((await request(pathA,customerAccount)).status,403);
  });
  await t.test("Manager edits contacts, tags and notes; nullable fields can be cleared",async()=>{
    const res=await request(`${pathA}/${contact.id}`,manager,"PATCH",{name:"Aisyah Updated",email:null,phone:"",tags:["VIP","Retail"],notes:"Discussed renewal"});assert.equal(res.status,200);
    const updated=await res.json() as CustomerRecord;assert.equal(updated.email,null);assert.equal(updated.phone,null);assert.deepEqual(updated.tags,["vip","retail"]);assert.equal(updated.name,"Aisyah Updated");
    assert.equal((await request(pathA,manager,"POST",{name:"Manager-created customer",status:"INACTIVE",tags:["other"]})).status,201);
    assert.equal((await request(pathA,owner,"POST",{name:"Lead customer",status:"LEAD",tags:["vip"]})).status,201);
  });
  await t.test("search, tag/status filters, accurate totals and stable disjoint pages",async()=>{
    const filtered=await (await request(`${pathA}?q=aisyah&status=ACTIVE&tag=VIP`,staff)).json() as PageResult<CustomerRecord>;
    assert.equal(filtered.total,1);assert.equal(filtered.items[0].id,contact.id);
    const first=await (await request(`${pathA}?page=1&pageSize=2`,owner)).json() as PageResult<CustomerRecord>;
    const second=await (await request(`${pathA}?page=2&pageSize=2`,owner)).json() as PageResult<CustomerRecord>;
    assert.equal(first.total,3);assert.equal(first.totalPages,2);assert.equal(first.items.length,2);assert.equal(second.items.length,1);
    assert.equal(new Set([...first.items,...second.items].map(c=>c.id)).size,3);
    const empty=await (await request(`${pathA}?q=does-not-exist`,owner)).json() as PageResult<CustomerRecord>;assert.equal(empty.total,0);assert.deepEqual(empty.items,[]);
  });
  await t.test("Staff may read and append follow-ups, but cannot create/edit customer profiles",async()=>{
    assert.equal((await request(`${pathA}/${contact.id}`,staff)).status,200);
    assert.equal((await request(pathA,staff,"POST",{name:"Forbidden"})).status,403);
    assert.equal((await request(`${pathA}/${contact.id}`,staff,"PATCH",{notes:"Forbidden"})).status,403);
    for(const actor of [owner,manager,staff]){const res=await request(`${pathA}/${contact.id}/follow-ups`,actor,"POST",{content:`Followed up as ${actor.id}`});assert.equal(res.status,201);const record=await res.json() as CustomerFollowUpRecord;assert.equal(record.authorId,actor.id);assert.equal(record.tenantId,tenantA);assert.equal(record.customerId,contact.id);assert.deepEqual(Object.keys(record.author).sort(),["email","id"]);}
    const history=await (await request(`${pathA}/${contact.id}/follow-ups?pageSize=2`,staff)).json() as PageResult<CustomerFollowUpRecord>;assert.equal(history.total,3);assert.equal(history.items.length,2);assert.equal(history.totalPages,2);
    const next=await (await request(`${pathA}/${contact.id}/follow-ups?pageSize=2&page=2`,staff)).json() as PageResult<CustomerFollowUpRecord>;assert.equal(next.items.length,1);
  });
  await t.test("tenant B cannot enumerate, read, edit or append tenant A contact even for same owner",async()=>{
    const list=await (await request(pathB,owner)).json() as PageResult<CustomerRecord>;assert.equal(list.total,0);
    assert.equal((await request(`${pathB}/${contact.id}`,owner)).status,404);
    assert.equal((await request(`${pathB}/${contact.id}`,owner,"PATCH",{name:"Wrong tenant"})).status,404);
    assert.equal((await request(`${pathB}/${contact.id}/follow-ups`,owner)).status,404);
    assert.equal((await request(`${pathB}/${contact.id}/follow-ups`,owner,"POST",{content:"Wrong tenant"})).status,404);
    for(const actor of [manager,staff,customerAccount]){
      assert.equal((await request(pathB,actor)).status,403);
      assert.equal((await request(`${pathB}/${contact.id}`,actor)).status,403);
      assert.equal((await request(`${pathB}/${contact.id}/follow-ups`,actor,"POST",{content:"forbidden"})).status,403);
    }
    const unchanged=await data.db.customer.findUniqueOrThrow({where:{id:contact.id}});assert.equal(unchanged.name,"Aisyah Updated");assert.equal(unchanged.tenantId,tenantA);
  });
  await t.test("overposting and forged query/body identities are rejected without changing records",async()=>{
    for(const payload of [{tenantId:tenantB},{tenant_id:tenantB},{id:randomUUID()},{status:"OWNER"},{email:"invalid"}])assert.equal((await request(`${pathA}/${contact.id}`,owner,"PATCH",payload)).status,400);
    assert.equal((await request(`${pathA}?tenantId=${tenantB}`,owner)).status,400);
    assert.equal((await request(`${pathA}?pageSize=101`,owner)).status,400);
    assert.equal((await request(`${pathA}?page=1&page=2`,owner)).status,400);
    for(const payload of [{content:"x",tenantId:tenantB},{content:"x",authorId:owner.id},{content:"x",occurredAt:"2000-01-01"}])assert.equal((await request(`${pathA}/${contact.id}/follow-ups`,staff,"POST",payload)).status,400);
  });
  await t.test("database composite foreign key independently prevents a cross-tenant follow-up",async()=>{
    await assert.rejects(()=>data.db.customerFollowUp.create({data:{tenantId:tenantB,customerId:contact.id,authorId:owner.id,content:"Invalid composite relation"}}),(error:unknown)=>typeof error==="object"&&error!==null&&"code" in error&&error.code==="P2003");
    assert.equal(await data.db.customerFollowUp.count({where:{tenantId:tenantB,customerId:contact.id}}),0);
  });
  await t.test("membership revocation, missing auth and logout immediately block CRM",async()=>{
    await data.db.membership.delete({where:{userId_tenantId:{userId:staff.id,tenantId:tenantA}}});
    assert.equal((await request(pathA,staff)).status,403);
    assert.equal((await request(`${pathA}/${contact.id}/follow-ups`,staff,"POST",{content:"revoked"})).status,403);
    assert.equal((await request(pathA)).status,401);
    assert.equal((await request("/auth/logout",manager,"POST",{})).status,201);
    assert.equal((await request(`${pathA}/${contact.id}`,manager)).status,401);
  });
});
