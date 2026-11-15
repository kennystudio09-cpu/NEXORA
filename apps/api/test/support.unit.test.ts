import {test} from "node:test";
import assert from "node:assert/strict";
import {supportMessage,supportOpen,supportRead,supportVersion,supportCursor,supportQuery} from "../src/support.validation";
import {supportText} from "@nexora/shared";
test("support rejects spoofed identities, attachments, roles and malformed content",()=>{
 for(const extra of[{tenantId:"fake"},{senderId:"fake"},{senderType:"AI"},{role:"OWNER"},{attachment:"file"}])assert.throws(()=>supportMessage({content:"Hi",...extra}));
 for(const content of["", "  ","x".repeat(4001),"bad\0text",99,null])assert.throws(()=>supportMessage({content}));
 assert.deepEqual(supportMessage({content:" <script>alert(1)</script> "}),{content:"<script>alert(1)</script>"});assert.throws(()=>supportOpen({displayName:"Buyer",contactId:"claim"}));
});
test("support cursors and version controls validate bounded integers and allowlisted queries",()=>{
 for(const throughSequence of[-1,1.5,"1",null])assert.throws(()=>supportRead({throughSequence}));
 assert.equal(supportRead({throughSequence:0}),0);assert.throws(()=>supportVersion({version:0}));assert.throws(()=>supportVersion({version:1,senderId:"fake"}));
 for(const q of[{after:"-1"},{limit:"101"},{limit:"0"},{after:"1.2"},{tenantId:"other"}])assert.throws(()=>supportCursor(q));assert.throws(()=>supportQuery({status:"UNKNOWN"}));assert.throws(()=>supportQuery({customerUserId:"other"}));assert.deepEqual(supportCursor({}),{after:0,limit:50});
});
test("human support labels exist in English, Chinese and Malay without promising presence or AI",()=>{
 for(const lang of["en","zh","ms"]as const)for(const key of["inbox","humanNotice","ai","attachments","send","read","reconnecting","assign"])assert.notEqual(supportText(lang,key),key);
});
