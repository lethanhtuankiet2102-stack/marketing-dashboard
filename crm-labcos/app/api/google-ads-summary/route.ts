import {getChatGPTUser} from '../../chatgpt-auth';
import {googleAdsReport,sources} from '../../../lib/google-ads-reports';
import {parseGoogleAdsReport} from '../../../lib/google-ads-parser';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(){
 if(!await getChatGPTUser())return Response.json({error:'Cần đăng nhập.'},{status:401});
 const results=await Promise.all(Object.entries(sources).sort(([a],[b])=>a.localeCompare(b)).map(async([month,id])=>{
  try{const source=await googleAdsReport(month);return {report:parseGoogleAdsReport(source.html,month,'https://drive.google.com/file/d/'+id+'/view',source.stale)};}
  catch{return {error:month};}
 }));
 const reports=results.flatMap(r=>r.report?[r.report]:[]),missing=results.flatMap(r=>r.error?[r.error]:[]);
 // Do not silently show partial spend against a full-period lead count.
 if(missing.length)return Response.json({error:'Chưa tổng hợp đủ báo cáo: '+missing.join(', ')+'. Kiểm tra kết nối Google, quyền đọc file hoặc cấu trúc bảng chiến dịch.',missing},{status:503,headers:{'Cache-Control':'private, no-store'}});
 return Response.json(reports,{headers:{'Cache-Control':'private, no-store'}});
}
