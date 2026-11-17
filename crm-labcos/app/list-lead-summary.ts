export type ListLeadItem = { date:string; note:string;channel?:'facebook'|'google'|'other' };
export type ListLeadData = { fromDate:string; throughDate:string; items:ListLeadItem[]; live?:boolean; warning?:string;lastSyncedAt?:string;mode?:'upload';crmUnified?:boolean };
export type LeadChannel = 'facebook'|'google'|'other';

const normalized = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();

export function listLeadChannel(item:ListLeadItem):LeadChannel {
  if(item.channel)return item.channel;
  return /\bzalo\s*oa\b/.test(normalized(item.note)) ? 'google' : 'facebook';
}

export function summarizeListLeads(data:ListLeadData,since:string,until:string,channel:LeadChannel) {
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const synced=!data.crmUnified&&data.mode!=='upload'&&data.lastSyncedAt?new Date(data.lastSyncedAt):null;
  const through=synced&&!Number.isNaN(synced.getTime())?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(synced):data.throughDate;
  const covered=since>=data.fromDate&&until<=(data.live?today:through);
  return {covered,leads:covered?data.items.filter(item=>item.date>=since&&item.date<=until&&listLeadChannel(item)===channel).length:0};
}

