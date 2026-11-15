import {Controller,Get,Post,Body,Param,Query,Req,Inject,UseFilters} from "@nestjs/common";
import type {Request} from "express";
import {Data} from "./data";
import {body} from "./catalog.validation";
import {SupportService,type SupportActor} from "./support.service";
import {SupportRealtime} from "./support.realtime";
import {OrderDbFilter} from "./orders.controller";
@Controller(["tenants/:tenantId/support","customer/support"])
@UseFilters(OrderDbFilter)
export class SupportController{
 constructor(@Inject(Data) private data:Data,@Inject(SupportService) private service:SupportService,@Inject(SupportRealtime) private realtime:SupportRealtime){}
 async actor(req:Request):Promise<SupportActor>{const session=await this.data.session(req);const tenantId=typeof req.params.tenantId==="string"?req.params.tenantId:undefined;const actor:SupportActor={userId:session.userId,sessionId:session.id,kind:tenantId?"STAFF":"CUSTOMER",...(tenantId?{tenantId}:{})};if(actor.kind==="STAFF")await this.service.membership(actor);return actor;}
 @Get("conversations") async list(@Req() req:Request,@Query() q:unknown){return this.service.list(await this.actor(req),q);}
 @Get("unread") async unread(@Req() req:Request){return this.service.unread(await this.actor(req));}
 @Get("agents") async agents(@Req() req:Request){return this.service.agents(await this.actor(req));}
 @Post("socket-ticket") async ticket(@Req() req:Request,@Body() value:unknown){body(value,[]);return this.realtime.ticket(await this.actor(req));}
 @Get("conversations/:id") async detail(@Req() req:Request,@Param("id") id:string){return this.service.detail(await this.actor(req),id);}
 @Get("conversations/:id/messages") async messages(@Req() req:Request,@Param("id") id:string,@Query() q:unknown){return this.service.messages(await this.actor(req),id,q);}
 @Post("conversations/:id/messages") async send(@Req() req:Request,@Param("id") id:string,@Body() b:unknown){return this.service.send(await this.actor(req),id,req.headers["idempotency-key"],b);}
 @Post("conversations/:id/read") async read(@Req() req:Request,@Param("id") id:string,@Body() b:unknown){return this.service.read(await this.actor(req),id,b);}
 @Post("conversations/:id/assign") async assign(@Req() req:Request,@Param("id") id:string,@Body() b:unknown){return this.service.change(await this.actor(req),id,"assign",b);}
 @Post("conversations/:id/close") async close(@Req() req:Request,@Param("id") id:string,@Body() b:unknown){return this.service.change(await this.actor(req),id,"close",b);}
 @Post("conversations/:id/reopen") async reopen(@Req() req:Request,@Param("id") id:string,@Body() b:unknown){return this.service.change(await this.actor(req),id,"reopen",b);}
 @Get("conversations/:id/events") async events(@Req() req:Request,@Param("id") id:string){return this.service.events(await this.actor(req),id);}
}
@Controller("customer/stores/:slug/support")
@UseFilters(OrderDbFilter)
export class SupportOpenController{
 constructor(@Inject(Data) private data:Data,@Inject(SupportService) private service:SupportService){}
 @Post("conversation") async open(@Req() req:Request,@Param("slug") slug:string,@Body() b:unknown){const s=await this.data.session(req);return this.service.open({userId:s.userId,sessionId:s.id,kind:"CUSTOMER"},slug,b);}
}
