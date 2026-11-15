import { BadRequestException } from "@nestjs/common";
import { pagination } from "./crm.validation";
export const itemTypes = ["PRODUCT", "SERVICE", "DIGITAL", "BUNDLE"] as const;
export const itemStatuses = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export const currencies = ["MYR","SGD","USD","EUR","GBP","AUD","CNY","JPY","IDR","THB","BND","INR","KRW","TWD","HKD","VND","PHP","NZD","AED","SAR"] as const;
export function body(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException("Expected an object");
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some(k => !keys.includes(k))) throw new BadRequestException("Unexpected field");
  return result;
}
export function text(value: unknown, max: number, empty = false): string {
  if (typeof value !== "string" || value.length > max || value.includes("\u0000") || (!empty && !value.trim())) throw new BadRequestException("Invalid text");
  return value.trim();
}
export function price(value: unknown): string {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,13})(\.\d{1,4})?$/.test(value)) throw new BadRequestException("Price must be a nonnegative decimal string, maximum 14 integer and 4 fractional digits");
  return value;
}
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (!choices.includes(value as T)) throw new BadRequestException("Invalid selection");
  return value as T;
}
export function currency(value: unknown) { return choice(value,currencies); }
export function parseItem(value: unknown, partial = false) {
  const b = body(value,["name","description","itemType","sku","currencyCode","basePrice","status","categoryId"]);
  if (partial && !Object.keys(b).length) throw new BadRequestException("No changes supplied");
  const out: {name?:string;description?:string;itemType?:typeof itemTypes[number];sku?:string|null;currencyCode?:string;basePrice?:string;status?:typeof itemStatuses[number];categoryId?:string|null} = {};
  if (!partial || "name" in b) out.name=text(b.name,160);
  if ("description" in b) out.description=text(b.description,6000,true);
  if ("itemType" in b) out.itemType=choice(b.itemType,itemTypes);
  if ("sku" in b) out.sku=b.sku===null ? null : text(b.sku,64,true).toUpperCase()||null;
  if (!partial || "basePrice" in b) out.basePrice=price(b.basePrice);
  if ("currencyCode" in b) out.currencyCode=currency(b.currencyCode);
  if ("status" in b) out.status=choice(b.status,itemStatuses);
  if ("categoryId" in b) out.categoryId=b.categoryId===null||b.categoryId===""?null:text(b.categoryId,64);
  return out;
}
export function parseVariant(value: unknown, partial = false) {
  const b=body(value,["name","sku","price","active"]);
  if (partial && !Object.keys(b).length) throw new BadRequestException("No changes supplied");
  const out:{name?:string;sku?:string|null;price?:string;active?:boolean}={};
  if(!partial||"name" in b)out.name=text(b.name,100);
  if(!partial||"price" in b)out.price=price(b.price);
  if("sku" in b)out.sku=b.sku===null?null:text(b.sku,64,true).toUpperCase()||null;
  if("active" in b){if(typeof b.active!=="boolean")throw new BadRequestException("Invalid active flag");out.active=b.active;}
  return out;
}
export function query(value: unknown, isPublic=false){
  const b=body(value,isPublic?["q","itemType","categoryId","page","pageSize"]:["q","status","itemType","categoryId","page","pageSize"]);
  return {...pagination(b),q:b.q===undefined?undefined:text(b.q,120,true),status:b.status===undefined?undefined:choice(b.status,itemStatuses),itemType:b.itemType===undefined?undefined:choice(b.itemType,itemTypes),categoryId:b.categoryId===undefined?undefined:text(b.categoryId,64)};
}
export function storeInput(value:unknown){
  const b=body(value,["slug","published"]);const slug=text(b.slug,60);
  if(!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug)||["api","admin","catalog","login","register"].includes(slug))throw new BadRequestException("Use a unique lowercase slug of 3–60 letters, digits or hyphens");
  if(typeof b.published!=="boolean")throw new BadRequestException("Invalid publication flag");
  return {catalogSlug:slug,catalogPublic:b.published};
}
