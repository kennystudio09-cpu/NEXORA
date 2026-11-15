import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Res, Inject, Injectable, UseGuards, UseFilters, UseInterceptors, UploadedFile, Catch, ConflictException, NotFoundException, type CanActivate, type ExecutionContext, type ExceptionFilter, type ArgumentsHost } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Prisma, Role } from "@nexora/database";
import type { Request, Response } from "express";
import { Data } from "./data";
import { CatalogService } from "./catalog.service";
import { MAX_UPLOAD } from "./catalog.image";
@Injectable()
export class CatalogReadGuard implements CanActivate {
  constructor(@Inject(Data) private data:Data){}
  async canActivate(context:ExecutionContext){const req=context.switchToHttp().getRequest<Request>();await this.data.member(req,String(req.params.tenantId));return true;}
}
@Injectable()
export class CatalogWriteGuard implements CanActivate {
  constructor(@Inject(Data) private data:Data){}
  async canActivate(context:ExecutionContext){const req=context.switchToHttp().getRequest<Request>();await this.data.member(req,String(req.params.tenantId),[Role.OWNER,Role.MANAGER]);return true;}
}
@Catch(Prisma.PrismaClientKnownRequestError)
export class CatalogDbFilter implements ExceptionFilter {
  catch(error:Prisma.PrismaClientKnownRequestError,host:ArgumentsHost){
    const mapped=error.code==="P2025"?new NotFoundException("Record not found"):new ConflictException(error.code==="P2002"?"Value already exists in this scope":"Record is in use or conflicts with related data");
    host.switchToHttp().getResponse<Response>().status(mapped.getStatus()).json(mapped.getResponse());
  }
}
function sendImage(res:Response,row:{content:Uint8Array;mimeType:string}){res.setHeader("Content-Security-Policy","default-src 'none'; sandbox");res.setHeader("Content-Disposition","inline");return res.type(row.mimeType).send(Buffer.from(row.content));}
@Controller("tenants/:tenantId/catalog")
@UseGuards(CatalogReadGuard)
@UseFilters(CatalogDbFilter)
export class CatalogController {
  constructor(@Inject(CatalogService) private catalog:CatalogService){}
  @Get("items") list(@Param("tenantId") t:string,@Query() q:unknown){return this.catalog.list(t,q);}
  @Get("items/:id") async detail(@Param("tenantId") t:string,@Param("id") id:string){return this.catalog.dto(await this.catalog.item(t,id));}
  @Post("items") @UseGuards(CatalogWriteGuard) create(@Param("tenantId") t:string,@Body() b:unknown){return this.catalog.create(t,b);}
  @Patch("items/:id") @UseGuards(CatalogWriteGuard) update(@Param("tenantId") t:string,@Param("id") id:string,@Body() b:unknown){return this.catalog.update(t,id,b);}
  @Delete("items/:id") @UseGuards(CatalogWriteGuard) remove(@Param("tenantId") t:string,@Param("id") id:string){return this.catalog.remove(t,id);}
  @Get("categories") categories(@Param("tenantId") t:string){return this.catalog.categories(t);}
  @Post("categories") @UseGuards(CatalogWriteGuard) createCategory(@Param("tenantId") t:string,@Body() b:unknown){return this.catalog.createCategory(t,b);}
  @Patch("categories/:id") @UseGuards(CatalogWriteGuard) updateCategory(@Param("tenantId") t:string,@Param("id") id:string,@Body() b:unknown){return this.catalog.updateCategory(t,id,b);}
  @Delete("categories/:id") @UseGuards(CatalogWriteGuard) removeCategory(@Param("tenantId") t:string,@Param("id") id:string){return this.catalog.removeCategory(t,id);}
  @Get("store") store(@Param("tenantId") t:string){return this.catalog.store(t);}
  @Patch("store") @UseGuards(CatalogWriteGuard) updateStore(@Param("tenantId") t:string,@Body() b:unknown){return this.catalog.updateStore(t,b);}
  @Get("price-lists") priceLists(@Param("tenantId") t:string){return this.catalog.priceLists(t);}
  @Post("price-lists") @UseGuards(CatalogWriteGuard) createPriceList(@Param("tenantId") t:string,@Body() b:unknown){return this.catalog.createPriceList(t,b);}
  @Post("items/:id/variants") @UseGuards(CatalogWriteGuard) createVariant(@Param("tenantId") t:string,@Param("id") id:string,@Body() b:unknown){return this.catalog.createVariant(t,id,b);}
  @Patch("items/:id/variants/:variantId") @UseGuards(CatalogWriteGuard) updateVariant(@Param("tenantId") t:string,@Param("id") id:string,@Param("variantId") v:string,@Body() b:unknown){return this.catalog.updateVariant(t,id,v,b);}
  @Delete("items/:id/variants/:variantId") @UseGuards(CatalogWriteGuard) removeVariant(@Param("tenantId") t:string,@Param("id") id:string,@Param("variantId") v:string){return this.catalog.removeVariant(t,id,v);}
  @Post("items/:id/media") @UseGuards(CatalogWriteGuard)
  @UseInterceptors(FileInterceptor("file",{limits:{fileSize:MAX_UPLOAD,files:1,fields:1,fieldSize:1024,parts:3}}))
  upload(@Param("tenantId") t:string,@Param("id") id:string,@UploadedFile() file:Express.Multer.File|undefined,@Body() b:unknown){return this.catalog.addMedia(t,id,file,b);}
  @Get("items/:id/media/:mediaId") async image(@Param("tenantId") t:string,@Param("id") id:string,@Param("mediaId") m:string,@Res() res:Response){return sendImage(res,await this.catalog.media(t,id,m));}
  @Delete("items/:id/media/:mediaId") @UseGuards(CatalogWriteGuard) removeMedia(@Param("tenantId") t:string,@Param("id") id:string,@Param("mediaId") m:string){return this.catalog.removeMedia(t,id,m);}
}
@Controller("public/stores/:slug")
export class PublicCatalogController {
  constructor(@Inject(CatalogService) private catalog:CatalogService){}
  @Get() async store(@Param("slug") slug:string){const store=await this.catalog.publicStore(slug);return {name:store.name,slug:store.catalogSlug};}
  @Get("items") async list(@Param("slug") slug:string,@Query() q:unknown){const store=await this.catalog.publicStore(slug);return this.catalog.list(store.id,q,true);}
  @Get("items/:id") item(@Param("slug") slug:string,@Param("id") id:string){return this.catalog.publicItem(slug,id);}
  @Get("media/:id") async image(@Param("slug") slug:string,@Param("id") id:string,@Res() res:Response){return sendImage(res,await this.catalog.publicMedia(slug,id));}
}
