'use client';

import { useState } from 'react';
import GoogleAdsOverview from './google-ads-overview';

const months = [ ['2026-07','Tháng 7/2026'], ['2026-08','Tháng 8/2026'], ['2026-09','Tháng 9/2026'] ] as const;

export default function GoogleAdsPanel() {
  const [view,setView]=useState<'overview'|(typeof months)[number][0]>('overview');
  return <div className="google-original-page">
    <div className="google-original-toolbar"><div><p className="eyebrow">KHÔNG GIAN LÀM VIỆC / GOOGLE ADS</p><h1>Báo cáo Google Ads</h1></div><div className="meta-period" role="group" aria-label="Chọn báo cáo"><button type="button" className={view==='overview'?'selected':''} aria-pressed={view==='overview'} onClick={()=>setView('overview')}>Overview</button>{months.map(([key,label])=><button key={key} type="button" className={view===key?'selected':''} aria-pressed={view===key} onClick={()=>setView(key)}>{label}</button>)}</div></div>
    {view==='overview'?<GoogleAdsOverview/>:view==='2026-09'?<section className="panel" style={{padding:'32px',marginTop:'20px'}}><h2>Tháng 9/2026</h2><p>Chưa có báo cáo Google Ads tháng 9. Khi ông cập nhật file HTML, báo cáo sẽ xuất hiện tại đây.</p></section>:<iframe key={view} className="google-original-frame" src={`/api/google-ads?month=${view}`} title={`Báo cáo Google Ads ${months.find(([key])=>key===view)?.[1]}`} sandbox="allow-scripts" referrerPolicy="no-referrer"/>}
  </div>;
}
