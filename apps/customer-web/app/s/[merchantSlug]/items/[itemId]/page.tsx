import {ShopCatalog} from "../../../_components/catalog";
export default async function Page({params}:{params:Promise<{itemId:string}>}){return <ShopCatalog itemId={(await params).itemId}/>;}
