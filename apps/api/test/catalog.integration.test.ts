import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import sharp from "sharp";
import type {CatalogItemView,PageResult} from "@nexora/shared";
import {Data} from "../src/app";
import {createAcceptanceApp as createApp} from "./support";
test("M1-B catalog PostgreSQL/security acceptance",async t=>{
 const app=await createApp();await app.listen(0,"127.0.0.1");const base=await app.getUrl();const data=app.get(Data);t.after(()=>app.close());const suffix=randomUUID();
 type Actor={cookie:string;email:string};async function req(path:string,actor?:Actor,method="GET",body?:unknown){return fetch(`${base}/api${path}`,{method,headers:{"content-type":"application/json","x-nexora-request":"1",...(actor?{cookie:actor.cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});}
 async function register(name:string):Promise<Actor>{const email=`catalog-${name}-${suffix}@example.test`;const r=await req("/auth/register",undefined,"POST",{email,password:`B!${randomUUID()}`});assert.equal(r.status,201);return {email,cookie:r.headers.get("set-cookie")!.split(";")[0]};}
 const owner=await register("owner"),manager=await register("manager"),staff=await register("staff"),outsider=await register("outsider");
 const tenantA=(await (await req("/tenants",owner,"POST",{name:"Catalog A"})).json() as {id:string}).id;const tenantB=(await (await req("/tenants",owner,"POST",{name:"Catalog B"})).json() as {id:string}).id;
 for(const [actor,role]of[[manager,"MANAGER"],[staff,"STAFF"]]as const)assert.equal((await req(`/tenants/${tenantA}/members`,owner,"POST",{email:actor.email,role})).status,201);
 const a=`/tenants/${tenantA}/catalog`,b=`/tenants/${tenantB}/catalog`,slug=`store-${suffix}`;let item:CatalogItemView,categoryId:string,mediaId:string,variantId:string;
 const png=await sharp({create:{width:16,height:16,channels:3,background:"blue"}}).png().toBuffer();
 async function upload(path:string,actor:Actor,buffer:Buffer,mime="image/png",name="test.png") {const form=new FormData();form.append("file",new Blob([new Uint8Array(buffer)],{type:mime}),name);form.append("altText","Catalog picture");return fetch(`${base}/api${path}`,{method:"POST",headers:{cookie:actor.cookie,"x-nexora-request":"1"},body:form});}
 await t.test("category CRUD, tenant uniqueness and exact-price item creation",async()=>{
  const c=await req(`${a}/categories`,owner,"POST",{name:"Treatments"});assert.equal(c.status,201);categoryId=(await c.json() as {id:string}).id;
  assert.equal((await req(`${a}/categories`,owner,"POST",{name:"TREATMENTS"})).status,409);assert.equal((await req(`${b}/categories`,owner,"POST",{name:"Treatments"})).status,201);
  const r=await req(`${a}/items`,manager,"POST",{name:"Massage 中文",description:"Raw text <script> is not HTML",itemType:"SERVICE",sku:"precision-1",currencyCode:"MYR",basePrice:"99999999999999.9999",categoryId});assert.equal(r.status,201);item=await r.json() as CatalogItemView;assert.equal(item.basePrice,"99999999999999.9999");assert.equal(item.status,"DRAFT");assert.equal(item.category?.id,categoryId);
  assert.equal((await req(`${a}/items`,owner,"POST",{name:"duplicate",sku:"PRECISION-1",basePrice:"1"})).status,409);assert.equal((await req(`${b}/items`,owner,"POST",{name:"same SKU different tenant",sku:"PRECISION-1",basePrice:"1"})).status,201);
  assert.equal((await req(`${a}/categories/${categoryId}`,owner,"PATCH",{name:"Wellness"})).status,200);assert.equal((await req(`${a}/categories/${categoryId}`,owner,"DELETE")).status,409);
 });
 await t.test("item updates, search/filter/pagination and variant price foundation",async()=>{
  const r=await req(`${a}/items/${item.id}`,manager,"PATCH",{basePrice:"0.1000",status:"ACTIVE"});assert.equal(r.status,200);assert.equal((await r.json() as CatalogItemView).basePrice,"0.1000");
  for(const itemType of["PRODUCT","DIGITAL","BUNDLE"])assert.equal((await req(`${a}/items`,owner,"POST",{name:`Foundation ${itemType}`,basePrice:"10.2500",itemType})).status,201);
  const result=await (await req(`${a}/items?q=massage&status=ACTIVE&itemType=SERVICE&categoryId=${categoryId}`,staff)).json() as PageResult<CatalogItemView>;assert.equal(result.total,1);assert.equal(result.items[0].id,item.id);
  const first=await (await req(`${a}/items?pageSize=2`,owner)).json() as PageResult<CatalogItemView>;const second=await (await req(`${a}/items?pageSize=2&page=2`,owner)).json() as PageResult<CatalogItemView>;assert.equal(first.total,4);assert.equal(new Set([...first.items,...second.items].map(v=>v.id)).size,4);
  const variant=await req(`${a}/items/${item.id}/variants`,manager,"POST",{name:"60 minutes",sku:"VAR-1",price:"0.2000"});assert.equal(variant.status,201);const v=await variant.json() as {id:string;price:string};variantId=v.id;assert.equal(v.price,"0.2000");
  assert.equal((await req(`${a}/items/${item.id}`,manager,"PATCH",{currencyCode:"USD"})).status,409);
  assert.equal((await req(`${a}/price-lists`,owner,"POST",{name:"Standard",currencyCode:"MYR"})).status,201);assert.equal((await req(`${a}/price-lists`,owner,"POST",{name:"STANDARD",currencyCode:"MYR"})).status,409);assert.equal((await req(`${b}/price-lists`,owner,"POST",{name:"Standard",currencyCode:"MYR"})).status,201);
 });
 await t.test("Staff read-only and nonmembers denied, including pre-upload authorization",async()=>{
  for(const path of["items","categories","store","price-lists"])assert.equal((await req(`${a}/${path}`,staff)).status,200);
  for(const [path,method,body]of[["items","POST",{name:"bad",basePrice:"1"}],[`items/${item.id}`,"PATCH",{name:"bad"}],[`items/${item.id}`,"DELETE",undefined],["categories","POST",{name:"bad"}],["store","PATCH",{slug,published:true}],["price-lists","POST",{name:"bad",currencyCode:"MYR"}],[`items/${item.id}/variants`,"POST",{name:"bad",price:"1"}]] as const)assert.equal((await req(`${a}/${path}`,staff,method,body)).status,403);
  assert.equal((await upload(`${a}/items/${item.id}/media`,staff,Buffer.alloc(3*1024*1024))).status,403);
  assert.equal((await req(`${a}/items`,outsider)).status,403);assert.equal((await req(`${a}/items`)).status,401);
 });
 await t.test("cross-tenant IDs, foreign keys, child resources and overposting rejected",async()=>{
  for(const [path,method,payload]of[[`items/${item.id}`,"GET",undefined],[`items/${item.id}`,"PATCH",{name:"cross"}],[`items/${item.id}`,"DELETE",undefined],[`items/${item.id}/variants`,"POST",{name:"cross",price:"1"}],[`categories/${categoryId}`,"PATCH",{name:"cross"}]]as const)assert.equal((await req(`${b}/${path}`,owner,method,payload)).status,404);
  assert.equal((await req(`${b}/items`,owner,"POST",{name:"bad category",basePrice:"1",categoryId})).status,404);
  assert.equal((await req(`${a}/items/${item.id}`,owner,"PATCH",{tenantId:tenantB})).status,400);assert.equal((await req(`${a}/items?tenantId=${tenantB}`,owner)).status,400);
  await assert.rejects(()=>data.db.catalogVariant.create({data:{tenantId:tenantB,itemId:item.id,name:"invalid",price:"1"}}),(e:unknown)=>typeof e==="object"&&e!==null&&"code"in e&&e.code==="P2003");
  await assert.rejects(()=>data.db.catalogMedia.create({data:{tenantId:tenantB,itemId:item.id,mimeType:"image/webp",content:new Uint8Array([1]),size:1,width:1,height:1}}),(e:unknown)=>typeof e==="object"&&e!==null&&"code"in e&&e.code==="P2003");
  await assert.rejects(()=>data.db.catalogItem.create({data:{tenantId:tenantB,categoryId,name:"invalid",basePrice:"1"}}),(e:unknown)=>typeof e==="object"&&e!==null&&"code"in e&&e.code==="P2003");
 });
 await t.test("sanitized image upload and content limits with scoped binary access",async()=>{
  const r=await upload(`${a}/items/${item.id}/media`,owner,png);assert.equal(r.status,201,r.status!==201?await r.text():undefined);const m=await r.json() as {id:string;mimeType:string;content?:unknown};mediaId=m.id;assert.equal(m.mimeType,"image/webp");assert.equal(m.content,undefined);
  const image=await req(`${a}/items/${item.id}/media/${mediaId}`,staff);assert.equal(image.status,200);assert.match(image.headers.get("content-type")!,/image\/webp/);assert.equal(image.headers.get("x-content-type-options"),"nosniff");assert.equal((await sharp(Buffer.from(await image.arrayBuffer())).metadata()).format,"webp");
  assert.equal((await req(`${b}/items/${item.id}/media/${mediaId}`,owner)).status,404);
  assert.equal((await upload(`${a}/items/${item.id}/media`,owner,Buffer.from("<svg/>"),"image/svg+xml","bad.svg")).status,400);
  assert.equal((await upload(`${a}/items/${item.id}/media`,owner,png,"image/jpeg","fake.jpg")).status,400);
  assert.equal((await upload(`${a}/items/${item.id}/media`,owner,png.subarray(0,20))).status,400);
  assert.equal((await upload(`${a}/items/${item.id}/media`,owner,Buffer.alloc(2*1024*1024+1))).status,413);
 });
 await t.test("public slug publication exposes only listed fields and ACTIVE variants/items",async()=>{
  assert.equal((await req(`/public/stores/${slug}/items`)).status,404);
  assert.equal((await req(`${a}/store`,owner,"PATCH",{slug,published:true})).status,200);
  assert.equal((await req(`${b}/store`,owner,"PATCH",{slug,published:true})).status,409);
  const r=await req(`/public/stores/${slug}/items`);assert.equal(r.status,200);const result=await r.json() as PageResult<CatalogItemView>;assert.equal(result.total,1);
  const serialized=JSON.stringify(result);for(const key of["tenantId","sku","deletedAt","catalogPublic","content","status"])assert.equal(serialized.includes(`"${key}"`),false);
  assert.equal(result.items[0].basePrice,"0.1000");assert.equal(result.items[0].variants[0].price,"0.2000");
  assert.equal((await req(`/public/stores/${slug}/items?status=DRAFT`)).status,400);
  assert.equal((await req(`/public/stores/${slug}/media/${mediaId}`)).status,200);
  await req(`${a}/items/${item.id}/variants/${variantId}`,owner,"PATCH",{active:false});const detail=await (await req(`/public/stores/${slug}/items/${item.id}`)).json() as CatalogItemView;assert.deepEqual(detail.variants,[]);
  await req(`${a}/items/${item.id}`,owner,"PATCH",{status:"DRAFT"});assert.equal((await req(`/public/stores/${slug}/items/${item.id}`)).status,404);assert.equal((await req(`/public/stores/${slug}/media/${mediaId}`)).status,404);
  await req(`${a}/items/${item.id}`,owner,"PATCH",{status:"ACTIVE"});await req(`${a}/store`,owner,"PATCH",{slug,published:false});assert.equal((await req(`/public/stores/${slug}/items`)).status,404);await req(`${a}/store`,owner,"PATCH",{slug,published:true});
 });
 await t.test("image cap serializes concurrent uploads; deletion hides images and items",async()=>{
  for(let i=0;i<8;i++)assert.equal((await upload(`${a}/items/${item.id}/media`,manager,png)).status,201);
  const final=await Promise.all([upload(`${a}/items/${item.id}/media`,manager,png),upload(`${a}/items/${item.id}/media`,manager,png)]);assert.deepEqual(final.map(r=>r.status).sort(),[201,400]);assert.equal(await data.db.catalogMedia.count({where:{tenantId:tenantA,itemId:item.id}}),10);
  assert.equal((await req(`${a}/items/${item.id}/media/${mediaId}`,manager,"DELETE")).status,200);assert.equal((await req(`/public/stores/${slug}/media/${mediaId}`)).status,404);
  assert.equal((await req(`${a}/items/${item.id}/variants/${variantId}`,owner,"DELETE")).status,200);assert.equal((await req(`${a}/items/${item.id}`,owner,"DELETE")).status,200);assert.equal((await req(`${a}/items/${item.id}`,owner)).status,404);assert.equal((await req(`/public/stores/${slug}/items/${item.id}`)).status,404);
  const retained=await data.db.catalogItem.findUniqueOrThrow({where:{id:item.id}});assert.ok(retained.deletedAt);assert.equal(retained.status,"ARCHIVED");
  const c=await req(`${a}/categories`,owner,"POST",{name:"unused"});const id=(await c.json() as {id:string}).id;assert.equal((await req(`${a}/categories/${id}`,owner,"DELETE")).status,200);
 });
});
