import {Controller,Get,Post,Patch,Delete,Body,Param,Req,Res,Inject,UseGuards,UseFilters,UseInterceptors,UploadedFile} from "@nestjs/common";
import {FileInterceptor} from "@nestjs/platform-express";
import type {Request,Response} from "express";
import {CatalogReadGuard,CatalogWriteGuard,CatalogDbFilter} from "./catalog.controller";
import {StorefrontService} from "./storefront.service";
import {OrdersService} from "./orders.service";
import {Data} from "./data";
import {OrderDbFilter} from "./orders.controller";
import {MAX_UPLOAD} from "./catalog.image";
@Controller("tenants/:tenantId/storefront")
@UseGuards(CatalogReadGuard)
@UseFilters(CatalogDbFilter)
export class StorefrontController{
 constructor(@Inject(StorefrontService) private service:StorefrontService){}
 @Get() profile(@Param("tenantId") id:string){return this.service.profile(id);}
 @Patch() @UseGuards(CatalogWriteGuard) update(@Param("tenantId") id:string,@Body() b:unknown){return this.service.update(id,b);}
 @Post("logo") @UseGuards(CatalogWriteGuard) @UseInterceptors(FileInterceptor("file",{limits:{fileSize:MAX_UPLOAD,files:1,fields:0,parts:2}})) logo(@Param("tenantId") id:string,@UploadedFile() f:Express.Multer.File|undefined){return this.service.logo(id,f);}
 @Delete("logo") @UseGuards(CatalogWriteGuard) remove(@Param("tenantId") id:string){return this.service.removeLogo(id);}
}
@Controller("public/stores/:slug")
export class StorefrontPublicController{
 constructor(@Inject(StorefrontService) private service:StorefrontService,@Inject(OrdersService) private orders:OrdersService){}
 @Get("profile") profile(@Param("slug") slug:string){return this.service.publicView(slug);}
 @Get("categories") categories(@Param("slug") slug:string){return this.service.publicCategories(slug);}
 @Get("logo") async logo(@Param("slug") slug:string,@Res() res:Response){const row=await this.service.publicLogo(slug);res.setHeader("Content-Security-Policy","default-src 'none'; sandbox");res.setHeader("Content-Disposition","inline");return res.type(row.logoMime!).send(Buffer.from(row.logoData!));}
 @Post("quote") quote(@Param("slug") slug:string,@Body() b:unknown){return this.orders.customerQuote(slug,b);}
}
@Controller("customer/stores/:slug/orders")
@UseFilters(OrderDbFilter)
export class StorefrontCheckoutController{
 constructor(@Inject(Data) private data:Data,@Inject(OrdersService) private orders:OrdersService){}
 @Post() async create(@Param("slug") slug:string,@Req() req:Request,@Body() b:unknown){const session=await this.data.session(req);return this.orders.customerCreate(slug,session.userId,req.headers["idempotency-key"],b);}
}
