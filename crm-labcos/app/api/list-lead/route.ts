import { getChatGPTUser } from '../../chatgpt-auth';
import { parseLeadWorkbook } from './workbook';
import { readPrivate, writePrivate } from '../../../lib/private-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

type Stored = ReturnType<typeof parseLeadWorkbook> & { mode?:'upload'; lastSyncedAt?:string; fileName?:string };
const cachePath='labcos/list-leads.json';
const headers={'Cache-Control':'private, no-store'};

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
  const saved=await readPrivate<Stored|null>(cachePath,null).catch(()=>null);
  if(saved?.mode==='upload') return Response.json({...saved,live:false,manual:true,warning:null},{headers});
  if (!fileId) return saved?Response.json({...saved,live:false,warning:'Chưa kết nối file Google. Quản trị viên có thể tải Excel mới lên.'},{headers}):Response.json({error:'Chưa kết nối file Google. Hãy tải Excel lên để cập nhật List Lead.'},{status:503,headers});
  try {
    const buffer=await downloadWorkbook();
    const records=parseLeadWorkbook(buffer);
    try {
      const previous=await readPrivate<typeof records|null>('labcos/list-leads.json',null);
      if (JSON.stringify(previous)!==JSON.stringify(records)) await writePrivate('labcos/list-leads.json',records);
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

export async function POST(request:Request) {
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'Cần đăng nhập.'},{status:401,headers});
  if(user.role!=='owner')return Response.json({error:'Chỉ quản trị viên được cập nhật List Lead.'},{status:403,headers});
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Yêu cầu không hợp lệ.'},{status:403,headers});
  if(Number(request.headers.get('content-length')||0)>4_000_000)return Response.json({error:'File phải nhỏ hơn 4 MB.'},{status:413,headers});
  let records:Stored;
  try {
    const form=await request.formData();
    const file=form.get('file');
    if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.xlsx'))throw new Error('Hãy chọn file Excel .xlsx.');
    if(file.size>4_000_000) return Response.json({error:'File phải nhỏ hơn 4 MB.'},{status:413,headers});
    const buffer=await file.arrayBuffer();
    const bytes=new Uint8Array(buffer);
    if(bytes[0]!==0x50||bytes[1]!==0x4b)throw new Error('File Excel không hợp lệ.');
    const parsed=parseLeadWorkbook(buffer);
    if(!parsed.items.length)throw new Error('Không tìm thấy lead từ tháng 7/2026. Dữ liệu hiện có được giữ nguyên.');
    records={...parsed,mode:'upload',lastSyncedAt:new Date().toISOString(),fileName:file.name.slice(0,180)};
  } catch(error) {return Response.json({error:error instanceof Error?error.message:'Không đọc được file Excel.'},{status:400,headers});}
  try {
    await writePrivate(cachePath,records);
    return Response.json({...records,live:false,manual:true,warning:null},{headers});
  } catch {return Response.json({error:'Chưa lưu được dữ liệu. Hãy thử lại; bản cũ vẫn được giữ.'},{status:503,headers});}
}
