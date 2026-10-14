import {randomBytes,createHash} from 'node:crypto';
import {cookies} from 'next/headers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {crmOrigin,googleCallback,googleConfigured} from '../../../../lib/google-source';
export const runtime='nodejs';
export async function POST(request:Request){
 const user=await getChatGPTUser();
 if(!user||user.role!=='owner')return Response.json({error:'Chỉ quản trị viên được kết nối Google.'},{status:user?403:401});
 if(request.headers.get('origin')!==crmOrigin)return Response.json({error:'Yêu cầu không hợp lệ.'},{status:403});
 if(!googleConfigured())return Response.json({error:'Cần cấu hình GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET trên Vercel.'},{status:503});
 const state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
 (await cookies()).set('labcos-google-state',JSON.stringify({state,verifier,email:user.email,expires:Date.now()+600000}),{httpOnly:true,secure:true,sameSite:'lax',path:'/api/google-sync',maxAge:600});
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.search=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID!,redirect_uri:googleCallback,response_type:'code',scope:'https://www.googleapis.com/auth/drive.readonly',access_type:'offline',prompt:'consent',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
 return Response.redirect(url,303);
}
