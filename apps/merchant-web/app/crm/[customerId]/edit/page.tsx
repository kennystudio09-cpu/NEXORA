import { CustomerForm } from "../../_components/form";
export default async function Page({params}:{params:Promise<{customerId:string}>}){const {customerId}=await params;return <CustomerForm id={customerId}/>;}
