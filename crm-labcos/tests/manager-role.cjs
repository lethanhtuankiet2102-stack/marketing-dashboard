const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript');
const root=require('path').resolve(__dirname,'..')+'/';
function mod(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(root+file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>mocks[n]||require(n),Error,Response,Request,URL,Intl,Date,structuredClone,Buffer,process,File,console,crypto:require('node:crypto').webcrypto});return exports;}
const owner={email:'owner@test.com',userId:'owner',displayName:'Owner',fullName:null,role:'owner'};
let actor=owner,accounts=[],cookie;
const authMock={getChatGPTUser:async()=>actor};
const config={levels:[{id:'L2',points:2}],taskDefaults:{Banner:'L2'},items:[]};let orders=[];
const privateStore={readPrivate:async(path,fallback)=>path.includes('viewers.json')?structuredClone(accounts):path.includes('designer.json')?config:path.includes('design-orders.json')?orders:fallback,transactPrivate:async(path,fallback,fn)=>{const value=fn(structuredClone(accounts));accounts=value;return value;},updatePrivate:async(path,fn)=>fn(structuredClone(config)),writePrivate:async()=>{}};
const users=mod('app/api/users/route.ts',{'../../chatgpt-auth':authMock,'../../../lib/private-store':privateStore});
const req=(body,origin='https://crm.test')=>new Request('https://crm.test/api/users',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const password='test-password-123456';
(async()=>{
 process.env.AUTH_USER=owner.email;
 assert.equal((await users.POST(req({email:'manager@test.com',password,role:'manager'}))).status,201);
 assert.equal((await users.POST(req({email:'other-manager@test.com',password,role:'manager'}))).status,201);
 let payload=await (await users.GET()).json();assert.equal(payload.canGrantManager,true);assert.ok(!JSON.stringify(payload).includes('passwordHash'));
 actor={...owner,email:'manager@test.com',userId:'manager@test.com',role:'manager'};
 payload=await (await users.GET()).json();assert.equal(payload.canGrantManager,false);assert.equal(payload.users.find(u=>u.email===actor.email).canManage,false);
 for(const role of ['viewer','designer','order'])assert.equal((await users.POST(req({email:`${role}@test.com`,password,role}))).status,201);
 assert.equal((await users.PATCH(req({email:'viewer@test.com',role:'designer'}))).status,200);
 assert.equal((await users.DELETE(req({email:'order@test.com'}))).status,200);
 const snapshot=JSON.stringify(accounts);
 assert.equal((await users.POST(req({email:'forged@test.com',password,role:'manager'}))).status,403);
 for(const email of ['manager@test.com','other-manager@test.com']){
  assert.equal((await users.PATCH(req({email,role:'viewer'}))).status,403);
  assert.equal((await users.DELETE(req({email}))).status,403);
 }
 assert.equal((await users.PATCH(req({email:'viewer@test.com',role:'manager'}))).status,403);
 assert.equal((await users.PATCH(req({email:'viewer@test.com',role:'owner'}))).status,400);
 assert.equal((await users.POST(req({email:owner.email,password,role:'viewer'}))).status,403);
 assert.equal(JSON.stringify(accounts),snapshot);
 assert.equal((await users.POST(req({email:'origin@test.com',password,role:'viewer'},'https://evil.test'))).status,403);
 // Authority revoked after initial authentication is checked again in the mutation snapshot.
 accounts.find(a=>a.email===actor.email).role='viewer';assert.equal((await users.POST(req({email:'race@test.com',password,role:'viewer'}))).status,403);accounts.find(a=>a.email===actor.email).role='manager';
 const roles=mod('app/roles.ts',{'./chatgpt-auth':authMock});assert.equal(await roles.requireAdminWrite(),null);
 const dashboard=mod('app/api/dashboard/route.ts',{'../../roles':roles,'../../../lib/private-store':privateStore});assert.equal((await dashboard.POST(req({kind:'content',title:'Test',channel:'Facebook',status:'draft'}))).status,201);
 const designerModel=mod('app/designer-model.ts',{}),ordersModel=mod('app/design-orders-model.ts',{'./designer-model':designerModel});
const workspaceModel=mod('lib/designer-workspace.ts',{'../app/designer-model':designerModel,'../app/design-orders-model':ordersModel});
 const designer=mod('app/api/designer/route.ts',{'../../../lib/designer-workspace':workspaceModel,'../../chatgpt-auth':authMock,'../../../lib/private-store':privateStore,'../../../lib/designer-sync':{refreshDesigner:async()=>config},'../../../lib/google-source':{syncWarning:()=>''},'../../designer-model':{effectiveLevel:()=>null,workloadPoints:()=>null},'../../design-orders-model':{orderTask:()=>{}}});assert.equal((await (await designer.GET()).json()).canEdit,true);assert.equal((await designer.PATCH(req({}))).status,400);
 const listLead=mod('app/api/list-lead/route.ts',{'../../chatgpt-auth':authMock,'../../../lib/private-store':privateStore,'../../../lib/google-source':{},'./workbook':{}});assert.equal((await listLead.POST(req({}))).status,400);
 const google=mod('app/api/google-sync/route.ts',{'../../chatgpt-auth':authMock,'../../../lib/private-store':privateStore,'../../../lib/google-source':{googleConfigured:()=>true,googleCredentialIssue:()=>null}});assert.equal((await (await google.GET()).json()).canConnect,false);
 const connect=mod('app/api/google-sync/connect/route.ts',{'../../../chatgpt-auth':authMock,'../../../../lib/google-source':{}});assert.equal((await connect.POST(req({}))).status,403);
 const auth=mod('app/chatgpt-auth.ts',{'next/headers':{cookies:async()=>({get:()=>({value:cookie})})},'next/navigation':{},'../lib/private-store':privateStore});process.env.AUTH_SESSION_SECRET='test-only-manager-secret-at-least-24-characters';
 cookie=auth.createSession({...actor,role:'viewer'});assert.equal((await auth.getChatGPTUser()).role,'manager');
 const login=mod('app/api/auth/login/route.ts',{'../../../chatgpt-auth':auth,'../../../../lib/private-store':privateStore});let response=await login.POST(req({username:actor.email,password}));assert.equal(response.status,200);const token=response.headers.get('set-cookie').split(';')[0].split('=')[1];assert.equal(auth.verifySession(token).role,'manager');
 actor=owner;assert.equal((await users.PATCH(req({email:'manager@test.com',role:'viewer'}))).status,200);assert.equal((await auth.getChatGPTUser()).role,'viewer');
 assert.equal((await users.PATCH(req({email:'viewer@test.com',role:'manager'}))).status,200);
 assert.equal((await users.DELETE(req({email:'other-manager@test.com'}))).status,200);
 actor={...owner,role:'viewer'};assert.equal((await users.GET()).status,403);assert.equal((await roles.requireAdminWrite()).status,403);
 actor=null;assert.equal((await users.GET()).status,403);assert.equal((await roles.requireAdminWrite()).status,401);
 console.log('PASS: owner-only manager grants/revocation, delegated account creation, protected peers/self, no owner escalation, atomic authority recheck, CRM writes, hidden Google controls, login and immediate role downgrade.');
})().catch(error=>{console.error(error);process.exit(1)});
