import { BadRequestException } from "@nestjs/common";

import { CUSTOMER_STATUSES as customerStatuses, type CustomerStatus as CustomerStatusInput, type CustomerInput } from "@nexora/shared";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException("Expected a JSON object");
  return value as Record<string, unknown>;
}
function allowed(body: Record<string, unknown>, fields: string[]) {
  if (Object.keys(body).some(key => !fields.includes(key))) throw new BadRequestException("Unexpected field");
}
function string(value: unknown, max: number, label: string, empty = false): string {
  if (typeof value !== "string" || value.length > max || value.includes("\u0000")) throw new BadRequestException(`Invalid ${label}`);
  const result = value.trim();
  if (!empty && !result) throw new BadRequestException(`${label} is required`);
  return result;
}
export function parseCustomer(value: unknown, partial = false): CustomerInput {
  const body = record(value);
  allowed(body, ["name", "email", "phone", "status", "tags", "notes"]);
  if (partial && !Object.keys(body).length) throw new BadRequestException("Provide at least one field");
  const out: CustomerInput = {};
  if (!partial || "name" in body) out.name = string(body.name, 120, "name");
  if ("email" in body) {
    const email = body.email === null ? "" : string(body.email, 254, "email", true).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException("Invalid email");
    out.email = email || null;
  }
  if ("phone" in body) {
    const phone = body.phone === null ? "" : string(body.phone, 40, "phone", true);
    if (phone && !/^[+\d().\s-]{3,40}$/.test(phone)) throw new BadRequestException("Invalid phone");
    out.phone = phone || null;
  }
  if ("status" in body) {
    if (!customerStatuses.includes(body.status as CustomerStatusInput)) throw new BadRequestException("Invalid customer status");
    out.status = body.status as CustomerStatusInput;
  }
  if ("tags" in body) {
    if (!Array.isArray(body.tags) || body.tags.length > 10) throw new BadRequestException("Use at most 10 tags");
    out.tags = [...new Set(body.tags.map(tag => string(tag, 32, "tag").toLowerCase()))];
  }
  if ("notes" in body) out.notes = string(body.notes, 4000, "notes", true);
  return out;
}
export function pagination(value: Record<string, unknown>) {
  function integer(input: unknown, fallback: number, max: number) {
    if (input === undefined) return fallback;
    if (typeof input !== "string" || !/^[1-9]\d*$/.test(input) || Number(input) > max) throw new BadRequestException("Invalid pagination");
    return Number(input);
  }
  return { page: integer(value.page, 1, 10000), pageSize: integer(value.pageSize, 20, 100) };
}
export function parseCustomerQuery(value: unknown, followUps = false) {
  const body = record(value);
  allowed(body, followUps ? ["page", "pageSize"] : ["q", "status", "tag", "page", "pageSize"]);
  const result: {page:number;pageSize:number;q?:string;status?:CustomerStatusInput;tag?:string} = pagination(body);
  if ("q" in body) result.q = string(body.q, 120, "search", true);
  if ("tag" in body) result.tag = string(body.tag, 32, "tag", true).toLowerCase();
  if ("status" in body && body.status !== "") {
    if (!customerStatuses.includes(body.status as CustomerStatusInput)) throw new BadRequestException("Invalid customer status");
    result.status = body.status as CustomerStatusInput;
  }
  return result;
}
export function parseFollowUp(value: unknown) {
  const body = record(value);
  allowed(body, ["content"]);
  return { content: string(body.content, 2000, "follow-up") };
}
