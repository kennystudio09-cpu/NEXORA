import {Injectable,Inject,NotFoundException,BadRequestException,ConflictException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import {Prisma} from "@nexora/database";
import type {OrderStatusValue,OrderView,OrderQuote,CustomerQuote,CustomerOrderView} from "@nexora/shared";
import {Data} from "./data";
import {createInput,editInput,changeInput,idempotencyKey,listQuery,assertTransition,type CreateOrderInput} from "./orders.validation";
import {cartInput,checkoutInput} from "./storefront.validation";
import {totals} from "./orders.money";
const include={items:{orderBy:{position:"asc" as const}}};
type OrderRow=Prisma.OrderGetPayload<{include:typeof include}>;
const digest=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
@Injectable()
export class OrdersService {
 constructor(@Inject(Data) readonly data:Data){}
 dto(row:OrderRow):OrderView{return {id:row.id,tenantId:row.tenantId,orderNumber:row.orderNumber,contactId:row.contactId,contactNameSnapshot:row.contactNameSnapshot,source:row.source,sourceChannel:row.sourceChannel??(row.source==="CUSTOMER"?"customer_portal":"merchant"),paymentStatus:row.paymentStatus,customerNote:row.customerNote,status:row.status,version:row.version,currencyCode:row.currencyCode,subtotal:row.subtotal.toFixed(4),discountTotal:row.discountTotal.toFixed(4),taxTotal:row.taxTotal.toFixed(4),grandTotal:row.grandTotal.toFixed(4),notes:row.notes,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),items:row.items.map(v=>({id:v.id,position:v.position,catalogItemId:v.catalogItemId,catalogVariantId:v.catalogVariantId,itemNameSnapshot:v.itemNameSnapshot,variantNameSnapshot:v.variantNameSnapshot,skuSnapshot:v.skuSnapshot,unitPriceSnapshot:v.unitPriceSnapshot.toFixed(4),quantity:v.quantity,lineTotal:v.lineTotal.toFixed(4)}))};}
 async row(tx:Prisma.TransactionClient,tenantId:string,id:string){const row=await tx.order.findUnique({where:{tenantId_id:{tenantId,id}},include});if(!row)throw new NotFoundException("Order not found");return row;}
 async contact(tx:Prisma.TransactionClient,tenantId:string,id:string|null){if(!id)return null;const contact=await tx.customer.findUnique({where:{tenantId_id:{tenantId,id}},select:{name:true}});if(!contact)throw new NotFoundException("Contact not found");return contact.name;}
 async prices(tx:Prisma.TransactionClient,tenantId:string,input:CreateOrderInput,publicOnly=false):Promise<OrderQuote>{
  const ids=[...new Set(input.items.map(v=>v.catalogItemId))].sort();
  await tx.$queryRaw`SELECT id FROM "CatalogItem" WHERE tenant_id = ${tenantId} AND id IN (${Prisma.join(ids)}) ORDER BY id FOR SHARE`;
  const variantIds=input.items.map(v=>v.catalogVariantId).filter((v):v is string=>Boolean(v)).sort();
  if(variantIds.length)await tx.$queryRaw`SELECT id FROM "CatalogVariant" WHERE tenant_id = ${tenantId} AND id IN (${Prisma.join(variantIds)}) ORDER BY id FOR SHARE`;
  const items=await tx.catalogItem.findMany({where:{tenantId,id:{in:ids},status:"ACTIVE",deletedAt:null},select:{id:true,name:true,sku:true,currencyCode:true,basePrice:true,itemType:true}});
  const variants=variantIds.length?await tx.catalogVariant.findMany({where:{tenantId,id:{in:variantIds},active:true}}):[];
  const name=await this.contact(tx,tenantId,input.contactId);
  const currencies=new Set(items.map(v=>v.currencyCode));if(items.length!==ids.length||currencies.size!==1)throw new BadRequestException("Use available items in one currency");
  if(publicOnly&&items.some(v=>v.itemType!=="PRODUCT"&&v.itemType!=="SERVICE"))throw new BadRequestException("Digital delivery and bundles are not available for checkout");
  const snapshots=input.items.map((line,position)=>{const item=items.find(v=>v.id===line.catalogItemId)!;const variant=line.catalogVariantId?variants.find(v=>v.id===line.catalogVariantId&&v.itemId===item.id):null;if(line.catalogVariantId&&!variant)throw new BadRequestException("Variant unavailable");return {catalogItemId:item.id,catalogVariantId:variant?.id??null,position,itemNameSnapshot:item.name,variantNameSnapshot:variant?.name??null,skuSnapshot:variant?.sku??item.sku,unitPriceSnapshot:(variant?.price??item.basePrice).toFixed(4),quantity:line.quantity};});
  const amounts=totals(snapshots.map(v=>({unitPrice:v.unitPriceSnapshot,quantity:v.quantity})));
  const result={currencyCode:items[0].currencyCode,subtotal:amounts.subtotal,discountTotal:amounts.discountTotal,taxTotal:amounts.taxTotal,grandTotal:amounts.grandTotal,contactNameSnapshot:name,items:snapshots.map((v,i)=>({...v,lineTotal:amounts.lineTotals[i]}))};
  return {...result,quoteHash:digest({contactId:input.contactId,...result})};
 }
 quote(tenantId:string,value:unknown){const input=createInput(value);return this.data.db.$transaction(tx=>this.prices(tx,tenantId,input),{timeout:15000});}
 async create(tenantId:string,actorId:string,keyValue:unknown,value:unknown):Promise<OrderView>{
  const key=idempotencyKey(keyValue),input=createInput(value),requestHash=digest(input);
  return this.data.db.$transaction(async tx=>{
   // Read Committed plus a transaction-scoped lock lets a waiting retry see the first committed response.
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`nexora:order:${tenantId}:${actorId}:${key}`}, 0))`;
   const prior=await tx.idempotencyKey.findUnique({where:{tenantId_actorId_key:{tenantId,actorId,key}}});
   if(prior){if(prior.operation!=="MERCHANT_ORDER_CREATE"||prior.requestHash!==requestHash)throw new ConflictException("Idempotency key was used for a different request");return prior.response as unknown as OrderView;}
   const q=await this.prices(tx,tenantId,input);if(input.quoteHash&&q.quoteHash!==input.quoteHash)throw new ConflictException("Quote changed; calculate again");
   return await this.persistCreated(tx,tenantId,actorId,key,requestHash,input,q) as OrderView;
  },{timeout:15000,maxWait:5000});
 }
 async persistCreated(tx:Prisma.TransactionClient,tenantId:string,actorId:string,key:string,requestHash:string,input:CreateOrderInput,q:OrderQuote,customer?:{customerNote:string;storeName:string;storeSlug:string}):Promise<OrderView|CustomerOrderView>{
  const order=await tx.order.create({data:{tenantId,createdById:actorId,orderNumber:`NXR-${randomUUID().replaceAll("-","").toUpperCase()}`,contactId:input.contactId,contactNameSnapshot:q.contactNameSnapshot,source:customer?"CUSTOMER":"MERCHANT",sourceChannel:customer?"customer_portal":"merchant",customerUserId:customer?actorId:null,paymentStatus:"UNPAID",customerNote:customer?.customerNote??"",storeNameSnapshot:customer?.storeName,storeSlugSnapshot:customer?.storeSlug,status:input.initialStatus,currencyCode:q.currencyCode,subtotal:q.subtotal,discountTotal:q.discountTotal,taxTotal:q.taxTotal,grandTotal:q.grandTotal,notes:input.notes}});
  await tx.orderItem.createMany({data:q.items.map(v=>({...v,tenantId,orderId:order.id}))});
  const row=await this.row(tx,tenantId,order.id),privateView=this.dto(row),response=customer?this.customerDto(row):privateView;
  await tx.orderStatusHistory.create({data:{tenantId,orderId:order.id,actorId,fromStatus:null,toStatus:order.status,version:order.version}});
  await tx.orderEvent.create({data:{tenantId,orderId:order.id,actorId,type:"CREATED",version:order.version,payload:json({after:privateView})}});
  await tx.idempotencyKey.create({data:{tenantId,actorId,key,requestHash,operation:customer?"CUSTOMER_PORTAL_ORDER_CREATE":"MERCHANT_ORDER_CREATE",orderId:order.id,response:json(response)}});return response;
 }
 async checkoutStore(tx:Prisma.TransactionClient,slug:string){
  await tx.$queryRaw`SELECT id FROM "Tenant" WHERE catalog_slug = ${slug} FOR SHARE`;
  const store=await tx.tenant.findUnique({where:{catalogSlug:slug},select:{id:true,name:true,catalogSlug:true,catalogPublic:true,storefrontProfile:{select:{displayName:true}}}});if(!store)throw new NotFoundException("Store not found");return store;
 }
 publicQuote(q:OrderQuote):CustomerQuote{
  const terms={currencyCode:q.currencyCode,subtotal:q.subtotal,discountTotal:q.discountTotal,taxTotal:q.taxTotal,grandTotal:q.grandTotal,items:q.items.map(v=>({catalogItemId:v.catalogItemId,catalogVariantId:v.catalogVariantId,itemNameSnapshot:v.itemNameSnapshot,variantNameSnapshot:v.variantNameSnapshot,unitPriceSnapshot:v.unitPriceSnapshot,quantity:v.quantity,lineTotal:v.lineTotal}))};return {...terms,quoteHash:digest(terms)};
 }
 customerQuote(slug:string,value:unknown){const input=cartInput(value);return this.data.db.$transaction(async tx=>{const store=await this.checkoutStore(tx,slug);if(!store.catalogPublic)throw new NotFoundException("Store not found");return this.publicQuote(await this.prices(tx,store.id,{...input,contactId:null,notes:"",initialStatus:"PENDING"},true));},{timeout:15000});}
 customerCreate(slug:string,actorId:string,keyValue:unknown,value:unknown){
  const input=checkoutInput(value),key=idempotencyKey(keyValue),requestHash=digest({operation:"CUSTOMER_PORTAL_ORDER_CREATE",input});
  return this.data.db.$transaction(async tx=>{
   const store=await this.checkoutStore(tx,slug),tenantId=store.id;
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`nexora:order:${tenantId}:${actorId}:${key}`},0))`;
   const prior=await tx.idempotencyKey.findUnique({where:{tenantId_actorId_key:{tenantId,actorId,key}}});
   if(prior){if(prior.operation!=="CUSTOMER_PORTAL_ORDER_CREATE"||prior.requestHash!==requestHash)throw new ConflictException("Idempotency key was used for a different request");return prior.response as unknown as CustomerOrderView;}
   if(!store.catalogPublic)throw new NotFoundException("Store not found");
   const draft:CreateOrderInput={items:input.items,contactId:null,notes:"",initialStatus:"PENDING"};const q=await this.prices(tx,tenantId,draft,true);
   if(input.quoteHash&&input.quoteHash!==this.publicQuote(q).quoteHash)throw new ConflictException("Quote changed; review your cart");
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`nexora:customer-link:${tenantId}:${actorId}`},0))`;
   let link=await tx.customerAccountLink.findUnique({where:{tenantId_userId:{tenantId,userId:actorId}}});
   if(!link){const user=await tx.user.findUniqueOrThrow({where:{id:actorId},select:{email:true}});const contact=await tx.customer.create({data:{tenantId,name:input.displayName,email:user.email,status:"ACTIVE"}});link=await tx.customerAccountLink.create({data:{tenantId,userId:actorId,contactId:contact.id}});}
   draft.contactId=link.contactId;q.contactNameSnapshot=input.displayName;
   return this.persistCreated(tx,tenantId,actorId,key,requestHash,draft,q,{customerNote:input.customerNote,storeName:store.storefrontProfile?.displayName||store.name,storeSlug:store.catalogSlug!});
  },{timeout:15000,maxWait:5000});
 }
 async detail(tenantId:string,id:string){return this.dto(await this.row(this.data.db,tenantId,id));}
 async list(tenantId:string,value:unknown){
  const q=listQuery(value);const where:Prisma.OrderWhereInput={tenantId,...(q.status?{status:q.status}:{}),...(q.source?{source:q.source}:{}),...(q.contactId?{contactId:q.contactId}:{}),...(q.q?{OR:[{orderNumber:{contains:q.q,mode:"insensitive"}},{contactNameSnapshot:{contains:q.q,mode:"insensitive"}}]}:{})};
  const [items,total]=await this.data.db.$transaction([this.data.db.order.findMany({where,include,orderBy:[{createdAt:"desc"},{id:"asc"}],skip:(q.page-1)*q.pageSize,take:q.pageSize}),this.data.db.order.count({where})],{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});return {items:items.map(v=>this.dto(v)),total,page:q.page,pageSize:q.pageSize,totalPages:Math.ceil(total/q.pageSize)};
 }
 async locked(tx:Prisma.TransactionClient,tenantId:string,id:string,expected:number){await tx.$queryRaw`SELECT id FROM "Order" WHERE tenant_id = ${tenantId} AND id = ${id} FOR UPDATE`;const row=await this.row(tx,tenantId,id);if(row.version!==expected)throw new ConflictException("Order version changed");return row;}
 async applyTransition(tx:Prisma.TransactionClient,row:OrderRow,actorId:string,to:OrderStatusValue,reason:string){
  assertTransition(row.status,to);const {tenantId,id:orderId}=row;const next=await tx.order.update({where:{tenantId_id:{tenantId,id:orderId}},data:{status:to,version:{increment:1}},include});
  await tx.orderStatusHistory.create({data:{tenantId,orderId,actorId,fromStatus:row.status,toStatus:to,version:next.version,reason}});
  await tx.orderEvent.create({data:{tenantId,orderId,actorId,type:"STATUS_CHANGED",version:next.version,payload:{from:row.status,to,reason}}});return this.dto(next);
 }
 transition(tenantId:string,id:string,actorId:string,to:OrderStatusValue,value:unknown){const b=changeInput(value);return this.data.db.$transaction(async tx=>this.applyTransition(tx,await this.locked(tx,tenantId,id,b.version),actorId,to,b.reason),{timeout:15000});}
 edit(tenantId:string,id:string,actorId:string,value:unknown){const b=editInput(value);return this.data.db.$transaction(async tx=>{
  const old=await this.locked(tx,tenantId,id,b.version);if("status"in b&&b.status)return this.applyTransition(tx,old,actorId,b.status,b.reason);
  if(old.status!=="DRAFT")throw new ConflictException("Only draft orders can be edited");
  const contactId=b.contactId===undefined?old.contactId:b.contactId;
  const updates:Prisma.OrderUncheckedUpdateInput={version:{increment:1},...(b.notes===undefined?{}:{notes:b.notes}),...(b.contactId===undefined?{}:{contactId,contactNameSnapshot:await this.contact(tx,tenantId,contactId)})};
  if(b.items){const q=await this.prices(tx,tenantId,{items:b.items,contactId,notes:b.notes??old.notes,initialStatus:"DRAFT"});if(b.quoteHash&&b.quoteHash!==q.quoteHash)throw new ConflictException("Quote changed; calculate again");Object.assign(updates,{currencyCode:q.currencyCode,subtotal:q.subtotal,discountTotal:q.discountTotal,taxTotal:q.taxTotal,grandTotal:q.grandTotal,contactNameSnapshot:q.contactNameSnapshot});await tx.orderItem.deleteMany({where:{tenantId,orderId:id}});await tx.orderItem.createMany({data:q.items.map(v=>({...v,tenantId,orderId:id}))});}
  const next=await tx.order.update({where:{tenantId_id:{tenantId,id}},data:updates,include});
  await tx.orderEvent.create({data:{tenantId,orderId:id,actorId,type:"UPDATED",version:next.version,payload:json({before:this.dto(old),after:this.dto(next)})}});return this.dto(next);
 },{timeout:15000});}
 async history(tenantId:string,id:string,value:unknown,events=false){await this.row(this.data.db,tenantId,id);const q=listQuery(value,false,true);const where={tenantId,orderId:id};const args={where,orderBy:{version:"asc" as const},skip:(q.page-1)*q.pageSize,take:q.pageSize,include:{actor:{select:{id:true,email:true}}}};
  if(events){const [items,total]=await this.data.db.$transaction([this.data.db.orderEvent.findMany(args),this.data.db.orderEvent.count({where})]);return {items,total,page:q.page,pageSize:q.pageSize,totalPages:Math.ceil(total/q.pageSize)};}
  const [items,total]=await this.data.db.$transaction([this.data.db.orderStatusHistory.findMany(args),this.data.db.orderStatusHistory.count({where})]);return {items,total,page:q.page,pageSize:q.pageSize,totalPages:Math.ceil(total/q.pageSize)};
 }
 customerDto(row:OrderRow):CustomerOrderView{const view=this.dto(row);return {id:view.id,orderNumber:view.orderNumber,status:view.status,sourceChannel:view.sourceChannel,paymentStatus:view.paymentStatus,customerNote:view.customerNote,storeName:row.storeNameSnapshot,storeSlug:row.storeSlugSnapshot,currencyCode:view.currencyCode,subtotal:view.subtotal,discountTotal:view.discountTotal,taxTotal:view.taxTotal,grandTotal:view.grandTotal,createdAt:view.createdAt,updatedAt:view.updatedAt,items:view.items.map(v=>({itemNameSnapshot:v.itemNameSnapshot,variantNameSnapshot:v.variantNameSnapshot,unitPriceSnapshot:v.unitPriceSnapshot,quantity:v.quantity,lineTotal:v.lineTotal}))};}
 async customerDetail(userId:string,id:string){const row=await this.data.db.order.findFirst({where:{id,customerUserId:userId,source:"CUSTOMER"},include});if(!row)throw new NotFoundException("Order not found");return this.customerDto(row);}
 async customerList(userId:string,value:unknown){const q=listQuery(value,true);const where:Prisma.OrderWhereInput={customerUserId:userId,source:"CUSTOMER",...(q.status?{status:q.status}:{})};const [rows,total]=await this.data.db.$transaction([this.data.db.order.findMany({where,include,skip:(q.page-1)*q.pageSize,take:q.pageSize,orderBy:[{createdAt:"desc"},{id:"asc"}]}),this.data.db.order.count({where})]);return {items:rows.map(v=>this.customerDto(v)),total,page:q.page,pageSize:q.pageSize,totalPages:Math.ceil(total/q.pageSize)};}
}
