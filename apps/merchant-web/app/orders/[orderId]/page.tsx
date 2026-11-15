import {OrderDetail} from "../_components/detail";
export default async function Page({params}:{params:Promise<{orderId:string}>}){return <OrderDetail id={(await params).orderId}/>;}
