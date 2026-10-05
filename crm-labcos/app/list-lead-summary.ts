export type ListLeadItem = { date:string; note:string };
export type ListLeadData = { fromDate:string; throughDate:string; items:ListLeadItem[]; live?:boolean; warning?:string };
export type LeadChannel = 'facebook'|'google';

const normalized = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();

export function listLeadChannel(item:ListLeadItem):LeadChannel {
  return /\bzalo\s*oa\b/.test(normalized(item.note)) ? 'google' : 'facebook';
}

export function summarizeListLeads(data:ListLeadData,since:string,until:string,channel:LeadChannel) {
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const covered=since>=data.fromDate&&until<=(data.live?today:data.throughDate);
  return {covered,leads:covered?data.items.filter(item=>item.date>=since&&item.date<=until&&listLeadChannel(item)===channel).length:0};
}
