import type {DesignData} from '../app/designer-model';
import {effectiveLevel,workloadPoints} from '../app/designer-model';
import {orderTask,type DesignOrder} from '../app/design-orders-model';

export function composeDesignerWorkspace(data:DesignData,orders:DesignOrder[],role:string){
 const items=[...data.items,...orders.map(orderTask)];
 return {...data,canEdit:['owner','manager','designer'].includes(role),canOrder:['owner','manager','designer','order'].includes(role),orders,items:items.map(item=>({...item,effectiveLevel:effectiveLevel(item,data),workloadPoints:workloadPoints(item,data)}))};
}
