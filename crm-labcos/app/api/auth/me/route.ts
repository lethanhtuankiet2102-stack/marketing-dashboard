import { getChatGPTUser } from '../../../chatgpt-auth';
export async function GET() {
  const user=await getChatGPTUser();
  return Response.json(user?{user:{email:user.email,role:user.role}}:{error:'Cần đăng nhập.'},{status:user?200:401,headers:{'Cache-Control':'private, no-store'}});
}
