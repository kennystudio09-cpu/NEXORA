import {BadRequestException,ConflictException} from "@nestjs/common";
import {ORDER_STATUSES,ORDER_SOURCES,type OrderStatusValue,type OrderLineInput} from "@nexora/shared";
import {body,text} from "./catalog.validation";
import {pagination} from "./crm.validation";
export interface CreateOrderInput {contactId:string|null;items:OrderLineInput[];notes:string;initialStatus:"DRAFT"|"PENDING";quoteHash?:string}
export function lines(value:unknown):OrderLineInput[]{
 if(!Array.isArray(value)||value.length<1||value.length>100)throw new BadRequestException("Use 1–100 order lines");
 const seen=new Set<string>();return value.map(raw=>{const b=body(raw,["catalogItemId","catalogVariantId","quantity"]);const catalogItemId=text(b.catalogItemId,64);const catalogVariantId=b.catalogVariantId==null?null:text(b.catalogVariantId,64);if(typeof b.quantity!=="number"||!Number.isInteger(b.quantity)||b.quantity<1||b.quantity>10000)throw new BadRequestException("Quantity must be an integer from 1 to 10000");const key=JSON.stringify([catalogItemId,catalogVariantId]);if(seen.has(key))throw new BadRequestException("Duplicate line; combine quantities");seen.add(key);return {catalogItemId,catalogVariantId,quantity:b.quantity};});
}
export function createInput(value:unknown):CreateOrderInput{
 const b=body(value,["contactId","items","notes","initialStatus","quoteHash"]);const initialStatus=b.initialStatus??"DRAFT";if(initialStatus!=="DRAFT"&&initialStatus!=="PENDING")throw new BadRequestException("Invalid initial status");
 return {contactId:b.contactId==null||b.contactId===""?null:text(b.contactId,64),items:lines(b.items),notes:b.notes===undefined?"":text(b.notes,4000,true),initialStatus,...(b.quoteHash===undefined?{}:{quoteHash:quoteHash(b.quoteHash)})};
}
function quoteHash(value:unknown){if(typeof value!=="string"||!(/^[a-f0-9]{64}$/).test(value))throw new BadRequestException("Invalid quote hash");return value;}
export function version(value:unknown){if(typeof value!=="number"||!Number.isInteger(value)||value<1||value>2147483646)throw new BadRequestException("A current integer version is required");return value;}
export function changeInput(value:unknown){const b=body(value,["version","reason"]);return {version:version(b.version),reason:b.reason===undefined?"":text(b.reason,1000,true)};}
export function editInput(value:unknown){
 const b=body(value,["version","items","notes","contactId","status","reason","quoteHash"]);const v=version(b.version);
 if("status"in b){if(Object.keys(b).some(k=>!["version","status","reason"].includes(k))||!(b.status==="PENDING"||b.status==="PROCESSING"))throw new BadRequestException("Use an explicit supported status action");return {version:v,status:b.status,reason:b.reason===undefined?"":text(b.reason,1000,true)} as const;}
 if(!["items","notes","contactId"].some(k=>k in b)||"reason"in b||("quoteHash"in b&&!("items"in b)))throw new BadRequestException("Provide draft fields");
 return {version:v,...("items"in b?{items:lines(b.items)}:{}),...("notes"in b?{notes:text(b.notes,4000,true)}:{}),...("contactId"in b?{contactId:b.contactId==null||b.contactId===""?null:text(b.contactId,64)}:{}),...(b.quoteHash===undefined?{}:{quoteHash:quoteHash(b.quoteHash)})};
}
export function idempotencyKey(value:unknown){if(typeof value!=="string"||!(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/).test(value))throw new BadRequestException("Idempotency-Key of 8–128 ASCII characters is required");return value;}
export const transitions:Record<OrderStatusValue,readonly OrderStatusValue[]>={DRAFT:["PENDING","CONFIRMED","CANCELLED"],PENDING:["CONFIRMED","CANCELLED"],CONFIRMED:["PROCESSING","CANCELLED"],PROCESSING:["COMPLETED","CANCELLED"],COMPLETED:[],CANCELLED:[]};
export function assertTransition(from:OrderStatusValue,to:OrderStatusValue){if(!transitions[from].includes(to))throw new ConflictException("Invalid order status transition");}
export function listQuery(value:unknown,customer=false,history=false){const b=body(value,history?["page","pageSize"]:customer?["page","pageSize","status"]:["page","pageSize","q","status","source","contactId"]);const out:{page:number;pageSize:number;q?:string;status?:OrderStatusValue;source?:typeof ORDER_SOURCES[number];contactId?:string}={...pagination(b)};
 if("q"in b)out.q=text(b.q,120,true);
 if("status"in b){if(!ORDER_STATUSES.includes(b.status as OrderStatusValue))throw new BadRequestException("Invalid status");out.status=b.status as OrderStatusValue;}
 if("source"in b){if(!ORDER_SOURCES.includes(b.source as typeof ORDER_SOURCES[number]))throw new BadRequestException("Invalid source");out.source=b.source as typeof ORDER_SOURCES[number];}
 if("contactId"in b)out.contactId=text(b.contactId,64);return out;
}
