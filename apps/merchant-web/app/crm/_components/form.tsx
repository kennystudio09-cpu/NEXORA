"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CUSTOMER_STATUSES, type CustomerRecord } from "@nexora/shared";
import { useCrm } from "./workspace";
import { crmApi, message, field, button, panel } from "./api";
export function CustomerForm({id}:{id?:string}){
  const {tenantId,canEdit}=useCrm();const router=useRouter();
  const [customer,setCustomer]=useState<CustomerRecord|null>(null);
  const [loading,setLoading]=useState(Boolean(id));const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  useEffect(()=>{
    if(!id||!canEdit)return;
    const controller=new AbortController();setLoading(true);setCustomer(null);setError("");
    crmApi<CustomerRecord>(`/tenants/${tenantId}/customers/${id}`,{signal:controller.signal}).then(customer=>{if(!controller.signal.aborted)setCustomer(customer);}).catch(e=>{if(!controller.signal.aborted)setError(message(e));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[tenantId,id,canEdit]);
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=new FormData(event.currentTarget);setBusy(true);setError("");
    try{
      const body={name:form.get("name"),email:form.get("email"),phone:form.get("phone"),status:form.get("status"),tags:String(form.get("tags")??"").split(",").map(s=>s.trim()).filter(Boolean),notes:form.get("notes")};
      const saved=await crmApi<CustomerRecord>(`/tenants/${tenantId}/customers${id?`/${id}`:""}`,{method:id?"PATCH":"POST",body});
      router.push(`/crm/${saved.id}`);
    }catch(e){setError(message(e));setBusy(false);}
  }
  if(!canEdit)return <p role="alert">Only Owners and Managers can create or edit customer profiles. <Link href="/crm" className="text-cyan-300">Back to customers</Link></p>;
  return <div className="max-w-3xl"><Link href="/crm" className="text-cyan-300">← Customers</Link><h2 className="my-6 text-2xl font-semibold">{id?"Edit customer":"New customer"}</h2>{error&&<p role="alert" className="my-5 rounded border border-rose-500 p-4">{error}</p>}{loading?<p role="status">Loading customer…</p>:(!id||customer)&&<form onSubmit={save} className={`${panel} space-y-5`}><div className="grid gap-5 sm:grid-cols-2"><label className="sm:col-span-2">Customer name<input className={field} name="name" required maxLength={120} defaultValue={customer?.name}/></label><label>Email<input className={field} name="email" type="email" maxLength={254} defaultValue={customer?.email??""}/></label><label>Phone<input className={field} name="phone" type="tel" maxLength={40} defaultValue={customer?.phone??""} placeholder="+60 12-345 6789"/></label><label>Status<select className={field} name="status" aria-label="Customer status" defaultValue={customer?.status??"LEAD"}>{CUSTOMER_STATUSES.map(s=><option key={s}>{s}</option>)}</select></label><div><label htmlFor="customer-tags">Tags</label><input id="customer-tags" className={field} name="tags" maxLength={329} defaultValue={customer?.tags.join(", ")??""} aria-describedby="tag-help"/><span id="tag-help" className="mt-2 block text-xs text-slate-400">Comma-separated, up to 10 tags of 32 characters each.</span></div></div><div><label className="block" htmlFor="customer-notes">Notes</label><textarea id="customer-notes" className={field} name="notes" rows={5} maxLength={4000} defaultValue={customer?.notes??""}/></div><div className="flex flex-wrap items-center gap-5"><button className={button} disabled={busy}>Save customer</button><Link href={id?`/crm/${id}`:"/crm"}>Cancel</Link></div></form>}</div>;
}
