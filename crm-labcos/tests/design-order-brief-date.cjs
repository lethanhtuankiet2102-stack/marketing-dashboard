const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript'),path=require('path');
const root=path.resolve(__dirname,'..');
class Clock extends Date{constructor(value){super(value===undefined?'2026-10-30T18:30:00.000Z':value);}static now(){return Date.parse('2026-10-30T18:30:00.000Z');}}
function mod(file,mocks={},date=Date){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>mocks[n]||require(n),Error,Response,Request,URL,Intl,Date:date,structuredClone,Buffer,process});return exports;}
const model=mod('app/designer-model.ts'),ordersModel=mod('app/design-orders-model.ts',{'./designer-model':model});
let orders=[];const config={levels:[{id:'L1',points:1}],taskDefaults:{Banner:'L1'},items:[]};
const route=mod('app/api/design-orders/route.ts',{'../../chatgpt-auth':{getChatGPTUser:async()=>({email:'sales@test.com',displayName:'Sales',role:'sale_oem'})},'../../../lib/private-store':{readPrivate:async(p,f)=>p.includes('designer.json')?config:orders,transactPrivate:async(p,f,fn)=>{orders=fn(structuredClone(orders));return orders;}},'../../design-orders-model':ordersModel},Clock);
const input=()=>({...ordersModel.blankOrder,id:require('crypto').randomUUID(),name:'Brief date test',platform:'Task Phát Sinh',taskType:'Banner',brief:'Test'});
const req=body=>new Request('https://crm.test/api/design-orders',{method:'POST',headers:{origin:'https://crm.test'},body:JSON.stringify(body)});
(async()=>{
 for(const omit of [false,true]){const body=input();if(omit)delete body.briefDate;const response=await route.POST(req(body));assert.equal(response.status,201);const order=(await response.json()).order;assert.equal(order.briefDate,'2026-10-31');assert.equal(order.createdAt,'2026-10-30T18:30:00.000Z');}
 const body={...input(),briefDate:'2026-09-15'};let response=await route.POST(req(body));assert.equal(response.status,201);let order=(await response.json()).order;assert.equal(order.briefDate,'2026-09-15');assert.equal(ordersModel.orderTask(order).period,'2026-09');
 // POST retry must not change the date or create a duplicate.
 const before=orders.length;assert.equal((await route.POST(req({...body,briefDate:'2026-08-01'}))).status,201);assert.equal(orders.length,before);assert.equal(orders.find(o=>o.id===body.id).briefDate,'2026-09-15');
 for(const briefDate of ['2026-02-30','30/10/2026','2026-13-01','2026-10-30T00:00:00Z',null,123])assert.equal((await route.POST(req({...input(),briefDate}))).status,400);
 response=await route.PATCH(req({...body,revision:order.revision,briefDate:'2026-08-05'}));assert.equal(response.status,200);order=(await response.json()).order;assert.equal(order.briefDate,'2026-08-05');assert.ok(order.history.at(-1).fields.includes('briefDate'));assert.equal(ordersModel.orderTask(order).period,'2026-08');
 for(const omit of [false,true]){const update={...body,revision:order.revision,briefDate:''};if(omit)delete update.briefDate;response=await route.PATCH(req(update));assert.equal(response.status,200);order=(await response.json()).order;assert.equal(order.briefDate,'2026-08-05');}
 const editor=fs.readFileSync(path.join(root,'app/design-order-editor.tsx'),'utf8');assert.ok(editor.includes('Ngày brief (không bắt buộc)<input type="date"'));assert.ok(editor.includes("value={form.briefDate}"));
 console.log('PASS: optional brief date, Vietnam midnight default, selected date, validation, month attribution, edit history, preserved dates on blank/legacy edits and idempotent retries.');
})().catch(e=>{console.error(e);process.exit(1)});
