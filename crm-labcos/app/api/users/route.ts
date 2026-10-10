import { randomBytes, scryptSync } from 'node:crypto';
import { requireOwnerWrite } from '../../roles';
import { readPrivate, writePrivate } from '../../../lib/private-store';
export const runtime='nodejs';
const path='labcos/viewers.json';
type Viewer={email:string;passwordHash:string;displayName:string;role?:'viewer'|'designer'};
const denied=()=>Response.json({error:'Yêu cầu không hợp lệ.'},{status:403});
export async function GET() {
  const blocked=await requireOwnerWrite();if(blocked)return blocked;
  const viewers=await readPrivate<Viewer[]>(path,[]);
  return Response.json({users:viewers.map(({email,displayName,role})=>({email,displayName,role:role||'viewer'}))},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:Request) {
  const blocked=await requireOwnerWrite();if(blocked)return blocked;
  if(request.headers.get('origin')!==new URL(request.url).origin)return denied();
  const input=await request.json() as {email?:string;password?:string;displayName?:string;role?:string};
  if(input.role!==undefined&&!['viewer','designer'].includes(input.role))return Response.json({error:'Quyền không hợp lệ.'},{status:400});
  const email=String(input.email||'').trim().toLowerCase(),password=String(input.password||'');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<12||password.length>128)return Response.json({error:'Email hợp lệ và mật khẩu tối thiểu 12 ký tự.'},{status:400});
  const viewers=await readPrivate<Viewer[]>(path,[]);
  if(viewers.some(v=>v.email===email))return Response.json({error:'Tài khoản đã tồn tại.'},{status:409});
  const salt=randomBytes(16).toString('hex');
  viewers.push({email,passwordHash:`${salt}:${scryptSync(password,salt,32).toString('hex')}`,displayName:String(input.displayName||email).trim().slice(0,80),role:input.role==='designer'?'designer':'viewer'});
  await writePrivate(path,viewers);
  return Response.json({ok:true},{status:201});
}
export async function PATCH(request:Request){
  const blocked=await requireOwnerWrite();if(blocked)return blocked;
  if(request.headers.get('origin')!==new URL(request.url).origin)return denied();
  let input:{email?:string;role?:string};try{input=await request.json()}catch{return Response.json({error:'Yêu cầu không hợp lệ.'},{status:400});}
  if(!['viewer','designer'].includes(input.role||''))return Response.json({error:'Quyền không hợp lệ.'},{status:400});
  const viewers=await readPrivate<Viewer[]>(path,[]),account=viewers.find(x=>x.email===input.email);
  if(!account)return Response.json({error:'Không tìm thấy tài khoản.'},{status:404});
  account.role=input.role as 'viewer'|'designer';await writePrivate(path,viewers);
  return Response.json({ok:true});
}
export async function DELETE(request:Request) {
  const blocked=await requireOwnerWrite();if(blocked)return blocked;
  if(request.headers.get('origin')!==new URL(request.url).origin)return denied();
  const {email}=await request.json() as {email?:string};
  const viewers=await readPrivate<Viewer[]>(path,[]);
  const updated=viewers.filter(v=>v.email!==email);
  if(updated.length===viewers.length)return Response.json({error:'Không tìm thấy tài khoản.'},{status:404});
  await writePrivate(path,updated);
  return Response.json({ok:true});
}

