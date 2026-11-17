import {randomUUID} from 'node:crypto';
import {getChatGPTUser} from '../../chatgpt-auth';
import {canEditLeads} from '../../access-policy';
import {transactPrivate} from '../../../lib/private-store';
import {notifyZaloNewLead} from '../../../lib/zalo-lead-notify';
import {readSaleWorkspace,normalizeSaleLead,validateSaleFields,updateSaleLead,saleDashboardPath,emptySaleDashboard,type SaleDashboard} from '../../../lib/sale-leads';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){
 const user=await getChatGPTUser(true);if(!user)return Response.json({error:'Cần đăng nhập.'},{status:401,headers});if(user.role==='order')return Response.json({error:'Không có quyền truy cập Sale.'},{status:403,headers});
 try{const {dashboard,snapshot}=await readSaleWorkspace();return Response.json({items:dashboard.leads,canEdit:canEditLeads(user.role),lastSyncedAt:snapshot?.lastSyncedAt||null},{headers});}
 catch{return Response.json({error:'Chưa tải được danh sách lead. Dữ liệu cũ vẫn được giữ; hãy thử lại.'},{status:503,headers});}
}
async function mutate(request:Request,method:'POST'|'PATCH'|'DELETE'){
 const user=await getChatGPTUser(true);if(!user)return Response.json({error:'Cần đăng nhập.'},{status:401,headers});if(!canEditLeads(user.role))return Response.json({error:'Tài khoản chỉ có quyền xem.'},{status:403,headers});
 if(request.headers.get('origin')!==new URL(request.url).origin||!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'Yêu cầu không hợp lệ.'},{status:403,headers});
 try{
  const raw=await request.text();if(raw.length>128000)throw new Error('INPUT');const input=JSON.parse(raw) as Record<string,unknown>;if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('INPUT');
  if(typeof input.id!=='string'||input.id.length>180||!input.id||method==='POST'&&!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(input.id)||method!=='POST'&&typeof input.revision!=='string')throw new Error('INPUT');
  if(input.action!==undefined&&!['care','restore','archive'].includes(input.action as string))throw new Error('INPUT');
  if(input.action==='archive'&&method!=='DELETE'||['care','restore'].includes(input.action as string)&&method!=='PATCH')throw new Error('INPUT');
  await readSaleWorkspace();
  const fields=method==='POST'?validateSaleFields(input):null;
  const at=new Date().toISOString();
  let created=false;
  const result=await transactPrivate<SaleDashboard>(saleDashboardPath,emptySaleDashboard,dashboard=>{
   created=false;
   dashboard.leads=(dashboard.leads||[]).map(normalizeSaleLead);const lead=dashboard.leads.find(l=>l.id===input.id);
   if(method==='POST'){
    if(lead){if(lead.created_by!==user.email)throw new Error('CONFLICT');return dashboard;}
    dashboard.leads.unshift({...fields!,id:input.id as string,revision:randomUUID(),created_at:at,updated_at:at,created_by:user.email,origin:'crm',history:[{id:randomUUID(),at,by:user.email,action:'created'}]});created=true;return dashboard;
   }
   if(!lead)throw new Error('NOT_FOUND');if(lead.revision!==input.revision)throw new Error('CONFLICT');
   if(method==='DELETE'||input.action==='restore'){
    lead.archived_at=method==='DELETE'?at:null;lead.updated_at=at;lead.revision=randomUUID();lead.history.push({id:randomUUID(),at,by:user.email,action:method==='DELETE'?'archived':'restored'});
   }else if(input.action==='care'){
    if(typeof input.careNote!=='string'||!input.careNote.trim()||input.careNote.length>4000)throw new Error('INPUT');
    const next=validateSaleFields(mergeFields(lead,input,input.careNote.trim()));updateSaleLead(lead,next,user.email,input.careNote.trim());
   }else updateSaleLead(lead,validateSaleFields(mergeFields(lead,input)),user.email);
   return dashboard;
  });
  const lead=result.leads.find(l=>l.id===input.id);
  let zaloNotification:'sent'|'failed'|'not_configured'|'skipped'='skipped';
  if(method==='POST'&&created&&lead?.origin==='crm'&&lead.record_kind==='lead'){
   try{zaloNotification=await notifyZaloNewLead(lead);}
   catch{zaloNotification='failed';console.error('ZALO_LEAD_NOTIFY_FAILED',lead.id);}
  }
  return Response.json({lead,...(method==='POST'?{zaloNotification}:{})},{status:method==='POST'?201:200,headers});
 }catch(error){const code=error instanceof Error?error.message:'';const status=code==='CONFLICT'?409:code==='NOT_FOUND'?404:code==='INPUT'||error instanceof SyntaxError?400:503;return Response.json({error:status===409?'Lead vừa được người khác cập nhật. Tải lại danh sách rồi mở lại lead; nội dung đang nhập được giữ.':status===404?'Không tìm thấy lead.':status===400?'Kiểm tra tên, ngày ghi nhận, giai đoạn, giá trị và nội dung chăm sóc.':'Chưa lưu được thay đổi. Hãy thử lại.'},{status,headers});}
}
export const POST=(r:Request)=>mutate(r,'POST');
export const PATCH=(r:Request)=>mutate(r,'PATCH');
export const DELETE=(r:Request)=>mutate(r,'DELETE');

function mergeFields(lead:Record<string,unknown>,input:Record<string,unknown>,interaction?:string){const next:Record<string,unknown>={...lead,...input,...(interaction===undefined?{}:{last_interaction:interaction})};if(input.status_tags===undefined&&input.status!==undefined&&input.status!==lead.status)next.status_tags=[];return next;}
