import { getChatGPTUser } from '../../chatgpt-auth';
import { readPrivate } from '../../../lib/private-store';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(request:Request) {
  if(!await getChatGPTUser())return new Response('Cần đăng nhập.',{status:401});
  const month=new URL(request.url).searchParams.get('month')||'';
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))return new Response('Tháng không hợp lệ.',{status:400});
  const html=await readPrivate<string|null>(`labcos/google-ads-${month}.json`,null);
  if(!html)return new Response('Chưa chuyển báo cáo Google Ads tháng này sang Vercel.',{status:503});
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"}});
}
