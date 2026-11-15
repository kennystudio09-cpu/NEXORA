import {PublicCatalog} from "../../../catalog";
export default async function Page({params}:{params:Promise<{slug:string;itemId:string}>}){const {slug,itemId}=await params;return <PublicCatalog slug={slug} itemId={itemId}/>;}
