const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript'),path=require('path');
const root=path.resolve(__dirname,'..');
function mod(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>mocks[n]||require(n),Error,Response,Request,URL,Intl,Date,structuredClone,Buffer,process,File,console,crypto:require('node:crypto').webcrypto});return exports;}
const db=new Map(),store={readPrivate:async(p,f)=>structuredClone(db.has(p)?db.get(p):f),writePrivate:async(p,v)=>db.set(p,structuredClone(v)),transactPrivate:async(p,f,fn)=>{const next=fn(structuredClone(db.has(p)?db.get(p):f));db.set(p,next);return next;},updatePrivate:async(p,fn)=>{const next=fn(structuredClone(db.get(p)));db.set(p,next);return next;}};
let cookie;
const auth=mod('app/chatgpt-auth.ts',{'next/headers':{cookies:async()=>({get:()=>({value:cookie})})},'next/navigation':{},'../lib/private-store':store});
const policy=mod('app/access-policy.ts'),roles=mod('app/roles.ts',{'./chatgpt-auth':auth});
const users=mod('app/api/users/route.ts',{'../../chatgpt-auth':auth,'../../../lib/private-store':store});
const login=mod('app/api/auth/login/route.ts',{'../../../chatgpt-auth':auth,'../../../../lib/private-store':store});
const dashboard=mod('app/api/dashboard/route.ts',{'../../roles':roles,'../../../lib/private-store':store});
const model=mod('app/designer-model.ts'),ordersModel=mod('app/design-orders-model.ts',{'./designer-model':model});
const compose=mod('lib/designer-workspace.ts',{'../app/designer-model':model,'../app/design-orders-model':ordersModel});
const config={levels:[{id:'L1',points:1}],taskDefaults:{Banner:'L1'},items:[{id:'sheet-1',name:'Source task',platform:'Facebook',taskType:'Banner',status:'NEW',updatedAt:null,levelOverride:null}]};
db.set('labcos/designer.json',config);
db.set('labcos/dashboard.json',{leads:[],content:[{id:'content-1',title:'Marketing-only content'}]});
const orderRoute=mod('app/api/design-orders/route.ts',{'../../chatgpt-auth':auth,'../../../lib/private-store':store,'../../designer-model':model,'../../design-orders-model':ordersModel});
const designer=mod('app/api/designer/route.ts',{'../../chatgpt-auth':auth,'../../../lib/private-store':store,'../../../lib/designer-workspace':compose,'../../../lib/designer-sync':{refreshDesigner:async()=>structuredClone(config)},'../../../lib/google-source':{syncWarning:()=>''},'../../designer-model':model,'../../design-orders-model':ordersModel});
const req=(body,origin='https://crm.test')=>new Request('https://crm.test/api/test',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const person=(role,email=role+'@test.com')=>({role,email,userId:email,displayName:role,fullName:null});
const signIn=role=>{cookie=auth.createSession(person(role));};
const password='test-only-password-123456';
(async()=>{
 process.env.AUTH_USER='owner@test.com';process.env.AUTH_SESSION_SECRET='test-only-sale-role-secret-at-least-24-characters';
 signIn('owner');
 for(const role of ['sale_admin','sale_oem','manager'])assert.equal((await users.POST(req({email:role+'@test.com',password,role}))).status,201);
 signIn('manager');assert.equal((await users.POST(req({email:'team@test.com',password,role:'sale_oem'}))).status,201);
 assert.equal((await users.PATCH(req({email:'team@test.com',role:'sale_admin'}))).status,200);
 assert.equal((await users.PATCH(req({email:'team@test.com',role:'manager'}))).status,403);
 for(const role of ['sale_admin','sale_oem']){
  const response=await login.POST(req({username:role+'@test.com',password}));assert.equal(response.status,200);cookie=response.headers.get('set-cookie').split(';')[0].split('=')[1];assert.equal(auth.verifySession(cookie).role,role);assert.equal((await auth.getChatGPTUser(true)).role,role);
  const before=JSON.stringify(db.get('labcos/viewers.json'));
  for(const method of ['GET','POST','PATCH','DELETE'])assert.equal((await users[method](req({email:'team@test.com',password,role:'manager'}))).status,403);
  assert.equal(JSON.stringify(db.get('labcos/viewers.json')),before);assert.equal(policy.canManageAccounts(role),false);assert.equal(policy.canAccessTab(role,'users'),false);
  assert.equal((await orderRoute.GET()).status,200);assert.equal((await (await orderRoute.GET()).json()).canEdit,true);
  const input={...ordersModel.blankOrder,name:'Sales brief',platform:'Task Phát Sinh',taskType:'Banner',brief:'Test brief',id:require('node:crypto').randomUUID()};
  let result=await orderRoute.POST(req(input));assert.equal(result.status,201);const order=(await result.json()).order;assert.equal(order.createdBy,role+'@test.com');
  assert.equal((await orderRoute.PATCH(req({...input,revision:order.revision,status:'URGENT'}))).status,200);
  assert.equal((await orderRoute.POST(req(input,'https://evil.test'))).status,403);
  const payload=await (await designer.GET()).json();assert.equal(payload.canOrder,true);assert.equal(payload.canEdit,role==='sale_admin');
  let res=await dashboard.POST(req({kind:'lead',name:role,status:'new'}));assert.equal(res.status,201);const lead=await res.json();assert.equal((await dashboard.PATCH(req({kind:'lead',id:lead.id,name:'Updated',status:'contacted'}))).status,200);assert.equal((await dashboard.DELETE(req({kind:'lead',id:lead.id}))).status,200);
  assert.equal((await dashboard.POST(req({kind:'lead',name:'No',status:'new'},'https://evil.test'))).status,403);
  const contentBefore=JSON.stringify(db.get('labcos/dashboard.json').content);
  for(const method of ['POST','PATCH','DELETE']){res=await dashboard[method](req({kind:'content',id:'content-1',title:'Changed',channel:'Facebook',status:'draft'}));assert.equal(res.status,role==='sale_admin'?(method==='POST'?201:200):403);}
  const data=await (await dashboard.GET()).json();assert.equal(data.role,role);if(role==='sale_oem'){assert.equal(data.content.length,0);assert.equal(JSON.stringify(db.get('labcos/dashboard.json').content),contentBefore);}
  assert.equal((await designer.PATCH(req({id:'sheet-1',expectedUpdatedAt:null,level:'L1'}))).status,role==='sale_admin'?200:403);
  for(const file of ['sale-performance','sale-lead-report','sale-lead-summary']){
   db.set('labcos/'+(file==='sale-performance'?file:'sale-lead-report')+'.json',{fromDate:'2026-07-01',throughDate:'2026-10-31',people:[]});
   const route=mod('app/api/'+file+'/route.ts',{'../../chatgpt-auth':auth,'../../../lib/private-store':store});assert.equal((await route.GET(new Request('https://crm.test/api/test?since=2026-07-01&until=2026-09-30&channel=google'))).status,200);
  }
  const list=mod('app/api/list-lead/route.ts',{'../../chatgpt-auth':auth,'../../../lib/private-store':store,'../../../lib/google-source':{},'./workbook':{}});
  db.set('labcos/list-leads.json',{items:[],lastSyncedAt:new Date().toISOString()});assert.equal((await list.GET()).status,200);
  assert.equal((await list.POST(req({}))).status,role==='sale_admin'?400:401);
  const meta=mod('app/api/meta/route.ts',{'../../roles':roles,'../../../lib/private-store':store});delete process.env.META_AD_ACCOUNT_ID;
  assert.equal((await meta.GET(new Request('https://crm.test/api/meta'))).status,role==='sale_admin'?200:401);
  for(const file of ['google-ads','google-ads-summary']){const route=mod('app/api/'+file+'/route.ts',{'../../chatgpt-auth':auth,'../../../lib/google-ads-reports':{sources:{},googleAdsReport:async()=>{throw new Error('SHOULD_NOT_FETCH')}},'../../../lib/google-ads-parser':{}});if(role==='sale_oem')assert.equal((await route.GET(new Request('https://crm.test/api/google-ads?month=2026-09'))).status,401);}
  assert.equal(policy.defaultTab(role),role==='sale_oem'?'leads':'overview');
 }
 for(const tab of ['leads','list-lead','sale-performance','sale-lead-report','designer'])assert.equal(policy.canAccessTab('sale_oem',tab),true);
 for(const tab of ['overview','marketing','meta','google','content','kpis','users','designer-performance'])assert.equal(policy.canAccessTab('sale_oem',tab),false);
 for(const tab of ['overview','marketing','meta','google','content','kpis','designer','designer-performance','leads','list-lead','sale-performance','sale-lead-report'])assert.equal(policy.canAccessTab('sale_admin',tab),true);
 assert.equal(policy.designerLanding('sale_oem'),'designer');
 signIn('sale_admin');const accounts=db.get('labcos/viewers.json');accounts.find(a=>a.role==='sale_admin'&&a.email==='sale_admin@test.com').role='sale_oem';assert.equal((await auth.getChatGPTUser(true)).role,'sale_oem');assert.equal(await auth.getChatGPTUser(),null);db.set('labcos/viewers.json',accounts.filter(a=>a.email!=='sale_admin@test.com'));assert.equal(await auth.getChatGPTUser(true),null);
 signIn('order');db.get('labcos/viewers.json').push({...person('order')});assert.equal((await dashboard.GET()).status,403);
 const ui=fs.readFileSync(path.join(root,'app/workspace.tsx'),'utf8');assert.ok(ui.includes("tab==='users'&&canManageUsers"));assert.ok(ui.includes('filter(item=>canAccessTab(role,item.id))'));
 console.log('PASS: Sale Admin and Sale OEM login, delegated assignment, account-management denial, lead CRUD/content isolation, Design order CRUD, designer task scope, Sale/report APIs, marketing denial, origin checks, navigation, live role changes and revocation.');
})().catch(error=>{console.error(error);process.exit(1)});
