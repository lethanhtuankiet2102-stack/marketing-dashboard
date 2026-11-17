import type {SaleLead} from '../app/sale-leads-model';

type ZaloResponse={ok?:boolean;error_code?:number};

function compact(value:string|undefined,maxLength:number){
 return (value||'').replace(/\s+/g,' ').trim().slice(0,maxLength);
}

// Group notifications should not reveal phone numbers, emails, or private care notes.
export function formatZaloLeadMessage(lead:Pick<SaleLead,'name'|'source'|'need'|'sales'|'date'>){
 return [
  '🔔 LABCOS | LEAD MỚI',
  '',
  'Khách hàng: '+(compact(lead.name,120)||'Chưa cập nhật'),
  'Nguồn: '+(compact(lead.source,100)||'Chưa cập nhật'),
  'Nhu cầu: '+(compact(lead.need,350)||'Chưa cập nhật'),
  'Sales phụ trách: '+(compact(lead.sales,120)||'Chưa phân công'),
  'Ngày ghi nhận: '+compact(lead.date,10),
  '',
  'Vui lòng tiếp nhận và cập nhật trạng thái trên CRM.',
  'https://marketing-dashboard-labcos.vercel.app/'
 ].join('\n');
}

export async function notifyZaloNewLead(lead:SaleLead):Promise<'sent'|'not_configured'>{
 const token=process.env.ZALO_BOT_TOKEN?.trim();
 const groupId=process.env.ZALO_SALES_GROUP_ID?.trim();
 if(!token||!groupId)return 'not_configured';
 if(!groupId.startsWith('zgr-'))throw new Error('ZALO_INVALID_GROUP_ID');

 const response=await fetch(`https://bot-api.zaloplatforms.com/bot${token}/sendMessage`,{
  method:'POST',
  headers:{'Content-Type':'application/json; charset=utf-8'},
  body:JSON.stringify({chat_id:groupId,text:formatZaloLeadMessage(lead)}),
  cache:'no-store',
  signal:AbortSignal.timeout(8000)
 });
 const payload=await response.json().catch(()=>null) as ZaloResponse|null;
 if(!response.ok||payload?.ok!==true){
  // Do not include the bot token, URL, customer data or raw API response in logs.
  throw new Error('ZALO_SEND_FAILED_'+(payload?.error_code??response.status));
 }
 return 'sent';
}
