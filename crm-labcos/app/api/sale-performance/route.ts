import { getChatGPTUser } from '../../chatgpt-auth';
import { readPrivate } from '../../../lib/private-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  if (!await getChatGPTUser()) {
    return Response.json({error:'Cần đăng nhập để xem Sale Performance.'},{status:401,headers:{'Cache-Control':'no-store'}});
  }
  const report=await readPrivate<Record<string,unknown>|null>('labcos/sale-performance.json',null);
  return Response.json(report??{error:'Chưa chuyển báo cáo Sale Performance sang Vercel.'},{status:report?200:503,headers:{'Cache-Control':'private, no-store'}});
}
