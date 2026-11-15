import { Injectable, UnauthorizedException, ForbiddenException, HttpException, type OnModuleDestroy } from "@nestjs/common";
import { PrismaClient, Role } from "@nexora/database";
import { newSessionToken, sessionDigest } from "@nexora/auth";
import Redis from "ioredis";
import type { Request, Response } from "express";
const cookieName = "nexora_session";
const lifetime = 7 * 24 * 60 * 60 * 1000;
function token(req: Request) {
  const raw = (req.headers.cookie ?? "").split(";").map(p => p.trim()).find(p => p.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) throw new UnauthorizedException("Please sign in");
  return raw;
}
@Injectable()
export class Data implements OnModuleDestroy {
  db = new PrismaClient();
  redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: 1, lazyConnect: true, retryStrategy: () => null });
  async onModuleDestroy() { await this.db.$disconnect(); this.redis.disconnect(); }
  async rateLimit(req: Request, email: string) {
    const address = req.ip ?? "unknown";
    for (const [key, limit] of [[`ip:${address}`, 100], [`email:${email}`, 20]] as const) {
      const count = Number(await this.redis.eval('local n=redis.call("INCR",KEYS[1]); if n==1 then redis.call("EXPIRE",KEYS[1],900) end; return n', 1, `nexora:auth:${sessionDigest(key)}`));
      if (count > limit) throw new HttpException("Too many attempts; try later", 429);
    }
  }
  async session(req: Request) {
    const session = await this.db.session.findUnique({ where: { id: sessionDigest(token(req)) }, include: { user: true } });
    if (!session || session.expiresAt.getTime() <= Date.now()) throw new UnauthorizedException("Session expired");
    return session;
  }
  async member(req: Request, tenantId: string, roles: Role[] = [Role.OWNER, Role.MANAGER, Role.STAFF]) {
    const session = await this.session(req);
    const membership = await this.db.membership.findUnique({ where: { userId_tenantId: { userId: session.userId, tenantId } } });
    if (!membership || !roles.includes(membership.role)) throw new ForbiddenException("Merchant access denied");
    return { session, membership };
  }
  async issue(req: Request, res: Response, userId: string) {
    const raw = newSessionToken();
    await this.db.$transaction(async tx => {
      try { await tx.session.deleteMany({ where: { id: sessionDigest(token(req)) } }); } catch (error) { if (!(error instanceof UnauthorizedException)) throw error; }
      await tx.session.create({ data: { id: sessionDigest(raw), userId, expiresAt: new Date(Date.now() + lifetime) } });
    });
    res.cookie(cookieName, raw, { httpOnly: true, secure: process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production", sameSite: "lax", path: "/api", maxAge: lifetime });
  }
}
