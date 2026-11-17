const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const content=fs.readFileSync(path.join(__dirname,'../lib/zalo-lead-notify.ts'),'utf8');
const exports={};
const context={
 exports,require,console,AbortSignal,
 process:{env:{}},fetch:async()=>{throw new Error('Unexpected fetch');}
};
vm.runInNewContext(ts.transpileModule(content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const lead={name:'Nguyễn Văn A',source:'Google Ads',need:'Gia công toner\nserum',sales:'Kimmy',date:'2026-11-17',phone:'0900123456',email:'private@example.com',note:'Private sale note'};
(async()=>{
 const msg=exports.formatZaloLeadMessage(lead);
 assert.ok(msg.includes('Nguyễn Văn A'));
 assert.ok(msg.includes('Gia công toner serum'));
 assert.ok(msg.includes('Kimmy'));
 assert.ok(!msg.includes(lead.phone));
 assert.ok(!msg.includes(lead.email));
 assert.ok(!msg.includes(lead.note));
 assert.equal(await exports.notifyZaloNewLead(lead),'not_configured');
 context.process.env.ZALO_BOT_TOKEN='123456:example-token';
 context.process.env.ZALO_SALES_GROUP_ID='zgr-testgroup';
 let call;
 context.fetch=async(url,options)=>{call={url,options};return {ok:true,status:200,json:async()=>({ok:true})};};
 assert.equal(await exports.notifyZaloNewLead(lead),'sent');
 assert.equal(call.options.method,'POST');
 assert.equal(JSON.parse(call.options.body).chat_id,'zgr-testgroup');
 assert.equal(JSON.parse(call.options.body).text,msg);
 assert.ok(!call.url.includes(lead.phone));
 context.fetch=async()=>({ok:true,status:200,json:async()=>({ok:false,error_code:403})});
 await assert.rejects(()=>exports.notifyZaloNewLead(lead),/ZALO_SEND_FAILED_403/);
 context.process.env.ZALO_SALES_GROUP_ID='not-a-group';
 await assert.rejects(()=>exports.notifyZaloNewLead(lead),/ZALO_INVALID_GROUP_ID/);
 console.log('PASS: Zalo notification payload, privacy, configuration and response handling.');
})().catch(err=>{console.error(err);process.exitCode=1});
