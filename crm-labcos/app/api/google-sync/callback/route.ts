import {cookies} from 'next/headers';
import {timingSafeEqual} from 'node:crypto';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {googleCallback,crmOrigin,googleTokenPath,type GoogleGrant} from '../../../../lib/google-source';
import {writePrivate} from '../../../../lib/private-store';
export const runtime='nodejs';
function finish(status:string){return Response.redirect(`${crmOrigin}/?google_sync=${status}`,303)}
export async function GET(request:Request){
 const user=await getChatGPTUser(),jar=await cookies(),raw=jar.get('labcos-google-state')?.value;
 jar.set('labcos-google-state','',{httpOnly:true,secure:true,sameSite:'lax',path:'/api/google-sync',maxAge:0});
 if(!user||user.role!=='owner'||!raw)return finish('invalid_state');
 const url=new URL(request.url);let saved:{state:string;verifier:string;email:string;expires:number};
 try{saved=JSON.parse(raw)}catch{return finish('invalid_state')}
 const state=url.searchParams.get('state')||'',expected=Buffer.from(saved.state||''),actual=Buffer.from(state);
 if(saved.email!==user.email||saved.expires<Date.now()||!actual.length||actual.length!==expected.length||!timingSafeEqual(actual,expected))return finish('invalid_state');
 if(url.searchParams.has('error'))return finish('denied');
 const code=url.searchParams.get('code');if(!code)return finish('denied');
 try{
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID||'',client_secret:process.env.GOOGLE_CLIENT_SECRET||'',code,code_verifier:saved.verifier,redirect_uri:googleCallback,grant_type:'authorization_code'}),cache:'no-store',signal:AbortSignal.timeout(15000)});
  const token=await response.json();
  if(!response.ok){
   const errors:Record<string,string>={invalid_client:'invalid_client',unauthorized_client:'invalid_client',invalid_grant:'invalid_grant',invalid_scope:'missing_scope',access_denied:'denied'};
   return finish(errors[String(token.error)]||'token_exchange_failed');
  }
  if(!token.access_token)return finish('token_exchange_failed');
  if(!token.refresh_token)return finish('missing_refresh_token');
  if(!String(token.scope||'').split(' ').includes('https://www.googleapis.com/auth/drive.readonly'))return finish('missing_scope');
  const grant:GoogleGrant={accessToken:token.access_token,refreshToken:token.refresh_token,expiresAt:Date.now()+Number(token.expires_in||3600)*1000,connectedAt:new Date().toISOString()};
  try{await writePrivate(googleTokenPath,grant)}catch{return finish('save_failed')}
  return finish('connected');
 }catch{return finish('token_exchange_failed')}
}
