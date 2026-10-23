import {composeDesignerWorkspace} from '../../../lib/designer-workspace';
import {orderStatuses,type DesignOrder} from '../../design-orders-model';
import {refreshDesigner} from '../../../lib/designer-sync';
import {syncWarning} from '../../../lib/google-source';
import { getChatGPTUser } from '../../chatgpt-auth';
import { readPrivate, updatePrivate } from '../../../lib/private-store';
import { type DesignData } from '../../designer-model';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const path='labcos/designer.json';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){
  const user=await getChatGPTUser(true);
  if(!user)return Response.json({error:'Cần đăng nhập.'},{status:401,headers});
  try{
    let data:DesignData|null=null,warning:string|null=null,live=false;
    try{data=await refreshDesigner();live=true}catch(error){warning=syncWarning(error);data=await readPrivate<DesignData|null>(path,null);}

    if(!data)return Response.json({error:'Chưa có dữ liệu ORDER DESIGN.'},{status:503,headers});
    const orders=await readPrivate<DesignOrder[]>('labcos/design-orders.json',[]);
    return Response.json({...composeDesignerWorkspace(data,orders,user.role),live,warning},{headers});
  }catch{return Response.json({error:'Không tải được dữ liệu Designer. Hãy thử lại.'},{status:503,headers});}
}
export async function PATCH(request:Request){
  const user=await getChatGPTUser(true);
  if(!user)return Response.json({error:'Cần đăng nhập.'},{status:401,headers});
  if(!['owner','manager','designer'].includes(user.role))return Response.json({error:'Tài khoản chỉ có quyền xem.'},{status:403,headers});
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Yêu cầu không hợp lệ.'},{status:403,headers});
  let input:{id?:string;level?:string|null;taskType?:string|null;status?:string|null;expectedUpdatedAt?:string|null};
  try{input=await request.json()}catch{return Response.json({error:'Yêu cầu không hợp lệ.'},{status:400,headers});}
  if(!input||typeof input!=='object'||typeof input.id!=='string'||!Object.hasOwn(input,'expectedUpdatedAt')||!(input.expectedUpdatedAt===null||typeof input.expectedUpdatedAt==='string'))return Response.json({error:'Yêu cầu không hợp lệ.'},{status:400,headers});
  const hasLevel=Object.hasOwn(input,'level'),hasType=Object.hasOwn(input,'taskType'),hasStatus=Object.hasOwn(input,'status');
  if(!hasLevel&&!hasType&&!hasStatus)return Response.json({error:'Chọn thông tin cần cập nhật.'},{status:400,headers});
  if(hasType&&!(input.taskType===null||typeof input.taskType==='string'&&input.taskType.trim().length>0&&input.taskType.length<=240)||hasStatus&&!(input.status===null||typeof input.status==='string'&&input.status.trim().length>0&&input.status.length<=80))return Response.json({error:'Phân loại hoặc tiến độ không hợp lệ.'},{status:400,headers});
  if(hasLevel&&!(input.level===null||typeof input.level==='string'&&/^L[1-5]$/.test(input.level)))return Response.json({error:'Chọn level L1–L5 hợp lệ.'},{status:400,headers});
  try{
    const data=await updatePrivate<DesignData>(path,current=>{
      const task=current.items.find(item=>item.id===input.id);
      if(!task)throw new Error('NOT_FOUND');
      if(task.updatedAt!==input.expectedUpdatedAt)throw new Error('CONFLICT');
      if(hasLevel&&input.level&&!current.levels.some(level=>level.id===input.level))throw new Error('INVALID_LEVEL');
      if(hasType&&input.taskType!==null&&!Object.hasOwn(current.taskDefaults,input.taskType!.trim())&&!current.items.some(item=>[item.taskType,item.taskTypeOverride].includes(input.taskType!.trim())))throw new Error('INVALID_CHOICE');
      if(hasStatus&&input.status!==null&&!orderStatuses.some(status=>status===input.status!.trim())&&!current.items.some(item=>[item.status,item.statusOverride].includes(input.status!.trim())))throw new Error('INVALID_CHOICE');
      if(hasLevel)task.levelOverride=input.level??null;
      if(hasType)task.taskTypeOverride=input.taskType===null?null:input.taskType!.trim();
      if(hasStatus)task.statusOverride=input.status===null?null:input.status!.trim();
      task.updatedAt=new Date().toISOString();
      return current;
    });
    const orders=await readPrivate<DesignOrder[]>('labcos/design-orders.json',[]);
    return Response.json(composeDesignerWorkspace(data,orders,user.role),{headers});
  }catch(error){
    const message=error instanceof Error?error.message:'';
    if(message==='NOT_FOUND')return Response.json({error:'Không tìm thấy task.'},{status:404,headers});
    if(message==='CONFLICT'||error instanceof Error&&error.name==='BlobPreconditionFailedError')return Response.json({error:'Dữ liệu vừa được người khác cập nhật. Tải lại rồi cập nhật task.'},{status:409,headers});
    if(message==='INVALID_CHOICE')return Response.json({error:'Chọn phân loại hoặc tiến độ trong danh sách có sẵn.'},{status:400,headers});
    if(message==='INVALID_LEVEL')return Response.json({error:'Level chưa có trong KPI CONFIG 2026.'},{status:400,headers});
    return Response.json({error:'Chưa lưu được task. Hãy thử lại.'},{status:503,headers});
  }
}
