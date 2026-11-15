import {randomUUID} from "node:crypto";
import {createApp,Data} from "../dist/app.js";
for(const name of ["DATABASE_URL","REDIS_URL"]){const url=new URL(process.env[name]??"");if(!["localhost","127.0.0.1","[::1]"].includes(url.hostname))throw new Error("Browser acceptance requires local development dependencies");}
if(process.env.NODE_ENV==="production")throw new Error("Do not run acceptance tests in production");
const app=await createApp();const data=app.get(Data);const original=data.redis;
data.redis=original.duplicate({keyPrefix:`nexora:e2e:${randomUUID()}:`});original.disconnect();
if(process.env.NEXORA_AI_MOCK_E2E==="1"){
 const {AIService}=await import("../dist/ai.service.js");
 app.get(AIService).provider={name:"mock-e2e",model:"mock-selector",configured:()=>true,select:async(_question,facts)=>({selection:{factIds:facts.length?[facts[0].id]:[],needsHuman:!facts.length},inputTokens:100,outputTokens:10,latencyMs:1,attempts:1})};
}
await app.listen(Number(process.env.API_PORT??4100),"127.0.0.1");
