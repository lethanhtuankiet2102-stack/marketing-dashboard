import { getChatGPTUser } from '../../chatgpt-auth';
import { readPrivate } from '../../../lib/private-store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET() {
  if(!await getChatGPTUser())return Response.json({error:'Cần đăng nhập.'},{status:401});
  const reports=await readPrivate<unknown[]|null>('labcos/google-ads-summary.json',null);
  return Response.json(reports??{error:'Chưa chuyển báo cáo Google Ads sang Vercel.'},{status:reports?200:503,headers:{'Cache-Control':'private, no-store'}});
}
