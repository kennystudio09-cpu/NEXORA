import {randomUUID} from "node:crypto";
import {createApp,Data} from "../dist/app.js";
for(const name of ["DATABASE_URL","REDIS_URL"]){const url=new URL(process.env[name]??"");if(!["localhost","127.0.0.1","[::1]"].includes(url.hostname))throw new Error("Browser acceptance requires local development dependencies");}
if(process.env.NODE_ENV==="production")throw new Error("Do not run acceptance tests in production");
const app=await createApp();const data=app.get(Data);const original=data.redis;
data.redis=original.duplicate({keyPrefix:`nexora:e2e:${randomUUID()}:`});original.disconnect();
await app.listen(Number(process.env.API_PORT??4100),"127.0.0.1");
