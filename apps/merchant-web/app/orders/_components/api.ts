import {ApiError} from "../../crm/_components/api";
export async function orderApi<T>(path:string,options:{method?:string;body?:unknown;signal?:AbortSignal;key?:string}={}):Promise<T>{
 const res=await fetch(`/api${path}`,{method:options.method??"GET",credentials:"same-origin",cache:"no-store",signal:options.signal,headers:{"content-type":"application/json","x-nexora-request":"1",...(options.key?{"idempotency-key":options.key}:{})},...(options.body===undefined?{}:{body:JSON.stringify(options.body)})});const value=await res.json();if(!res.ok)throw new ApiError(res.status,typeof value.message==="string"?value.message:"Request failed");return value as T;
}
export function orderError(e:unknown){return e instanceof ApiError?(e.status===409?"conflict":e.status===404||e.status===401||e.status===403?"missing":e.status===400?"invalid":"error"):"error";}
