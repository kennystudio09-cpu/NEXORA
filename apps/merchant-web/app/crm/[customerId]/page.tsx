import { CustomerDetail } from "../_components/detail";
export default async function Page({params}:{params:Promise<{customerId:string}>}){const {customerId}=await params;return <CustomerDetail id={customerId}/>;}
