'use client';
import {useState} from 'react';
import GoogleAdsOverview from './google-ads-overview';
import GoogleSyncStatus from './google-sync-status';
const months=[['2026-07','Tháng 7/2026'],['2026-08','Tháng 8/2026'],['2026-09','Tháng 9/2026']] as const;
export default function GoogleAdsPanel(){
 const [view,setView]=useState<'overview'|(typeof months)[number][0]>('overview'),[reload,setReload]=useState(0);
 return <div className="google-original-page">
  <GoogleSyncStatus/>
  <div className="google-original-toolbar"><div><p className="eyebrow">KHÔNG GIAN LÀM VIỆC / GOOGLE ADS</p><h1>Báo cáo Google Ads</h1></div><div className="meta-period" role="group" aria-label="Chọn báo cáo"><button type="button" className={view==='overview'?'selected':''} aria-pressed={view==='overview'} onClick={()=>{setView('overview');setReload(0)}}>Overview</button>{months.map(([key,label])=><button key={key} type="button" className={view===key?'selected':''} aria-pressed={view===key} onClick={()=>{setView(key);setReload(0)}}>{label}</button>)}</div></div>
  {view==='overview'?<GoogleAdsOverview/>:<><div className="tools-row"><span className="data-note">Báo cáo lấy từ file HTML trên Google Drive. CRM hiển thị bản đã lưu; bấm Cập nhật dữ liệu để lấy báo cáo mới.</span><button type="button" className="button outline" onClick={()=>setReload(value=>value+1)}>Cập nhật dữ liệu</button></div><iframe key={view+'-'+reload} className="google-original-frame" src={`/api/google-ads?month=${view}${reload>0?'&refresh=1':''}`} title={`Báo cáo Google Ads ${months.find(([key])=>key===view)?.[1]}`} sandbox="allow-scripts" referrerPolicy="no-referrer"/></>}
 </div>;
}

