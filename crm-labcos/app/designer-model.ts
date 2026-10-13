export type Level={id:string;label:string;points:number;description:string;signals:string;examples:string;short:string};
export type DesignTask={id:string;sheetRow:number;period:string;number:string;platform:string;name:string;briefUrl:string;taskType:string;briefBy:string;briefDate:string;deadline:string;status:string;sourceLevel:string|null;levelOverride:string|null;note:string;finalUrl:string;designer?:string;taskSource?:'planned'|'ad-hoc'|null;updatedAt:string|null};
export type DesignData={schemaVersion:number;sourceName:string;importedAt:string;levels:Level[];taskDefaults:Record<string,string>;items:DesignTask[]};
export function effectiveLevel(task:DesignTask,data:Pick<DesignData,'levels'|'taskDefaults'>):string|null {
  const id=task.levelOverride||task.sourceLevel||data.taskDefaults[task.taskType.trim()]||null;
  return data.levels.some(level=>level.id===id)?id:null;
}
export function workloadPoints(task:DesignTask,data:Pick<DesignData,'levels'|'taskDefaults'>):number|null {
  const id=effectiveLevel(task,data);
  return data.levels.find(level=>level.id===id)?.points??null;
}

export const isDesignDone=(task:DesignTask)=>task.status.trim().toUpperCase()==='DONE';
export function designSummary(items:DesignTask[],data:DesignData){
 const done=items.filter(isDesignDone),adHoc=items.filter(x=>x.taskSource==='ad-hoc');
 const points=(rows:DesignTask[])=>rows.reduce((sum,x)=>sum+(workloadPoints(x,data)??0),0);
 const totalPoints=points(items);
 return {total:items.length,done:done.length,totalPoints,donePoints:points(done),adHoc:adHoc.length,adHocPoints:points(adHoc),progress:items.length?done.length/items.length*100:0,advancedShare:totalPoints?points(items.filter(x=>['L3','L4','L5'].includes(effectiveLevel(x,data)||'')))/totalPoints*100:0,average:items.length?totalPoints/items.length:0,unscored:items.filter(x=>workloadPoints(x,data)===null).length};
}
