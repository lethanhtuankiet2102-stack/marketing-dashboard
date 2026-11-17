export const saleStages=[['new','Mới'],['contacted','Đã liên hệ'],['interested','Quan tâm / tư vấn'],['booked','Đã hẹn'],['won','Chốt đơn'],['lost','Không phù hợp']] as const;
export type SaleStage=typeof saleStages[number][0];
export type SaleChannel='facebook'|'google'|'other';
export type SaleLeadFields={name:string;company:string;phone:string;source:string;channel:SaleChannel;date:string;sales:string;need:string;status:SaleStage;value:number;next_action:string;note:string};
export type SaleActivity={id:string;at:string;by:string;action:'created'|'updated'|'care'|'archived'|'restored';note?:string;fields?:string[];fromStatus?:SaleStage;toStatus?:SaleStage};
export type SaleLead=SaleLeadFields&{id:string;revision:string;created_at:string;updated_at:string;created_by?:string;origin:'sheet'|'crm';archived_at?:string|null;history:SaleActivity[];_crmEdited?:string[];_sheet?:{key:string;row:number;status:string;fingerprint:string};sourceMissing?:boolean};
export const saleSourceOptions=['Messenger/Facebook Ads','Zalo OA/Google','Hotline','Website','Giới thiệu','Khác'];
export const saleStageLabel=(s:string)=>saleStages.find(item=>item[0]===s)?.[1]||s;
export const saleNormalize=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').trim().replace(/\s+/g,' ');
export function saleChannel(source:string):SaleChannel{const s=saleNormalize(source);return /google|zalo/.test(s)?'google':/facebook|messenger|meta/.test(s)?'facebook':'other';}
export const saleToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const emptySaleLead=():SaleLeadFields=>({name:'',company:'',phone:'',source:'Messenger/Facebook Ads',channel:'facebook',date:saleToday(),sales:'',need:'',status:'new',value:0,next_action:'',note:''});
export function saleOverdue(lead:SaleLead,today=saleToday()){return !!lead.next_action&&lead.next_action<today&&!['won','lost'].includes(lead.status)&&!lead.archived_at;}
export type SaleFilters={month:string;stage:string;sales:string;channel:string;query:string;overdue:boolean;archived:boolean};
export function filterSaleLeads(items:SaleLead[],f:SaleFilters){const q=saleNormalize(f.query);return items.filter(l=>!!l.archived_at===f.archived&&(f.month==='all'||l.date.startsWith(f.month))&&(f.stage==='all'||l.status===f.stage)&&(f.sales==='all'||(l.sales||'__empty__')===f.sales)&&(f.channel==='all'||l.channel===f.channel)&&(!f.overdue||saleOverdue(l))&&(!q||saleNormalize([l.name,l.company,l.phone,l.sales,l.need,l.note,l.source,l._sheet?.status||''].join(' ')).includes(q)));}
