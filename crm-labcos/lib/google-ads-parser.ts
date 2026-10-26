export type CampaignTotal={name:string;funnel:string;spend:number;impressions:number;clicks:number;conversions:number};
export type GoogleReport={month:string;sourceUrl:string;summary:Omit<CampaignTotal,'name'|'funnel'>;campaigns:CampaignTotal[];stale:boolean};
const clean=(s:string)=>s.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
const key=(s:string)=>clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d');
function number(s:string){const v=clean(s).replace(/[₫đ\s]/g,'');if(!/^\d+(?:\.\d{3})*(?:,\d+)?$/.test(v))throw new Error('REPORT_NUMBER_INVALID');return Number(v.replace(/\./g,'').replace(',','.'));}
export function parseGoogleAdsReport(html:string,month:string,sourceUrl:string,stale=false):GoogleReport{
 const safe=html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
 for(const table of safe.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)){
  const rows=[...table[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(row=>[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell=>clean(cell[1])));
  const header=rows.findIndex(row=>row.some(s=>key(s)==='chien dich')&&row.some(s=>key(s)==='tang pheu'));
  if(header<0)continue;
  const h=rows[header].map(key),idx={name:h.indexOf('chien dich'),funnel:h.indexOf('tang pheu'),impressions:h.indexOf('hien thi'),clicks:h.findIndex(s=>s==='nhap'||s==='luot nhap'),spend:h.indexOf('chi phi'),conversions:h.indexOf('cd')};
  if(Object.values(idx).some(i=>i<0))throw new Error('REPORT_COLUMNS_CHANGED');
  const campaigns:CampaignTotal[]=[];let summary:GoogleReport['summary']|undefined;
  for(const row of rows.slice(header+1)){
   if(row.length<Math.max(...Object.values(idx))+1){if(row.some(s=>key(s).includes('khong co so lieu')))continue;throw new Error('REPORT_ROW_INVALID');}
   const metrics={spend:number(row[idx.spend]),impressions:number(row[idx.impressions]),clicks:number(row[idx.clicks]),conversions:number(row[idx.conversions])};
   if(key(row[idx.name]).startsWith('tong')){if(summary)throw new Error('REPORT_DUPLICATE_TOTAL');summary=metrics;}
   else campaigns.push({name:row[idx.name],funnel:row[idx.funnel],...metrics});
  }
  if(!summary||!campaigns.length)throw new Error('REPORT_TOTAL_MISSING');
  for(const field of ['spend','impressions','clicks','conversions'] as const){const sum=campaigns.reduce((n,c)=>n+c[field],0);if(Math.abs(sum-summary[field])>(field==='conversions'?0.02:1))throw new Error('REPORT_TOTAL_MISMATCH');}
  return {month,sourceUrl,summary,campaigns,stale};
 }
 throw new Error('REPORT_TABLE_MISSING');
}
