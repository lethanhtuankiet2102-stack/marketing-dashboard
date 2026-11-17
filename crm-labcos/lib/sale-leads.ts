import {createHash,randomUUID} from 'node:crypto';
import {readPrivate,transactPrivate} from './private-store';
import {emptySaleLead,saleChannel,saleNormalize,saleStages,saleToday,salePrimaryStatus,type SaleLead,type SaleLeadFields,type SaleStage} from '../app/sale-leads-model';
export type SheetLead={id:string;sheetRow:number;date:string;number:string;name:string;phone:string;status:string;sales:string;need:string;note:string};
export type LeadSnapshot={items:SheetLead[];fromDate:string;throughDate:string;lastSyncedAt?:string;source?:string;mode?:'upload';fileName?:string};
export type SaleDashboard={leads:SaleLead[];content:Record<string,unknown>[];_saleSourceVersion?:string;_saleSourceSyncedAt?:string;[key:string]:unknown};
export const saleDashboardPath='labcos/dashboard.json';
export const emptySaleDashboard:SaleDashboard={leads:[],content:[]};
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,28);
const fieldKeys=Object.keys(emptySaleLead()) as (keyof SaleLeadFields)[];
function sheetStage(value:string):SaleStage{
 const s=saleNormalize(value);
 if(!s)return 'new';
 if(saleStages.some(([key])=>key===s))return s as SaleStage;
 const mapped:Record<string,SaleStage>={'moi':'new','chua lien he':'new','chua cham soc':'new','khach moi':'new','da lien he':'contacted','quan tam':'interested','dang tu van':'interested','da hen':'booked','hen gap':'booked','chot don':'won','da chot':'won','thanh cong':'won','khong phu hop':'lost','that bai':'lost','mat lead':'lost','dang cham soc':'caring','da gui hop dong':'contract_sent','dang doi mau':'waiting_sample','da bao gia':'quoted','da lh - chua tu van':'contacted_not_advised','da lh - khach chua phan hoi':'waiting_reply','khong lien lac duoc':'unreachable','closed':'closed','win':'won','da gui mau':'samples_sent','dang doi mau fix':'waiting_sample_fix'};
 return mapped[s]||'contacted';
}
function phoneKey(value:string){let s=value.replace(/\D/g,'');if(s.startsWith('84'))s='0'+s.slice(2);if(s.length===9)s='0'+s;return s;}
function sourceKey(row:SheetLead){return hash([row.date,saleNormalize(row.name),phoneKey(row.phone)]);}
function sourceFields(row:SheetLead):SaleLeadFields{return {...emptySaleLead(),name:row.name||'Chưa ghi tên',phone:row.phone,company:'',date:row.date,sales:row.sales,need:row.need,note:row.note,status:sheetStage(row.status),value:0,next_action:'',source:/\bzalo\s*oa\b/.test(saleNormalize(row.note))?'Zalo OA/Google':'Messenger/Facebook Ads',channel:/\bzalo\s*oa\b/.test(saleNormalize(row.note))?'google':'facebook'};}
function fingerprint(row:SheetLead){return hash([sourceFields(row),row.status]);}
export function normalizeSaleLead(raw:SaleLead):SaleLead{
 const fields={...emptySaleLead(),...raw};
 const status=saleStages.some(([s])=>s===fields.status)?fields.status:'new';
 return {...fields,status_tags:Array.isArray(raw.status_tags)?raw.status_tags.filter(s=>saleStages.some(([key])=>key===s)):[],channel:raw.channel||saleChannel(fields.source),date:raw.date||raw.created_at?.slice(0,10)||'',status,origin:raw.origin||'crm',history:Array.isArray(raw.history)?raw.history:[],revision:raw.revision||'legacy-'+hash(raw)};
}
export function reconcileSaleLeads(dashboard:SaleDashboard,snapshot:LeadSnapshot,now=new Date().toISOString()):SaleDashboard{
 const leads=(dashboard.leads||[]).map(normalizeSaleLead),seen=new Set<string>();
 const groups=new Map<string,SheetLead[]>();for(const row of snapshot.items){const key=sourceKey(row);groups.set(key,[...(groups.get(key)||[]),row]);}
 for(const [key,rows] of groups){
  const candidates=leads.filter(l=>l._sheet?.key===key),used=new Set<string>(),matches=new Map<SheetLead,SaleLead>();
  for(const row of rows){const match=candidates.find(l=>!used.has(l.id)&&l._sheet?.fingerprint===fingerprint(row));if(match){matches.set(row,match);used.add(match.id);}}
  const remainingRows=rows.filter(row=>!matches.has(row)),remainingLeads=candidates.filter(l=>!used.has(l.id));
  if(remainingRows.length===1&&remainingLeads.length===1)matches.set(remainingRows[0],remainingLeads[0]);
  for(const row of rows){
   const fields=sourceFields(row),fp=fingerprint(row),previous=matches.get(row);
   if(previous){
    const edited=new Set(previous._crmEdited||[]),before=JSON.stringify(previous);
    for(const field of ['name','phone','date','sales','need','note','status','source','channel'] as const){if(!edited.has(field))Object.assign(previous,{[field]:fields[field]});}
    previous._sheet={key,row:row.sheetRow,status:row.status,fingerprint:fp};previous.sourceMissing=false;
    if(JSON.stringify(previous)!==before){previous.revision=randomUUID();previous.updated_at=now;}
    seen.add(previous.id);
   }else{
    let id='sheet-lead-'+key+(rows.length>1?'-'+fp:'');while(leads.some(l=>l.id===id))id+='-copy';
    leads.push({...fields,id,revision:randomUUID(),created_at:row.date+'T00:00:00+07:00',updated_at:now,origin:'sheet',history:[],_crmEdited:[],_sheet:{key,row:row.sheetRow,status:row.status,fingerprint:fp}});seen.add(id);
   }
  }
 }
 // A removed Sheet row must never delete its CRM care history or archive state.
 for(const lead of leads)if(lead._sheet&&!seen.has(lead.id))lead.sourceMissing=true;
 return {...dashboard,leads,_saleSourceVersion:hash(snapshot.items),_saleSourceSyncedAt:snapshot.lastSyncedAt||dashboard._saleSourceSyncedAt};
}
export async function readSaleWorkspace(snapshotInput?:LeadSnapshot|null){
 const [dashboard,snapshot]=await Promise.all([readPrivate<SaleDashboard>(saleDashboardPath,emptySaleDashboard),snapshotInput===undefined?readPrivate<LeadSnapshot|null>('labcos/list-leads.json',null):Promise.resolve(snapshotInput)]);
 if(snapshot&&dashboard._saleSourceVersion!==hash(snapshot.items)){
  if(!dashboard._saleSourceVersion)await transactPrivate<SaleDashboard|null>('labcos/dashboard-before-sale-merge.json',null,saved=>saved??dashboard);
  const next=await transactPrivate<SaleDashboard>(saleDashboardPath,emptySaleDashboard,current=>current._saleSourceVersion===hash(snapshot.items)||current._saleSourceSyncedAt&&snapshot.lastSyncedAt&&Date.parse(current._saleSourceSyncedAt)>Date.parse(snapshot.lastSyncedAt)?current:reconcileSaleLeads(current,snapshot));
  return {dashboard:{...next,leads:next.leads.map(normalizeSaleLead)},snapshot};
 }
 return {dashboard:{...dashboard,leads:(dashboard.leads||[]).map(normalizeSaleLead)},snapshot};
}
export function saleListView(dashboard:SaleDashboard,snapshot:LeadSnapshot|null){
 const items=dashboard.leads.filter(l=>!l.archived_at).map(l=>({id:l.id,sheetRow:l._sheet?.row||0,date:l.date,number:'',name:l.name,phone:l.phone,status:l.status,sales:l.sales,need:l.need,note:l.note,channel:l.channel}));
 return {...snapshot,source:'Sale / Khách hàng & Lead',fromDate:items.reduce((d,l)=>l.date&&l.date<d?l.date:d,snapshot?.fromDate||saleToday()),throughDate:saleToday(),crmUnified:true,items};
}
const validDate=(v:string)=>!v||/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function validateSaleFields(input:Record<string,unknown>):SaleLeadFields{
 const value=emptySaleLead();const limits:Record<string,number>={name:180,company:180,phone:60,source:120,date:10,sales:120,need:4000,status:30,next_action:10,note:4000,record_kind:20,lead_group:5,customer_group:30,contact_date:10,received_date:10,conversion_date:10,customer_code:120,email:254,last_interaction:4000,action_plan:4000,preliminary_result:4000,fail_reason:4000,fit:30,unfit_reason:4000,sale_type:20,business_model:180,region:180,moq:180,decision_authority:180,products_selling:4000,order_status:180,order_plan:4000,order_action_date:10,order_result:4000,last_order_date:10,upsell_product:4000,upsell_note:4000};
 for(const [key,max] of Object.entries(limits)){if(input[key]===undefined)continue;if(typeof input[key]!=='string'||(input[key] as string).length>max)throw new Error('INPUT');Object.assign(value,{[key]:(input[key] as string).trim()});}
 if(!value.name||!value.date||!['date','next_action','contact_date','received_date','conversion_date','order_action_date','last_order_date'].every(k=>validDate(value[k as keyof SaleLeadFields] as string))||!saleStages.some(([s])=>s===value.status))throw new Error('INPUT');
 for(const [key,options] of Object.entries({record_kind:['lead','customer'],lead_group:['','A','B','C','D'],customer_group:['',...['CD3','CD4','CD5'].flatMap(c=>['A1','A2','A3','A4'].map(a=>`${c} - ${a}`))],fit:['','Fit Lead','Unfit lead'],sale_type:['','OEM','Xá']}))if(!options.includes(value[key as keyof SaleLeadFields] as string))throw new Error('INPUT');
 if(input.status_tags!==undefined){if(!Array.isArray(input.status_tags)||input.status_tags.length>saleStages.length||input.status_tags.some(s=>typeof s!=='string'||!saleStages.some(([key])=>key===s)))throw new Error('INPUT');value.status_tags=[...new Set(input.status_tags)] as SaleStage[];if(value.status_tags.length)value.status=salePrimaryStatus(value.status_tags);}
 if(input.quality_lead!==undefined&&typeof input.quality_lead!=='boolean')throw new Error('INPUT');value.quality_lead=input.quality_lead===true;
 for(const key of ['value','po_value'] as const){const amount=input[key]===undefined?0:input[key];if(typeof amount!=='number'||!Number.isFinite(amount)||amount<0||amount>1e12)throw new Error('INPUT');value[key]=amount;}
 if(value.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))throw new Error('INPUT');
 value.source=value.source||'Khác';value.channel=saleChannel(value.source);return value;
}
export function updateSaleLead(lead:SaleLead,fields:SaleLeadFields,actor:string,note?:string){
 const changes=fieldKeys.filter(k=>JSON.stringify(lead[k])!==JSON.stringify(fields[k])),before=lead.status,at=new Date().toISOString(),detail=Object.fromEntries(changes.map(k=>[k,{before:lead[k]??'',after:fields[k]}]));
 Object.assign(lead,fields,{revision:randomUUID(),updated_at:at,_crmEdited:[...new Set([...(lead._crmEdited||[]),...changes,...(changes.includes('status_tags')?['status','status_tags']:[]),...(note?['status','next_action']:[])])],history:[...(lead.history||[]),{id:randomUUID(),at,by:actor,action:note?'care':'updated',note,fields:changes,changes:detail,fromStatus:before,toStatus:fields.status}]});
 return lead;
}
