const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript'),path=require('path');
const root=path.resolve(__dirname,'..');
function mod(file,mocks={},extra={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>mocks[n]||require(n),Error,Response,Request,URL,Intl,Date,structuredClone,Buffer,process,crypto:require('crypto').webcrypto,...extra});return exports;}
const model=mod('app/designer-model.ts'),ordersModel=mod('app/design-orders-model.ts',{'./designer-model':model});
const source={...ordersModel.blankOrder,name:'Source design',platform:'Facebook',taskType:'Banner',brief:'Copy this brief',briefUrl:'https://example.com/brief',briefDate:'2026-09-01',deadline:'2026-11-20',status:'DONE',level:'L1',note:'Instructions',finalUrl:'https://example.com/old-final',id:require('crypto').randomUUID(),number:4,revision:'original-revision',createdAt:'2026-09-01T00:00:00Z',updatedAt:'2026-09-02T00:00:00Z',createdBy:'original@test.com',briefBy:'Original',history:[{at:'2026-09-01T00:00:00Z',by:'original@test.com',fields:['created']}]};
const before=JSON.stringify(source),fields=ordersModel.duplicateOrderFields(source);
for(const key of ['platform','taskType','brief','briefUrl','deadline','level','note'])assert.equal(fields[key],source[key]);
assert.equal(fields.name,'Source design (Bản sao)');assert.equal(fields.briefDate,'');assert.equal(fields.briefBy,'');assert.equal(fields.status,'NEW');assert.equal(fields.finalUrl,'');assert.equal(JSON.stringify(source),before);
for(const key of ['id','number','revision','createdBy','createdAt','history'])assert.equal(Object.hasOwn(fields,key),false);
assert.ok(ordersModel.duplicateOrderFields({...source,name:'A'.repeat(240)}).name.length<=240);
const config={levels:[{id:'L1',points:1}],taskDefaults:{Banner:'L1'},items:[]};let saved=[structuredClone(source)],writes=0,body,method,created;
const route=mod('app/api/design-orders/route.ts',{'../../chatgpt-auth':{getChatGPTUser:async()=>({email:'copy@test.com',displayName:'Copier',role:'sale_oem'})},'../../../lib/private-store':{readPrivate:async(p,f)=>p.includes('designer.json')?config:saved,transactPrivate:async(p,f,fn)=>{writes++;saved=fn(structuredClone(saved));return saved;}},'../../design-orders-model':ordersModel});
let states=[],cursor=0;
const react={useState:initial=>{const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v}];},useEffect:()=>{},useRef:()=>({current:null})};
const editor=mod('app/design-order-editor.tsx',{'react':react,'./design-orders-model':ordersModel},{fetch:async(url,options)=>{body=JSON.parse(options.body);method=options.method;return route[method](new Request('https://crm.test'+url,{method,headers:{...options.headers,origin:'https://crm.test'},body:options.body}));}}).default;
function render(props){cursor=0;return editor({data:{...config,platforms:[]},onClose:()=>{},onSaved:order=>{created=order},...props});}
function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;const children=node.props?.children;for(const child of Array.isArray(children)?children:[children]){const result=find(child,predicate);if(result)return result;}return null;}
(async()=>{
 const tree=render({duplicateOf:source});assert.equal(writes,0);const form=find(tree,node=>node.type==='form');assert.ok(form);assert.ok(find(tree,node=>node.type==='h2'&&node.props.children.includes('Tạo bản sao')));
 const name=find(tree,node=>node.type==='input'&&node.props.value===fields.name);name.props.onChange({target:{value:'Edited duplicate'}});
 await find(render({duplicateOf:source}),node=>node.type==='form').props.onSubmit({preventDefault(){}});
 assert.equal(method,'POST');assert.notEqual(body.id,source.id);assert.equal(body.revision,undefined);assert.equal(created.name,'Edited duplicate');assert.equal(created.createdBy,'copy@test.com');assert.equal(created.briefBy,'Copier');assert.equal(created.status,'NEW');assert.equal(created.finalUrl,'');assert.equal(created.history.length,1);assert.notEqual(created.revision,source.revision);assert.equal(saved.length,2);assert.equal(JSON.stringify(saved[0]),before);assert.equal(created.number,5);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(created.createdAt));assert.equal(created.briefDate,today);
 // Reusing a draft after a network retry stays idempotent.
 const retry=await route.POST(new Request('https://crm.test/api/design-orders',{method:'POST',headers:{origin:'https://crm.test'},body:JSON.stringify(body)}));assert.equal(retry.status,201);assert.equal(saved.length,2);
 states=[];render({order:source});assert.equal(states[0].id,source.id);assert.equal(states[0].revision,source.revision);assert.equal(states[1].status,'DONE');assert.equal(states[1].finalUrl,source.finalUrl);
 const panel=fs.readFileSync(path.join(root,'app/designer-panel.tsx'),'utf8');assert.ok(panel.includes("setOrderEditor({mode:'duplicate',order})"));assert.ok(panel.includes("duplicateOf={orderEditor.mode==='duplicate'?orderEditor.order:undefined}"));
 console.log('PASS: duplicate draft fields, reset status/date/final, no copied identity/history, editable form, POST with new ID, server audit data, original unchanged, idempotent retries and edit mode preserved.');
})().catch(error=>{console.error(error);process.exit(1)});
