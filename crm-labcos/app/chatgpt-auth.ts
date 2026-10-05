import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { readPrivate } from '../lib/private-store';

export type ChatGPTUser = { userId:string; displayName:string; email:string; fullName:string|null; role:'owner'|'viewer' };
const cookieName='labcos-session';

function secret() {
  const value=process.env.AUTH_SESSION_SECRET;
  if (!value || value.length<24) throw new Error('AUTH_SESSION_SECRET chưa được cấu hình.');
  return value;
}
function sign(payload:string) { return createHmac('sha256',secret()).update(payload).digest('base64url'); }
export function createSession(user:ChatGPTUser) {
  const payload=Buffer.from(JSON.stringify({user,expires:Date.now()+7*24*60*60*1000})).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
export function verifySession(token:string|undefined):ChatGPTUser|null {
  if (!token) return null;
  try {
    const [payload,signature,...extra]=token.split('.');
    if (!payload||!signature||extra.length) return null;
    const expected=Buffer.from(sign(payload));
    const actual=Buffer.from(signature);
    if (actual.length!==expected.length||!timingSafeEqual(actual,expected)) return null;
    const parsed=JSON.parse(Buffer.from(payload,'base64url').toString('utf8')) as {user:ChatGPTUser;expires:number};
    if (parsed.expires<Date.now()||!['owner','viewer'].includes(parsed.user?.role)||!parsed.user.email) return null;
    return parsed.user;
  } catch { return null; }
}
export async function getChatGPTUser() {
  const user=verifySession((await cookies()).get(cookieName)?.value);
  if(user?.role==='viewer') {
    try {
      const viewers=await readPrivate<{email:string}[]>('labcos/viewers.json',[]);
      if(!viewers.some(viewer=>viewer.email===user.email))return null;
    } catch {return null}
  }
  return user;
}
export async function requireChatGPTUser(returnTo:string):Promise<ChatGPTUser> {
  const user=await getChatGPTUser();
  if (user) return user;
  redirect(chatGPTSignInPath(returnTo));
}
export function chatGPTSignInPath(returnTo:string) { return `/login?return_to=${encodeURIComponent(safePath(returnTo))}`; }
export function chatGPTSignOutPath() { return '/api/auth/logout'; }
export function safePath(path:string) { return path.startsWith('/')&&!path.startsWith('//')&&!path.startsWith('/api/')?path:'/'; }
export const sessionCookie=cookieName;
