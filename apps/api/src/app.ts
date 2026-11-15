import "reflect-metadata";
import { Controller, Inject, Get, Post, Patch, Body, Param, Req, Res, Module, UnauthorizedException, ForbiddenException, BadRequestException, ConflictException, ServiceUnavailableException } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Prisma, Role } from "@nexora/database";
import { hashPassword, verifyPassword } from "@nexora/auth";
import { Data } from "./data";
import { CrmController } from "./crm.controller";
import { CrmService } from "./crm.service";
import { CatalogController, PublicCatalogController, CatalogReadGuard, CatalogWriteGuard } from "./catalog.controller";
import { CatalogService } from "./catalog.service";
export { Data } from "./data";
import type { Request, Response, NextFunction } from "express";

const cookieName = "nexora_session";
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException("Expected an object");
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 120): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new BadRequestException("Invalid input");
  return value.trim();
}
function credentials(value: unknown) {
  const body = object(value);
  const email = text(body.email, 254).toLowerCase();
  const password = body.password;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== "string" || password.length < 12 || password.length > 128) throw new BadRequestException("Use a valid email and a password of 12–128 characters");
  return { email, password };
}
@Controller()
class ApiController {
  constructor(@Inject(Data) private readonly data: Data) {}
  @Get("health/live") live() { return { status: "ok", service: "nexora-api" }; }
  @Get("health") async health() {
    try { await this.data.db.$queryRaw`SELECT 1`; const redis = await this.data.redis.ping(); if (redis !== "PONG") throw new Error("Redis unavailable"); return { status: "ok", database: "up", redis: "up" }; }
    catch { throw new ServiceUnavailableException("Dependency unavailable"); }
  }
  @Post("auth/register") async register(@Body() input: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { email, password } = credentials(input);
    await this.data.rateLimit(req, email);
    try {
      const user = await this.data.db.user.create({ data: { email, passwordHash: await hashPassword(password) } });
      await this.data.issue(req, res, user.id);
      return { id: user.id, email: user.email };
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Account unavailable"); throw error; }
  }
  @Post("auth/login") async login(@Body() input: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { email, password } = credentials(input);
    await this.data.rateLimit(req, email);
    const user = await this.data.db.user.findUnique({ where: { email } });
    // A dummy derivation keeps missing-user paths computationally similar.
    const valid = await verifyPassword(password, user?.passwordHash ?? "scrypt:00000000000000000000000000000000:" + "00".repeat(64));
    if (!user || !valid) throw new UnauthorizedException("Invalid email or password");
    await this.data.issue(req, res, user.id);
    return { id: user.id, email: user.email };
  }
  @Post("auth/logout") async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.data.session(req);
    await this.data.db.session.deleteMany({ where: { id: session.id } });
    res.clearCookie(cookieName, { httpOnly: true, secure: process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production", sameSite: "lax", path: "/api" });
    return { ok: true };
  }
  @Get("auth/me") async me(@Req() req: Request) {
    const s = await this.data.session(req);
    return { id: s.user.id, email: s.user.email, platformAdmin: s.user.platformAdmin, activeTenantId: s.activeTenantId };
  }
  @Get("tenants") async tenants(@Req() req: Request) {
    const s = await this.data.session(req);
    return this.data.db.membership.findMany({ where: { userId: s.userId }, select: { role: true, tenant: { select: { id: true, name: true } } }, orderBy: { tenant: { createdAt: "asc" } } });
  }
  @Post("tenants") async createTenant(@Body() input: unknown, @Req() req: Request) {
    const s = await this.data.session(req);
    const name = text(object(input).name);
    return this.data.db.$transaction(async tx => {
      const tenant = await tx.tenant.create({ data: { name, memberships: { create: { userId: s.userId, role: Role.OWNER } } }, select: { id: true, name: true } });
      await tx.session.update({ where: { id: s.id }, data: { activeTenantId: tenant.id } });
      return tenant;
    });
  }
  @Post("tenants/:tenantId/switch") async switchTenant(@Param("tenantId") tenantId: string, @Req() req: Request) {
    const { session } = await this.data.member(req, tenantId);
    await this.data.db.session.update({ where: { id: session.id }, data: { activeTenantId: tenantId } });
    return { activeTenantId: tenantId };
  }
  @Get("dashboard") async activeDashboard(@Req() req: Request) {
    const s = await this.data.session(req);
    if (!s.activeTenantId) throw new BadRequestException("Select a merchant first");
    return this.dashboard(s.activeTenantId, req);
  }
  @Get("tenants/:tenantId/dashboard") async dashboard(@Param("tenantId") tenantId: string, @Req() req: Request) {
    const { membership } = await this.data.member(req, tenantId);
    const tenant = await this.data.db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { id: true, name: true } });
    const members = await this.data.db.membership.count({ where: { tenantId } });
    return { tenant, role: membership.role, members };
  }
  @Patch("tenants/:tenantId") async rename(@Param("tenantId") tenantId: string, @Body() input: unknown, @Req() req: Request) {
    await this.data.member(req, tenantId, [Role.OWNER, Role.MANAGER]);
    const body = object(input);
    if (Object.keys(body).some(k => k !== "name")) throw new BadRequestException("Only name may be changed");
    return this.data.db.tenant.update({ where: { id: tenantId }, data: { name: text(body.name) }, select: { id: true, name: true } });
  }
  @Get("tenants/:tenantId/members") async members(@Param("tenantId") tenantId: string, @Req() req: Request) {
    await this.data.member(req, tenantId, [Role.OWNER, Role.MANAGER]);
    return this.data.db.membership.findMany({ where: { tenantId }, select: { role: true, user: { select: { id: true, email: true } } } });
  }
  @Post("tenants/:tenantId/members") async addMember(@Param("tenantId") tenantId: string, @Body() input: unknown, @Req() req: Request) {
    await this.data.member(req, tenantId, [Role.OWNER]);
    const body = object(input);
    if (Object.keys(body).some(k => !["email", "role"].includes(k))) throw new BadRequestException("Unexpected field");
    if (body.role !== Role.MANAGER && body.role !== Role.STAFF) throw new BadRequestException("Role must be MANAGER or STAFF");
    const user = await this.data.db.user.findUnique({ where: { email: text(body.email, 254).toLowerCase() } });
    if (!user) throw new BadRequestException("User must register first");
    try { return await this.data.db.membership.create({ data: { tenantId, userId: user.id, role: body.role }, select: { userId: true, role: true } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("User is already a member"); throw error; }
  }
  @Get("platform/overview") async platform(@Req() req: Request) {
    const s = await this.data.session(req);
    if (!s.user.platformAdmin) throw new ForbiddenException("Platform administrator required");
    return { users: await this.data.db.user.count(), merchants: await this.data.db.tenant.count() };
  }
}
@Module({ controllers: [ApiController, CrmController, CatalogController, PublicCatalogController], providers: [Data, CrmService, CatalogService, CatalogReadGuard, CatalogWriteGuard] })
class AppModule {}
export async function createApp() {
  if (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "true") throw new Error("Production requires COOKIE_SECURE=true and HTTPS");
  const app = await NestFactory.create(AppModule, { logger: process.env.NODE_ENV === "test" ? false : ["error", "warn", "log"] });
  app.setGlobalPrefix("api");
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const allowed = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000,http://localhost:3001,http://localhost:3002").split(",");
      if (req.headers["x-nexora-request"] !== "1" || (req.headers.origin && !allowed.includes(req.headers.origin))) return res.status(403).json({ message: "Request origin denied" });
    }
    next();
  });
  app.enableShutdownHooks();
  return app;
}
