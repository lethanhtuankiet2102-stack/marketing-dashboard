import {createHash} from 'node:crypto';
import {googleGet,sourceIds} from './google-source';
import {readPrivate,updatePrivate} from './private-store';
import type {DesignData,DesignTask,Level} from '../app/designer-model';
type Cell={formattedValue?:string;hyperlink?:string};
type Sheet={properties:{title:string};data?:{startRow?:number;rowData?:{values?:Cell[]}[]}[]};
const text=(cells:Cell[],index:number)=>cells[index]?.formattedValue?.trim()||'';
const url=(cells:Cell[],index:number)=>cells[index]?.hyperlink||(/^https?:\/\//i.test(text(cells,index))?text(cells,index):'');
const levelId=(value:string)=>value.match(/^L[1-5]\b/i)?.[0].toUpperCase()||null;
const norm=(value:string)=>value.trim().replace(/\s+/g,' ').toLocaleLowerCase('vi');
const identity=(task:Pick<DesignTask,'name'|'platform'|'period'>)=>JSON.stringify([task.period,norm(task.platform),norm(task.name)]);
function sheetRows(sheet:Sheet){const rows:Cell[][]=[];for(const block of sheet.data||[])for(let i=0;i<(block.rowData||[]).length;i++)rows[(block.startRow||0)+i]=block.rowData![i].values||[];return rows;}
export function parseDesignerSheets(sheets:Sheet[],previous:DesignData,now=new Date()):DesignData{
 const brief=sheets.find(x=>x.properties.title.trim()==='BRIEF DESIGN'),config=sheets.find(x=>x.properties.title.trim()==='KPI CONFIG 2026');
 if(!brief||!config)throw new Error('SOURCE_TABS_MISSING');
 const configs=sheetRows(config),levels:Level[]=[],taskDefaults:Record<string,string>={};
 for(const row of configs){if(!row)continue;const id=levelId(text(row,6)),points=Number(text(row,10));if(id&&Number.isFinite(points)&&points>0)levels.push({id,label:text(row,6),points,description:text(row,7),signals:text(row,8),examples:text(row,9),short:text(row,11)});const type=text(row,0),defaultId=levelId(text(row,1));if(type&&defaultId)taskDefaults[type]=defaultId;}
 if(levels.length!==5||new Set(levels.map(l=>l.id)).size!==5||!Object.keys(taskDefaults).length)throw new Error('SOURCE_CONFIG_INVALID');
 const rows=sheetRows(brief),items:DesignTask[]=[];
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit'}).format(now);
 let year=Number(today.slice(0,4)),lastMonth=0,period='unknown',previousNumber:number|null=null,gap=false,newHeading=false;
 for(let index=7;index<rows.length;index++){
  const row=rows[index]||[],number=text(row,0),heading=number.match(/^THÁNG\s+(\d{1,2})(?:\s*[\/.-]\s*(\d{4}))?/i);
  if(heading){const month=Number(heading[1]);if(month<1||month>12)throw new Error('SOURCE_MONTH_INVALID');if(heading[2])year=Number(heading[2]);else if(lastMonth&&month>lastMonth||!lastMonth&&month>Number(today.slice(5)))year--;lastMonth=month;period=`${year}-${String(month).padStart(2,'0')}`;newHeading=true;previousNumber=null;continue;}
  const name=text(row,2);if(!name){gap=true;continue;}
  const numeric=/^\d+$/.test(number)?Number(number):null;
  // An unlabelled section after a gap stays unknown, rather than inventing a month.
  if(!newHeading&&gap&&numeric!==null&&previousNumber!==null&&numeric>previousNumber)period='unknown';
  newHeading=false;gap=false;previousNumber=numeric;
  items.push({id:'',sheetRow:index+1,period,number,platform:text(row,1),name,briefUrl:url(row,3),taskType:text(row,4),briefBy:text(row,5),briefDate:text(row,6),deadline:text(row,7),status:text(row,8),sourceLevel:levelId(text(row,9)),levelOverride:null,note:text(row,10),finalUrl:url(row,11),updatedAt:null});
 }
 if(!items.length)throw new Error('SOURCE_EMPTY');
 const oldGroups=new Map<string,DesignTask[]>(),counts=new Map<string,number>();
 for(const item of previous.items){const key=identity(item);oldGroups.set(key,[...(oldGroups.get(key)||[]),item]);}
 for(const item of items){const key=identity(item);counts.set(key,(counts.get(key)||0)+1);}
 const occurrences=new Map<string,number>();
 for(const item of items){const key=identity(item),old=oldGroups.get(key);const index=(occurrences.get(key)||0)+1;occurrences.set(key,index);
  // Never carry an override by row number: inserting rows can move a different task there.
  const match=counts.get(key)===1&&old?.length===1?old[0]:undefined;
  item.id=match?.id||`design-${createHash('sha256').update(key).digest('hex').slice(0,24)}-${index}`;
  if(match){item.levelOverride=match.levelOverride;const comparable=(x:DesignTask)=>JSON.stringify([x.period,x.number,x.platform,x.name,x.briefUrl,x.taskType,x.briefBy,x.briefDate,x.deadline,x.status,x.sourceLevel,x.note,x.finalUrl]);item.updatedAt=comparable(match)===comparable(item)?match.updatedAt:now.toISOString();}
 }
 return {...previous,levels,taskDefaults,items,importedAt:now.toISOString(),sourceName:'[LABCOS] _ ORDER DESIGN (Google Sheets)',lastSyncedAt:now.toISOString(),live:true} as DesignData;
}
export async function refreshDesigner(force=false){
 const current=await readPrivate<DesignData|null>('labcos/designer.json',null);
 if(!current)throw new Error('SOURCE_CACHE_MISSING');
 const synced=(current as DesignData&{lastSyncedAt?:string}).lastSyncedAt;
 if(!force&&synced&&Date.now()-Date.parse(synced)<60000)return current;
 const target=new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sourceIds.designer)}`);
 target.searchParams.append('ranges',"'BRIEF DESIGN'!A1:M10000");target.searchParams.append('ranges',"'KPI CONFIG 2026'!A1:L2000");target.searchParams.set('includeGridData','true');target.searchParams.set('fields','sheets(properties(title),data(startRow,rowData(values(formattedValue,hyperlink))))');
 const {sheets}=await (await googleGet(target.toString())).json() as {sheets:Sheet[]};
 for(let attempt=0;attempt<3;attempt++){try{return await updatePrivate<DesignData>('labcos/designer.json',previous=>parseDesignerSheets(sheets,previous));}catch(e){if(!(e instanceof Error&&e.name==='BlobPreconditionFailedError')||attempt===2)throw e;}}
 throw new Error('SYNC_CONFLICT');
}
