import { sessionCookie } from '../../../chatgpt-auth';
export async function POST(request:Request) {
  if (request.headers.get('origin')!==new URL(request.url).origin) return Response.json({error:'Yêu cầu không hợp lệ.'},{status:403});
  const response=Response.json({ok:true});
  response.headers.append('Set-Cookie',`${sessionCookie}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  return response;
}
