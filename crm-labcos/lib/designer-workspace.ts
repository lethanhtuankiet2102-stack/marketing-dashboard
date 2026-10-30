import type {DesignData} from '../app/designer-model';
import {effectiveLevel,workloadPoints,sortDesignerTasks} from '../app/designer-model';
import {orderTask,type DesignOrder} from '../app/design-orders-model';

export function composeDesignerWorkspace(data:DesignData,orders:DesignOrder[],role:string){
 const items=sortDesignerTasks([...data.items,...orders.map(orderTask)]);
 return {...data,canEdit:['owner','manager','sale_admin','designer'].includes(role),canOrder:['owner','manager','sale_admin','designer','order','sale_oem'].includes(role),orders,items:items.map(item=>({...item,sourceTaskType:item.taskType,sourceStatus:item.status,taskType:item.taskTypeOverride??item.taskType,status:item.statusOverride??item.status,effectiveLevel:effectiveLevel(item,data),workloadPoints:workloadPoints(item,data)}))};
}

