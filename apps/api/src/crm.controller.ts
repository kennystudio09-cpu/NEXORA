import { Controller, Get, Post, Patch, Body, Param, Query, Req, Inject } from "@nestjs/common";
import { Role } from "@nexora/database";
import type { Request } from "express";
import { Data } from "./data";
import { CrmService } from "./crm.service";

@Controller("tenants/:tenantId/customers")
export class CrmController {
  constructor(@Inject(Data) private readonly data: Data, @Inject(CrmService) private readonly crm: CrmService) {}
  @Get() async list(@Param("tenantId") tenantId: string, @Query() query: unknown, @Req() req: Request) {
    await this.data.member(req, tenantId);
    return this.crm.list(tenantId, query);
  }
  @Post() async create(@Param("tenantId") tenantId: string, @Body() body: unknown, @Req() req: Request) {
    await this.data.member(req, tenantId, [Role.OWNER, Role.MANAGER]);
    return this.crm.create(tenantId, body);
  }
  @Get(":customerId") async detail(@Param("tenantId") tenantId: string, @Param("customerId") id: string, @Req() req: Request) {
    await this.data.member(req, tenantId);
    return this.crm.detail(tenantId, id);
  }
  @Patch(":customerId") async update(@Param("tenantId") tenantId: string, @Param("customerId") id: string, @Body() body: unknown, @Req() req: Request) {
    await this.data.member(req, tenantId, [Role.OWNER, Role.MANAGER]);
    return this.crm.update(tenantId, id, body);
  }
  @Get(":customerId/follow-ups") async followUps(@Param("tenantId") tenantId: string, @Param("customerId") id: string, @Query() query: unknown, @Req() req: Request) {
    await this.data.member(req, tenantId);
    return this.crm.followUps(tenantId, id, query);
  }
  @Post(":customerId/follow-ups") async addFollowUp(@Param("tenantId") tenantId: string, @Param("customerId") id: string, @Body() body: unknown, @Req() req: Request) {
    const { session } = await this.data.member(req, tenantId);
    return this.crm.addFollowUp(tenantId, id, session.userId, body);
  }
}
