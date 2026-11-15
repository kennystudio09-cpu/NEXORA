import {Injectable,Inject,type OnModuleInit,type OnModuleDestroy} from "@nestjs/common";
import {EventEmitter} from "node:events";
import {randomUUID} from "node:crypto";
import type Redis from "ioredis";
import {Data} from "./data";
export type SupportChange={tenantId:string;conversationId:string};
@Injectable()
export class SupportBus implements OnModuleInit,OnModuleDestroy{
 readonly events=new EventEmitter();private origin=randomUUID();private subscriber?:Redis;private channel="nexora:support:invalidation:v1";
 constructor(@Inject(Data) private data:Data){}
 async onModuleInit(){if(process.env.SUPPORT_REDIS_ADAPTER!=="true")return;this.subscriber=this.data.redis.duplicate();this.subscriber.on("message",(_channel,raw)=>{try{const v=JSON.parse(raw);if(v.origin!==this.origin&&typeof v.tenantId==="string"&&typeof v.conversationId==="string")this.events.emit("change",v);}catch{/* Discard malformed invalidations; PostgreSQL is authoritative. */}});await this.subscriber.subscribe(this.channel);}
 async publish(value:SupportChange){this.events.emit("change",value);if(this.subscriber)try{await this.data.redis.publish(this.channel,JSON.stringify({...value,origin:this.origin}));}catch{/* A persisted change is never rolled back by a notification outage. Clients reconcile via HTTP. */}}
 onModuleDestroy(){this.events.removeAllListeners();this.subscriber?.disconnect();}
}
