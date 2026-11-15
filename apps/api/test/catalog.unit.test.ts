import {test} from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {Prisma} from "@nexora/database";
import {price,parseItem,parseVariant,query,storeInput} from "../src/catalog.validation";
import {sanitizeImage,MAX_UPLOAD} from "../src/catalog.image";
test("catalog Decimal preserves exact large and fractional prices and rejects floats/exponents",()=>{
 for(const value of ["0","0.1","0.0001","99999999999999.9999"]){assert.equal(price(value),value);assert.equal(new Prisma.Decimal(value).toFixed(4),value.includes(".")?value.padEnd(value.indexOf(".")+5,"0"):value+".0000");}
 assert.equal(new Prisma.Decimal(price("0.1")).plus(price("0.2")).toFixed(4),"0.3000");
 for(const value of [0.1,-1,"-1","NaN","Infinity","1e3","0.00001","100000000000000","01.2",".5"," 1.00",null])assert.throws(()=>price(value));
});
test("catalog input allowlists types, currency, tenant-controlled fields and pagination",()=>{
 assert.deepEqual(parseItem({name:" Therapy ",basePrice:"29.9900",itemType:"SERVICE",sku:" service-1 "}),{name:"Therapy",basePrice:"29.9900",itemType:"SERVICE",sku:"SERVICE-1"});
 for(const itemType of ["PRODUCT","SERVICE","DIGITAL","BUNDLE"])assert.equal(parseItem({name:"x",basePrice:"0",itemType}).itemType,itemType);
 for(const body of [{name:"x",basePrice:"1",tenantId:"fake"},{name:"x",basePrice:"1",currencyCode:"XXX"},{name:"x",basePrice:"1",itemType:"UNKNOWN"},{name:"x",basePrice:"1",status:"PUBLIC"},{}])assert.throws(()=>parseItem(body));
 assert.throws(()=>parseVariant({name:"x",price:"1",itemId:"fake"}));assert.throws(()=>parseVariant({name:"x",price:1}));assert.throws(()=>query({status:"DRAFT"},true));assert.throws(()=>query({pageSize:"101"}));assert.throws(()=>storeInput({slug:"../private",published:true}));assert.throws(()=>storeInput({slug:"valid-slug",published:"true"}));
});
test("image sanitizer decodes content, re-encodes safely and rejects spoofed/corrupt/large files",async()=>{
 const png=await sharp({create:{width:12,height:8,channels:3,background:"red"}}).png().toBuffer();
 const image=await sanitizeImage({buffer:png,mimetype:"image/png",originalname:"sample.png"});assert.equal(image.mimeType,"image/webp");assert.equal(image.width,12);assert.equal((await sharp(image.content).metadata()).format,"webp");
 for(const file of [undefined,{buffer:Buffer.from('<svg onload="alert(1)"/>'),mimetype:"image/svg+xml",originalname:"x.svg"},{buffer:png,mimetype:"image/jpeg",originalname:"spoof.jpg"},{buffer:png,mimetype:"image/png",originalname:"../x.png"},{buffer:png.subarray(0,24),mimetype:"image/png",originalname:"truncated.png"},{buffer:Buffer.alloc(MAX_UPLOAD+1),mimetype:"image/png",originalname:"large.png"}])await assert.rejects(()=>sanitizeImage(file));
 const bomb=await sharp({create:{width:4001,height:4001,channels:3,background:"red"}}).png().toBuffer();await assert.rejects(()=>sanitizeImage({buffer:bomb,mimetype:"image/png",originalname:"pixels.png"}));
});
