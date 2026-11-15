import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import type {OrderView,OrderQuote,PageResult,OrderHistoryView,OrderEventView} from "@nexora/shared";
import {Data} from "../src/app";
import {createAcceptanceApp} from "./support";
test("M1-C real PostgreSQL transactional order engine acceptance",async t=>{
 const app=await createAcceptanceApp();await app.listen(0,"127.0.0.1");t.after(()=>app.close());const base=await app.getUrl(),data=app.get(Data),suffix=randomUUID();
 type Actor={cookie:string;email:string;id:string};
 async function req(path:string,actor?:Actor,method="GET",body?:unknown,key?:string){return fetch(`${base}/api${path}`,{method,headers:{"content-type":"application/json","x-nexora-request":"1",...(actor?{cookie:actor.cookie}:{}),...(key?{"idempotency-key":key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});}
 async function register(label:string):Promise<Actor>{const email=`order-${label}-${suffix}@example.test`;const r=await req("/auth/register",undefined,"POST",{email,password:`Orders!${randomUUID()}`});assert.equal(r.status,201);return {email,id:(await r.json()as{id:string}).id,cookie:r.headers.get("set-cookie")!.split(";")[0]};}
 const owner=await register("owner"),manager=await register("manager"),staff=await register("staff"),customer=await register("customer"),otherCustomer=await register("other");
 const tenantA=(await(await req("/tenants",owner,"POST",{name:"Order merchant A"})).json()as{id:string}).id;
 const tenantB=(await(await req("/tenants",owner,"POST",{name:"Order merchant B"})).json()as{id:string}).id;
 for(const [actor,role]of[[manager,"MANAGER"],[staff,"STAFF"]]as const)assert.equal((await req(`/tenants/${tenantA}/members`,owner,"POST",{email:actor.email,role})).status,201);
 const a=`/tenants/${tenantA}/orders`,b=`/tenants/${tenantB}/orders`,catalog=`/tenants/${tenantA}/catalog`;
 const contact=(await(await req(`/tenants/${tenantA}/customers`,owner,"POST",{name:"Order contact",email:customer.email})).json()as{id:string}).id;
 const foreignContact=(await(await req(`/tenants/${tenantB}/customers`,owner,"POST",{name:"Foreign contact"})).json()as{id:string}).id;
 async function item(tenant:string,name:string,basePrice:string,currencyCode="MYR",status="ACTIVE"){const r=await req(`/tenants/${tenant}/catalog/items`,owner,"POST",{name,basePrice,currencyCode,status,sku:name.replaceAll(" ","-")});assert.equal(r.status,201);return(await r.json()as{id:string}).id;}
 const one=await item(tenantA,"First item","0.1000"),two=await item(tenantA,"Second item","0.2000"),foreign=await item(tenantB,"Foreign item","5"),usd=await item(tenantA,"USD item","1","USD"),inactive=await item(tenantA,"Unlisted item","1","MYR","DRAFT");
 const variant=(await(await req(`${catalog}/items/${two}/variants`,owner,"POST",{name:"Premium",sku:"VARIANT-SKU",price:"0.3333"})).json()as{id:string}).id;
 const input={contactId:contact,items:[{catalogItemId:one,quantity:3},{catalogItemId:two,quantity:2}],notes:"Private merchant note"};
 let order:OrderView;let replayKey:string;let quote:OrderQuote;
 await t.test("quote and create real multiple-item order, CRM link, snapshots and exact totals",async()=>{
  const q=await req(`${a}/quote`,manager,"POST",input);assert.equal(q.status,201);quote=await q.json()as OrderQuote;assert.equal(quote.grandTotal,"0.7000");assert.equal(quote.items[0].lineTotal,"0.3000");assert.equal(quote.contactNameSnapshot,"Order contact");
  replayKey=randomUUID();const r=await req(a,manager,"POST",{...input,quoteHash:quote.quoteHash},replayKey);assert.equal(r.status,201,await r.clone().text());order=await r.json()as OrderView;assert.equal(order.grandTotal,"0.7000");assert.equal(order.discountTotal,"0.0000");assert.equal(order.taxTotal,"0.0000");assert.equal(order.contactId,contact);assert.equal(order.version,1);assert.equal(order.status,"DRAFT");assert.equal(order.items[0].itemNameSnapshot,"First item");assert.equal(order.items[0].skuSnapshot,"FIRST-ITEM");assert.equal(await data.db.orderEvent.count({where:{tenantId:tenantA,orderId:order.id}}),1);
 });
 await t.test("large exact amounts round-trip through PostgreSQL beyond 20 significant digits",async()=>{
  const huge=await item(tenantA,"Large precision item","99999999999999.9999");const r=await req(a,owner,"POST",{items:[{catalogItemId:huge,quantity:10000},{catalogItemId:one,quantity:1}]},randomUUID());assert.equal(r.status,201);const row=await r.json()as OrderView;assert.equal(row.grandTotal,"999999999999999999.1000");const stored=await data.db.order.findUniqueOrThrow({where:{id:row.id}});assert.equal(stored.grandTotal.toFixed(4),row.grandTotal);
 });
 await t.test("idempotent replay returns original response, mismatch conflicts, actor and tenant scopes are separate",async()=>{
  const replay=await req(a,manager,"POST",{...input,quoteHash:quote.quoteHash},replayKey);assert.equal(replay.status,201);assert.deepEqual(await replay.json(),order);
  assert.equal((await req(a,manager,"POST",{...input,notes:"different"},replayKey)).status,409);
  const own=await req(a,owner,"POST",input,replayKey);assert.equal(own.status,201);assert.notEqual((await own.json()as OrderView).id,order.id);
  const other=await req(b,owner,"POST",{items:[{catalogItemId:foreign,quantity:1}]},replayKey);assert.equal(other.status,201);
  assert.equal(await data.db.idempotencyKey.count({where:{tenantId:tenantA,actorId:manager.id,key:replayKey}}),1);
 });
 await t.test("concurrent same-key requests create exactly one order/history/event",async()=>{
  const key=randomUUID();const calls=await Promise.all(Array.from({length:6},()=>req(a,owner,"POST",input,key)));assert.ok(calls.every(r=>r.status===201));const rows=await Promise.all(calls.map(r=>r.json()as Promise<OrderView>));assert.equal(new Set(rows.map(v=>v.id)).size,1);for(const row of rows)assert.deepEqual(row,rows[0]);
  assert.equal(await data.db.orderStatusHistory.count({where:{tenantId:tenantA,orderId:rows[0].id}}),1);assert.equal(await data.db.orderEvent.count({where:{tenantId:tenantA,orderId:rows[0].id}}),1);
 });
 await t.test("price/tenant/source/ownership injection rejected and failed creation is atomic",async()=>{
  const count=await data.db.order.count({where:{tenantId:tenantA}});const key=randomUUID();
  for(const extra of[{grandTotal:"0"},{subtotal:"0"},{discountTotal:"999"},{taxTotal:"0"},{tenantId:tenantB},{source:"CUSTOMER"},{customerUserId:customer.id}])assert.equal((await req(a,owner,"POST",{...input,...extra},key)).status,400);
  assert.equal((await req(a,owner,"POST",{items:[{catalogItemId:one,quantity:1,unitPriceSnapshot:"0"}]},key)).status,400);
  for(const payload of[{items:[{catalogItemId:foreign,quantity:1}]},{items:[{catalogItemId:inactive,quantity:1}]},{items:[{catalogItemId:one,quantity:1},{catalogItemId:usd,quantity:1}]},{...input,contactId:foreignContact},{items:[{catalogItemId:one,catalogVariantId:variant,quantity:1}]}])assert.ok([400,404].includes((await req(a,owner,"POST",payload,key)).status));
  assert.equal((await req(a,owner,"POST",input)).status,400);assert.equal(await data.db.order.count({where:{tenantId:tenantA}}),count);assert.equal(await data.db.idempotencyKey.count({where:{tenantId:tenantA,key}}),0);
  assert.equal((await req(a,owner,"POST",input,key)).status,201);
 });
 await t.test("snapshots survive catalog changes; note-only edits do not reprice; stale quotes conflict",async()=>{
  await req(`${catalog}/items/${one}`,owner,"PATCH",{name:"Renamed item",sku:"RENAMED-SKU",basePrice:"7.9999"});
  const current=await(await req(`${a}/${order.id}`,owner)).json()as OrderView;assert.equal(current.items[0].itemNameSnapshot,"First item");assert.equal(current.items[0].unitPriceSnapshot,"0.1000");
  const edited=await req(`${a}/${order.id}`,owner,"PATCH",{version:1,notes:"Edited note"});assert.equal(edited.status,200);order=await edited.json()as OrderView;assert.equal(order.grandTotal,"0.7000");assert.equal(order.version,2);
  assert.equal((await req(a,owner,"POST",{...input,quoteHash:quote.quoteHash},randomUUID())).status,409);
  const replay=await req(a,manager,"POST",{...input,quoteHash:quote.quoteHash},replayKey);assert.equal(replay.status,201);const original=await replay.json()as OrderView;assert.equal(original.grandTotal,"0.7000");assert.equal(original.version,1);
 });
 await t.test("draft replacement reprices selected variant; old revisions remain in audit",async()=>{
  const r=await req(`${a}/${order.id}`,manager,"PATCH",{version:2,items:[{catalogItemId:two,catalogVariantId:variant,quantity:3}],contactId:null});assert.equal(r.status,200);order=await r.json()as OrderView;assert.equal(order.grandTotal,"0.9999");assert.equal(order.contactId,null);assert.equal(order.items[0].skuSnapshot,"VARIANT-SKU");assert.equal(order.version,3);
  assert.equal((await req(`${catalog}/items/${two}/variants/${variant}`,owner,"DELETE")).status,409);
  const e=await(await req(`${a}/${order.id}/events`,staff)).json()as PageResult<OrderEventView>;assert.deepEqual(e.items.map(v=>v.type),["CREATED","UPDATED","UPDATED"]);const payload=e.items[2].payload as {before:OrderView;after:OrderView};assert.equal(payload.before.grandTotal,"0.7000");assert.equal(payload.after.grandTotal,"0.9999");
 });
 await t.test("state transitions require current version and reject invalid transitions",async()=>{
  assert.equal((await req(`${a}/${order.id}/complete`,owner,"POST",{version:3})).status,409);
  assert.equal((await req(`${a}/${order.id}/confirm`,owner,"POST",{})).status,400);
  const pending=await req(`${a}/${order.id}`,owner,"PATCH",{version:3,status:"PENDING",reason:"Reviewed"});assert.equal(pending.status,200);order=await pending.json()as OrderView;assert.equal(order.status,"PENDING");
  assert.equal((await req(`${a}/${order.id}`,owner,"PATCH",{version:4,notes:"Not a draft"})).status,409);
  const confirmed=await req(`${a}/${order.id}/confirm`,manager,"POST",{version:4,reason:"Accepted"});assert.equal(confirmed.status,201);order=await confirmed.json()as OrderView;
  assert.equal((await req(`${a}/${order.id}/cancel`,owner,"POST",{version:4})).status,409);
  const processing=await req(`${a}/${order.id}`,manager,"PATCH",{version:5,status:"PROCESSING"});assert.equal(processing.status,200);order=await processing.json()as OrderView;
  const completed=await req(`${a}/${order.id}/complete`,owner,"POST",{version:6,reason:"Delivered"});assert.equal(completed.status,201);order=await completed.json()as OrderView;assert.equal(order.status,"COMPLETED");assert.equal(order.version,7);
  for(const action of["confirm","complete","cancel"])assert.equal((await req(`${a}/${order.id}/${action}`,owner,"POST",{version:7})).status,409);
  assert.equal((await req(`${a}/${order.id}`,owner,"PATCH",{version:7,notes:"Locked"})).status,409);
 });
 await t.test("concurrent confirm/cancel requests have one winner and one version conflict",async()=>{
  const created=await(await req(a,owner,"POST",input,randomUUID())).json()as OrderView;
  const replies=await Promise.all([req(`${a}/${created.id}/confirm`,owner,"POST",{version:1}),req(`${a}/${created.id}/cancel`,manager,"POST",{version:1})]);assert.deepEqual(replies.map(v=>v.status).sort(),[201,409]);
  const updated=await(await req(`${a}/${created.id}`,staff)).json()as OrderView;assert.equal(updated.version,2);assert.ok(["CONFIRMED","CANCELLED"].includes(updated.status));assert.equal(await data.db.orderStatusHistory.count({where:{tenantId:tenantA,orderId:created.id}}),2);assert.equal(await data.db.orderEvent.count({where:{tenantId:tenantA,orderId:created.id}}),2);
  const cancelled=await(await req(a,owner,"POST",input,randomUUID())).json()as OrderView;assert.equal((await req(`${a}/${cancelled.id}/cancel`,owner,"POST",{version:1,reason:"Customer request"})).status,201);assert.equal((await req(`${a}/${cancelled.id}`,owner,"PATCH",{version:2,notes:"No"})).status,409);
 });
 await t.test("history is ordered, paginated, actor-attributed and matches committed transitions",async()=>{
  const h=await(await req(`${a}/${order.id}/history?pageSize=2`,staff)).json()as PageResult<OrderHistoryView>;assert.equal(h.total,5);assert.equal(h.items[0].fromStatus,null);assert.equal(h.items[0].toStatus,"DRAFT");assert.equal(h.items[1].toStatus,"PENDING");assert.deepEqual(Object.keys(h.items[0].actor).sort(),["email","id"]);
  const all=await(await req(`${a}/${order.id}/history?pageSize=100`,staff)).json()as PageResult<OrderHistoryView>;assert.deepEqual(all.items.map(v=>v.toStatus),["DRAFT","PENDING","CONFIRMED","PROCESSING","COMPLETED"]);assert.equal(all.items.at(-1)?.reason,"Delivered");assert.equal((await(await req(`${a}/${order.id}/events`,owner)).json()as PageResult<OrderEventView>).total,7);
  const list=await(await req(`${a}?q=${encodeURIComponent(order.orderNumber)}&status=COMPLETED&source=MERCHANT&pageSize=1`,staff)).json()as PageResult<OrderView>;assert.equal(list.total,1);assert.equal(list.items[0].id,order.id);
 });
 await t.test("RBAC, canonical tenant routes and active-tenant aliases never allow cross-tenant access",async()=>{
  assert.equal((await req(a)).status,401);assert.equal((await req(a,customer)).status,403);assert.equal((await req(a,staff,"POST",input,randomUUID())).status,403);assert.equal((await req(`${a}/quote`,staff,"POST",input)).status,403);
  for(const suffix of["","/history","/events"])assert.equal((await req(`${b}/${order.id}${suffix}`,owner)).status,404);
  assert.equal((await req(`${b}/${order.id}/cancel`,owner,"POST",{version:7})).status,404);assert.equal((await req(`${a}/${order.id}`,staff,"PATCH",{version:7,notes:"fake"})).status,403);
  assert.equal((await req(`${a}?tenantId=${tenantB}`,owner)).status,400);
  await req(`/tenants/${tenantB}/switch`,owner,"POST",{});assert.equal((await req(`/orders/${order.id}`,owner)).status,404);await req(`/tenants/${tenantA}/switch`,owner,"POST",{});assert.equal((await req(`/orders/${order.id}`,owner)).status,200);
  const aliased=await req("/orders",owner,"POST",input,randomUUID());assert.equal(aliased.status,201);assert.equal((await aliased.json()as OrderView).tenantId,tenantA);
 });
 await t.test("database foreign keys reject cross-tenant order lines, contacts, history and keys",async()=>{
  const predicate=(e:unknown)=>typeof e==="object"&&e!==null&&"code"in e&&e.code==="P2003";
  await assert.rejects(()=>data.db.orderItem.create({data:{tenantId:tenantB,orderId:order.id,position:99,catalogItemId:foreign,itemNameSnapshot:"Invalid",unitPriceSnapshot:"1",quantity:1,lineTotal:"1"}}),predicate);
  await assert.rejects(()=>data.db.orderStatusHistory.create({data:{tenantId:tenantB,orderId:order.id,actorId:owner.id,toStatus:"DRAFT",version:99}}),predicate);
  await assert.rejects(()=>data.db.idempotencyKey.create({data:{tenantId:tenantB,orderId:order.id,actorId:owner.id,key:randomUUID(),requestHash:"a".repeat(64),response:{}}}),predicate);
  await assert.rejects(()=>data.db.order.update({where:{id:order.id},data:{contactId:foreignContact}}),predicate);
 });
 await t.test("customer read foundation checks account ownership, never CRM email or bare order ID",async()=>{
  assert.equal((await req(`/customer/orders/${order.id}`,customer)).status,404);assert.equal((await req(`/customer/orders/${order.id}`)).status,401);assert.equal((await req(`/public/orders/${order.id}`)).status,404);
  const seed=await data.db.order.create({data:{tenantId:tenantA,createdById:owner.id,customerUserId:customer.id,source:"CUSTOMER",status:"PENDING",orderNumber:`TEST-${randomUUID().replaceAll("-","")}`,currencyCode:"MYR",subtotal:"1",grandTotal:"1",notes:"Do not expose private notes"}});
  await data.db.orderItem.create({data:{tenantId:tenantA,orderId:seed.id,position:0,catalogItemId:two,itemNameSnapshot:"Customer-owned fixture",skuSnapshot:"PRIVATE",unitPriceSnapshot:"1",quantity:1,lineTotal:"1"}});
  const positive=await req(`/customer/orders/${seed.id}`,customer);assert.equal(positive.status,200);const value=await positive.json()as Record<string,unknown>;for(const key of["tenantId","contactId","customerUserId","notes","createdById"])assert.equal(key in value,false);assert.equal(JSON.stringify(value).includes("PRIVATE"),false);
  assert.equal((await req(`/customer/orders/${seed.id}`,otherCustomer)).status,404);assert.equal((await req(`/customer/orders/${seed.id}`,owner)).status,404);assert.equal((await(await req("/customer/orders",customer)).json()as{total:number}).total,1);assert.equal((await req("/customer/orders?customerUserId="+customer.id,otherCustomer)).status,400);
  assert.equal((await req("/customer/orders",customer,"POST",input,randomUUID())).status,404);
 });
});
