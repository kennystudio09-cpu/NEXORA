"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { CUSTOMER_STATUSES, type CustomerRecord, type PageResult } from "@nexora/shared";
import { useCrm } from "./workspace";
import { crmApi, message, field, button, panel } from "./api";
export function CustomerList(){
  const {tenantId,canEdit}=useCrm();
  const [filters,setFilters]=useState({q:"",status:"",tag:"",pageSize:"20"});
  const [page,setPage]=useState(1);
  const [result,setResult]=useState<PageResult<CustomerRecord>|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError("");setResult(null);
    const query=new URLSearchParams({...filters,page:String(page)});
    crmApi<PageResult<CustomerRecord>>(`/tenants/${tenantId}/customers?${query}`,{signal:controller.signal}).then(result=>{if(!controller.signal.aborted)setResult(result);}).catch(e=>{if(!controller.signal.aborted)setError(message(e));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[tenantId,filters,page]);
  function search(event:FormEvent<HTMLFormElement>){event.preventDefault();const data=new FormData(event.currentTarget);setPage(1);setFilters({q:String(data.get("q")??""),status:String(data.get("status")??""),tag:String(data.get("tag")??""),pageSize:String(data.get("pageSize")??"20")});}
  return <><div className="mb-6 flex flex-wrap items-center justify-between gap-4"><h2 className="text-2xl font-semibold">Customers</h2>{canEdit&&<Link className={button} href="/crm/new">New customer</Link>}</div><form aria-label="Customer filters" onSubmit={search} className={`${panel} mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5`}><label>Search<input name="q" className={field} maxLength={120} placeholder="Name, email or phone"/></label><label>Status<select name="status" aria-label="Filter status" className={field}><option value="">All statuses</option>{CUSTOMER_STATUSES.map(s=><option key={s}>{s}</option>)}</select></label><label>Tag<input name="tag" className={field} maxLength={32} placeholder="e.g. vip"/></label><label>Per page<select name="pageSize" aria-label="Per page" className={field}><option>20</option><option>10</option><option>50</option></select></label><button className={`${button} self-end`} type="submit">Apply filters</button></form>{error&&<p role="alert" className="my-5 border border-rose-500 p-4">{error}</p>}{loading?<p role="status">Loading customers…</p>:result&&<><p role="status" className="mb-4 text-slate-300">{result.total} customers found</p>{result.items.length?<ul className="grid gap-4 sm:grid-cols-2">{result.items.map(c=><li key={c.id} className={`${panel} min-w-0 break-words`}><div className="flex flex-wrap items-start justify-between gap-2"><Link className="text-xl font-semibold text-cyan-300" href={`/crm/${c.id}`}>{c.name}</Link><span className="rounded-full bg-slate-800 px-3 py-1 text-xs">{c.status}</span></div><p className="mt-3 text-sm text-slate-300">{c.email||"No email"}</p><p className="mt-2 text-sm text-slate-300">{c.phone||"No phone"}</p><div className="mt-4 flex flex-wrap gap-2">{c.tags.map(tag=><span key={tag} className="rounded bg-cyan-950 px-2 py-1 text-sm text-cyan-200">{tag}</span>)}</div></li>)}</ul>:<div className={panel}><h3 className="text-lg font-semibold">No customers found</h3><p className="mt-2 text-slate-300">Try another filter{canEdit?" or add your first customer":""}.</p></div>}<nav aria-label="Customer pagination" className="mt-6 flex flex-wrap items-center justify-between gap-4"><button className={button} disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><p>Page {result.page} of {Math.max(1,result.totalPages)}</p><button className={button} disabled={page>=result.totalPages} onClick={()=>setPage(p=>p+1)}>Next</button></nav></>}</>;
}
