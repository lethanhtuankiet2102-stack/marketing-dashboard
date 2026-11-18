import {randomUUID} from 'node:crypto';
import {getChatGPTUser} from '../../chatgpt-auth';
import {canEditLeads,canDeleteLeads} from '../../access-policy';
import {transactPrivate,readPrivate,readPrivateImage,writePrivateImage,deletePrivateImage} from '../../../lib/private-store';
import {notifyZaloNewLead} from '../../../lib/zalo-lead-notify';
import {salePurgeKey,readSaleWorkspace,normalizeSaleLead,validateSaleFields,updateSaleLead,saleDashboardPath,emptySaleDashboard,type SaleDashboard} from '../../../lib/sale-leads';
import {saleQrMaxBytes,saleQrTypes,type SaleQrImage,type SaleLead,type SaleLeadFields} from '../../sale-leads-model';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request?:Request){
 const user=await getChatGPTUser(true);if(!user)return Response.json({error:'Cần đăng nhập.'},{status:401,headers});if(user.role==='order')return Response.json({error:'Không có quyền truy cập Sale.'},{status:403,headers});
 try{
  const params=request?new URL(request.url).searchParams:null;
  if(params?.has('qr')){
   const id=params.get('qr');
   const dashboard=await readPrivate(saleDashboardPath,emptySaleDashboard);
   const lead=dashboard.leads.find(lead=>lead.id===id);
   const image=lead?.contact_method==='qr'&&(!lead.deleted_at||canDeleteLeads(user.role))?lead.contact_qr:undefined;
   if(image&&saleQrTypes.includes(image.type)&&/^labcos\/lead-qr\/[0-9a-f-]{36}$/.test(image.path)){
    const stream=await readPrivateImage(image.path);
    if(stream)return new Response(stream,{headers:{...headers,'Content-Type':image.type,'X-Content-Type-Options':'nosniff'}});
   }
   return Response.json({error:'Không tìm thấy ảnh QR.'},{status:404,headers});
  }
  const trash=params?.get('trash')==='1';if(trash&&!canDeleteLeads(user.role))return Response.json({error:'Chỉ Quản trị được truy cập thùng rác.'},{status:403,headers});const {dashboard,snapshot}=await readSaleWorkspace(undefined,true);return Response.json({items:dashboard.leads.filter(l=>trash?!!l.deleted_at:!l.deleted_at),canEdit:canEditLeads(user.role),canDelete:canDeleteLeads(user.role),trashCount:canDeleteLeads(user.role)?dashboard.leads.filter(l=>l.deleted_at).length:undefined,lastSyncedAt:snapshot?.lastSyncedAt||null},{headers});}
 catch{return Response.json({error:'Chưa tải được danh sách lead. Dữ liệu cũ vẫn được giữ; hãy thử lại.'},{status:503,headers});}
}
async function mutate(request:Request,method:'POST'|'PATCH'|'DELETE'){
 const user=await getChatGPTUser(true);if(!user)return Response.json({error:'Cần đăng nhập.'},{status:401,headers});if(!canEditLeads(user.role))return Response.json({error:'Tài khoản chỉ có quyền xem.'},{status:403,headers});
 const contentType=request.headers.get('content-type')||'',multipart=method!=='DELETE'&&contentType.startsWith('multipart/form-data;');
 if(request.headers.get('origin')!==new URL(request.url).origin||!multipart&&!contentType.startsWith('application/json'))return Response.json({error:'Yêu cầu không hợp lệ.'},{status:403,headers});
 let uploaded:SaleQrImage|undefined,committed=false;
 try{
  if(multipart&&Number(request.headers.get('content-length'))>saleQrMaxBytes+160000)throw new Error('QR_FILE');
  const form=multipart?await request.formData().catch(()=>{throw new Error('QR_FILE')}):null;
  const raw=form?form.get('lead'):await request.text();
  if(typeof raw!=='string')throw new Error('INPUT');
  if(raw.length>128000)throw new Error('INPUT');const input=JSON.parse(raw) as Record<string,unknown>;if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('INPUT');
  if(typeof input.id!=='string'||input.id.length>180||!input.id||method==='POST'&&!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(input.id)||method!=='POST'&&typeof input.revision!=='string')throw new Error('INPUT');
  if(input.action!==undefined&&!['care','restore','archive','delete','undelete','purge'].includes(input.action as string))throw new Error('INPUT');
  if(['archive','delete','purge'].includes(input.action as string)&&method!=='DELETE'||['care','restore','undelete'].includes(input.action as string)&&method!=='PATCH')throw new Error('INPUT');
  if(['delete','undelete','purge'].includes(input.action as string)&&!canDeleteLeads(user.role))return Response.json({error:'Chỉ Quản trị được xóa hoặc khôi phục lead đã xóa.'},{status:403,headers});
  const {dashboard:current}=await readSaleWorkspace();
  const file=form?.get('qr');
  if(form){
   if(method==='PATCH'){
    const lead=current.leads.find(l=>l.id===input.id);
    if(!lead)throw new Error('NOT_FOUND');
    if(lead.revision!==input.revision)throw new Error('CONFLICT');
   }
   if((input.action!==undefined&&input.action!=='care')||input.contact_method!=='qr'||!file||typeof file==='string'||!file.size||file.size>saleQrMaxBytes)throw new Error('QR_FILE');
   const bytes=new Uint8Array(await file.arrayBuffer()),type=qrImageType(bytes);
   if(!type||file.type!==type)throw new Error('QR_FILE');
   const image={path:'labcos/lead-qr/'+randomUUID(),type};
   await writePrivateImage(image.path,bytes,type);
   uploaded=image;
  }
  const fields=method==='POST'?validateSaleFields(input):null;
  const at=new Date().toISOString();
  let created=false,oldImage:SaleQrImage|undefined;
  const result=await transactPrivate<SaleDashboard>(saleDashboardPath,emptySaleDashboard,dashboard=>{
   created=false;oldImage=undefined;
   dashboard.leads=(dashboard.leads||[]).map(normalizeSaleLead);const lead=dashboard.leads.find(l=>l.id===input.id);
   if(method==='POST'){
    if(dashboard._salePurgedIds?.includes(salePurgeKey(input.id as string)))throw new Error('CONFLICT');
    if(lead){if(lead.deleted_at)throw new Error('CONFLICT');if(lead.created_by!==user.email)throw new Error('CONFLICT');return dashboard;}
    dashboard.leads.unshift({...fields!,contact_qr:contactImage(fields!,uploaded),id:input.id as string,revision:randomUUID(),created_at:at,updated_at:at,created_by:user.email,origin:'crm',history:[{id:randomUUID(),at,by:user.email,action:'created'}]});created=true;return dashboard;
   }
   if(!lead||lead.deleted_at&&!['undelete','purge'].includes(input.action as string))throw new Error('NOT_FOUND');if(lead.revision!==input.revision)throw new Error('CONFLICT');
   if(input.action==='purge'){
    if(!lead.deleted_at||input.confirmName!==lead.name)throw new Error('PURGE_CONFIRM');
    dashboard._salePurgedIds=[...new Set([...(dashboard._salePurgedIds||[]),salePurgeKey(lead.id)])];
    if(lead._sheet)dashboard._salePurgedSources=[...new Set([...(dashboard._salePurgedSources||[]),lead._sheet.key])];
    oldImage=lead.contact_qr;
    dashboard.leads=dashboard.leads.filter(l=>l.id!==lead.id);return dashboard;
   }else if(input.action==='delete'||input.action==='undelete'){
    if(input.action==='undelete'&&!lead.deleted_at)throw new Error('INPUT');lead.deleted_at=input.action==='delete'?at:null;lead.deleted_by=input.action==='delete'?user.email:null;lead.updated_at=at;lead.revision=randomUUID();lead.history.push({id:randomUUID(),at,by:user.email,action:input.action==='delete'?'trashed':'untrashed'});
   }else if(method==='DELETE'||input.action==='restore'){
    lead.archived_at=method==='DELETE'?at:null;lead.updated_at=at;lead.revision=randomUUID();lead.history.push({id:randomUUID(),at,by:user.email,action:method==='DELETE'?'archived':'restored'});
   }else if(input.action==='care'){
    if(typeof input.careNote!=='string'||!input.careNote.trim()||input.careNote.length>4000)throw new Error('INPUT');
    const next=validateSaleFields(mergeFields(lead,input,input.careNote.trim()));
    oldImage=updateLeadContact(lead,next,uploaded,user.email,input.careNote.trim());
   }else oldImage=updateLeadContact(lead,validateSaleFields(mergeFields(lead,input)),uploaded,user.email);
   return dashboard;
  });
  committed=true;
  const lead=result.leads.find(l=>l.id===input.id);
  if(oldImage)await discardImage(oldImage);
  if(uploaded&&lead?.contact_qr?.path!==uploaded.path)await discardImage(uploaded);
  let zaloNotification:'sent'|'failed'|'not_configured'|'skipped'='skipped';
  if(method==='POST'&&created&&lead?.origin==='crm'&&lead.record_kind==='lead'){
   try{zaloNotification=await notifyZaloNewLead(lead);}
   catch{zaloNotification='failed';console.error('ZALO_LEAD_NOTIFY_FAILED',lead.id);}
  }
  return Response.json({lead,...(input.action==='purge'?{purgedId:input.id}:{}),...(method==='POST'?{zaloNotification}:{})},{status:method==='POST'?201:200,headers});
 }catch(error){const code=error instanceof Error?error.message:'';if(uploaded&&!committed&&['INPUT','QR_REQUIRED','NOT_FOUND','CONFLICT'].includes(code))await discardImage(uploaded);const status=code==='CONFLICT'?409:code==='NOT_FOUND'?404:code==='INPUT'||code==='PURGE_CONFIRM'||code==='QR_REQUIRED'||code==='QR_FILE'||error instanceof SyntaxError?400:503;return Response.json({error:status===409?'Lead vừa được người khác cập nhật. Tải lại danh sách rồi mở lại lead; nội dung đang nhập được giữ.':status===404?'Không tìm thấy lead.':code==='PURGE_CONFIRM'?'Chỉ xóa vĩnh viễn lead trong Thùng rác và cần nhập đúng tên khách hàng.':code==='QR_REQUIRED'?'Chọn ảnh QR trước khi lưu.':code==='QR_FILE'?'Chọn ảnh QR định dạng PNG, JPG hoặc WebP, tối đa 2 MB.':status===400?'Kiểm tra tên, ngày ghi nhận, giai đoạn, giá trị và nội dung chăm sóc.':'Chưa lưu được thay đổi. Hãy thử lại.'},{status,headers});}
}
export const POST=(r:Request)=>mutate(r,'POST');
export const PATCH=(r:Request)=>mutate(r,'PATCH');
export const DELETE=(r:Request)=>mutate(r,'DELETE');

function mergeFields(lead:Record<string,unknown>,input:Record<string,unknown>,interaction?:string){const next:Record<string,unknown>={...lead,...input,...(interaction===undefined?{}:{last_interaction:interaction})};if(input.status_tags===undefined&&input.status!==undefined&&input.status!==lead.status)next.status_tags=[];return next;}


function qrImageType(bytes:Uint8Array):SaleQrImage['type']|undefined{
 const starts=(prefix:number[],at=0)=>bytes.length>=at+prefix.length&&prefix.every((n,i)=>bytes[at+i]===n);
 if(starts([137,80,78,71,13,10,26,10]))return 'image/png';
 if(starts([255,216,255]))return 'image/jpeg';
 if(starts([82,73,70,70])&&starts([87,69,66,80],8))return 'image/webp';
}
function contactImage(fields:SaleLeadFields,image?:SaleQrImage){
 if(fields.contact_method!=='qr')return;
 if(!image)throw new Error('QR_REQUIRED');
 return image;
}
function updateLeadContact(lead:SaleLead,fields:SaleLeadFields,uploaded:SaleQrImage|undefined,actor:string,note?:string){
 const previous=lead.contact_qr,next=contactImage(fields,uploaded||previous);
 updateSaleLead(lead,fields,actor,note);
 if(next)lead.contact_qr=next;
 else delete lead.contact_qr;
 return previous?.path!==next?.path?previous:undefined;
}
async function discardImage(image:SaleQrImage){
 if(/^labcos\/lead-qr\/[0-9a-f-]{36}$/.test(image.path))await deletePrivateImage(image.path).catch(()=>console.error('Could not remove private lead QR image'));
}
