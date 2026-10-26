import {getChatGPTUser} from '../../chatgpt-auth';
import {googleAdsReport} from '../../../lib/google-ads-reports';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"};
export async function GET(request:Request){
 if(!await getChatGPTUser())return new Response('Cần đăng nhập.',{status:401,headers});
 const month=new URL(request.url).searchParams.get('month')||'';
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))return new Response('Tháng không hợp lệ.',{status:400,headers});
 try{
  const report=await googleAdsReport(month);
  const warning='<div role="status" style="position:fixed;right:12px;bottom:12px;z-index:99999;max-width:340px;padding:12px 16px;border:1px solid #f2ce83;border-radius:10px;background:#fffbeb;color:#854d0e;font:13px/1.5 system-ui">Đang hiển thị bản lưu. Chưa đọc được bản mới trên Drive; quản trị viên kiểm tra kết nối Google và quyền đọc file.</div>';
  return new Response(report.stale?report.html.replace(/<body\b[^>]*>/i,match=>match+warning):report.html,{headers});
 }catch(error){
  const unknown=error instanceof Error&&error.message==='UNKNOWN_MONTH';
  return new Response(unknown?'Chưa có nguồn báo cáo cho tháng này.':'<html lang="vi"><body style="font:15px/1.6 system-ui;padding:28px;color:#334155"><h2>Chưa tải được báo cáo từ Google Drive</h2><p>Quản trị viên mở Kết nối Google trên CRM để kết nối lại và kiểm tra tài khoản Google có quyền đọc file báo cáo. Sau đó bấm Tải lại báo cáo.</p></body></html>',{status:unknown?404:503,headers});
 }
}
