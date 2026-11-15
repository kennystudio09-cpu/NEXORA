import {Injectable,Inject,NotFoundException} from "@nestjs/common";
import {Data} from "./data";
import {CatalogService} from "./catalog.service";
import {sanitizeImage} from "./catalog.image";
import {profileInput} from "./storefront.validation";
const select={displayName:true,description:true,address:true,businessHours:true,phone:true,email:true,logoMime:true,logoWidth:true,logoHeight:true} as const;
@Injectable()
export class StorefrontService{
 constructor(@Inject(Data) private data:Data,@Inject(CatalogService) private catalog:CatalogService){}
 async profile(tenantId:string){return await this.data.db.storefrontProfile.findUnique({where:{tenantId},select})??{displayName:"",description:"",address:"",businessHours:"",phone:"",email:"",logoMime:null,logoWidth:null,logoHeight:null};}
 update(tenantId:string,value:unknown){const fields=profileInput(value);return this.data.db.storefrontProfile.upsert({where:{tenantId},create:{tenantId,...fields},update:fields,select});}
 async logo(tenantId:string,file:Express.Multer.File|undefined){const image=await sanitizeImage(file);return this.data.db.storefrontProfile.upsert({where:{tenantId},create:{tenantId,logoData:image.content,logoMime:image.mimeType,logoWidth:image.width,logoHeight:image.height},update:{logoData:image.content,logoMime:image.mimeType,logoWidth:image.width,logoHeight:image.height},select});}
 async removeLogo(tenantId:string){await this.data.db.storefrontProfile.updateMany({where:{tenantId},data:{logoData:null,logoMime:null,logoWidth:null,logoHeight:null}});return {ok:true};}
 async publicView(slug:string){const store=await this.catalog.publicStore(slug);const profile=await this.profile(store.id);return {name:profile.displayName||store.name,slug:store.catalogSlug!,storefrontKey:store.storefrontKey,description:profile.description,address:profile.address,businessHours:profile.businessHours,phone:profile.phone,email:profile.email,hasLogo:Boolean(profile.logoMime),logoWidth:profile.logoWidth,logoHeight:profile.logoHeight};}
 async publicLogo(slug:string){const store=await this.catalog.publicStore(slug);const row=await this.data.db.storefrontProfile.findUnique({where:{tenantId:store.id},select:{logoData:true,logoMime:true}});if(!row?.logoData||!row.logoMime)throw new NotFoundException("Logo not found");return row;}
 async publicCategories(slug:string){const store=await this.catalog.publicStore(slug);return this.data.db.catalogCategory.findMany({where:{tenantId:store.id,items:{some:{status:"ACTIVE",deletedAt:null}}},select:{id:true,name:true},orderBy:{name:"asc"}});}
}
