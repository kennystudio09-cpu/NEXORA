import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createAcceptanceApp} from "./support";
test("isolated acceptance Redis counters still enforce real authentication limits",async t=>{
 const app=await createAcceptanceApp();await app.listen(0,"127.0.0.1");t.after(()=>app.close());const url=await app.getUrl();
 const email=`rate-${randomUUID()}@example.test`;
 for(let i=0;i<21;i++){const response=await fetch(`${url}/api/auth/login`,{method:"POST",headers:{"content-type":"application/json","x-nexora-request":"1"},body:JSON.stringify({email,password:"Invalid-test-password!"})});assert.equal(response.status,i<20?401:429);}
});
