import {randomUUID} from 'node:crypto';
import {getChatGPTUser} from '../../chatgpt-auth';
import {readPrivate,transactPrivate} from '../../../lib/private-store';
import {scoreOrder,validateOrder,type DesignOrder} from '../../design-orders-model';
import type {DesignData} from '../../designer-model';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const path='labcos/design-orders.json',headers={'Cache-Control':'private, no-store'};
async function config(){const data=await readPrivate<DesignData|null>('labcos/designer.json',null);if(!data?.levels?.length)throw new Error('CONFIG');return data;}
export async function GET(){
 const user=await getChatGPTUser(true);if(!user)return Response.json({error:'Cần đăng nhập.'},{status:401,headers});
 try{const [data,orders]=await Promise.all([config(),readPrivate<DesignOrder[]>(path,[])]);return Response.json({orders:orders.map(o=>scoreOrder(o,data)),levels:data.levels,taskDefaults:data.taskDefaults,platforms:[...new Set(data.items.map(t=>t.platform).filter(Boolean))],canEdit:['owner','manager','sale_admin','designer','order','sale_oem'].includes(user.role)},{headers});}catch{return Response.json({error:'Chưa tải được Order Design hoặc cấu hình KPI. Hãy thử lại.'},{status:503,headers});}
}
async function save(request:Request,editing:boolean){
 const user=await getChatGPTUser(true);if(!user)return Response.json({error:'Cần đăng nhập.'},{status:401,headers});
 if(!['owner','manager','sale_admin','designer','order','sale_oem'].includes(user.role))return Response.json({error:'Tài khoản chỉ có quyền xem.'},{status:403,headers});
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Yêu cầu không hợp lệ.'},{status:403,headers});
 try{
  const body=await request.text();if(body.length>18000)throw new Error('INPUT');
  let input;try{input=JSON.parse(body)}catch{throw new Error('INPUT')}
  const fields=validateOrder(input),data=await config();
  if(fields.level&&!data.levels.some(l=>l.id===fields.level))throw new Error('INPUT');
  if(typeof input.id!=='string'||!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(input.id)||editing&&typeof input.revision!=='string')throw new Error('INPUT');
  const at=new Date().toISOString(),revision=randomUUID();
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
  const orders=await transactPrivate<DesignOrder[]>(path,[],current=>{
   const previous=current.find(o=>o.id===input.id);
   if(editing){if(!previous)throw new Error('NOT_FOUND');if(previous.revision!==input.revision)throw new Error('CONFLICT');const nextFields={...fields,briefDate:fields.briefDate||previous.briefDate||today};const changed=Object.keys(nextFields).filter(key=>nextFields[key as keyof typeof nextFields]!==previous[key as keyof typeof nextFields]);Object.assign(previous,nextFields,{revision,updatedAt:at,history:[...previous.history,{at,by:user.email,fields:changed}]});}
   else{if(previous){if(previous.createdBy!==user.email)throw new Error('CONFLICT');return current;}current.push({...fields,id:input.id,number:Math.max(0,...current.map(o=>o.number))+1,revision,createdAt:at,updatedAt:at,briefDate:fields.briefDate||today,briefBy:user.displayName||user.email,createdBy:user.email,history:[{at,by:user.email,fields:['created']}]});}
   return current;
  });
  return Response.json({order:scoreOrder(orders.find(o=>o.id===input.id)!,data)},{status:editing?200:201,headers});
 }catch(error){const message=error instanceof Error?error.message:'';const status=message==='INPUT'?400:message==='NOT_FOUND'?404:message==='CONFLICT'?409:503;return Response.json({error:status===400?'Kiểm tra tên, nền tảng, phân loại, brief, ngày brief, deadline và đường dẫn.':status===409?'Đơn vừa được người khác sửa. Nội dung đang nhập vẫn được giữ; mở lại đơn để xem bản mới trước khi lưu.':status===404?'Không tìm thấy đơn.':'Chưa lưu được đơn. Hãy thử lại.'},{status,headers});}
}
export const POST=(request:Request)=>save(request,false);
export const PATCH=(request:Request)=>save(request,true);

