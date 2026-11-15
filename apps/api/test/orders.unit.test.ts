import {test} from "node:test";
import assert from "node:assert/strict";
import {ORDER_STATUSES} from "@nexora/shared";
import {createInput,editInput,changeInput,idempotencyKey,assertTransition,listQuery} from "../src/orders.validation";
import {totals} from "../src/orders.money";
test("order amounts use high precision Decimal beyond default 20 significant digits",()=>{
 assert.deepEqual(totals([{unitPrice:"0.1000",quantity:3},{unitPrice:"0.2000",quantity:2}]),{lineTotals:["0.3000","0.4000"],subtotal:"0.7000",discountTotal:"0.0000",taxTotal:"0.0000",grandTotal:"0.7000"});
 const big=totals([{unitPrice:"99999999999999.9999",quantity:10000},{unitPrice:"0.0001",quantity:1}]);assert.equal(big.grandTotal,"999999999999999999.0001");
 assert.equal(totals(Array.from({length:100},()=>({unitPrice:"99999999999999.9999",quantity:10000}))).grandTotal,"99999999999999999900.0000");
 assert.throws(()=>totals([{unitPrice:"100000000000000000000",quantity:1}]));
});
test("order allowlists reject client money, tenant, source, ownership and invalid quantities",()=>{
 const valid={items:[{catalogItemId:"one",quantity:2}]};assert.deepEqual(createInput(valid),{items:[{catalogItemId:"one",catalogVariantId:null,quantity:2}],contactId:null,notes:"",initialStatus:"DRAFT"});
 for(const field of ["tenantId","currencyCode","grandTotal","subtotal","discountTotal","taxTotal","source","customerUserId","createdById"])assert.throws(()=>createInput({...valid,[field]:"forged"}));
 for(const quantity of [0,-1,1.5,"2",10001,NaN])assert.throws(()=>createInput({items:[{catalogItemId:"one",quantity}]}));
 for(const bad of [{items:[]},{items:Array(101).fill(valid.items[0])},{items:[...valid.items,...valid.items]},{items:[{...valid.items[0],unitPriceSnapshot:"0"}]},{...valid,initialStatus:"COMPLETED"}])assert.throws(()=>createInput(bad));
});
test("state machine forbids skipping processing, reversing or leaving terminal states",()=>{
 for(const [from,to]of[["DRAFT","PENDING"],["DRAFT","CONFIRMED"],["PENDING","CONFIRMED"],["CONFIRMED","PROCESSING"],["PROCESSING","COMPLETED"]]as const)assert.doesNotThrow(()=>assertTransition(from,to));
 for(const from of ["DRAFT","PENDING","CONFIRMED","PROCESSING"]as const)assert.doesNotThrow(()=>assertTransition(from,"CANCELLED"));
 for(const [from,to]of[["DRAFT","COMPLETED"],["PENDING","PROCESSING"],["PENDING","COMPLETED"],["CONFIRMED","COMPLETED"],["PROCESSING","PENDING"],["CONFIRMED","DRAFT"]]as const)assert.throws(()=>assertTransition(from,to));
 for(const from of ["COMPLETED","CANCELLED"]as const)for(const to of ORDER_STATUSES)assert.throws(()=>assertTransition(from,to));
});
test("mutations require versions; keys and list queries are bounded",()=>{
 for(const value of [{},{version:0},{version:"1"},{version:1,grandTotal:"0"}])assert.throws(()=>changeInput(value));
 assert.throws(()=>editInput({version:1,status:"COMPLETED"}));assert.throws(()=>editInput({version:1,status:"PENDING",notes:"mixed mutation"}));assert.throws(()=>editInput({version:1,quoteHash:"a".repeat(64)}));
 assert.equal(idempotencyKey("abcdef12-3456"),"abcdef12-3456");for(const key of [undefined,"short","x".repeat(129),["duplicate"],"bad key value"])assert.throws(()=>idempotencyKey(key));
 for(const q of [{tenantId:"fake"},{pageSize:"101"},{status:"UNKNOWN"},{source:"UNKNOWN"},{page:["1","2"]}])assert.throws(()=>listQuery(q));assert.throws(()=>listQuery({contactId:"fake"},true));
});
