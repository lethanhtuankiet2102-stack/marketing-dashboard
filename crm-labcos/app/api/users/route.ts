import {randomBytes,scryptSync} from 'node:crypto';
import {getChatGPTUser,type ChatGPTUser} from '../../chatgpt-auth';
import {readPrivate,transactPrivate} from '../../../lib/private-store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const path='labcos/viewers.json',headers={'Cache-Control':'private, no-store'};
const accountRoles=['viewer','designer','order','manager'] as const;
type AccountRole=typeof accountRoles[number];
type Account={email:string;passwordHash:string;displayName:string;role?:AccountRole};
function isAdmin(user:ChatGPTUser|null):user is ChatGPTUser{return !!user&&['owner','manager'].includes(user.role);}
function denied(){return Response.json({error:'Không có quyền quản lý tài khoản này.'},{status:403,headers});}
function assertActor(user:ChatGPTUser,accounts:Account[]){
 // Re-check delegated authority in the same snapshot as the account mutation.
 if(user.role!=='owner'&&!accounts.some(a=>a.email===user.email&&a.role==='manager'))throw new Error('FORBIDDEN');
}
function assertTarget(user:ChatGPTUser,account:Account|undefined,requestedRole?:string){
 if(user.role!=='owner'&&(account?.role==='manager'||requestedRole==='manager'))throw new Error('FORBIDDEN');
}
function failure(error:unknown){
 const message=error instanceof Error?error.message:'';
 if(message==='FORBIDDEN')return denied();
 const status=message==='NOT_FOUND'?404:message==='EXISTS'||message==='CONFLICT'?409:message==='INPUT'?400:503;
 return Response.json({error:status===404?'Không tìm thấy tài khoản.':status===409?'Tài khoản đã tồn tại hoặc dữ liệu vừa thay đổi. Hãy tải lại.':status===400?'Yêu cầu không hợp lệ.':'Chưa lưu được tài khoản. Hãy thử lại.'},{status,headers});
}
async function inputFor(request:Request):Promise<Record<string,unknown>>{
 const body=await request.text();if(body.length>3000)throw new Error('INPUT');
 let input;try{input=JSON.parse(body)}catch{throw new Error('INPUT')}
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('INPUT');return input;
}
export async function GET(){
 const user=await getChatGPTUser();if(!isAdmin(user))return denied();
 try{const accounts=await readPrivate<Account[]>(path,[]);return Response.json({canGrantManager:user.role==='owner',users:accounts.map(({email,displayName,role})=>({email,displayName,role:role||'viewer',canManage:user.role==='owner'||role!=='manager'}))},{headers});}catch(error){return failure(error)}
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!isAdmin(user))return denied();
 if(request.headers.get('origin')!==new URL(request.url).origin)return denied();
 try{
  const input=await inputFor(request),role=input.role===undefined?'viewer':input.role;
  if(typeof role!=='string'||!accountRoles.some(r=>r===role))throw new Error('INPUT');
  assertTarget(user,undefined,role);
  const email=typeof input.email==='string'?input.email.trim().toLowerCase():'',password=typeof input.password==='string'?input.password:'';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<12||password.length>128)return Response.json({error:'Email hợp lệ và mật khẩu từ 12 đến 128 ký tự.'},{status:400,headers});
  if(email===process.env.AUTH_USER?.trim().toLowerCase())throw new Error('FORBIDDEN');
  const salt=randomBytes(16).toString('hex'),account:Account={email,passwordHash:`${salt}:${scryptSync(password,salt,32).toString('hex')}`,displayName:typeof input.displayName==='string'?input.displayName.trim().slice(0,80)||email:email,role:role as AccountRole};
  await transactPrivate<Account[]>(path,[],accounts=>{assertActor(user,accounts);if(accounts.some(a=>a.email===email))throw new Error('EXISTS');return [...accounts,account];});
  return Response.json({ok:true},{status:201,headers});
 }catch(error){return failure(error)}
}
export async function PATCH(request:Request){
 const user=await getChatGPTUser();if(!isAdmin(user))return denied();
 if(request.headers.get('origin')!==new URL(request.url).origin)return denied();
 try{
  const input=await inputFor(request);
  if(typeof input.email!=='string'||typeof input.role!=='string'||!accountRoles.some(r=>r===input.role))throw new Error('INPUT');
  await transactPrivate<Account[]>(path,[],accounts=>{assertActor(user,accounts);const account=accounts.find(a=>a.email===input.email);if(!account)throw new Error('NOT_FOUND');assertTarget(user,account,input.role as string);account.role=input.role as AccountRole;return accounts;});
  return Response.json({ok:true},{headers});
 }catch(error){return failure(error)}
}
export async function DELETE(request:Request){
 const user=await getChatGPTUser();if(!isAdmin(user))return denied();
 if(request.headers.get('origin')!==new URL(request.url).origin)return denied();
 try{
  const input=await inputFor(request);if(typeof input.email!=='string')throw new Error('INPUT');
  await transactPrivate<Account[]>(path,[],accounts=>{assertActor(user,accounts);const account=accounts.find(a=>a.email===input.email);if(!account)throw new Error('NOT_FOUND');assertTarget(user,account);return accounts.filter(a=>a.email!==input.email);});
  return Response.json({ok:true},{headers});
 }catch(error){return failure(error)}
}
