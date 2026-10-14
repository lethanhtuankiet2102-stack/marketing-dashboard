const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript');
const root=require('path').resolve(__dirname,'..')+'/';
function mod(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(root+file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>mocks[n]||require(n),Error,Response,Request,URL,Intl,Date,structuredClone,Buffer,process});return exports;}
let blob=null,etag=0;const sdk={get:async()=>blob===null?null:{statusCode:200,blob:{etag:'"'+etag+'"'},stream:new Response(blob).body},put:async(path,value,opts)=>{if((blob!==null&&!opts.allowOverwrite)||(opts.ifMatch&&opts.ifMatch!=='"'+etag+'"')){const e=new Error('race');e.name='BlobPreconditionFailedError';throw e;}blob=value;etag++;}};
const store=mod('lib/private-store.ts',{'@vercel/blob':sdk});const model=mod('app/designer-model.ts',{});const ordersModel=mod('app/design-orders-model.ts',{'./designer-model':model});
const config={levels:[{id:'L1',points:1},{id:'L3',points:4}],taskDefaults:{Banner:'L1'},items:[]};let user={email:'order@example.com',displayName:'Order',role:'order'},saved=[];
const route=mod('app/api/design-orders/route.ts',{'../../chatgpt-auth':{getChatGPTUser:async()=>user},'../../../lib/private-store':{readPrivate:async(p,f)=>p.includes('designer.json')?config:saved,transactPrivate:async(p,f,fn)=>{const next=fn(structuredClone(saved));saved=next;return next;}},'../../designer-model':model,'../../design-orders-model':ordersModel});
const input={...ordersModel.blankOrder,name:'Banner A',platform:'Task Phát Sinh',taskType:'Banner',brief:'Nội dung yêu cầu',deadline:'2026-10-20',id:require('crypto').randomUUID()};
const req=(body,origin='https://crm.test')=>new Request('https://crm.test/api/design-orders',{method:'POST',headers:{origin},body:JSON.stringify(body)});
(async()=>{
 await Promise.all(Array.from({length:4},(_,id)=>store.transactPrivate('test',[],data=>[...data,id])));assert.equal(JSON.parse(blob).length,4);
 let res=await route.POST(req(input));assert.equal(res.status,201);let result=await res.json();assert.equal(result.order.workloadPoints,1);assert.equal(result.order.createdBy,user.email);const revision=result.order.revision;
 assert.equal((await route.POST(req(input))).status,201);assert.equal(saved.length,1);
 res=await route.PATCH(req({...input,revision,level:'L3'}));assert.equal(res.status,200);assert.equal((await res.json()).order.workloadPoints,4);assert.equal(saved[0].history.length,2);
 assert.equal((await route.PATCH(req({...input,revision}))).status,409);assert.equal(saved[0].level,'L3');
 assert.equal((await route.POST(req({...input,id:require('crypto').randomUUID(),briefUrl:'javascript:alert(1)'}))).status,400);
 assert.equal((await route.POST(req({...input,id:require('crypto').randomUUID(),deadline:'2026-02-30'}))).status,400);
 assert.equal((await route.POST(req(input,'https://evil.test'))).status,403);
 user={...user,role:'viewer'};assert.equal((await route.POST(req(input))).status,403);assert.equal((await route.GET()).status,200);
 user=null;assert.equal((await route.GET()).status,401);
 let account={email:'order@example.com',role:'order'};let token;const auth=mod('app/chatgpt-auth.ts',{'next/headers':{cookies:async()=>({get:()=>({value:token})})},'next/navigation':{redirect:()=>{}},'../lib/private-store':{readPrivate:async()=>account?[account]:[]}});process.env.AUTH_SESSION_SECRET='test-only-secret-at-least-24-characters';token=auth.createSession({userId:'order',email:account.email,displayName:'Order',fullName:null,role:'order'});
 assert.equal(await auth.getChatGPTUser(),null);assert.equal((await auth.getChatGPTUser(true)).role,'order');account.role='viewer';assert.equal((await auth.getChatGPTUser()).role,'viewer');account=null;assert.equal(await auth.getChatGPTUser(true),null);
 console.log('PASS: atomic initialization/races, persistence, idempotency, automatic KPI points, stale edits, input validation, origin checks, role scope and revocation.');
})().catch(e=>{console.error(e);process.exit(1)});
