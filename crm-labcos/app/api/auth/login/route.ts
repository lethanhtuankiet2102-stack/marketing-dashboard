import { scryptSync, timingSafeEqual } from 'node:crypto';
import { createSession, safePath, sessionCookie, type ChatGPTUser } from '../../../chatgpt-auth';
import { readPrivate } from '../../../../lib/private-store';

export const runtime='nodejs';
const noStore={'Cache-Control':'private, no-store'};
type Viewer={email:string;passwordHash:string;displayName:string;role?:'viewer'|'designer'};
function check(password:string,stored:string) {
  const [salt,hash]=stored.split(':');
  if (!salt||!hash||!/^[0-9a-f]{64}$/.test(hash)) return false;
  const supplied=scryptSync(password,salt,32),expected=Buffer.from(hash,'hex');
  return timingSafeEqual(supplied,expected);
}
export async function POST(request:Request) {
  if (request.headers.get('origin')!==new URL(request.url).origin) return Response.json({error:'Yêu cầu không hợp lệ.'},{status:403,headers:noStore});
  let input:{username?:string;password?:string;returnTo?:string};
  try {input=await request.json()} catch {return Response.json({error:'Yêu cầu không hợp lệ.'},{status:400,headers:noStore})}
  const username=String(input.username||'').trim().toLowerCase(),password=String(input.password||'');
  let user:ChatGPTUser|null=null;
  if (username===process.env.AUTH_USER?.trim().toLowerCase()&&process.env.AUTH_PASS&&password===process.env.AUTH_PASS) {
    user={userId:'owner',email:username,displayName:username,fullName:null,role:'owner'};
  } else {
    const viewers=await readPrivate<Viewer[]>('labcos/viewers.json',[]);
    const viewer=viewers.find(item=>item.email===username);
    if (viewer&&check(password,viewer.passwordHash)) user={userId:viewer.email,email:viewer.email,displayName:viewer.displayName||viewer.email,fullName:null,role:viewer.role==='designer'?'designer':'viewer'};
  }
  if (!user) return Response.json({error:'Tài khoản hoặc mật khẩu không đúng.'},{status:401,headers:noStore});
  const response=Response.json({ok:true,returnTo:safePath(input.returnTo||'/')},{headers:noStore});
  response.headers.append('Set-Cookie',`${sessionCookie}=${createSession(user)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);
  return response;
}

