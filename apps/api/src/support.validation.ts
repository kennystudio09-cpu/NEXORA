import {BadRequestException} from "@nestjs/common";
import {body,text} from "./catalog.validation";
import {pagination} from "./crm.validation";
export function supportOpen(value:unknown){const b=body(value,["displayName"]);return {displayName:text(b.displayName,120)};}
export function supportMessage(value:unknown){const b=body(value,["content"]);return {content:text(b.content,4000)};}
export function supportVersion(value:unknown,assign=false){const b=body(value,assign?["version","assigneeId"]:["version"]);if(typeof b.version!=="number"||!Number.isInteger(b.version)||b.version<1)throw new BadRequestException("Current version required");return {version:b.version,...(assign?{assigneeId:text(b.assigneeId,64)}:{})};}
export function supportRead(value:unknown){const b=body(value,["throughSequence"]);if(typeof b.throughSequence!=="number"||!Number.isInteger(b.throughSequence)||b.throughSequence<0)throw new BadRequestException("Invalid read cursor");return b.throughSequence;}
export function supportQuery(value:unknown){const b=body(value,["q","status","page","pageSize"]);if(b.status!==undefined&&b.status!=="OPEN"&&b.status!=="CLOSED")throw new BadRequestException("Invalid status");return {...pagination(b),q:b.q===undefined?"":text(b.q,120,true),status:b.status as "OPEN"|"CLOSED"|undefined};}
export function supportCursor(value:unknown){const b=body(value,["after","limit"]);function number(v:unknown,fallback:number,max:number){if(v===undefined)return fallback;if(typeof v!=="string"||!/^\d{1,10}$/.test(v)||Number(v)>max)throw new BadRequestException("Invalid cursor");return Number(v);}const limit=number(b.limit,50,100);if(!limit)throw new BadRequestException("Invalid limit");return {after:number(b.after,0,2147483647),limit};}
