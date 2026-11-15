import {ShopWorkspace} from "../_components/workspace";
export default async function Layout({children,params}:{children:React.ReactNode;params:Promise<{merchantSlug:string}>}){return <ShopWorkspace slug={(await params).merchantSlug}>{children}</ShopWorkspace>;}
