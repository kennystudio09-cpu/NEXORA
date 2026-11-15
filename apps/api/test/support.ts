import {randomUUID} from "node:crypto";
import {createApp,Data} from "../src/app";
// Acceptance data is local-only. Isolate rate counters without clearing keys or changing limits.
export async function createAcceptanceApp(){
  for(const name of ["DATABASE_URL","REDIS_URL"]){const url=new URL(process.env[name]??"");if(!["localhost","127.0.0.1","[::1]"].includes(url.hostname))throw new Error("Acceptance tests require local development dependencies");}
  if(process.env.NODE_ENV==="production")throw new Error("Do not run acceptance tests in production");
  const app=await createApp();const data=app.get(Data);const original=data.redis;
  data.redis=original.duplicate({keyPrefix:`nexora:acceptance:${randomUUID()}:`});original.disconnect();return app;
}
