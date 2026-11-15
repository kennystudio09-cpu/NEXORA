import "reflect-metadata";
import { Controller, Get, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
@Controller()
class HealthController { @Get("health") health() { return { status: "ok", service: "nexora-api", scope: "liveness" }; } }
@Module({ controllers: [HealthController] })
class AppModule {}
async function main() { const app = await NestFactory.create(AppModule); await app.listen(Number(process.env.API_PORT ?? 4000), "0.0.0.0"); }
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
