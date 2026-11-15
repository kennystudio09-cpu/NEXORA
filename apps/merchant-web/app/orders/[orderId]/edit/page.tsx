import {OrderForm} from "../../_components/form";
export default async function Page({params}:{params:Promise<{orderId:string}>}){return <OrderForm id={(await params).orderId}/>;}
