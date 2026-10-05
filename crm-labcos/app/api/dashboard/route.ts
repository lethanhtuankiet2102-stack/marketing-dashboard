import { dashboardRole, requireOwnerWrite } from '../../roles';
import { readPrivate, writePrivate } from '../../../lib/private-store';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const path='labcos/dashboard.json';
const leadStatuses=new Set(['new','contacted','interested','booked','won','lost']);
const contentStatuses=new Set(['draft','review','scheduled','published']);
const channels=new Set(['Facebook','Instagram','TikTok','Google Ads','Khác']);
type Row={id:string;created_at:string;updated_at:string;[key:string]:unknown};
type Dashboard={leads:Row[];content:Row[]};
const empty:Dashboard={leads:[],content:[]};
const str=(v:unknown,max=500)=>typeof v==='string'?v.trim().slice(0,max):'';
const validDate=(v:string)=>!v||/^\d{4}-\d{2}-\d{2}$/.test(v);
const validWrite=(r:Request)=>r.headers.get('origin')===new URL(r.url).origin&&r.headers.get('content-type')?.startsWith('application/json');
const error=()=>Response.json({error:'Không thể lưu hoặc tải dữ liệu. Vui lòng thử lại.'},{status:500});
function fields(input:Record<string,unknown>) {
  if(input.kind==='lead') {
    const name=str(input.name,120),status=str(input.status),next_action=str(input.nextAction,10);
    if(!name||!leadStatuses.has(status)||!validDate(next_action))return null;
    return {name,company:str(input.company,120),phone:str(input.phone,40),source:str(input.source,80)||'Khác',status,value:Math.max(0,Math.min(1e12,Number(input.value)||0)),next_action,note:str(input.note,3000)};
  }
  if(input.kind==='content') {
    const title=str(input.title,180),channel=str(input.channel),status=str(input.status),publish_date=str(input.publishDate,10);
    if(!title||!channels.has(channel)||!contentStatuses.has(status)||!validDate(publish_date))return null;
    return {title,channel,status,publish_date,brief:str(input.brief,4000)};
  }
  return null;
}
export async function GET() {
  const role=await dashboardRole();if(!role)return Response.json({error:'Cần đăng nhập.'},{status:401});
  try {const data=await readPrivate(path,empty);return Response.json({...data,role},{headers:{'Cache-Control':'private, no-store'}})}catch(e){console.error('Dashboard read failed',e);return error()}
}
export async function POST(request:Request) { return mutate(request,'POST'); }
export async function PATCH(request:Request) { return mutate(request,'PATCH'); }
export async function DELETE(request:Request) { return mutate(request,'DELETE'); }
async function mutate(request:Request,method:'POST'|'PATCH'|'DELETE') {
  const denied=await requireOwnerWrite();if(denied)return denied;
  if(!validWrite(request))return Response.json({error:'Yêu cầu không hợp lệ.'},{status:403});
  try {
    const input=await request.json() as Record<string,unknown>;
    const collection=input.kind==='lead'?'leads':input.kind==='content'?'content':null;
    if(!collection)return Response.json({error:'Loại dữ liệu không hợp lệ.'},{status:400});
    const data=await readPrivate(path,empty);
    const rows=data[collection],id=method==='POST'?crypto.randomUUID():str(input.id,80),index=rows.findIndex(row=>row.id===id);
    if(method!=='POST'&&index<0)return Response.json({error:'Không tìm thấy bản ghi.'},{status:404});
    if(method==='DELETE')rows.splice(index,1);
    else {
      const values=fields(input);if(!values)return Response.json({error:'Dữ liệu không hợp lệ.'},{status:400});
      const now=new Date().toISOString();
      if(method==='POST')rows.unshift({id,...values,created_at:now,updated_at:now});
      else rows[index]={...rows[index],...values,updated_at:now};
    }
    await writePrivate(path,data);
    return Response.json(method==='POST'?{id}:{ok:true},{status:method==='POST'?201:200});
  }catch(e){console.error('Dashboard write failed',e);return error()}
}
