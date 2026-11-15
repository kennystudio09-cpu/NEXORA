import {ItemForm} from "../../_components/form";
export default async function Page({params}:{params:Promise<{itemId:string}>}){return <ItemForm id={(await params).itemId}/>;}
