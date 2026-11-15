"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
type User = { email: string; platformAdmin: boolean; activeTenantId: string | null };
type Merchant = { role: "OWNER" | "MANAGER" | "STAFF"; tenant: { id: string; name: string } };
type Dashboard = { tenant: { id: string; name: string }; role: string; members: number };
async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, { method, credentials: "same-origin", headers: { "content-type": "application/json", "x-nexora-request": "1" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.message === "string" ? data.message : "Request failed");
  return data as T;
}
export function Portal({ portal, screen = "dashboard" }: { portal: "customer" | "merchant" | "admin"; screen?: "login" | "register" | "dashboard" }) {
  const [user, setUser] = useState<User | null>(null);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [overview, setOverview] = useState<{users:number;merchants:number} | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const title = portal === "customer" ? "Customer Portal" : portal === "merchant" ? "Merchant Portal" : "Platform Admin";
  const refresh = useCallback(async () => {
    const me = await api<User>("/auth/me"); setUser(me);
    if (portal === "merchant") {
      setMerchants(await api<Merchant[]>("/tenants"));
      setDashboard(me.activeTenantId ? await api<Dashboard>("/dashboard") : null);
    }
    if (portal === "admin" && me.platformAdmin) setOverview(await api("/platform/overview"));
  }, [portal]);
  useEffect(() => { refresh().catch(e => { if (e.message !== "Please sign in" && e.message !== "Session expired") setError(e.message); }).finally(() => setLoading(false)); }, [refresh]);
  async function action(work: () => Promise<void>) { setBusy(true); setError(""); setNotice(""); try { await work(); } catch (e) { setError(e instanceof Error ? e.message : "Request failed"); } finally { setBusy(false); } }
  function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void action(async () => { await api(`/auth/${screen === "register" ? "register" : "login"}`, "POST", { email: form.get("email"), password: form.get("password") }); window.location.assign("/dashboard"); });
  }
  const field = "mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white";
  const button = "rounded-lg bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50";
  return <div className="min-h-screen"><header className="border-b border-slate-800"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5"><a href="/" className="text-xl font-bold tracking-widest text-cyan-300">NEXORA</a><nav aria-label="Main navigation" className="flex flex-wrap items-center gap-5"><a href="/dashboard">Dashboard</a>{portal === "merchant" && <><a href="/crm">Customers</a><a href="/catalog">Catalog</a><a href="/orders">Orders</a><a href="/inbox">Unified Inbox</a><a href="/ai">AI support</a></>}{user ? <><span className="text-sm text-slate-300">{user.email}</span><button disabled={busy} onClick={() => void action(async () => { await api("/auth/logout", "POST", {}); setUser(null); setMerchants([]); setDashboard(null); window.location.assign("/login"); })}>Sign out</button></> : <><a href="/login">Sign in</a><a href="/register">Create account</a></>}</nav></div></header>
  <main className="mx-auto max-w-6xl px-6 py-12"><p className="text-sm uppercase tracking-widest text-cyan-300">AI Business Operating System · Malaysia</p><h1 className="mt-4 text-4xl font-bold sm:text-5xl">{title}</h1>{error && <p role="alert" className="mt-6 rounded-lg border border-rose-500 bg-rose-950 p-4">{error}</p>}{notice && <p role="status" className="mt-6 rounded-lg bg-emerald-950 p-4">{notice}</p>}
  {loading ? <p className="mt-8" role="status">Loading your workspace…</p> : !user ? <section className="mt-10 max-w-md rounded-2xl border border-slate-700 bg-slate-900/60 p-6"><h2 className="text-2xl font-semibold">{screen === "register" ? "Create your account" : "Sign in to NEXORA"}</h2><form onSubmit={authenticate} className="mt-6 space-y-5"><label className="block">Email<input className={field} name="email" type="email" autoComplete="email" required maxLength={254}/></label><label className="block">Password<input className={field} name="password" type="password" autoComplete={screen === "register" ? "new-password" : "current-password"} required minLength={12} maxLength={128}/></label><p className="text-sm text-slate-400">Use 12–128 characters.</p><button className={button} disabled={busy}>{screen === "register" ? "Register" : "Sign in"}</button></form><p className="mt-6"><a className="text-cyan-300" href={screen === "register" ? "/login" : "/register"}>{screen === "register" ? "Already registered? Sign in" : "New here? Create account"}</a></p></section> : <div className="mt-10 space-y-8">
  {portal === "customer" && <section className="rounded-2xl border border-slate-700 p-6"><h2 className="text-2xl font-semibold">Welcome to NEXORA</h2><p className="mt-3 text-slate-300">Visit a merchant’s /s/ store link to browse products and services.</p><a className="mt-4 inline-block text-cyan-300" href="/account/orders">My orders</a></section>}
  {portal === "admin" && (user.platformAdmin && overview ? <section className="grid gap-5 sm:grid-cols-2"><article className="rounded-xl border border-slate-700 p-6"><h2>Registered users</h2><p className="mt-3 text-4xl">{overview.users}</p></article><article className="rounded-xl border border-slate-700 p-6"><h2>Merchants</h2><p className="mt-3 text-4xl">{overview.merchants}</p></article></section> : <p role="alert" className="rounded-xl border border-amber-500 p-6">Platform administrator access is required. Merchant roles do not grant platform access.</p>)}
  {portal === "merchant" && <><div className="grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border border-slate-700 p-6"><h2 className="text-xl font-semibold">Your merchants</h2>{merchants.length ? <label className="mt-5 block">Active merchant<select className={field} aria-label="Active merchant" value={user.activeTenantId ?? ""} disabled={busy} onChange={e => { const id=e.target.value; if(id) void action(async () => { await api(`/tenants/${id}/switch`, "POST", {}); await refresh(); }); }}><option value="" disabled>Select a merchant</option>{merchants.map(m => <option key={m.tenant.id} value={m.tenant.id}>{m.tenant.name} · {m.role}</option>)}</select></label> : <p className="mt-5 text-slate-300">Create your first merchant to begin.</p>}</section>
  <section className="rounded-2xl border border-slate-700 p-6"><h2 className="text-xl font-semibold">Create a merchant</h2><form className="mt-5 space-y-4" onSubmit={e => { e.preventDefault(); const form=e.currentTarget; const name=new FormData(form).get("name"); void action(async () => { await api("/tenants", "POST", { name }); form.reset(); await refresh(); }); }}><label className="block">Merchant name<input className={field} name="name" required maxLength={120}/></label><button className={button} disabled={busy}>Create merchant</button></form></section></div>
  {dashboard && <section className="rounded-2xl border border-slate-700 p-6"><p className="text-sm text-cyan-300">Merchant Dashboard</p><h2 className="mt-2 text-3xl font-semibold" data-testid="merchant-name">{dashboard.tenant.name}</h2><div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-slate-900 p-5"><p>Your role</p><p className="mt-2 text-2xl" data-testid="merchant-role">{dashboard.role}</p></div><div className="rounded-xl bg-slate-900 p-5"><p>Team members</p><p className="mt-2 text-2xl">{dashboard.members}</p></div></div>
  {dashboard.role !== "STAFF" && <form className="mt-8 max-w-lg space-y-4" onSubmit={e => { e.preventDefault(); const name=new FormData(e.currentTarget).get("name"); void action(async () => { await api(`/tenants/${dashboard.tenant.id}`, "PATCH", {name}); await refresh(); setNotice("Merchant updated"); }); }}><label className="block">New merchant name<input className={field} name="name" required maxLength={120}/></label><button className={button} disabled={busy}>Save name</button></form>}
  {dashboard.role === "OWNER" && <form className="mt-8 max-w-lg space-y-4 border-t border-slate-700 pt-6" onSubmit={e => { e.preventDefault(); const form=new FormData(e.currentTarget); void action(async () => { await api(`/tenants/${dashboard.tenant.id}/members`, "POST", {email:form.get("email"), role:form.get("role")}); await refresh(); setNotice("Team member added"); }); }}><h3 className="text-xl font-semibold">Add a registered team member</h3><label className="block">Team member email<input className={field} name="email" type="email" required/></label><label className="block">Role<select className={field} name="role" aria-label="Role"><option value="STAFF">Staff</option><option value="MANAGER">Manager</option></select></label><button className={button} disabled={busy}>Add team member</button></form>}</section>}</>}
  </div>}</main><footer className="mx-auto max-w-6xl px-6 py-10 text-sm text-slate-400">NEXORA · Built for businesses in Malaysia</footer></div>;
}

export {SupportChat,useSupportRealtime,supportApi,supportField,supportButton} from "./support";
