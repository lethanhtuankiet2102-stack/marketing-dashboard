'use client';
import {useEffect,useState} from 'react';
type Status={connected:boolean;canConnect:boolean;configured:boolean;credentialIssue?:string|null;callback?:string};
const connectionErrors:Record<string,string>={
 invalid_state:'Phiên kết nối không còn hợp lệ. Đăng nhập CRM trên đúng marketing-dashboard-labcos.vercel.app, rồi bấm Kết nối Google lại ngay trong cùng trình duyệt. Không tải lại trang callback hoặc dùng lại liên kết cũ.',
 invalid_client:'Google từ chối thông tin ứng dụng. Kiểm tra GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET trên Vercel: phải cùng một OAuth Client loại Web application. Lưu đúng môi trường Production rồi Redeploy.',
 invalid_grant:'Mã cho phép của Google đã hết hạn hoặc không hợp lệ. Bấm Kết nối Google để tạo lượt mới; không dùng lại trang kết nối cũ. Kiểm tra redirect URI đúng dòng bên dưới.',
 missing_refresh_token:'Google chưa cấp quyền duy trì kết nối. Bấm Kết nối Google lại và hoàn tất màn hình đồng ý để cấp quyền đọc khi CRM cần cập nhật.',
 missing_scope:'Chưa được cấp đủ quyền đọc Google Drive. Bấm Kết nối Google lại và cho phép đọc file Drive bằng tài khoản xem được cả hai file nguồn.',
 save_failed:'Google đã cho phép nhưng CRM chưa lưu được kết nối. Dữ liệu cũ vẫn được giữ. Bấm Kết nối Google lại; nếu còn báo mã này, gửi mã save_failed để kiểm tra phần lưu của CRM.',
 token_exchange_failed:'CRM chưa đổi được mã cho phép thành kết nối Google. Thử kết nối lại; nếu lỗi vẫn còn, kiểm tra Client ID/Client Secret và redirect URI trong phần cấu hình bên dưới.',
 denied:'Ông chưa cấp quyền đọc Google. Có thể bấm Kết nối Google lại.',
 failed:'Lượt kết nối trước chưa hoàn tất. Bấm Kết nối Google lại để xem mã lỗi cụ thể.'
};
export default function GoogleSyncStatus(){
 const [status,setStatus]=useState<Status|null>(null);
 useEffect(()=>{let active=true;fetch('/api/google-sync',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(value=>{if(active)setStatus(value)}).catch(()=>undefined);return()=>{active=false}},[]);
 if(!status?.canConnect)return null;
 const result=typeof window!=='undefined'?new URLSearchParams(window.location.search).get('google_sync'):null;
 return <section className="google-sync-card" aria-label="Kết nối dữ liệu Google"><div><strong>{status.connected?'Đã kết nối Google':'Kết nối Google để tự cập nhật CRM'}</strong><p>{status.connected?'Designer và List Lead tự kiểm tra dữ liệu mỗi phút khi trang đang mở.':'Cấp quyền đọc bằng tài khoản có quyền xem cả ORDER DESIGN và LỊCH TRỰC PAGE. CRM chỉ đọc dữ liệu nguồn.'}</p>{status.credentialIssue&&<p role="alert"><b>Kiểm tra cấu hình:</b> {status.credentialIssue}</p>}{!status.connected&&result&&result!=='connected'&&<p role="alert">{connectionErrors[result]||'Chưa hoàn tất kết nối. Hãy kết nối lại.'} <b>Mã: {Object.hasOwn(connectionErrors,result)?result:'unknown'}</b></p>}</div><form action="/api/google-sync/connect" method="post"><button className="button outline" disabled={!status.configured}>{status.connected?'Kết nối lại Google':'Kết nối Google'}</button></form>{!status.connected&&<details><summary>Cấu hình Google cho quản trị viên</summary><p>Trong Google Cloud, bật Google Drive API và Google Sheets API. Với OAuth Client loại Web application, thêm Authorized redirect URI:</p><code>{status.callback}</code><p>{status.configured?'Vercel đã có tên biến GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET; cần bảo đảm giá trị đúng với OAuth Client đó.':'Cấu hình GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET trực tiếp trong Environment Variables của Vercel, rồi triển khai lại.'} Nếu ứng dụng Google đang ở Testing, thêm tài khoản kết nối vào Test users; quyền kết nối có thể hết hạn sau 7 ngày.</p></details>}</section>;
}
