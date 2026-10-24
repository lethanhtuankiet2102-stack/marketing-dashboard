import {effectiveLevel,workloadPoints,type DesignData,type DesignTask} from './designer-model';
import {designerStatusKey} from './designer-options';
export type DesignerColumnKey='task'|'taskType'|'briefBy'|'briefDate'|'deadline'|'status'|'briefUrl'|'finalUrl'|'note'|'level'|'points';
export type DesignerColumnFilter={values?:string[];query?:string;origin?:string;from?:string;to?:string;missingOnly?:boolean;min?:string;max?:string};
export type DesignerColumnFilters=Partial<Record<DesignerColumnKey,DesignerColumnFilter>>;
export type DesignerFilterColumn={key:DesignerColumnKey;label:string;kind:'task'|'values'|'date'|'text'|'number';options?:{value:string;label:string}[]};
export const normalizeDesignerText=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLocaleLowerCase('vi').trim();
export function designerDateKey(value:string):string{
 const raw=value.trim(),iso=/^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/.exec(raw),local=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
 if(!iso&&!local)return '';
 const year=Number(iso?iso[1]:local![3]),month=Number(iso?iso[2]:local![2]),day=Number(iso?iso[3]:local![1]),date=new Date(Date.UTC(year,month-1,day));
 return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?date.toISOString().slice(0,10):'';
}
export function designerFilterActive(filter:DesignerColumnFilter|undefined):boolean{return !!filter&&!!(filter.values?.length||filter.query?.trim()||filter.origin||filter.from||filter.to||filter.missingOnly||filter.min?.trim()||filter.max?.trim());}
const selected=(filter:DesignerColumnFilter,value:string)=>!filter.values?.length||filter.values.includes(value);
const contains=(value:string,query?:string)=>!query?.trim()||normalizeDesignerText(value).includes(normalizeDesignerText(query));
export function filterDesignerColumns(items:DesignTask[],data:DesignData&{orders?:{id:string;brief:string}[]},filters:DesignerColumnFilters):DesignTask[]{
 const active=(Object.entries(filters) as [DesignerColumnKey,DesignerColumnFilter][]).filter(([,filter])=>designerFilterActive(filter));
 if(!active.length)return items;
 const briefs=new Map((data.orders||[]).map(order=>['order:'+order.id,order.brief]));
 return items.filter(item=>active.every(([key,filter])=>{
  if(key==='task')return contains(`${item.name} ${item.platform} ${item.number}`,filter.query)&&(!filter.origin||(item.id.startsWith('order:')?'crm':'sheet')===filter.origin)&&selected(filter,item.platform||'__empty__');
  if(key==='briefDate'||key==='deadline'){
   const date=designerDateKey(item[key]);if(filter.missingOnly)return !date;
   return !!date&&(!filter.from||date>=filter.from)&&(!filter.to||date<=filter.to);
  }
  if(key==='points'){
   const points=workloadPoints(item,data);if(filter.missingOnly)return points===null;
   return points!==null&&(!filter.min?.trim()||points>=Number(filter.min))&&(!filter.max?.trim()||points<=Number(filter.max));
  }
  if(key==='taskType')return selected(filter,item.taskType||'__empty__');
  if(key==='briefBy')return selected(filter,item.briefBy||'__empty__');
  if(key==='status')return selected(filter,designerStatusKey(item.status)||'__empty__');
  if(key==='level')return selected(filter,effectiveLevel(item,data)||'__empty__');
  if(key==='briefUrl'||key==='finalUrl')return selected(filter,/^https?:\/\//i.test(item[key])?'yes':'no');
  const note=`${item.note} ${briefs.get(item.id)||''}`.trim();return selected(filter,note?'yes':'no')&&contains(note,filter.query);
 }));
}
