import { test } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { parseCustomer, parseCustomerQuery, parseFollowUp } from "../src/crm.validation";

test("customer normalization preserves notes, clears optional contacts and deduplicates tags",()=>{
  assert.deepEqual(parseCustomer({name:"  Aisyah Tan  ",email:" ALICE@EXAMPLE.TEST ",phone:" +60 12-345 6789 ",tags:[" VIP ","vip","Retail"],notes:"  Call next week\nIn MYT  ",status:"ACTIVE"}),{name:"Aisyah Tan",email:"alice@example.test",phone:"+60 12-345 6789",tags:["vip","retail"],notes:"Call next week\nIn MYT",status:"ACTIVE"});
  assert.deepEqual(parseCustomer({email:"",phone:null,notes:"",tags:[]},true),{email:null,phone:null,notes:"",tags:[]});
});
test("customer input rejects overposting, invalid types and bounded values",()=>{
  for(const value of [null,[],"x",{}, {name:" "},{name:"x".repeat(121)},{name:"Valid",email:"bad"},{name:"Valid",phone:"not a phone"},{name:"Valid",tags:[" "]},{name:"Valid",tags:Array(11).fill("vip")},{name:"Valid",tags:["x".repeat(33)]},{name:"Valid",notes:"x".repeat(4001)},{name:"Valid",status:"ADMIN"},{name:"Valid",tenantId:"forged"},{name:"Valid",id:"forged"},{name:"Valid",name2:"extra"},{name:"Null\u0000byte"}]) assert.throws(()=>parseCustomer(value),BadRequestException);
  assert.throws(()=>parseCustomer({},true),BadRequestException);
  assert.deepEqual(parseCustomer({status:"INACTIVE"},true),{status:"INACTIVE"});
});
test("list queries bound pagination and reject unexpected or repeated fields",()=>{
  assert.deepEqual(parseCustomerQuery({}),{page:1,pageSize:20});
  assert.deepEqual(parseCustomerQuery({page:"2",pageSize:"10",q:" Tan ",status:"ACTIVE",tag:"VIP"}),{page:2,pageSize:10,q:"Tan",status:"ACTIVE",tag:"vip"});
  for(const value of [{page:"0"},{page:"-1"},{page:"1.5"},{page:"1e2"},{page:"10001"},{pageSize:"101"},{pageSize:"0"},{page:["1","2"]},{q:["a","b"]},{tenantId:"forged"},{status:"INVALID"},{tag:"x".repeat(33)}]) assert.throws(()=>parseCustomerQuery(value),BadRequestException);
  assert.throws(()=>parseCustomerQuery({q:"not permitted"},true),BadRequestException);
});
test("follow-ups accept bounded content and reject forged author, tenant and time",()=>{
  assert.deepEqual(parseFollowUp({content:"  Called customer  "}),{content:"Called customer"});
  for(const value of [{content:""},{content:"x".repeat(2001)},{content:"OK",authorId:"forged"},{content:"OK",tenant_id:"forged"},{content:"OK",occurredAt:"2000-01-01"},[]]) assert.throws(()=>parseFollowUp(value),BadRequestException);
});
