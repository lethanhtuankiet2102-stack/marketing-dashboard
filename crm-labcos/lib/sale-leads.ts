import {createHash,randomUUID} from 'node:crypto';
import {readPrivate,transactPrivate} from './private-store';
import {emptySaleLead,saleChannel,saleNormalize,saleStages,saleToday,type SaleLead,type SaleLeadFields,type SaleStage} from '../app/sale-leads-model';
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
 const mapped:Record<string,SaleStage>={'moi':'new','chua lien he':'new','chua cham soc':'new','khach moi':'new','da lien he':'contacted','quan tam':'interested','dang tu van':'interested','da hen':'booked','hen gap':'booked','chot don':'won','da chot':'won','thanh cong':'won','khong phu hop':'lost','that bai':'lost','mat lead':'lost'};
 return mapped[s]||'contacted';
}
function phoneKey(value:string){let s=value.replace(/\D/g,'');if(s.startsWith('84'))s='0'+s.slice(2);if(s.length===9)s='0'+s;return s;}
function sourceKey(row:SheetLead){return hash([row.date,saleNormalize(row.name),phoneKey(row.phone)]);}
function sourceFields(row:SheetLead):SaleLeadFields{return {name:row.name||'Chưa ghi tên',phone:row.phone,company:'',date:row.date,sales:row.sales,need:row.need,note:row.note,status:sheetStage(row.status),value:0,next_action:'',source:/\bzalo\s*oa\b/.test(saleNormalize(row.note))?'Zalo OA/Google':'Messenger/Facebook Ads',channel:/\bzalo\s*oa\b/.test(saleNormalize(row.note))?'google':'facebook'};}
function fingerprint(row:SheetLead){return hash([sourceFields(row),row.status]);}
export function normalizeSaleLead(raw:SaleLead):SaleLead{
 const fields={...emptySaleLead(),...raw};
 const status=saleStages.some(([s])=>s===fields.status)?fields.status:'new';
 return {...fields,channel:raw.channel||saleChannel(fields.source),date:raw.date||raw.created_at?.slice(0,10)||'',status,origin:raw.origin||'crm',history:Array.isArray(raw.history)?raw.history:[],revision:raw.revision||'legacy-'+hash(raw)};
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
 const value=emptySaleLead();const limits:Record<string,number>={name:180,company:180,phone:60,source:120,date:10,sales:120,need:4000,status:30,next_action:10,note:4000};
 for(const [key,max] of Object.entries(limits)){if(input[key]===undefined)continue;if(typeof input[key]!=='string'||(input[key] as string).length>max)throw new Error('INPUT');Object.assign(value,{[key]:(input[key] as string).trim()});}
 if(!value.name||!value.date||!validDate(value.date)||!validDate(value.next_action)||!saleStages.some(([s])=>s===value.status))throw new Error('INPUT');
 const amount=input.value===undefined?0:input.value;if(typeof amount!=='number'||!Number.isFinite(amount)||amount<0||amount>1e12)throw new Error('INPUT');value.value=amount;
 value.source=value.source||'Khác';value.channel=saleChannel(value.source);return value;
}
export function updateSaleLead(lead:SaleLead,fields:SaleLeadFields,actor:string,note?:string){
 const changes=fieldKeys.filter(k=>lead[k]!==fields[k]),before=lead.status,at=new Date().toISOString();
 Object.assign(lead,fields,{revision:randomUUID(),updated_at:at,_crmEdited:[...new Set([...(lead._crmEdited||[]),...changes,...(note?['status','next_action']:[])])],history:[...(lead.history||[]),{id:randomUUID(),at,by:actor,action:note?'care':'updated',note,fields:changes,fromStatus:before,toStatus:fields.status}]});
 return lead;
}
