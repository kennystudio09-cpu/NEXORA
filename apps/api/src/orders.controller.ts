import {Controller,Get,Post,Patch,Param,Body,Query,Req,Inject,Injectable,UseGuards,UseFilters,BadRequestException,ConflictException,NotFoundException,Catch,type CanActivate,type ExecutionContext,type ExceptionFilter,type ArgumentsHost} from "@nestjs/common";
import type {Request,Response} from "express";
import {Prisma,Role} from "@nexora/database";
import {Data} from "./data";
import {OrdersService} from "./orders.service";
interface OrderRequest extends Request {orderScope:{tenantId:string;actorId:string}}
@Injectable()
export class OrderReadGuard implements CanActivate{
 constructor(@Inject(Data) private data:Data){}
 async canActivate(context:ExecutionContext){const req=context.switchToHttp().getRequest<OrderRequest>();const session=await this.data.session(req);const tenantId=req.params.tenantId?String(req.params.tenantId):session.activeTenantId;if(!tenantId)throw new BadRequestException("Select a merchant first");await this.data.member(req,tenantId);req.orderScope={tenantId,actorId:session.userId};return true;}
}
@Injectable()
export class OrderWriteGuard implements CanActivate{
 constructor(@Inject(Data) private data:Data){}
 async canActivate(context:ExecutionContext){const req=context.switchToHttp().getRequest<OrderRequest>();await this.data.member(req,req.orderScope.tenantId,[Role.OWNER,Role.MANAGER]);return true;}
}
@Catch(Prisma.PrismaClientKnownRequestError)
export class OrderDbFilter implements ExceptionFilter{
 catch(error:Prisma.PrismaClientKnownRequestError,host:ArgumentsHost){const mapped=error.code==="P2025"?new NotFoundException("Order not found"):new ConflictException("Order conflicts with current data; reload and retry");host.switchToHttp().getResponse<Response>().status(mapped.getStatus()).json(mapped.getResponse());}
}
@Controller(["tenants/:tenantId/orders","orders"])
@UseGuards(OrderReadGuard)
@UseFilters(OrderDbFilter)
export class OrdersController{
 constructor(@Inject(OrdersService) private service:OrdersService){}
 @Get() list(@Req() req:OrderRequest,@Query() q:unknown){return this.service.list(req.orderScope.tenantId,q);}
 @Post("quote") @UseGuards(OrderWriteGuard) quote(@Req() req:OrderRequest,@Body() b:unknown){return this.service.quote(req.orderScope.tenantId,b);}
 @Post() @UseGuards(OrderWriteGuard) create(@Req() req:OrderRequest,@Body() b:unknown){return this.service.create(req.orderScope.tenantId,req.orderScope.actorId,req.headers["idempotency-key"],b);}
 @Get(":id") detail(@Req() req:OrderRequest,@Param("id") id:string){return this.service.detail(req.orderScope.tenantId,id);}
 @Patch(":id") @UseGuards(OrderWriteGuard) edit(@Req() req:OrderRequest,@Param("id") id:string,@Body() b:unknown){return this.service.edit(req.orderScope.tenantId,id,req.orderScope.actorId,b);}
 @Post(":id/confirm") @UseGuards(OrderWriteGuard) confirm(@Req() req:OrderRequest,@Param("id") id:string,@Body() b:unknown){return this.service.transition(req.orderScope.tenantId,id,req.orderScope.actorId,"CONFIRMED",b);}
 @Post(":id/cancel") @UseGuards(OrderWriteGuard) cancel(@Req() req:OrderRequest,@Param("id") id:string,@Body() b:unknown){return this.service.transition(req.orderScope.tenantId,id,req.orderScope.actorId,"CANCELLED",b);}
 @Post(":id/complete") @UseGuards(OrderWriteGuard) complete(@Req() req:OrderRequest,@Param("id") id:string,@Body() b:unknown){return this.service.transition(req.orderScope.tenantId,id,req.orderScope.actorId,"COMPLETED",b);}
 @Get(":id/history") history(@Req() req:OrderRequest,@Param("id") id:string,@Query() q:unknown){return this.service.history(req.orderScope.tenantId,id,q);}
 @Get(":id/events") events(@Req() req:OrderRequest,@Param("id") id:string,@Query() q:unknown){return this.service.history(req.orderScope.tenantId,id,q,true);}
}
@Controller("customer/orders")
export class CustomerOrdersController{
 constructor(@Inject(Data) private data:Data,@Inject(OrdersService) private service:OrdersService){}
 @Get() async list(@Req() req:Request,@Query() q:unknown){const session=await this.data.session(req);return this.service.customerList(session.userId,q);}
 @Get(":id") async detail(@Req() req:Request,@Param("id") id:string){const session=await this.data.session(req);return this.service.customerDetail(session.userId,id);}
}
