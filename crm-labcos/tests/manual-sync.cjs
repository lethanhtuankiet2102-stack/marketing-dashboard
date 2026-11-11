const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript'),path=require('path');
const root=path.resolve(__dirname,'..');
function mod(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>mocks[n]||require(n),Error,Response,Request,URL,Intl,Date,structuredClone,Buffer,process});return exports;}
const config={items:[],levels:[],taskDefaults:{},lastSyncedAt:'2020-01-01T00:00:00Z'};
let sourceCalls=0;
const sync=mod('lib/designer-sync.ts',{'./google-source':{sourceIds:{designer:'test-id'},googleGet:async()=>{sourceCalls++;throw new Error('OFFLINE')}},'./private-store':{readPrivate:async()=>config}});
let actor={role:'owner'},designerFlags=[];
const designer=mod('app/api/designer/route.ts',{'../../chatgpt-auth':{getChatGPTUser:async()=>actor},'../../../lib/private-store':{readPrivate:async(p,f)=>p.includes('design-orders')?[]:config},'../../../lib/designer-workspace':{composeDesignerWorkspace:(d,orders)=>({...d,orders})},'../../design-orders-model':{},'../../../lib/designer-sync':{refreshDesigner:async force=>{designerFlags.push(force);if(force)throw new Error('OFFLINE');return config;}},'../../../lib/google-source':{syncWarning:()=> 'Source offline'}});
let saved={items:[{date:'2026-11-08',note:'Zalo OA'}],fromDate:'2026-07-01',throughDate:'2026-11-08',lastSyncedAt:'2020-01-01T00:00:00Z'},leadCalls=0,fail=false;
const list=mod('app/api/list-lead/route.ts',{'../../chatgpt-auth':{getChatGPTUser:async()=>actor},'../../../lib/private-store':{readPrivate:async()=>saved,writePrivate:async(p,v)=>{saved=v}},'../../../lib/google-source':{leadWorkbook:async()=>{leadCalls++;if(fail)throw new Error('OFFLINE');return 'source'},syncWarning:()=> 'Source offline'},'./workbook':{parseLeadWorkbook:()=>({items:[{date:'2026-11-11',note:'Zalo OA'}],fromDate:'2026-07-01',throughDate:'2026-11-11'})}});
const request=refresh=>new Request('https://crm.test/api/test'+(refresh?'?refresh=1':''));
(async()=>{
 assert.equal(await sync.refreshDesigner(),config);assert.equal(sourceCalls,0);await assert.rejects(()=>sync.refreshDesigner(true),/OFFLINE/);assert.equal(sourceCalls,1);
 let response=await designer.GET(request(false));assert.equal(response.status,200);assert.equal((await response.json()).warning,null);assert.equal(designerFlags.join(','),'false');
 response=await designer.GET(request(true));assert.equal(response.status,200);assert.equal((await response.json()).warning,'Source offline');assert.equal(designerFlags.join(','),'false,true');
 for(let i=0;i<2;i++){response=await list.GET(request(false));assert.equal(response.status,200);assert.equal((await response.json()).warning,null);}assert.equal(leadCalls,0);
 response=await list.GET(request(true));assert.equal(response.status,200);assert.equal(leadCalls,1);assert.equal(saved.items[0].date,'2026-11-11');
 // Repeated explicit clicks bypass the old one-minute window.
 await list.GET(request(true));assert.equal(leadCalls,2);
 fail=true;const snapshot=JSON.stringify(saved);response=await list.GET(request(true));assert.equal(response.status,200);assert.equal((await response.json()).warning,'Source offline');assert.equal(JSON.stringify(saved),snapshot);
 saved=null;const before=leadCalls;assert.equal((await list.GET(request(false))).status,503);assert.equal(leadCalls,before);
 actor=null;assert.equal((await list.GET(request(true))).status,401);assert.equal((await designer.GET(request(true))).status,401);assert.equal(leadCalls,before);
 actor={role:'order'};assert.equal((await list.GET(request(true))).status,403);assert.equal(leadCalls,before);
 let flags=[];const summary=mod('app/api/google-ads-summary/route.ts',{'../../chatgpt-auth':{getChatGPTUser:async()=>({role:'owner'})},'../../../lib/google-ads-reports':{sources:{'2026-07':'a','2026-09':'b'},googleAdsReport:async(month,refresh)=>{flags.push(refresh);return {html:'cached',stale:false}}},'../../../lib/google-ads-parser':{parseGoogleAdsReport:()=>({})}});
 assert.equal((await summary.GET(request(false))).status,200);assert.equal(flags.join(','),'false,false');flags=[];assert.equal((await summary.GET(request(true))).status,200);assert.equal(flags.join(','),'true,true');
 const leads=mod('app/list-lead-summary.ts');const data={fromDate:'2026-07-01',throughDate:'2026-11-08',lastSyncedAt:'2026-11-10T18:30:00Z',items:[]};assert.equal(leads.summarizeListLeads(data,'2026-11-01','2026-11-11','google').covered,true);assert.equal(leads.summarizeListLeads(data,'2026-11-01','2026-11-12','google').covered,false);assert.equal(leads.summarizeListLeads({...data,mode:'upload'},'2026-11-01','2026-11-11','google').covered,false);
 for(const file of ['app/designer-panel.tsx','app/designer-performance-panel.tsx','app/list-lead-panel.tsx','app/google-ads-overview.tsx']){const ui=fs.readFileSync(path.join(root,file),'utf8');assert.ok(!ui.includes('setInterval'),file);assert.ok(!/addEventListener\(['"]focus/.test(ui),file);assert.ok(ui.includes('Cập nhật dữ liệu'),file);assert.ok(ui.includes('?refresh=1'),file);}
 console.log('PASS: snapshot reads without Google calls, explicit forced updates without TTL, cached fallback, missing cache/auth/role handling, monthly summary refresh flags, snapshot lead coverage and no timer/focus polling.');
})().catch(error=>{console.error(error);process.exit(1)});
