export const CUSTOMER_STATUSES = ["LEAD", "ACTIVE", "INACTIVE"] as const;
export type CustomerStatus = typeof CUSTOMER_STATUSES[number];
export type CustomerInput = {
  name?: string; email?: string | null; phone?: string | null;
  status?: CustomerStatus; tags?: string[]; notes?: string;
};
export interface CustomerRecord {
  id: string; tenantId: string; name: string; email: string | null; phone: string | null;
  status: CustomerStatus; tags: string[]; notes: string; createdAt: string; updatedAt: string;
}
export interface CustomerFollowUpRecord {
  id: string; tenantId: string; customerId: string; authorId: string; content: string;
  occurredAt: string; createdAt: string; author: { id: string; email: string };
}
export interface PageResult<T> { items: T[]; total: number; page: number; pageSize: number; totalPages: number }
