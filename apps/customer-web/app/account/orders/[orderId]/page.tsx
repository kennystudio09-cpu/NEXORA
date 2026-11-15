import {CustomerOrders} from "../../_components/account";
export default async function Page({params}:{params:Promise<{orderId:string}>}){const {orderId}=await params;return <CustomerOrders id={orderId}/>;}
