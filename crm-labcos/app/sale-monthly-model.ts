import {saleNormalize,saleToday,type SaleLead} from './sale-leads-model';
export const monthlyRows=[['contacted','Tổng lead liên hệ trong tháng'],['quality','Quality lead trong tháng'],['meetings','Số lượng lead chuyển đổi gặp mặt'],['sent','Số lượng lead đã gửi mẫu'],['sample_rate','Tỷ lệ gửi mẫu'],['feedback','Số lead phản hồi mẫu'],['feedback_rate','Tỷ lệ mẫu phản hồi'],['outlook','Lead có tỷ lệ chuyển đổi cao trong 1 tháng tiếp theo']] as const;
export type MonthlyRow=typeof monthlyRows[number][0];
export type CountRow='contacted'|'quality'|'meetings'|'sent'|'feedback';
export type Cohort='old'|'fresh';
export type MonthlyAnnotation={potential:string;available:string;unavailable:string;note:string};
export type MonthlyManual={counts:Record<CountRow,Record<Cohort,number|null>>;outlook:Record<Cohort,string>;annotations:Record<MonthlyRow,MonthlyAnnotation>};
export type MonthlyAutomatic={version:1;contacted:Record<Cohort,number>;quality:Record<Cohort,number>;newLeads:number;undatedContacts:number;groupB:{id:string;name:string;need:string}[]};
export type MonthlyReport={month:string;person:string;revision:string;manual:MonthlyManual;automatic:MonthlyAutomatic;updated_at:string;updated_by:string;history:{at:string;by:string;manual:MonthlyManual;automatic:MonthlyAutomatic}[]};
export const monthlyToday=()=>saleToday().slice(0,7);
export function emptyMonthlyManual():MonthlyManual{return {counts:Object.fromEntries(['contacted','quality','meetings','sent','feedback'].map(key=>[key,{old:null,fresh:null}])) as MonthlyManual['counts'],outlook:{old:'',fresh:''},annotations:Object.fromEntries(monthlyRows.map(([key])=>[key,{potential:'',available:'',unavailable:'',note:''}])) as MonthlyManual['annotations']};}
export const monthlyPerson=(s:string)=>saleNormalize(s);
export function validMonthlyPeriod(month:unknown):month is string{return typeof month==='string'&&/^(20\d{2})-(0[1-9]|1[0-2])$/.test(month);}
export function monthlyDay(at:string){const d=new Date(at);return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
// Undo dated field edits after the reporting month. Keep legacy history usable.
function atMonthEnd(lead:SaleLead,end:string){const fields={...lead};if(fields.archived_at&&monthlyDay(fields.archived_at)>end)fields.archived_at=null;const later=(lead.history||[]).map((entry,i)=>({entry,i})).filter(({entry})=>monthlyDay(entry.at)>end).sort((a,b)=>Date.parse(b.entry.at)-Date.parse(a.entry.at)||b.i-a.i);for(const {entry} of later){if(entry.changes)for(const [key,value] of Object.entries(entry.changes))if(Object.prototype.hasOwnProperty.call(fields,key))Object.assign(fields,{[key]:value.before});if(entry.fromStatus)fields.status=entry.fromStatus;if(entry.action==='archived')fields.archived_at=null;if(entry.action==='restored')fields.archived_at=entry.at;}return fields;}
export function aggregateMonthly(items:SaleLead[],month:string,person:string):MonthlyAutomatic{
 const start=month+'-01',end=month+'-31',inMonth=(day:string)=>!!day&&day>=start&&day<=end;
 const result:MonthlyAutomatic={version:1,contacted:{old:0,fresh:0},quality:{old:0,fresh:0},newLeads:0,undatedContacts:0,groupB:[]};
 for(const raw of items){if(raw.deleted_at)continue;const lead={...atMonthEnd(raw,end),date:raw.date,contact_date:raw.contact_date};if(monthlyPerson(lead.sales||'Chưa phân công')!==monthlyPerson(person)||!lead.date||lead.date>end)continue;const cohort:Cohort=lead.date<start?'old':'fresh';const events=(raw.history||[]).filter(h=>h.action==='care'&&inMonth(monthlyDay(h.at)));const contacted=inMonth(lead.contact_date)||events.length>0;
  if(cohort==='fresh')result.newLeads++;
  if(contacted)result.contacted[cohort]++;
  if(lead.quality_lead&&(cohort==='fresh'||contacted))result.quality[cohort]++;
  if(!lead.contact_date&&!(raw.history||[]).some(h=>h.action==='care'&&monthlyDay(h.at))&&lead.status!=='new')result.undatedContacts++;
  if(lead.lead_group==='B'&&!lead.archived_at&&!['lost','closed','won'].includes(lead.status))result.groupB.push({id:lead.id,name:lead.name,need:lead.need});
 }
 result.groupB.sort((a,b)=>a.id.localeCompare(b.id));return result;
}
export function monthlyValue(manual:MonthlyManual,auto:MonthlyAutomatic,row:CountRow,cohort:Cohort):number|null{return manual.counts[row][cohort]??(row==='contacted'||row==='quality'?auto[row][cohort]:null);}
export function monthlyRate(manual:MonthlyManual,auto:MonthlyAutomatic,row:'sample_rate'|'feedback_rate',cohort:Cohort):number|null{const n=monthlyValue(manual,auto,row==='sample_rate'?'sent':'feedback',cohort),d=monthlyValue(manual,auto,row==='sample_rate'?'contacted':'sent',cohort);return n===null||d===null||d===0?null:n/d;}
export function validateMonthlyManual(input:unknown):MonthlyManual{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('INPUT');const raw=input as MonthlyManual,output=emptyMonthlyManual();
 for(const row of Object.keys(output.counts) as CountRow[])for(const cohort of ['old','fresh'] as const){const n=raw.counts?.[row]?.[cohort];if(n!==null&&(!Number.isInteger(n)||n<0||n>1000000))throw new Error('INPUT');output.counts[row][cohort]=n;}
 const string=(v:unknown)=>{if(typeof v!=='string'||v.length>2000)throw new Error('INPUT');return v.trim()};
 for(const cohort of ['old','fresh'] as const)output.outlook[cohort]=string(raw.outlook?.[cohort]);
 for(const [row] of monthlyRows)for(const key of ['potential','available','unavailable','note'] as const)output.annotations[row][key]=string(raw.annotations?.[row]?.[key]);
 return output;
}
