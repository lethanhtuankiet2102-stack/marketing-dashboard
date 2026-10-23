export type Level={id:string;label:string;points:number;description:string;signals:string;examples:string;short:string};
export type DesignTask={id:string;sheetRow:number;period:string;number:string;platform:string;name:string;briefUrl:string;taskType:string;taskTypeOverride?:string|null;statusOverride?:string|null;sourceTaskType?:string;sourceStatus?:string;briefBy:string;briefDate:string;deadline:string;status:string;sourceLevel:string|null;levelOverride:string|null;note:string;finalUrl:string;updatedAt:string|null};
export type DesignData={lastSyncedAt?:string;live?:boolean;warning?:string|null;schemaVersion:number;sourceName:string;importedAt:string;levels:Level[];taskDefaults:Record<string,string>;items:DesignTask[]};
export function effectiveLevel(task:DesignTask,data:Pick<DesignData,'levels'|'taskDefaults'>):string|null {
  const id=task.levelOverride||task.sourceLevel||data.taskDefaults[(task.taskTypeOverride??task.taskType).trim()]||null;
  return data.levels.some(level=>level.id===id)?id:null;
}
export function workloadPoints(task:DesignTask,data:Pick<DesignData,'levels'|'taskDefaults'>):number|null {
  const id=effectiveLevel(task,data);
  return data.levels.find(level=>level.id===id)?.points??null;
}

export function designTaskSource(task:Pick<DesignTask,'platform'>):'planned'|'emergent'|'unknown'{
 const platform=task.platform.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toUpperCase();
 return !platform?'unknown':/\bPHAT SINH\b/.test(platform)?'emergent':'planned';
}
export const isDesignCanceled=(task:DesignTask)=>['CANCELED','CANCELLED'].includes((task.statusOverride??task.status).trim().toUpperCase());
export const isDesignDone=(task:DesignTask)=>(task.statusOverride??task.status).trim().toUpperCase()==='DONE';
export function designSummary(items:DesignTask[],data:DesignData){
 items=items.filter(task=>!isDesignCanceled(task));
 const done=items.filter(isDesignDone),emergent=items.filter(x=>designTaskSource(x)==='emergent');
 const points=(rows:DesignTask[])=>rows.reduce((sum,x)=>sum+(workloadPoints(x,data)??0),0);
 const totalPoints=points(items);
 return {total:items.length,done:done.length,totalPoints,donePoints:points(done),emergent:emergent.length,emergentPoints:points(emergent),progress:items.length?done.length/items.length*100:0,advancedShare:totalPoints?points(items.filter(x=>['L3','L4','L5'].includes(effectiveLevel(x,data)||'')))/totalPoints*100:0,average:items.length?totalPoints/items.length:0,unscored:items.filter(x=>workloadPoints(x,data)===null).length};
}

function briefDateValue(value:string):number {
 const text=value.trim();
 const iso=/^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/.exec(text);
 const local=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
 if(!iso&&!local)return -Infinity;
 const year=Number(iso?iso[1]:local![3]),month=Number(iso?iso[2]:local![2]),day=Number(iso?iso[3]:local![1]);
 const date=new Date(Date.UTC(year,month-1,day));
 return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?date.getTime():-Infinity;
}
export function sortDesignerTasks(items:DesignTask[]):DesignTask[]{
 return [...items].sort((a,b)=>{
  const orderA=a.id.startsWith('order:'),orderB=b.id.startsWith('order:');
  if(orderA!==orderB)return orderA?-1:1;
  const dateA=briefDateValue(a.briefDate),dateB=briefDateValue(b.briefDate);
  if(dateA!==dateB)return dateA>dateB?-1:1;
  return b.sheetRow-a.sheetRow;
 });
}
