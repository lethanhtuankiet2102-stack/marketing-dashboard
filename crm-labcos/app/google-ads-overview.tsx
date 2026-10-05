'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { summarizeListLeads, type ListLeadData } from './list-lead-summary';

const count = (n:number) => new Intl.NumberFormat('vi-VN').format(n);
const decimal = (n:number) => new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2,minimumFractionDigits:n%1?2:0}).format(n);
const money = (n:number) => new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(n);

type CampaignTotal = { name:string; funnel:string; spend:number; impressions:number; clicks:number; conversions:number };
type GoogleReport={month:string;sourceUrl:string;summary:{spend:number;impressions:number;clicks:number;conversions:number};campaigns:CampaignTotal[]};
type LeadSummary = { covered:boolean; leads:number; qualityLeads:number; sourceThroughDate:string };

export default function GoogleAdsOverview() {
  const [reports,setReports]=useState<GoogleReport[]|null>(null);
  const [reportError,setReportError]=useState('');
  const [leadSummary,setLeadSummary]=useState<LeadSummary|null>(null);
  const [listLead,setListLead]=useState<{covered:boolean;leads:number;live:boolean}|null>(null);
  useEffect(()=>{
    let active=true;
    void Promise.allSettled([
      fetch('/api/google-ads-summary',{cache:'no-store'}).then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error||'Không tải được báo cáo Google Ads.');if(active)setReports(result as GoogleReport[])}).catch(error=>{if(active)setReportError(error instanceof Error?error.message:'Không tải được báo cáo Google Ads.')}),
      fetch('/api/sale-lead-summary?since=2026-07-01&until=2026-08-31&channel=google',{cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error('Không tải được Quality Lead');const result=await response.json() as LeadSummary;if(active)setLeadSummary(result)}),
      fetch('/api/list-lead',{cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error('Không tải được List Lead');const data=await response.json() as ListLeadData;if(active)setListLead({...summarizeListLeads(data,'2026-07-01','2026-08-31','google'),live:data.live===true})}),
    ]);
    return()=>{active=false};
  },[]);
  if(reportError)return <div className="panel meta-message"><h2>Google Ads Overview</h2><p>{reportError}</p></div>;
  if(!reports)return <div className="loading-state">Đang tải Google Ads…</div>;
  const totals=reports.reduce((result,report)=>({spend:result.spend+report.summary.spend,impressions:result.impressions+report.summary.impressions,clicks:result.clicks+report.summary.clicks,conversions:result.conversions+report.summary.conversions}),{spend:0,impressions:0,clicks:0,conversions:0});
  const campaignTotals=Array.from(reports.flatMap(report=>report.campaigns).reduce((map,campaign)=>{
    const name=campaign.name.replace('DSA Page Gia Công','DSA Gia Công');
    const current=map.get(name)||{name,funnel:campaign.funnel,spend:0,impressions:0,clicks:0,conversions:0};
    current.spend+=campaign.spend;current.impressions+=campaign.impressions;current.clicks+=campaign.clicks;current.conversions+=campaign.conversions;
    map.set(name,current);return map;
  },new Map<string,CampaignTotal>()).values()).sort((a,b)=>b.spend-a.spend);
  return <>
    <div className="page-heading meta-heading"><div><p className="eyebrow">GOOGLE ADS / OVERVIEW</p><h1>Tổng hợp Google Ads</h1><p>Cộng dồn báo cáo tháng 7 và tháng 8/2026.</p></div></div>
    <div className="stat-grid meta-stats"><Metric label="Tổng chi tiêu" value={money(totals.spend)}/><Metric label="Tổng hiển thị" value={count(totals.impressions)}/><Metric label="Tổng nhấp chuột" value={count(totals.clicks)}/><Metric label="Tổng chuyển đổi" value={decimal(totals.conversions)}/></div>
    <div className="google-secondary"><Metric label="CTR chung" value={`${decimal(totals.clicks/totals.impressions*100)}%`}/><Metric label="CPC chung" value={money(totals.spend/totals.clicks)}/><Metric label="Chi phí / chuyển đổi" value={money(totals.spend/totals.conversions)}/></div>
    <div className="google-secondary google-lead-stats"><Metric label="Lead Google" value={listLead?.covered?count(listLead.leads):'—'}/><Metric label="Quality Lead" value={leadSummary?.covered?count(leadSummary.qualityLeads):'—'}/><Metric label="CPL (Cost per Lead)" value={listLead?.covered&&listLead.leads?money(totals.spend/listLead.leads):'—'}/></div>
    <p className="data-note">Lead lấy từ List Lead, nhóm Zalo OA/Google (ghi chú có “Zalo OA”) trong tháng 7–8/2026; Quality Lead lấy từ Sale Lead Report, nguồn Google và Google/Hotline. CPL = tổng chi tiêu Google Ads hai tháng / Lead từ List Lead. Dấu “—” nghĩa là dữ liệu chưa đủ hoặc chưa tải được.</p>
    {listLead&&!listLead.live&&<p className="data-note">List Lead hiện dùng bản lưu vì chưa đồng bộ được file nguồn. Lead và CPL có thể chưa mới.</p>}
    <section className="panel data-panel"><div className="panel-title"><div><h2>Theo chiến dịch · gộp 2 tháng</h2><p>{campaignTotals.length} chiến dịch; các chỉ số tỷ lệ tính lại từ tổng số liệu</p></div></div><div className="table-scroll"><table className="google-campaign-table"><thead><tr><th>Chiến dịch</th><th>Tầng phễu</th><th>Chi tiêu</th><th>Hiển thị</th><th>Nhấp</th><th>CTR</th><th>CPC</th><th>Chuyển đổi</th><th>Chi phí / CĐ</th><th>Tỷ lệ CĐ</th></tr></thead><tbody>{campaignTotals.map(item=><tr key={item.name}><td><strong>{item.name}</strong></td><td>{item.funnel}</td><td>{money(item.spend)}</td><td>{count(item.impressions)}</td><td>{count(item.clicks)}</td><td>{decimal(item.clicks/item.impressions*100)}%</td><td>{money(item.spend/item.clicks)}</td><td><strong>{decimal(item.conversions)}</strong></td><td>{money(item.spend/item.conversions)}</td><td>{decimal(item.conversions/item.clicks*100)}%</td></tr>)}</tbody></table></div></section>
    <p className="data-note">“Chuyển đổi” là lượt liên hệ Google Ads ghi nhận, có thể là số thập phân; chưa phải lead đã lọc chất lượng. Tổng hợp này lấy từ hai file HTML và chưa tự cập nhật khi thư mục thay đổi.</p>
    <div className="google-report-links">{reports.map(report=><a className="google-source-link" key={report.month} href={report.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> Báo cáo gốc tháng {Number(report.month.slice(5))}/{report.month.slice(0,4)}</a>)}</div>
  </>;
}

function Metric({label,value}:{label:string;value:string}) { return <div className="stat-card meta-metric"><p>{label}</p><strong>{value}</strong></div>; }
