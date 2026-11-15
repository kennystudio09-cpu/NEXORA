export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function crmApi<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options.method ?? "GET", credentials: "same-origin", cache: "no-store", signal: options.signal,
    headers: { "content-type": "application/json", "x-nexora-request": "1" },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const data = await response.json();
  if (!response.ok) throw new ApiError(response.status, typeof data.message === "string" ? data.message : "Request failed");
  return data as T;
}
export function message(error: unknown) { return error instanceof Error ? error.message : "Request failed"; }
export const field = "mt-2 w-full min-w-0 rounded-lg border border-slate-600 bg-slate-900 px-3 py-3 text-white";
export const button = "inline-block rounded-lg bg-cyan-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50";
export const panel = "rounded-xl border border-slate-700 bg-slate-900/40 p-5 sm:p-6";
