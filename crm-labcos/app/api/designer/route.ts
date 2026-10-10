import { getChatGPTUser } from '../../chatgpt-auth';
import { readPrivate, updatePrivate } from '../../../lib/private-store';
import { workloadPoints, effectiveLevel, type DesignData } from '../../designer-model';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const path='labcos/designer.json';
const headers={'Cache-Control':'private, no-store'};
function payload(data:DesignData,role:string){return {...data,canEdit:role==='owner'||role==='designer',items:data.items.map(item=>({...item,effectiveLevel:effectiveLevel(item,data),workloadPoints:workloadPoints(item,data)}))};}
export async function GET(){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'Cần đăng nhập.'},{status:401,headers});
  try{
    const data=await readPrivate<DesignData|null>(path,null);
    if(!data)return Response.json({error:'Chưa có dữ liệu ORDER DESIGN.'},{status:503,headers});
    return Response.json(payload(data,user.role),{headers});
  }catch{return Response.json({error:'Không tải được dữ liệu Designer. Hãy thử lại.'},{status:503,headers});}
}
export async function PATCH(request:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'Cần đăng nhập.'},{status:401,headers});
  if(!['owner','designer'].includes(user.role))return Response.json({error:'Tài khoản chỉ có quyền xem.'},{status:403,headers});
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Yêu cầu không hợp lệ.'},{status:403,headers});
  let input:{id?:string;level?:string|null;expectedUpdatedAt?:string|null};
  try{input=await request.json()}catch{return Response.json({error:'Yêu cầu không hợp lệ.'},{status:400,headers});}
  if(typeof input.id!=='string'||!Object.hasOwn(input,'expectedUpdatedAt')||!(input.expectedUpdatedAt===null||typeof input.expectedUpdatedAt==='string')||!(input.level===null||typeof input.level==='string'&&/^L[1-5]$/.test(input.level)))return Response.json({error:'Chọn level L1–L5 hợp lệ.'},{status:400,headers});
  try{
    const data=await updatePrivate<DesignData>(path,current=>{
      const task=current.items.find(item=>item.id===input.id);
      if(!task)throw new Error('NOT_FOUND');
      if(task.updatedAt!==input.expectedUpdatedAt)throw new Error('CONFLICT');
      if(input.level&&!current.levels.some(level=>level.id===input.level))throw new Error('INVALID_LEVEL');
      task.levelOverride=input.level??null;task.updatedAt=new Date().toISOString();
      return current;
    });
    return Response.json(payload(data,user.role),{headers});
  }catch(error){
    const message=error instanceof Error?error.message:'';
    if(message==='NOT_FOUND')return Response.json({error:'Không tìm thấy task.'},{status:404,headers});
    if(message==='CONFLICT'||error instanceof Error&&error.name==='BlobPreconditionFailedError')return Response.json({error:'Dữ liệu vừa được người khác cập nhật. Tải lại rồi chọn level.'},{status:409,headers});
    if(message==='INVALID_LEVEL')return Response.json({error:'Level chưa có trong KPI CONFIG 2026.'},{status:400,headers});
    return Response.json({error:'Chưa lưu được level. Hãy thử lại.'},{status:503,headers});
  }
}
