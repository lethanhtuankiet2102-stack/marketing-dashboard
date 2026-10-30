import {leadWorkbook,syncWarning} from '../../../lib/google-source';
import { getChatGPTUser } from '../../chatgpt-auth';
import { parseLeadWorkbook } from './workbook';
import { readPrivate, writePrivate } from '../../../lib/private-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

type Stored = ReturnType<typeof parseLeadWorkbook> & { mode?:'upload'; lastSyncedAt?:string; fileName?:string };
const cachePath='labcos/list-leads.json';
const headers={'Cache-Control':'private, no-store'};


export async function GET() {
  const user=await getChatGPTUser(true);
  if (!user) {
    return Response.json({ error: 'Cần đăng nhập để xem List Lead.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  if(user.role==='order')return Response.json({error:'Không có quyền truy cập mục Sale.'},{status:403,headers:{'Cache-Control':'private, no-store'}});
  const saved=await readPrivate<Stored|null>(cachePath,null).catch(()=>null);
  if(saved?.mode!=='upload'&&saved?.lastSyncedAt&&Date.now()-Date.parse(saved.lastSyncedAt)<60000)return Response.json({...saved,live:true,manual:false,warning:null},{headers});
  try {
    const records=parseLeadWorkbook(await leadWorkbook());
    if(!records.items.length)throw new Error('SOURCE_EMPTY');
    const next={...records,lastSyncedAt:new Date().toISOString(),fileName:'LABCOS _ LỊCH TRỰC PAGE (Google Drive)'};
    await writePrivate(cachePath,next);
    return Response.json({...next,live:true,manual:false,warning:null},{headers});
  } catch(error) {
    if(saved)return Response.json({...saved,live:false,manual:false,warning:syncWarning(error)},{headers});
    return Response.json({error:syncWarning(error)},{status:503,headers});
  }
}

export async function POST(request:Request) {
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'Cần đăng nhập.'},{status:401,headers});
  if(!['owner','manager','sale_admin'].includes(user.role))return Response.json({error:'Chỉ quản trị viên được cập nhật List Lead.'},{status:403,headers});
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

