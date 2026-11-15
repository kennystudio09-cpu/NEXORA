import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import sharp from "sharp";
import type {CustomerOrderView,CustomerQuote,OrderView} from "@nexora/shared";
import {Data} from "../src/app";
import {createAcceptanceApp} from "./support";
test("M1-D real PostgreSQL customer storefront acceptance",async t=>{
 const app=await createAcceptanceApp();await app.listen(0,"127.0.0.1");t.after(()=>app.close());const base=await app.getUrl(),data=app.get(Data),suffix=randomUUID();
 type Actor={cookie:string;email:string;id:string};
 async function req(path:string,actor?:Actor,method="GET",body?:unknown,key?:string){return fetch(`${base}/api${path}`,{method,headers:{"content-type":"application/json","x-nexora-request":"1",...(actor?{cookie:actor.cookie}:{}),...(key?{"idempotency-key":key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});}
 async function register(label:string):Promise<Actor>{const email=`shop-${label}-${suffix}@example.test`;const r=await req("/auth/register",undefined,"POST",{email,password:`Shop!${randomUUID()}`});assert.equal(r.status,201);return {email,id:(await r.json()as{id:string}).id,cookie:r.headers.get("set-cookie")!.split(";")[0]};}
 const owner=await register("owner"),buyer=await register("buyer"),other=await register("other"),staff=await register("staff"),manager=await register("manager");
 const tenantA=(await(await req("/tenants",owner,"POST",{name:"Internal merchant A"})).json()as{id:string}).id,tenantB=(await(await req("/tenants",owner,"POST",{name:"Merchant B"})).json()as{id:string}).id;
 const slug=`shop-${suffix}`,slugB=`other-${suffix}`,a=`/tenants/${tenantA}`,b=`/tenants/${tenantB}`,pub=`/public/stores/${slug}`,checkout=`/customer/stores/${slug}/orders`;
 for(const [actor,role]of[[staff,"STAFF"],[manager,"MANAGER"]]as const)assert.equal((await req(`${a}/members`,owner,"POST",{email:actor.email,role})).status,201);
 for(const [base,storeSlug]of[[a,slug],[b,slugB]])assert.equal((await req(`${base}/catalog/store`,owner,"PATCH",{slug:storeSlug,published:true})).status,200);
 async function item(base:string,name:string,price:string,status="ACTIVE",itemType="PRODUCT"){const r=await req(`${base}/catalog/items`,owner,"POST",{name,basePrice:price,status,itemType,sku:`PRIVATE-${name}`});assert.equal(r.status,201);return(await r.json()as{id:string}).id;}
 const one=await item(a,"Product","0.1000"),two=await item(a,"Service","0.2000","ACTIVE","SERVICE"),foreign=await item(b,"Foreign","9"),inactive=await item(a,"Hidden","1","DRAFT"),digital=await item(a,"Digital","1","ACTIVE","DIGITAL"),bundle=await item(a,"Bundle","1","ACTIVE","BUNDLE");
 const input={displayName:"Customer buyer",customerNote:"Please call on arrival",items:[{catalogItemId:one,quantity:3},{catalogItemId:two,quantity:2}]};let order:CustomerOrderView,key:string,quote:CustomerQuote;
 const existing=(await(await req(`${a}/customers`,owner,"POST",{name:"Existing matching email",email:buyer.email})).json()as{id:string}).id;
 await t.test("public profile whitelist, private shops, category scope and profile RBAC",async()=>{
  assert.equal((await req(`${a}/storefront`,buyer)).status,403);assert.equal((await req(`${a}/storefront`,staff,"PATCH",{displayName:"Hijack"})).status,403);
  assert.equal((await req(`${a}/storefront`,manager,"PATCH",{displayName:"Public merchant",description:"Real store introduction",address:"KL",businessHours:"Mon–Fri 9–5",phone:"+60 123456789",email:"shop@example.test"})).status,200);
  const view=await(await req(`${pub}/profile`)).json()as Record<string,unknown>;assert.equal(view.name,"Public merchant");assert.equal(view.description,"Real store introduction");assert.equal(view.hasLogo,false);for(const k of["tenantId","id","members","catalogPublic","logoData"])assert.ok(!(k in view));assert.notEqual(view.storefrontKey,tenantA);
  assert.equal((await req(`${b}/storefront`,manager)).status,403);assert.equal((await req(`/public/stores/missing-${suffix}/profile`)).status,404);
  const cat=(await(await req(`${a}/catalog/categories`,owner,"POST",{name:"Public category"})).json()as{id:string}).id;await req(`${a}/catalog/items/${one}`,owner,"PATCH",{categoryId:cat});const categories=await(await req(`${pub}/categories`)).json()as Array<{id:string}>;assert.deepEqual(categories.map(v=>v.id),[cat]);
 });
 await t.test("logo enforces RBAC, type/size/content validation and sanitized public response",async()=>{
  const image=await sharp({create:{width:24,height:24,channels:3,background:"#00aaaa"}}).png().toBuffer();
  async function upload(actor:Actor,bytes:Uint8Array,type:string){const form=new FormData();form.set("file",new Blob([new Uint8Array(bytes)],{type}),"logo.png");return fetch(`${base}/api${a}/storefront/logo`,{method:"POST",headers:{"x-nexora-request":"1",cookie:actor.cookie},body:form});}
  assert.equal((await upload(staff,image,"image/png")).status,403);assert.equal((await upload(owner,new TextEncoder().encode("<svg onload='alert(1)'/>"),"image/png")).status,400);assert.equal((await upload(owner,new Uint8Array(2*1024*1024+1),"image/png")).status,413);
  assert.equal((await upload(manager,image,"image/png")).status,201);const logo=await req(`${pub}/logo`);assert.equal(logo.status,200);assert.equal(logo.headers.get("content-type"),"image/webp");assert.match(logo.headers.get("content-security-policy")!,/sandbox/);const meta=await sharp(Buffer.from(await logo.arrayBuffer())).metadata();assert.equal(meta.format,"webp");assert.equal(meta.width,24);
  assert.equal((await req(`${a}/storefront/logo`,staff,"DELETE")).status,403);assert.equal((await req(`${a}/storefront/logo`,owner,"DELETE")).status,200);assert.equal((await req(`${pub}/logo`)).status,404);
 });
 await t.test("public exact quote, server-priced checkout, tenant-scoped account CRM and snapshots",async()=>{
  const r=await req(`${pub}/quote`,undefined,"POST",{items:input.items});assert.equal(r.status,201);quote=await r.json()as CustomerQuote;assert.equal(quote.grandTotal,"0.7000");assert.ok(!JSON.stringify(quote).includes("PRIVATE"));assert.ok(!("contactNameSnapshot"in quote));
  key=randomUUID();const c=await req(checkout,buyer,"POST",{...input,quoteHash:quote.quoteHash},key);assert.equal(c.status,201,await c.clone().text());order=await c.json()as CustomerOrderView;assert.equal(order.status,"PENDING");assert.equal(order.paymentStatus,"UNPAID");assert.equal(order.sourceChannel,"customer_portal");assert.equal(order.grandTotal,"0.7000");assert.equal(order.storeName,"Public merchant");assert.equal(order.customerNote,input.customerNote);
  for(const hidden of["tenantId","contactId","notes","customerUserId","createdById","skuSnapshot"])assert.ok(!JSON.stringify(order).includes(`"${hidden}"`));
  const stored=await data.db.order.findUniqueOrThrow({where:{id:order.id}});assert.equal(stored.customerUserId,buyer.id);assert.equal(stored.source,"CUSTOMER");assert.notEqual(stored.contactId,existing);const link=await data.db.customerAccountLink.findUniqueOrThrow({where:{tenantId_userId:{tenantId:tenantA,userId:buyer.id}}});assert.equal(stored.contactId,link.contactId);assert.equal((await data.db.customer.findUniqueOrThrow({where:{id:existing}})).name,"Existing matching email");
 });
 await t.test("own-account authorization, private order whitelist, employee permissions and state linkage",async()=>{
  assert.equal((await req(`/customer/orders/${order.id}`)).status,401);assert.equal((await req(`/customer/orders/${order.id}`,other)).status,404);assert.equal((await req(`/customer/orders/${order.id}?phone=123`,other)).status,404);assert.equal((await req(`/customer/orders/${order.id}`,owner)).status,404);
  assert.equal((await req(`/customer/orders/${order.id}`,buyer)).status,200);assert.equal((await req(`${a}/orders/${order.id}`,buyer)).status,403);assert.equal((await req(`${b}/orders/${order.id}`,owner)).status,404);assert.equal((await req(`${a}/orders/${order.id}/confirm`,staff,"POST",{version:1})).status,403);
  assert.equal((await req(`${a}/orders/${order.id}/confirm`,manager,"POST",{version:1})).status,201);const row=await(await req(`/customer/orders/${order.id}`,buyer)).json()as CustomerOrderView;assert.equal(row.status,"CONFIRMED");assert.equal(row.paymentStatus,"UNPAID");const own=await(await req("/customer/orders",buyer)).json()as{items:CustomerOrderView[]};assert.ok(own.items.some(v=>v.id===order.id));const otherList=await(await req("/customer/orders",other)).json()as{total:number};assert.equal(otherList.total,0);
 });
 await t.test("cross-tenant cart, inactive products, unsupported fulfillment and all injected authorities rejected atomically",async()=>{
  const before=await data.db.order.count({where:{tenantId:tenantA}});const invalid=[foreign,inactive,digital,bundle];for(const id of invalid)assert.ok([400,404].includes((await req(checkout,other,"POST",{...input,items:[{catalogItemId:id,quantity:1}]},randomUUID())).status));
  for(const fields of[{tenantId:tenantB},{contactId:existing},{customerUserId:other.id},{source:"MERCHANT"},{grandTotal:"0"},{paymentStatus:"PAID"}])assert.equal((await req(checkout,buyer,"POST",{...input,...fields},randomUUID())).status,400);
  assert.equal((await req(checkout,buyer,"POST",{...input,items:[{catalogItemId:one,quantity:1,price:"0"}]},randomUUID())).status,400);assert.equal((await req(checkout,undefined,"POST",input,randomUUID())).status,401);assert.equal((await req(checkout,buyer,"POST",input)).status,400);assert.equal(await data.db.order.count({where:{tenantId:tenantA}}),before);assert.equal(await data.db.customerAccountLink.count({where:{tenantId:tenantA,userId:other.id}}),0);
 });
 await t.test("concurrent idempotent checkout creates one order; original safe response survives state updates",async()=>{
  const replay=await req(checkout,buyer,"POST",{...input,quoteHash:quote.quoteHash},key);assert.equal(replay.status,201);assert.deepEqual(await replay.json(),order);assert.equal((await req(checkout,buyer,"POST",{...input,displayName:"changed"},key)).status,409);
  const sameKey=randomUUID(),calls=await Promise.all(Array.from({length:4},()=>req(checkout,buyer,"POST",input,sameKey)));assert.ok(calls.every(v=>v.status===201));const rows=await Promise.all(calls.map(v=>v.json()as Promise<CustomerOrderView>));assert.equal(new Set(rows.map(v=>v.id)).size,1);assert.equal(await data.db.orderStatusHistory.count({where:{orderId:rows[0].id}}),1);
  const two=await Promise.all([req(checkout,other,"POST",input,randomUUID()),req(checkout,other,"POST",input,randomUUID())]);assert.ok(two.every(v=>v.status===201));assert.equal(await data.db.customerAccountLink.count({where:{tenantId:tenantA,userId:other.id}}),1);
 });
 await t.test("customer variant pricing stays exact and CRM mappings are tenant-scoped",async()=>{
  const v=await req(`${a}/catalog/items/${two}/variants`,owner,"POST",{name:"Customer premium",price:"0.3333",sku:"PRIVATE-PREMIUM"});assert.equal(v.status,201);const variant=(await v.json()as{id:string}).id;
  const payload={displayName:"Variant buyer",items:[{catalogItemId:two,catalogVariantId:variant,quantity:3}]};const response=await req(checkout,buyer,"POST",payload,randomUUID());assert.equal(response.status,201);const receipt=await response.json()as CustomerOrderView;assert.equal(receipt.grandTotal,"0.9999");assert.equal(receipt.items[0].variantNameSnapshot,"Customer premium");assert.ok(!JSON.stringify(receipt).includes("PRIVATE"));
  const second=await req(`/customer/stores/${slugB}/orders`,buyer,"POST",{displayName:"Same buyer",items:[{catalogItemId:foreign,quantity:1}]},randomUUID());assert.equal(second.status,201);const links=await data.db.customerAccountLink.findMany({where:{userId:buyer.id}});assert.equal(links.length,2);assert.equal(new Set(links.map(v=>v.contactId)).size,2);
  const wrong=links.find(v=>v.tenantId===tenantB)!;await assert.rejects(()=>data.db.customerAccountLink.update({where:{tenantId_userId:{tenantId:tenantA,userId:buyer.id}},data:{contactId:wrong.contactId}}),(e:unknown)=>typeof e==="object"&&e!==null&&"code"in e&&e.code==="P2003");
 });
 await t.test("idempotency operation separation prevents merchant response replay into customer route",async()=>{
  const sharedKey=randomUUID();const merchant=await req(`${a}/orders`,owner,"POST",{items:input.items},sharedKey);assert.equal(merchant.status,201);assert.equal((await req(checkout,owner,"POST",input,sharedKey)).status,409);
  const ckey=randomUUID();assert.equal((await req(checkout,owner,"POST",input,ckey)).status,201);assert.equal((await req(`${a}/orders`,owner,"POST",{items:input.items},ckey)).status,409);
 });
 await t.test("stale quote and delisted item reject new checkout; unpublished store allows only original receipt replay",async()=>{
  await req(`${a}/catalog/items/${one}`,owner,"PATCH",{basePrice:"7.9999"});assert.equal((await req(checkout,buyer,"POST",{...input,quoteHash:quote.quoteHash},randomUUID())).status,409);
  await req(`${a}/catalog/items/${one}`,owner,"PATCH",{status:"ARCHIVED"});assert.equal((await req(checkout,buyer,"POST",input,randomUUID())).status,400);assert.equal((await req(`${pub}/items/${one}`)).status,404);
  await req(`${a}/catalog/store`,owner,"PATCH",{slug,published:false});assert.equal((await req(`${pub}/profile`)).status,404);assert.equal((await req(`${pub}/quote`,undefined,"POST",{items:input.items})).status,404);assert.equal((await req(checkout,buyer,"POST",input,randomUUID())).status,404);const replay=await req(checkout,buyer,"POST",{...input,quoteHash:quote.quoteHash},key);assert.equal(replay.status,201);assert.deepEqual(await replay.json(),order);assert.equal((await req(`/customer/orders/${order.id}`,buyer)).status,200);
  await req("/auth/logout",buyer,"POST",{});assert.equal((await req(`/customer/orders/${order.id}`,buyer)).status,401);
 });
});
