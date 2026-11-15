"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { crmApi, message, field, ApiError } from "./api";
type Membership = {role:"OWNER"|"MANAGER"|"STAFF";tenant:{id:string;name:string}};
type Scope = { tenantId: string; role: Membership["role"]; canEdit: boolean };
const Context = createContext<Scope | null>(null);
export function useCrm() {
  const scope = useContext(Context);
  if (!scope) throw new Error("CRM workspace is required");
  return scope;
}
export function CrmWorkspace({children}:{children:ReactNode}) {
  const [memberships,setMemberships]=useState<Membership[]>([]);
  const [scope,setScope]=useState<Scope|null>(null);
  const [loading,setLoading]=useState(true);
  const [switching,setSwitching]=useState(false);
  const [error,setError]=useState("");
  const [signedOut,setSignedOut]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    async function load(){
      const me=await crmApi<{activeTenantId:string|null}>("/auth/me",{signal:controller.signal});
      const list=await crmApi<Membership[]>("/tenants",{signal:controller.signal});
      const selected=list.find(m=>m.tenant.id===me.activeTenantId);
      if(controller.signal.aborted)return;
      setMemberships(list);
      if(selected)setScope({tenantId:selected.tenant.id,role:selected.role,canEdit:selected.role!=="STAFF"});
    }
    load().catch(e=>{if(!controller.signal.aborted){setSignedOut(e instanceof ApiError&&e.status===401);setError(message(e));}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[]);
  async function switchTenant(id:string){
    setSwitching(true);setError("");
    try{await crmApi(`/tenants/${id}/switch`,{method:"POST",body:{}});window.location.assign("/crm");}
    catch(e){setError(message(e));setSwitching(false);}
  }
  return <div className="min-h-screen"><header className="border-b border-slate-700"><nav aria-label="Merchant navigation" className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-5 py-5"><Link className="mr-auto text-xl font-bold tracking-widest text-cyan-300" href="/">NEXORA</Link><Link href="/dashboard">Dashboard</Link><Link href="/crm" aria-current="page">Customers</Link></nav></header><main className="mx-auto max-w-6xl px-5 py-8"><p className="text-sm uppercase tracking-widest text-cyan-300">Merchant workspace</p><h1 className="mt-3 text-3xl font-bold sm:text-4xl">Customer CRM</h1>{error&&<p role="alert" className="my-5 rounded-lg border border-rose-500 p-4">{error}</p>}{loading?<p className="mt-8" role="status">Loading CRM…</p>:signedOut?<p className="mt-8"><Link className="text-cyan-300" href="/login">Sign in to access your merchants</Link></p>:<><div className="my-7 flex flex-wrap items-end gap-4"><label className="block min-w-0 max-w-full flex-1 sm:max-w-md">CRM merchant<select className={field} aria-label="CRM merchant" value={scope?.tenantId??""} disabled={switching} onChange={e=>void switchTenant(e.target.value)}><option value="" disabled>Select a merchant</option>{memberships.map(m=><option key={m.tenant.id} value={m.tenant.id}>{m.tenant.name} · {m.role}</option>)}</select></label>{scope&&<p className="py-3 text-sm text-slate-300">Your role: <span data-testid="crm-role">{scope.role}</span></p>}</div>{switching?<p role="status">Switching merchant…</p>:scope?<Context.Provider value={scope}><div key={scope.tenantId}>{children}</div></Context.Provider>:<p>Select a merchant, or <Link className="text-cyan-300" href="/dashboard">create one on your Dashboard</Link>.</p>}</>}</main></div>;
}
