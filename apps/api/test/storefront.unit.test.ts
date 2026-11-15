import {test} from "node:test";
import assert from "node:assert/strict";
import {parseCart,addCartLine,safeCustomerReturn,shopText} from "@nexora/shared";
import {checkoutInput,profileInput} from "../src/storefront.validation";
const line={catalogItemId:"real",catalogVariantId:null,quantity:2,name:"Item",variantName:null};
test("cart envelope separates immutable storefront keys and strips untrusted prices",()=>{
 assert.deepEqual(parseCart({storefrontKey:"a",lines:[{...line,price:"0"}]},"b"),[]);
 assert.deepEqual(parseCart({storefrontKey:"a",lines:[{...line,price:"0"}]},"a"),[line]);
 assert.deepEqual(parseCart({storefrontKey:"a",lines:[line,line]},"a"),[]);
 for(const quantity of[0,-1,1.5,10001,Infinity])assert.deepEqual(parseCart({storefrontKey:"a",lines:[{...line,quantity}]},"a"),[]);
 assert.equal(addCartLine([line],line)[0].quantity,4);assert.throws(()=>addCartLine([{...line,quantity:10000}],line));
});
test("customer return paths cannot escape portal and identity/price overposting is rejected",()=>{
 for(const input of["https://evil.test","//evil.test","/s/../../api/auth/logout","/s/\\evil","/dashboard"])assert.equal(safeCustomerReturn(input),"/account/orders");
 assert.equal(safeCustomerReturn("/s/merchant/checkout?x=1"),"/s/merchant/checkout?x=1");
 const input={displayName:"Buyer",items:[{catalogItemId:"item",quantity:1}]};
 for(const extra of[{tenantId:"other"},{contactId:"claim"},{userId:"other"},{grandTotal:"0"},{paymentStatus:"PAID"},{status:"COMPLETED"}])assert.throws(()=>checkoutInput({...input,...extra}));
 assert.throws(()=>profileInput({email:"javascript:alert(1)"}));assert.throws(()=>profileInput({phone:"javascript:evil"}));assert.throws(()=>profileInput({logoData:"unverified"}));
 for(const lang of["en","zh","ms"]as const)for(const key of["unpaid","submit","cart","noContact","aiPlaceholder"])assert.notEqual(shopText(lang,key),key);
});
