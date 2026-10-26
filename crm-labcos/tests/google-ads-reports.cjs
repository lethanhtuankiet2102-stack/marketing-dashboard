const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript'),path=require('path');
const root=path.resolve(__dirname,'..');
function mod(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>mocks[name]||require(name),Error,Date,Response,URL,Request});return exports;}
const saved=new Map();let requests=0,fail=false,writeFail=false;const html='<!DOCTYPE html><html><head><title>Report T9</title></head><body>September report</body></html>';
const source=mod('lib/google-ads-reports.ts',{'./google-source':{googleGet:async url=>{requests++;assert.ok(url.includes('1sReRZl5jxL-5zWG7RJZUOaz6AuiCUD4c'));if(fail)throw new Error('GOOGLE_CONNECT_REQUIRED');return new Response(html,{'headers':{'content-type':'text/html'}})}},'./private-store':{readPrivate:async(p,f)=>saved.has(p)?saved.get(p):f,writePrivate:async(p,v)=>{if(writeFail)throw new Error('CACHE_RACE');saved.set(p,v)}}});
let user={role:'owner'};const route=mod('app/api/google-ads/route.ts',{'../../chatgpt-auth':{getChatGPTUser:async()=>user},'../../../lib/google-ads-reports':source});
(async()=>{
 let result=await source.googleAdsReport('2026-09');assert.equal(result.html,html);assert.equal(result.stale,false);assert.equal(requests,1);assert.equal(saved.get('labcos/google-ads-2026-09.json'),html);
 await source.googleAdsReport('2026-09');assert.equal(requests,1);
 saved.get('labcos/google-ads-source-2026-09.json').syncedAt=Date.now()-61000;fail=true;result=await source.googleAdsReport('2026-09');assert.equal(result.stale,true);assert.equal(result.html,html);
 let response=await route.GET(new Request('https://crm.test/api/google-ads?month=2026-09'));assert.equal(response.status,200);assert.ok((await response.text()).includes('Đang hiển thị bản lưu'));assert.ok(response.headers.get('content-security-policy').includes("default-src 'none'"));
 saved.clear();assert.equal((await route.GET(new Request('https://crm.test/api/google-ads?month=2026-09'))).status,503);
 fail=false;writeFail=true;result=await source.googleAdsReport('2026-09');assert.equal(result.html,html);assert.equal(result.stale,false);writeFail=false;
 await assert.rejects(()=>source.googleAdsReport('2026-10'),/UNKNOWN_MONTH/);
 assert.equal((await route.GET(new Request('https://crm.test/api/google-ads?month=2026-10'))).status,404);
 assert.equal((await route.GET(new Request('https://crm.test/api/google-ads?month=../../private'))).status,400);
 const before=requests;user=null;assert.equal((await route.GET(new Request('https://crm.test/api/google-ads?month=2026-09'))).status,401);assert.equal(requests,before);
 const panel=fs.readFileSync(path.join(root,'app/google-ads-panel.tsx'),'utf8');assert.ok(!panel.includes('Chưa có báo cáo Google Ads tháng 9'));assert.ok(panel.includes('sandbox="allow-scripts"'));
 console.log('PASS: September Drive mapping, private cache freshness, stale fallback, connection errors, write races, month validation, auth and sandboxed report rendering.');
})().catch(error=>{console.error(error);process.exit(1)});
