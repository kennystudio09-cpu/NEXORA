import {PublicCatalog} from "../catalog";
export default async function Page({params}:{params:Promise<{slug:string}>}){return <PublicCatalog slug={(await params).slug}/>;}
