const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript');
const root=require('path').resolve(__dirname,'..')+'/';
function mod(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(root+file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>mocks[n]||require(n),Error,Response,Request,URL,Intl,Date,structuredClone,Buffer,process});return exports;}
const model=mod('app/designer-model.ts',{}),ordersModel=mod('app/design-orders-model.ts',{'./designer-model':model});
const workspace=mod('lib/designer-workspace.ts',{'../app/designer-model':model,'../app/design-orders-model':ordersModel});
const sheet={id:'sheet-1',sheetRow:2,period:'2026-10',number:'1',platform:'Facebook',name:'Sheet task',briefUrl:'',taskType:'Banner',briefBy:'Team',briefDate:'2026-10-19',deadline:'',status:'DONE',sourceLevel:'L1',levelOverride:null,note:'',finalUrl:'',updatedAt:null};
const config={schemaVersion:1,sourceName:'Sheet test',importedAt:'2026-10-19',levels:[{id:'L1',points:1},{id:'L3',points:4},{id:'L5',points:10}],taskDefaults:{Banner:'L1'},items:[sheet]};
const base={...ordersModel.blankOrder,name:'CRM order',platform:'Task Phát Sinh',taskType:'Banner',brief:'Brief',id:'order-1',number:1,revision:'r1',createdAt:'2026-10-19',updatedAt:'2026-10-19',briefDate:'2026-10-19',briefBy:'Team',createdBy:'team@test.com',history:[],level:'L3'};
let orders=[base,{...base,id:'order-2',number:2,status:'CANCELED',level:'L5'},{...base,id:'order-3',number:3,platform:'Facebook',taskType:'Unknown',level:''}];
let actor={role:'owner'};
const route=mod('app/api/designer/route.ts',{'../../../lib/designer-workspace':workspace,'../../design-orders-model':ordersModel,'../../../lib/designer-sync':{refreshDesigner:async()=>structuredClone(config)},'../../../lib/google-source':{syncWarning:()=>''},'../../chatgpt-auth':{getChatGPTUser:async()=>actor},'../../../lib/private-store':{readPrivate:async(path,fallback)=>path.includes('design-orders.json')?structuredClone(orders):structuredClone(config),updatePrivate:async(path,fn)=>{const next=fn(structuredClone(config));Object.assign(config,next);return next;}},'../../designer-model':model});
(async()=>{
 const initial=await (await route.GET()).json();assert.equal(initial.items.length,4);assert.equal(initial.orders.length,3);assert.equal(new Set(initial.items.map(t=>t.id)).size,4);
 let summary=model.designSummary(initial.items,initial);assert.equal(summary.total,3);assert.equal(summary.totalPoints,5);assert.equal(summary.donePoints,1);assert.equal(summary.unscored,1);assert.equal(summary.emergent,1);
 // List rows and performance both consume the same API; canceled rows remain editable.
 const active=initial.items.filter(t=>!model.isDesignCanceled(t));assert.equal(model.designSummary(active,initial).totalPoints,summary.totalPoints);assert.ok(initial.items.some(t=>t.status==='CANCELED'));
 orders[0]={...orders[0],status:'DONE',level:'L5',revision:'r2'};
 const edited=await (await route.GET()).json();summary=model.designSummary(edited.items,edited);assert.equal(summary.done,2);assert.equal(summary.totalPoints,11);assert.equal(summary.donePoints,11);
 const request=new Request('https://crm.test/api/designer',{method:'PATCH',headers:{origin:'https://crm.test'},body:JSON.stringify({id:'sheet-1',level:'L3',expectedUpdatedAt:null})});
 const response=await route.PATCH(request);assert.equal(response.status,200);const patched=await response.json();assert.equal(patched.orders.length,3);assert.equal(model.designSummary(patched.items,patched).totalPoints,14);assert.equal(patched.canOrder,true);
 for(const role of ['owner','manager','designer','order','viewer']){actor={role};const result=await (await route.GET()).json();assert.equal(result.canOrder,role!=='viewer');assert.equal(result.canEdit,['owner','manager','designer'].includes(role));}
 actor={role:'order'};assert.equal((await route.PATCH(new Request('https://crm.test/api/designer',{method:'PATCH'}))).status,403);
 actor=null;assert.equal((await route.GET()).status,401);
 const nav=fs.readFileSync(root+'app/workspace.tsx','utf8');assert.ok(!nav.includes("id:'design-orders'"));assert.ok(nav.includes("label:'Task & Order'"));
 const panel=fs.readFileSync(root+'app/designer-panel.tsx','utf8');assert.ok(panel.includes('DesignOrderEditor'));assert.ok(panel.includes('orderById.get(item.id)'));
 console.log('PASS: unified Sheet/CRM rows, canceled order retention and KPI exclusion, shared performance totals, level changes, order edits, permissions and single navigation tab.');
})().catch(error=>{console.error(error);process.exit(1)});
