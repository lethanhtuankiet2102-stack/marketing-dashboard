import {getChatGPTUser} from '../../chatgpt-auth';
import {readPrivate} from '../../../lib/private-store';
import {googleConfigured,googleCredentialIssue,googleCallback,googleTokenPath,type GoogleGrant} from '../../../lib/google-source';
export const dynamic='force-dynamic';
export async function GET(){
 const user=await getChatGPTUser(true);if(!user)return Response.json({error:'Cần đăng nhập.'},{status:401});
 const grant=await readPrivate<GoogleGrant|null>(googleTokenPath,null).catch(()=>null);
 return Response.json({canConnect:user.role==='owner',connected:!!grant,connectedAt:grant?.connectedAt||null,configured:googleConfigured(),credentialIssue:user.role==='owner'?googleCredentialIssue():undefined,callback:user.role==='owner'?googleCallback:undefined},{headers:{'Cache-Control':'private, no-store'}});
}
