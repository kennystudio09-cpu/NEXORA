import {Controller,Get,Post,Patch,Delete,Body,Param,Req,Inject,UseFilters,BadRequestException} from "@nestjs/common";
import type {Request} from "express";
import {Data} from "./data";
import {AIService} from "./ai.service";
import {AIKnowledge} from "./ai.knowledge";
import {body} from "./catalog.validation";
import {playgroundInput} from "./ai.validation";
import {idempotencyKey} from "./orders.validation";
import {OrderDbFilter} from "./orders.controller";
@Controller("tenants/:tenantId/ai")
@UseFilters(OrderDbFilter)
export class AIController{
 constructor(@Inject(Data) private data:Data,@Inject(AIService) private ai:AIService,@Inject(AIKnowledge) private knowledge:AIKnowledge){}
 async auth(req:Request,tenantId:string){const session=await this.data.session(req);await this.ai.assertManage(session.userId,tenantId);return session.userId;}
 @Get("settings") async config(@Req() req:Request,@Param("tenantId") id:string){await this.auth(req,id);return this.ai.config(id);}
 @Patch("settings") async save(@Req() req:Request,@Param("tenantId") id:string,@Body() v:unknown){return this.ai.save(id,await this.auth(req,id),v);}
 @Get("versions") async versions(@Req() req:Request,@Param("tenantId") id:string){await this.auth(req,id);return this.ai.versions(id);}
 @Get("documents") async list(@Req() req:Request,@Param("tenantId") id:string){await this.auth(req,id);return this.knowledge.list(id);}
 @Post("documents") async add(@Req() req:Request,@Param("tenantId") id:string,@Body() v:unknown){return this.knowledge.save(id,await this.auth(req,id),v);}
 @Patch("documents/:documentId") async edit(@Req() req:Request,@Param("tenantId") id:string,@Param("documentId") doc:string,@Body() v:unknown){return this.knowledge.save(id,await this.auth(req,id),v,doc);}
 @Delete("documents/:documentId") async archive(@Req() req:Request,@Param("tenantId") id:string,@Param("documentId") doc:string,@Body() v:unknown){const user=await this.auth(req,id),b=body(v,["revision"]);if(!Number.isInteger(b.revision))throw new BadRequestException("Revision required");return this.knowledge.archive(id,user,doc,Number(b.revision));}
 @Post("documents/:documentId/reindex") async reindex(@Req() req:Request,@Param("tenantId") id:string,@Param("documentId") doc:string,@Body() v:unknown){body(v,[]);return this.knowledge.reindex(id,await this.auth(req,id),doc);}
 @Post("search") async search(@Req() req:Request,@Param("tenantId") id:string,@Body() v:unknown){await this.auth(req,id);const q=playgroundInput(v);return this.knowledge.search(id,q.question,q.language);}
 @Post("playground") async playground(@Req() req:Request,@Param("tenantId") id:string,@Body() v:unknown){const actor=await this.auth(req,id),q=playgroundInput(v);return this.ai.playground(id,actor,idempotencyKey(req.headers["idempotency-key"]),q.question,q.language);}
 @Get("usage") async usage(@Req() req:Request,@Param("tenantId") id:string){await this.auth(req,id);return {records:await this.ai.logs(id),settings:(await this.ai.config(id)).settings};}
}
