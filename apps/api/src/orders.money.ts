import {BadRequestException} from "@nestjs/common";
import {Prisma} from "@nexora/database";
const Money=Prisma.Decimal.clone({precision:40,rounding:Prisma.Decimal.ROUND_HALF_UP});
export function totals(prices:Array<{unitPrice:string;quantity:number}>){
 const lineTotals=prices.map(p=>new Money(p.unitPrice).times(String(p.quantity)));const subtotal=lineTotals.reduce((a,b)=>a.plus(b),new Money("0"));
 if(!subtotal.isFinite()||subtotal.isNegative()||subtotal.gte("100000000000000000000"))throw new BadRequestException("Order amount exceeds supported range");
 return {lineTotals:lineTotals.map(v=>v.toFixed(4)),subtotal:subtotal.toFixed(4),discountTotal:"0.0000",taxTotal:"0.0000",grandTotal:subtotal.toFixed(4)};
}
