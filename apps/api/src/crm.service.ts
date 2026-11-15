import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Prisma } from "@nexora/database";
import { Data } from "./data";
import { parseCustomer, parseCustomerQuery, parseFollowUp } from "./crm.validation";

@Injectable()
export class CrmService {
  constructor(@Inject(Data) private readonly data: Data) {}
  async list(tenantId: string, input: unknown) {
    const { page, pageSize, q, status, tag } = parseCustomerQuery(input);
    const where: Prisma.CustomerWhereInput = {
      tenantId, ...(status ? { status } : {}), ...(tag ? { tags: { has: tag } } : {}),
      ...(q ? { OR: ["name", "email", "phone"].map(field => ({ [field]: { contains: q, mode: "insensitive" } })) } : {}),
    };
    const [items, total] = await this.data.db.$transaction([
      this.data.db.customer.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }),
      this.data.db.customer.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
  create(tenantId: string, input: unknown) {
    const fields = parseCustomer(input);
    return this.data.db.customer.create({ data: { ...fields, name: fields.name!, tenantId } });
  }
  async detail(tenantId: string, id: string) {
    const customer = await this.data.db.customer.findUnique({ where: { tenantId_id: { tenantId, id } } });
    if (!customer) throw new NotFoundException("Customer not found");
    return customer;
  }
  async update(tenantId: string, id: string, input: unknown) {
    const fields = parseCustomer(input, true);
    await this.detail(tenantId, id);
    return this.data.db.customer.update({ where: { tenantId_id: { tenantId, id } }, data: fields });
  }
  async followUps(tenantId: string, customerId: string, input: unknown) {
    const { page, pageSize } = parseCustomerQuery(input, true);
    await this.detail(tenantId, customerId);
    const where = { tenantId, customerId };
    const [items, total] = await this.data.db.$transaction([
      this.data.db.customerFollowUp.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: [{ createdAt: "desc" }, { id: "asc" }], include: { author: { select: { id: true, email: true } } } }),
      this.data.db.customerFollowUp.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
  async addFollowUp(tenantId: string, customerId: string, authorId: string, input: unknown) {
    const fields = parseFollowUp(input);
    await this.detail(tenantId, customerId);
    return this.data.db.customerFollowUp.create({ data: { ...fields, tenantId, customerId, authorId }, include: { author: { select: { id: true, email: true } } } });
  }
}
