export type Level={id:string;label:string;points:number;description:string;signals:string;examples:string;short:string};
export type DesignTask={id:string;sheetRow:number;period:string;number:string;platform:string;name:string;briefUrl:string;taskType:string;briefBy:string;briefDate:string;deadline:string;status:string;sourceLevel:string|null;levelOverride:string|null;note:string;finalUrl:string;updatedAt:string|null};
export type DesignData={schemaVersion:number;sourceName:string;importedAt:string;levels:Level[];taskDefaults:Record<string,string>;items:DesignTask[]};
export function effectiveLevel(task:DesignTask,data:Pick<DesignData,'levels'|'taskDefaults'>):string|null {
  const id=task.levelOverride||task.sourceLevel||data.taskDefaults[task.taskType.trim()]||null;
  return data.levels.some(level=>level.id===id)?id:null;
}
export function workloadPoints(task:DesignTask,data:Pick<DesignData,'levels'|'taskDefaults'>):number|null {
  const id=effectiveLevel(task,data);
  return data.levels.find(level=>level.id===id)?.points??null;
}
