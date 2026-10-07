import { unzipSync, strFromU8 } from 'fflate';

const SOURCE = 'LEAD LIST ';
const START = '2026-07-01';
type Lead = { id:string; sheetRow:number; date:string; number:string; name:string; phone:string; status:string; sales:string; need:string; note:string };

function decodeXml(value:string) {
  return value.replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi, (_, numeric:string, named:string) =>
    numeric ? String.fromCodePoint(numeric[0].toLowerCase()==='x' ? parseInt(numeric.slice(1),16) : Number(numeric)) :
    ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[named]);
}
function tagText(xml:string) {
  return decodeXml([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>m[1]).join(''));
}
function cellValue(xml:string, shared:string[]) {
  const raw=xml.match(/<v>([\s\S]*?)<\/v>/)?.[1];
  if (/\bt="s"/.test(xml)) return shared[Number(raw)] || '';
  if (/\bt="inlineStr"/.test(xml)) return tagText(xml);
  return raw ? decodeXml(raw) : '';
}
function dateValue(value:string) {
  if (!value) return '';
  const numeric=Number(value);
  if (Number.isFinite(numeric) && numeric>40000 && numeric<100000) {
    return new Date(Date.UTC(1899,11,30)+Math.floor(numeric)*86400000).toISOString().slice(0,10);
  }
  const match=value.trim().match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (match) return `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0,10) : '';
}
function clean(value:string) {
  const trimmed=value.trim();
  return /^\d+(?:\.\d+)?[eE][+-]?\d+$/.test(trimmed) ? String(Math.round(Number(trimmed))) : trimmed.replace(/\.0$/,'');
}

export function parseLeadWorkbook(buffer:ArrayBuffer) {
  const zip=unzipSync(new Uint8Array(buffer),{filter:file=>file.name==='xl/workbook.xml'||file.name==='xl/_rels/workbook.xml.rels'||file.name==='xl/sharedStrings.xml'||/^xl\/worksheets\/sheet\d+\.xml$/.test(file.name)});
  const read=(path:string)=>zip[path] ? strFromU8(zip[path]) : '';
  const workbook=read('xl/workbook.xml');
  const sheet=[...workbook.matchAll(/<sheet\s+([^>]*?)\/?\s*>/g)].find(m=>{
    const name=decodeXml(m[1].match(/\bname="([^"]+)"/)?.[1]||'').trim().replace(/\s+/g,' ').toUpperCase();
    return name==='LEAD LIST'||name==='LIST LEAD';
  });
  const relationship=sheet?.[1].match(/\br:id="([^"]+)"/)?.[1];
  const rels=read('xl/_rels/workbook.xml.rels');
  const target=[...rels.matchAll(/<Relationship\s+([^>]*?)\/?\s*>/g)].find(m=>m[1].includes(`Id="${relationship}"`))?.[1].match(/\bTarget="([^"]+)"/)?.[1];
  const path=target?.startsWith('/') ? target.slice(1) : `xl/${target}`;
  const xml=path ? read(path) : '';
  if (!xml) throw new Error(`Không tìm thấy sheet ${SOURCE} trong file nguồn.`);
  const shared=[...read('xl/sharedStrings.xml').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(m=>tagText(m[1]));
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const items:Lead[]=[];
  const seen=new Set<string>();
  let previous=today;
  for (const row of xml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const sheetRow=Number(row[1]);
    if (sheetRow<3) continue;
    const cells:Record<string,string>={};
    for (const cell of row[2].matchAll(/<c\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/c>)/g)) {
      const column=cell[1].match(/\br="([A-Z]+)\d+"/)?.[1];
      if (column && /^[A-H]$/.test(column)) cells[column]=cellValue(cell[1]+(cell[2]||''),shared);
    }
    let date=dateValue(cells.B||'');
    // Google Sheets sometimes stores dd/mm dates as mm/dd Excel dates. The lead
    // list is newest first, so use the day/month reading when it restores order.
    if (/^\d{5}(?:\.0)?$/.test(cells.B||'') && date) {
      const [,year,month,day]=date.match(/^(\d{4})-(\d{2})-(\d{2})$/)||[];
      if (Number(month)<=12 && Number(day)<=12) {
        const swapped=`${year}-${day}-${month}`;
        if (swapped<=previous && (date>previous || swapped>date)) date=swapped;
      }
    }
    if (!date || date<START || date>today || !(cells.C||cells.D)) continue;
    previous=date;
    const values=[date,...'ACDEFGH'.split('').map(column=>clean(cells[column]||''))];
    const fingerprint=JSON.stringify(values);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    items.push({id:`sheet-row-${sheetRow}`,sheetRow,date,number:clean(cells.A||''),name:clean(cells.C||''),phone:clean(cells.D||''),status:clean(cells.E||''),sales:clean(cells.F||''),need:clean(cells.G||''),note:clean(cells.H||'')});
  }
  return {source:SOURCE,fromDate:START,throughDate:items.reduce((max,item)=>item.date>max?item.date:max,START),items};
}
