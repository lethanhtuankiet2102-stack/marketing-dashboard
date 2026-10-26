'use client';

import { useEffect, useState, useCallback } from 'react';
import { ExternalLink } from 'lucide-react';
import { summarizeListLeads, type ListLeadData } from './list-lead-summary';

const count = (n:number) => new Intl.NumberFormat('vi-VN').format(n);
const decimal = (n:number) => new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2,minimumFractionDigits:n%1?2:0}).format(n);
const money = (n:number) => new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(n);

import type {CampaignTotal,GoogleReport} from '../lib/google-ads-parser';
type LeadSummary = { covered:boolean; leads:number; qualityLeads:number; sourceThroughDate:string };

export default function GoogleAdsOverview() {
  const [reports,setReports]=useState<GoogleReport[]|null>(null);
  const [reportError,setReportError]=useState('');
  const [leadSummary,setLeadSummary]=useState<LeadSummary|null>(null);
  const [listLead,setListLead]=useState<{covered:boolean;leads:number;live:boolean}|null>(null);
  const [refresh,setRefresh]=useState(0);
  const reload=useCallback(()=>setRefresh(n=>n+1),[]);
  useEffect(()=>{
    const timer=setInterval(()=>{if(document.visibilityState==='visible')reload()},60000);
    const focus=()=>reload();window.addEventListener('focus',focus);
    return()=>{clearInterval(timer);window.removeEventListener('focus',focus)};
  },[reload]);
  useEffect(()=>{
    const controller=new AbortController(),signal=controller.signal;
    const get=async(url:string)=>{const response=await fetch(url,{cache:'no-store',signal});const result=await response.json();if(!response.ok)throw new Error(result.error||'Không tải được dữ liệu.');return result;};
    void(async()=>{
      try{
        const data=await get('/api/google-ads-summary') as GoogleReport[];
        if(!data.length)throw new Error('Chưa có báo cáo Google Ads.');
        if(signal.aborted)return;
        setReports(data);setReportError('');setLeadSummary(null);setListLead(null);
        const months=data.map(r=>r.month).sort(),since=months[0]+'-01',last=months[months.length-1];
        const until=last+'-'+new Date(Number(last.slice(0,4)),Number(last.slice(5)),0).getDate();
        await Promise.allSettled([
          get('/api/sale-lead-summary?'+new URLSearchParams({since,until,channel:'google'})).then(result=>{if(!signal.aborted)setLeadSummary(result as LeadSummary)}),
          get('/api/list-lead').then((result:ListLeadData)=>{if(!signal.aborted)setListLead({...summarizeListLeads(result,since,until,'google'),live:result.live===true})}),
        ]);
      }catch(error){if(!signal.aborted)setReportError(error instanceof Error?error.message:'Không tải được báo cáo Google Ads.');}
    })();
    return()=>controller.abort();
  },[refresh]);
  if(reportError&&!reports)return <div className="panel meta-message"><h2>Google Ads Overview</h2><p>{reportError}</p></div>;
  if(!reports)return <div className="loading-state">Đang tải Google Ads…</div>;
  const period=reports.map(r=>`${Number(r.month.slice(5))}/${r.month.slice(0,4)}`).join(', ');
  const ratio=(n:number,d:number)=>d?n/d:0;
  const totals=reports.reduce((result,report)=>({spend:result.spend+report.summary.spend,impressions:result.impressions+report.summary.impressions,clicks:result.clicks+report.summary.clicks,conversions:result.conversions+report.summary.conversions}),{spend:0,impressions:0,clicks:0,conversions:0});
  const campaignTotals=Array.from(reports.flatMap(report=>report.campaigns).reduce((map,campaign)=>{
    const name=campaign.name.replace('DSA Page Gia Công','DSA Gia Công');
    const current=map.get(name)||{name,funnel:campaign.funnel,spend:0,impressions:0,clicks:0,conversions:0};
    current.spend+=campaign.spend;current.impressions+=campaign.impressions;current.clicks+=campaign.clicks;current.conversions+=campaign.conversions;
    map.set(name,current);return map;
  },new Map<string,CampaignTotal>()).values()).sort((a,b)=>b.spend-a.spend);
  return <>
    <div className="page-heading meta-heading"><div><p className="eyebrow">GOOGLE ADS / OVERVIEW</p><h1>Tổng hợp Google Ads</h1><p>Tự tổng hợp {reports.length} báo cáo tháng: {period}.</p></div></div>
    <div className="tools-row"><button type="button" className="button outline" onClick={reload}>Tải lại tổng hợp</button><span className="data-note">Tự kiểm tra mỗi phút khi Overview đang mở.</span></div>
    {reportError&&<p className="data-note" role="alert">Đang giữ tổng hợp lần trước. {reportError}</p>}
    {reports.some(r=>r.stale)&&<p className="data-note" role="status">Một số báo cáo đang dùng bản lưu vì chưa đọc được Drive. Kiểm tra kết nối Google để có số mới.</p>}
    <div className="stat-grid meta-stats"><Metric label="Tổng chi tiêu" value={money(totals.spend)}/><Metric label="Tổng hiển thị" value={count(totals.impressions)}/><Metric label="Tổng nhấp chuột" value={count(totals.clicks)}/><Metric label="Tổng chuyển đổi" value={decimal(totals.conversions)}/></div>
    <div className="google-secondary"><Metric label="CTR chung" value={`${decimal(ratio(totals.clicks,totals.impressions)*100)}%`}/><Metric label="CPC chung" value={money(ratio(totals.spend,totals.clicks))}/><Metric label="Chi phí / chuyển đổi" value={money(ratio(totals.spend,totals.conversions))}/></div>
    <div className="google-secondary google-lead-stats"><Metric label="Lead Google" value={listLead?.covered?count(listLead.leads):'—'}/><Metric label="Quality Lead" value={leadSummary?.covered?count(leadSummary.qualityLeads):'—'}/><Metric label="CPL (Cost per Lead)" value={listLead?.covered&&listLead.leads?money(totals.spend/listLead.leads):'—'}/></div>
    <p className="data-note">Lead lấy từ List Lead, nhóm Zalo OA/Google (ghi chú có “Zalo OA”) trong các tháng {period}; Quality Lead lấy từ Sale Lead Report, nguồn Google và Google/Hotline. CPL = tổng chi tiêu Google Ads các tháng trên / Lead từ List Lead. Dấu “—” nghĩa là dữ liệu chưa đủ hoặc chưa tải được.</p>
    {listLead&&!listLead.live&&<p className="data-note">List Lead hiện dùng bản lưu vì chưa đồng bộ được file nguồn. Lead và CPL có thể chưa mới.</p>}
    <section className="panel data-panel"><div className="panel-title"><div><h2>Theo chiến dịch · gộp {reports.length} tháng</h2><p>{campaignTotals.length} chiến dịch; các chỉ số tỷ lệ tính lại từ tổng số liệu</p></div></div><div className="table-scroll"><table className="google-campaign-table"><thead><tr><th>Chiến dịch</th><th>Tầng phễu</th><th>Chi tiêu</th><th>Hiển thị</th><th>Nhấp</th><th>CTR</th><th>CPC</th><th>Chuyển đổi</th><th>Chi phí / CĐ</th><th>Tỷ lệ CĐ</th></tr></thead><tbody>{campaignTotals.map(item=><tr key={item.name}><td><strong>{item.name}</strong></td><td>{item.funnel}</td><td>{money(item.spend)}</td><td>{count(item.impressions)}</td><td>{count(item.clicks)}</td><td>{decimal(ratio(item.clicks,item.impressions)*100)}%</td><td>{money(ratio(item.spend,item.clicks))}</td><td><strong>{decimal(item.conversions)}</strong></td><td>{money(ratio(item.spend,item.conversions))}</td><td>{decimal(ratio(item.conversions,item.clicks)*100)}%</td></tr>)}</tbody></table></div></section>
    <p className="data-note">“Chuyển đổi” là lượt liên hệ Google Ads ghi nhận, có thể là số thập phân; chưa phải lead đã lọc chất lượng. Tổng hợp tự tính lại từ các báo cáo HTML đã kết nối. Cập nhật phiên bản của cùng file Drive để CRM đọc số mới; file tháng mới cần được kết nối thêm.</p>
    <div className="google-report-links">{reports.map(report=><a className="google-source-link" key={report.month} href={report.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> Báo cáo gốc tháng {Number(report.month.slice(5))}/{report.month.slice(0,4)}</a>)}</div>
  </>;
}

function Metric({label,value}:{label:string;value:string}) { return <div className="stat-card meta-metric"><p>{label}</p><strong>{value}</strong></div>; }
