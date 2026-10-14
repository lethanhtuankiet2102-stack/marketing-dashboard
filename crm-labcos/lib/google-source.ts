import {readPrivate,writePrivate} from './private-store';
export const googleTokenPath='labcos/google-sync-token.json';
export const crmOrigin='https://marketing-dashboard-labcos.vercel.app';
export const googleCallback=`${crmOrigin}/api/google-sync/callback`;
export const sourceIds={designer:process.env.DESIGNER_SHEET_ID||'1IlIjxMRbP6OebbcW_wTE_DtNyUcjuQHZ5HsCg3vHfd0',leads:process.env.LIST_LEAD_SHEET_ID||'1s-JQpWGjkGvMCQHzUI9fMNBAbykEp2YJ'};
export type GoogleGrant={refreshToken:string;accessToken:string;expiresAt:number;connectedAt:string};
export const googleCredentials=()=>({clientId:(process.env.GOOGLE_CLIENT_ID||'').trim(),clientSecret:(process.env.GOOGLE_CLIENT_SECRET||'').trim()});
export const googleConfigured=()=>{const c=googleCredentials();return !!(c.clientId&&c.clientSecret)};
export function googleCredentialIssue():string|null{
 const {clientId,clientSecret}=googleCredentials();
 if(!clientId||!clientSecret)return 'Thiếu Client ID hoặc Client Secret trong môi trường Production.';
 if(!clientId.endsWith('.apps.googleusercontent.com')||/\s/.test(clientId))return 'GOOGLE_CLIENT_ID chưa phải Client ID đầy đủ. Copy lại Client ID của CRM Labcos trên Google Cloud.';
 if(clientSecret.includes('*'))return 'GOOGLE_CLIENT_SECRET đang chứa dấu *. Đây có thể là bản đã che; cần dùng secret đầy đủ lấy lúc tạo.';
 if(clientSecret===clientId||clientSecret.endsWith('.apps.googleusercontent.com'))return 'GOOGLE_CLIENT_SECRET đang bị dán thành Client ID. Hai giá trị này khác nhau.';
 if(clientSecret.startsWith('{')||clientSecret.startsWith('['))return 'GOOGLE_CLIENT_SECRET đang chứa cả nội dung JSON. Chỉ dán giá trị client_secret.';
 if(/[\s"']/.test(clientSecret))return 'GOOGLE_CLIENT_SECRET chứa dấu ngoặc kép hoặc ký tự trắng ở giữa. Copy lại nguyên secret, không kèm nhãn hay dấu ngoặc.';
 return null;
}
export async function googleAccessToken(){
 const grant=await readPrivate<GoogleGrant|null>(googleTokenPath,null);
 if(!grant)throw new Error('GOOGLE_CONNECT_REQUIRED');
 if(grant.expiresAt>Date.now()+60000)return grant.accessToken;
 const credentials=googleCredentials();
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:credentials.clientId,client_secret:credentials.clientSecret,refresh_token:grant.refreshToken,grant_type:'refresh_token'}),cache:'no-store',signal:AbortSignal.timeout(15000)});
 const token=await response.json();
 if(!response.ok||!token.access_token)throw new Error('GOOGLE_RECONNECT_REQUIRED');
 const next={...grant,accessToken:token.access_token,expiresAt:Date.now()+Number(token.expires_in||3600)*1000};
 // A concurrent refresh must not turn a successful read into a sync failure.
 await writePrivate(googleTokenPath,next).catch(()=>undefined);
 return next.accessToken;
}
export async function googleGet(url:string){
 const token=await googleAccessToken();
 const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error(response.status===401?'GOOGLE_RECONNECT_REQUIRED':response.status===403?'GOOGLE_ACCESS_REQUIRED':response.status===404?'GOOGLE_FILE_NOT_FOUND':'GOOGLE_READ_FAILED');
 return response;
}
export async function leadWorkbook(){
 const response=await googleGet(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(sourceIds.leads)}?alt=media`);
 if(Number(response.headers.get('content-length'))>20000000)throw new Error('SOURCE_TOO_LARGE');
 const buffer=await response.arrayBuffer(),bytes=new Uint8Array(buffer);
 if(buffer.byteLength>20000000||bytes[0]!==0x50||bytes[1]!==0x4b)throw new Error('SOURCE_INVALID');
 return buffer;
}
export function syncWarning(error:unknown){
 const code=error instanceof Error?error.message:'';
 if(code==='GOOGLE_CONNECT_REQUIRED')return 'Cần quản trị viên kết nối Google để tự đồng bộ. Đang hiển thị bản lưu.';
 if(code==='GOOGLE_RECONNECT_REQUIRED')return 'Kết nối Google hết hiệu lực. Quản trị viên cần kết nối lại; đang hiển thị bản lưu.';
 if(code==='GOOGLE_ACCESS_REQUIRED')return 'Google chưa cho CRM đọc file. Kiểm tra quyền file và bật Google Drive API / Google Sheets API; đang hiển thị bản lưu.';
 return 'Chưa đồng bộ được file Google. Đang hiển thị bản lưu gần nhất; hệ thống sẽ thử lại.';
}
