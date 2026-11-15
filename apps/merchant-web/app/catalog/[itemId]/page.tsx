import {ItemDetail} from "../_components/detail";
export default async function Page({params}:{params:Promise<{itemId:string}>}){return <ItemDetail id={(await params).itemId}/>;}
