import { getChatGPTUser } from '../../chatgpt-auth';
import { parseLeadWorkbook } from './workbook';
import { readPrivate, writePrivate } from '../../../lib/private-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const fileId=process.env.LIST_LEAD_SHEET_ID||'';
const sourceUrls=[
  `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
  `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`,
  `https://drive.google.com/uc?export=download&id=${fileId}`,
];

async function downloadWorkbook() {
  const failures:string[]=[];
  for (const url of sourceUrls) {
    try {
      const response=await fetch(url,{cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(12000)});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer=await response.arrayBuffer();
      const bytes=new Uint8Array(buffer);
      if (buffer.byteLength>20_000_000 || bytes[0]!==0x50 || bytes[1]!==0x4b) throw new Error('Google trả về trang web thay vì Excel');
      return buffer;
    } catch (error) {failures.push(`${new URL(url).hostname}: ${error instanceof Error?error.message:String(error)}`);}
  }
  throw new Error(failures.join('; '));
}

export async function GET() {
  if (!await getChatGPTUser()) {
    return Response.json({ error: 'Cần đăng nhập để xem List Lead.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!fileId) return Response.json({error:'Chưa cấu hình LIST_LEAD_SHEET_ID trên Vercel.'},{status:503,headers:{'Cache-Control':'private, no-store'}});
  try {
    const buffer=await downloadWorkbook();
    const records=parseLeadWorkbook(buffer);
    try {
      const previous=await readPrivate<typeof records|null>('labcos/list-leads.json',null);
      if (previous?.throughDate!==records.throughDate||previous.items.length!==records.items.length) await writePrivate('labcos/list-leads.json',records);
    } catch (error) { console.error('List Lead cache write failed',error); }
    return Response.json({...records,live:true,lastSyncedAt:new Date().toISOString()}, {headers:{'Cache-Control':'private, no-store'}});
  } catch (error) {
    console.error('List Lead source refresh failed:',error);
    try {
      const records=await readPrivate<ReturnType<typeof parseLeadWorkbook>|null>('labcos/list-leads.json',null);
      if(records)return Response.json({...records,live:false,lastSyncedAt:null,warning:'Chưa kết nối được file nguồn. Đang hiển thị bản lưu trước đó; dữ liệu có thể chưa mới.'},{headers:{'Cache-Control':'private, no-store'}});
    } catch (cacheError) { console.error('List Lead cache read failed',cacheError); }
    return Response.json({error:'Chưa kết nối được List Lead và chưa có bản lưu trên Vercel.'},{status:503,headers:{'Cache-Control':'private, no-store'}});
  }
}
