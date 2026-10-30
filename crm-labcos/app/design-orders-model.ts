import type {DesignData,DesignTask} from './designer-model';
import {effectiveLevel,workloadPoints} from './designer-model';
export const orderStatuses=['NEW','URGENT','IN_PROGRESS','REVIEW','REVISION','DONE','CANCELED'] as const;
export const orderStatusLabels:Record<string,string>={NEW:'Mới',URGENT:'Gấp',IN_PROGRESS:'Đang làm',REVIEW:'Chờ duyệt',REVISION:'Cần chỉnh sửa',DONE:'Hoàn thành',CANCELED:'Đã hủy'};
export type OrderFields={name:string;platform:string;taskType:string;brief:string;briefUrl:string;briefDate:string;deadline:string;status:string;level:string;note:string;finalUrl:string};
export type DesignOrder=OrderFields&{id:string;number:number;revision:string;createdAt:string;updatedAt:string;briefBy:string;createdBy:string;history:{at:string;by:string;fields:string[]}[]};
export const blankOrder:OrderFields={name:'',platform:'',taskType:'',brief:'',briefUrl:'',briefDate:'',deadline:'',status:'NEW',level:'',note:'',finalUrl:''};
export function orderTask(order:DesignOrder):DesignTask{
 return {id:`order:${order.id}`,sheetRow:order.number,period:order.briefDate.slice(0,7),number:String(order.number),name:order.name,platform:order.platform,taskType:order.taskType,briefUrl:order.briefUrl,briefBy:order.briefBy,briefDate:order.briefDate,deadline:order.deadline,status:order.status,sourceLevel:order.level||null,levelOverride:null,note:order.note,finalUrl:order.finalUrl,updatedAt:order.updatedAt};
}
export function scoreOrder(order:DesignOrder,config:Pick<DesignData,'levels'|'taskDefaults'>){const task=orderTask(order);return {...order,effectiveLevel:effectiveLevel(task,config),workloadPoints:workloadPoints(task,config)};}
export function validateOrder(input:unknown):OrderFields{
 if(!input||typeof input!=='object')throw new Error('INPUT');
 const raw=input as Record<string,unknown>,value={...blankOrder};
 for(const key of Object.keys(value) as (keyof OrderFields)[]){if((key==='deadline'||key==='briefDate')&&raw[key]===undefined)continue;if(typeof raw[key]!=='string'||raw[key].length>(['brief','note'].includes(key)?4000:['briefUrl','finalUrl'].includes(key)?2048:240))throw new Error('INPUT');value[key]=raw[key].trim();}
 if(!value.name||!value.platform||!value.taskType||(!value.brief&&!value.briefUrl)||!orderStatuses.some(s=>s===value.status))throw new Error('INPUT');
 for(const date of [value.briefDate,value.deadline]){if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))throw new Error('INPUT');}
 if(value.level&&!/^L[1-5]$/.test(value.level))throw new Error('INPUT');
 for(const key of ['briefUrl','finalUrl'] as const){if(value[key]){let url:URL;try{url=new URL(value[key])}catch{throw new Error('INPUT')}if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('INPUT');}}
 return value;
}

