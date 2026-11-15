import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException } from "@nestjs/common";
import { Prisma } from "@nexora/database";
import { Data } from "./data";
import { parseItem, parseVariant, query, body, text, currency, storeInput } from "./catalog.validation";
import { sanitizeImage } from "./catalog.image";
export const mediaSelect={id:true,altText:true,mimeType:true,size:true,width:true,height:true,createdAt:true} as const;
const itemInclude={category:{select:{id:true,name:true}},variants:{orderBy:{name:"asc" as const}},media:{select:mediaSelect,orderBy:{createdAt:"asc" as const}}};
@Injectable()
export class CatalogService {
  constructor(@Inject(Data) readonly data:Data){}
  async item(tenantId:string,id:string){
    const item=await this.data.db.catalogItem.findFirst({where:{tenantId,id,deletedAt:null},include:itemInclude});
    if(!item)throw new NotFoundException("Item not found");return item;
  }
  async category(tenantId:string,id:string){const c=await this.data.db.catalogCategory.findUnique({where:{tenantId_id:{tenantId,id}}});if(!c)throw new NotFoundException("Category not found");return c;}
  async list(tenantId:string,input:unknown,isPublic=false){
    const q=query(input,isPublic);
    const where:Prisma.CatalogItemWhereInput={tenantId,deletedAt:null,...(isPublic?{status:"ACTIVE" as const}:q.status?{status:q.status}:{}),...(q.itemType?{itemType:q.itemType}:{}),...(q.categoryId?{categoryId:q.categoryId}:{}),...(q.q?{OR:[{name:{contains:q.q,mode:"insensitive" as const}},{description:{contains:q.q,mode:"insensitive" as const}},...(!isPublic?[{sku:{contains:q.q,mode:"insensitive" as const}}]:[])]}:{})};
    const [rows,total]=await this.data.db.$transaction([this.data.db.catalogItem.findMany({where,include:itemInclude,skip:(q.page-1)*q.pageSize,take:q.pageSize,orderBy:[{createdAt:"desc"},{id:"asc"}]}),this.data.db.catalogItem.count({where})],{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
    return {items:rows.map(row=>isPublic?this.publicDto(row):this.dto(row)),total,page:q.page,pageSize:q.pageSize,totalPages:Math.ceil(total/q.pageSize)};
  }
  dto(row:Awaited<ReturnType<CatalogService["item"]>>){return {...row,basePrice:row.basePrice.toFixed(4),variants:row.variants.map(v=>({...v,price:v.price.toFixed(4)}))};}
  publicDto(row:Awaited<ReturnType<CatalogService["item"]>>){return {id:row.id,name:row.name,description:row.description,itemType:row.itemType,currencyCode:row.currencyCode,basePrice:row.basePrice.toFixed(4),category:row.category,variants:row.variants.filter(v=>v.active).map(v=>({id:v.id,name:v.name,price:v.price.toFixed(4)})),media:row.media};}
  async create(tenantId:string,input:unknown){const fields=parseItem(input);if(fields.categoryId)await this.category(tenantId,fields.categoryId);const row=await this.data.db.catalogItem.create({data:{...fields,name:fields.name!,basePrice:fields.basePrice!,tenantId}});return this.dto(await this.item(tenantId,row.id));}
  async update(tenantId:string,id:string,input:unknown){const fields=parseItem(input,true);const old=await this.item(tenantId,id);if(fields.categoryId)await this.category(tenantId,fields.categoryId);if(fields.currencyCode&&fields.currencyCode!==old.currencyCode&&old.variants.length)throw new ConflictException("Remove variants before changing currency");await this.data.db.catalogItem.update({where:{tenantId_id:{tenantId,id}},data:fields});return this.dto(await this.item(tenantId,id));}
  async remove(tenantId:string,id:string){await this.item(tenantId,id);await this.data.db.catalogItem.update({where:{tenantId_id:{tenantId,id}},data:{deletedAt:new Date(),status:"ARCHIVED"}});return {ok:true};}
  categories(tenantId:string){return this.data.db.catalogCategory.findMany({where:{tenantId},orderBy:{name:"asc"}});}
  async createCategory(tenantId:string,input:unknown){const b=body(input,["name"]);return this.data.db.catalogCategory.create({data:{tenantId,name:text(b.name,100).toLowerCase()}});}
  async updateCategory(tenantId:string,id:string,input:unknown){await this.category(tenantId,id);const b=body(input,["name"]);return this.data.db.catalogCategory.update({where:{tenantId_id:{tenantId,id}},data:{name:text(b.name,100).toLowerCase()}});}
  async removeCategory(tenantId:string,id:string){await this.category(tenantId,id);if(await this.data.db.catalogItem.count({where:{tenantId,categoryId:id}}))throw new ConflictException("Category is in use, including archived items");await this.data.db.catalogCategory.delete({where:{tenantId_id:{tenantId,id}}});return {ok:true};}
  async variant(tenantId:string,itemId:string,id:string){await this.item(tenantId,itemId);const row=await this.data.db.catalogVariant.findFirst({where:{tenantId,itemId,id}});if(!row)throw new NotFoundException("Variant not found");return row;}
  async createVariant(tenantId:string,itemId:string,input:unknown){await this.item(tenantId,itemId);const f=parseVariant(input);const row=await this.data.db.catalogVariant.create({data:{...f,tenantId,itemId,name:f.name!,price:f.price!}});return {...row,price:row.price.toFixed(4)};}
  async updateVariant(tenantId:string,itemId:string,id:string,input:unknown){await this.variant(tenantId,itemId,id);const f=parseVariant(input,true);const row=await this.data.db.catalogVariant.update({where:{tenantId_id:{tenantId,id}},data:f});return {...row,price:row.price.toFixed(4)};}
  async removeVariant(tenantId:string,itemId:string,id:string){await this.variant(tenantId,itemId,id);await this.data.db.catalogVariant.delete({where:{tenantId_id:{tenantId,id}}});return {ok:true};}
  async store(tenantId:string){return this.data.db.tenant.findUniqueOrThrow({where:{id:tenantId},select:{catalogSlug:true,catalogPublic:true}});}
  updateStore(tenantId:string,input:unknown){return this.data.db.tenant.update({where:{id:tenantId},data:storeInput(input),select:{catalogSlug:true,catalogPublic:true}});}
  async publicStore(slug:string){const row=await this.data.db.tenant.findFirst({where:{catalogSlug:slug,catalogPublic:true},select:{id:true,name:true,catalogSlug:true}});if(!row)throw new NotFoundException("Store not found");return row;}
  async publicItem(slug:string,id:string){const store=await this.publicStore(slug);const row=await this.item(store.id,id);if(row.status!=="ACTIVE")throw new NotFoundException("Item not found");return this.publicDto(row);}
  async addMedia(tenantId:string,itemId:string,file:Express.Multer.File|undefined,input:unknown){
    await this.item(tenantId,itemId);const b=body(input,["altText"]);const altText=b.altText===undefined?"":text(b.altText,160,true);const content=await sanitizeImage(file);
    return this.data.db.$transaction(async tx=>{
      // Serialize image-count checks per parent, without persisting user-controlled paths.
      await tx.$queryRaw`SELECT id FROM "CatalogItem" WHERE id = ${itemId} AND tenant_id = ${tenantId} FOR UPDATE`;
      if(!await tx.catalogItem.findFirst({where:{tenantId,id:itemId,deletedAt:null}}))throw new NotFoundException("Item not found");
      if(await tx.catalogMedia.count({where:{tenantId,itemId}})>=10)throw new BadRequestException("Maximum 10 images per item");
      return tx.catalogMedia.create({data:{tenantId,itemId,altText,...content},select:mediaSelect});
    });
  }
  async media(tenantId:string,itemId:string,id:string){await this.item(tenantId,itemId);const row=await this.data.db.catalogMedia.findFirst({where:{tenantId,itemId,id}});if(!row)throw new NotFoundException("Image not found");return row;}
  async removeMedia(tenantId:string,itemId:string,id:string){await this.media(tenantId,itemId,id);await this.data.db.catalogMedia.delete({where:{tenantId_id:{tenantId,id}}});return {ok:true};}
  async publicMedia(slug:string,id:string){const store=await this.publicStore(slug);const row=await this.data.db.catalogMedia.findFirst({where:{id,tenantId:store.id,item:{status:"ACTIVE",deletedAt:null}}});if(!row)throw new NotFoundException("Image not found");return row;}
  priceLists(tenantId:string){return this.data.db.priceList.findMany({where:{tenantId},orderBy:{name:"asc"}});}
  createPriceList(tenantId:string,input:unknown){const b=body(input,["name","currencyCode"]);return this.data.db.priceList.create({data:{tenantId,name:text(b.name,100).toLowerCase(),currencyCode:currency(b.currencyCode)}});}
}
