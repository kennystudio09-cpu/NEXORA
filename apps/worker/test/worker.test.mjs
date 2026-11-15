import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { Queue, QueueEvents } from "bullmq";
test("BullMQ worker processes a real Redis healthcheck job", {timeout:30000}, async()=>{
  const name=`nexora-test-${randomUUID()}`;
  const url=new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  const connection={host:url.hostname,port:Number(url.port||6379),username:url.username||undefined,password:url.password||undefined,db:Number(url.pathname.slice(1)||0)};
  const queue=new Queue(name,{connection});const events=new QueueEvents(name,{connection});
  const worker=spawn(process.execPath,["dist/main.js"],{env:{...process.env,WORKER_QUEUE:name},stdio:["ignore","pipe","pipe"]});
  try{await events.waitUntilReady();const job=await queue.add("healthcheck",{});assert.deepEqual(await job.waitUntilFinished(events,15000),{status:"ok",worker:"nexora"});}
  finally{worker.kill("SIGTERM");await once(worker,"exit");await events.close();await queue.close();}
});
