'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { summarizeListLeads, type ListLeadData } from './list-lead-summary';

type Period = 'this_month' | 'last_month' | 'this_quarter' | 'custom_month';
type Insight = { spend?:string; impressions?:string; clicks?:string; ctr?:string };
type Campaign = { campaign_id:string; campaign_name:string; objective:string|null; model:string|null; image_url:string|null; start_date:string|null; status:string|null; spend?:string; leads_meta:number; messages:number; comments:number; impressions?:string; clicks?:string; ctr?:string; cpc?:string; cpm?:string; engagement:number };
type Report = { status:'connected'|'unconfigured'|'error'; accountName:string; accountId?:string; currency?:string; message?:string; updatedAt?:string; range?:{since:string;until:string}; summary?:Insight; campaigns?:Campaign[]; hasMoreCampaigns?:boolean };
type LeadSummary = { covered:boolean; leads:number; qualityLeads:number; sourceThroughDate:string };
const periods:[Period,string][] = [['this_month','Tháng này'],['last_month','Tháng trước'],['this_quarter','Quý'],['custom_month','Tháng tùy chỉnh']];
const currentMonth = () => { const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit'}).formatToParts(new Date()); return `${parts.find(part=>part.type==='year')?.value}-${parts.find(part=>part.type==='month')?.value}`; };
const count = (value?:string) => new Intl.NumberFormat('vi-VN').format(Number(value || 0));
const decimal = (value?:string) => new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(Number(value || 0));
const money = (value?:string,currency?:string) => currency ? new Intl.NumberFormat('vi-VN',{style:'currency',currency,maximumFractionDigits:2}).format(Number(value || 0)) : count(value);
const statusLabel = (value:string|null) => ({ACTIVE:'Đang chạy',PAUSED:'Tạm dừng',ARCHIVED:'Đã lưu trữ',DELETED:'Đã xóa',IN_PROCESS:'Đang xử lý',WITH_ISSUES:'Có vấn đề'} as Record<string,string>)[value||''] || value || '—';
const campaignDate = (value:string|null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('vi-VN') : '—';

export default function MetaPanel({canEdit}:{canEdit:boolean}) {
  const [period,setPeriod] = useState<Period>('this_month');
  const [month,setMonth] = useState(currentMonth);
  const [report,setReport] = useState<Report|null>(null);
  const [leadSummary,setLeadSummary] = useState<LeadSummary|null>(null);
  const [listLead,setListLead] = useState<{covered:boolean;leads:number;live:boolean}|null>(null);
  const [loading,setLoading] = useState(true);
  const [token,setToken] = useState('');
  const [saving,setSaving] = useState(false);
  const [formError,setFormError] = useState('');
  const [editingToken,setEditingToken] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setLeadSummary(null);
    setListLead(null);
    try {
      const params = new URLSearchParams({period});
      if (period==='custom_month') params.set('month',month);
      const response = await fetch(`/api/meta?${params}`, {cache:'no-store'});
      const result = await response.json() as Report;
      setReport(result);
      if (result.status==='connected' && result.range) {
        try {
          const leadParams=new URLSearchParams({...result.range,channel:'facebook'});
          const [leadResponse,listResponse]=await Promise.all([
            fetch(`/api/sale-lead-summary?${leadParams}`,{cache:'no-store'}),
            fetch('/api/list-lead',{cache:'no-store'}),
          ]);
          if (leadResponse.ok) setLeadSummary(await leadResponse.json() as LeadSummary);
          if (listResponse.ok) {
            const data=await listResponse.json() as ListLeadData;
            setListLead({...summarizeListLeads(data,result.range.since,result.range.until,'facebook'),live:data.live===true});
          }
        } catch { setLeadSummary(null); setListLead(null); }
      }
    } catch {
      setReport({status:'error',accountName:'OEM LABCOS 2',message:'Không tải được báo cáo. Thử lại sau.'});
    } finally { setLoading(false); }
  },[period,month]);
  useEffect(() => { void load(); },[load]);

  async function connect(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFormError('');
    try {
      const response = await fetch('/api/meta', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token}) });
      const result = await response.json() as {error?:string};
      if (!response.ok) throw new Error(result.error || 'Không lưu được mã.');
      setToken(''); setEditingToken(false); await load();
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Không lưu được mã.'); }
    finally { setSaving(false); }
  }

  const summary = report?.summary;
  return <>
    <div className="page-heading meta-heading"><div><p className="eyebrow">META ADS / OEM LABCOS 2</p><h1>Hiệu quả quảng cáo</h1><p>Số liệu đọc trực tiếp từ tài khoản quảng cáo 682734114621757.</p></div><button className="button outline" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/> Tải lại</button></div>
    <div className="meta-period" role="group" aria-label="Khoảng thời gian báo cáo">{periods.map(([value,label])=><button key={value} className={period===value?'selected':''} onClick={()=>setPeriod(value)} aria-pressed={period===value}>{label}</button>)}{period==='custom_month'&&<label className="meta-month">Chọn tháng <input type="month" value={month} max={currentMonth()} onChange={event=>setMonth(event.target.value)} aria-label="Chọn tháng báo cáo"/></label>}</div>
    {report?.range && !loading && <p className="meta-range">Từ {new Date(`${report.range.since}T12:00:00`).toLocaleDateString('vi-VN')} đến {new Date(`${report.range.until}T12:00:00`).toLocaleDateString('vi-VN')}{period==='this_quarter'?' · Quý hiện tại':''}</p>}
    {loading && <div className="loading-state">Đang tải số liệu Meta…</div>}
    {!loading && report?.status==='unconfigured' && <div className="panel meta-message"><h2>Chưa có dữ liệu Meta</h2><p>{canEdit?report.message+' Nhập mã để kết nối tài khoản.':'Quản trị viên chưa kết nối tài khoản Meta.'}</p>{canEdit&&<TokenForm token={token} setToken={setToken} saving={saving} error={formError} onSubmit={connect}/>}</div>}
    {!loading && report?.status==='error' && <><div className="alert error" role="alert">{report.message}</div>{canEdit&&<div className="panel meta-message"><h2>Thử mã truy cập mới</h2><TokenForm token={token} setToken={setToken} saving={saving} error={formError} onSubmit={connect}/></div>}</>}
    {!loading && report?.status==='connected' && <>
      <div className="stat-grid meta-stats"><Metric label="Chi tiêu" value={money(summary?.spend,report.currency)}/><Metric label="Hiển thị" value={count(summary?.impressions)}/><Metric label="Nhấp chuột" value={count(summary?.clicks)}/><Metric label="CTR" value={`${decimal(summary?.ctr)}%`}/></div>
      <div className="stat-grid meta-stats meta-lead-stats"><Metric label="Lead Facebook" value={listLead?.covered?count(String(listLead.leads)):'—'}/><Metric label="Quality Lead" value={leadSummary?.covered?count(String(leadSummary.qualityLeads)):'—'}/><Metric label="CPL (Cost per Lead)" value={listLead?.covered&&listLead.leads?money(String(Number(summary?.spend||0)/listLead.leads),report.currency):'—'}/></div>
      <p className="data-note">Lead lấy từ List Lead, nhóm Messenger/Facebook Ads (ghi chú không có “Zalo OA”); Quality Lead lấy từ ba sheet LEAD trong Sale Lead Report, nguồn Facebook. CPL = chi tiêu Meta / Lead từ List Lead trong kỳ đang chọn. Quality Lead đã nhập đến {leadSummary?.sourceThroughDate?campaignDate(leadSummary.sourceThroughDate):'30/09/2026'}; dấu “—” là kỳ chưa có dữ liệu hoặc chưa tải được.</p>
      {listLead&&!listLead.live&&<p className="data-note">List Lead hiện dùng bản lưu vì chưa đồng bộ được file nguồn. Lead và CPL có thể chưa mới.</p>}
      <section className="panel data-panel"><div className="panel-title"><div><h2>Theo chiến dịch</h2><p>{report.campaigns?.length || 0} chiến dịch có dữ liệu trong kỳ</p></div></div>{report.campaigns?.length ? <div className="table-scroll"><table className="meta-table"><thead><tr><th>Campaign Name</th><th>Mục tiêu</th><th>Mô hình</th><th>Hình ảnh bài đăng</th><th>Start Date</th><th>Campaign Status</th><th>Chi phí</th><th title="Tin nhắn bắt đầu cuộc trò chuyện cộng với bình luận được Meta ghi nhận">Leads Meta</th><th>Impressions</th><th>Clicks</th><th>CTR (%)</th><th>CPC</th><th>CPM</th><th>Lượt tương tác</th><th>Đánh giá hiệu quả Campaign</th></tr></thead><tbody>{report.campaigns.map(item=><tr key={item.campaign_id}><td className="meta-campaign-name"><strong>{item.campaign_name || item.campaign_id}</strong></td><td>{item.objective || '—'}</td><td>{item.model ? <span className="meta-model">{item.model}</span> : '—'}</td><td>{item.image_url ? <img className="meta-thumbnail" src={item.image_url} alt={`Ảnh quảng cáo ${item.campaign_name}`} loading="lazy" referrerPolicy="no-referrer"/> : '—'}</td><td>{campaignDate(item.start_date)}</td><td><span className={`meta-status ${item.status==='ACTIVE'?'active':item.status==='PAUSED'?'paused':''}`}>{statusLabel(item.status)}</span></td><td>{money(item.spend,report.currency)}</td><td title={`${item.messages} tin nhắn + ${item.comments} bình luận`}><strong>{count(String(item.leads_meta))}</strong><small className="meta-breakdown">{item.messages} tin nhắn + {item.comments} bình luận</small></td><td>{count(item.impressions)}</td><td>{count(item.clicks)}</td><td>{decimal(item.ctr)}%</td><td>{money(item.cpc,report.currency)}</td><td>{money(item.cpm,report.currency)}</td><td>{count(String(item.engagement))}</td><td className="meta-evaluation"></td></tr>)}</tbody></table></div> : <p className="meta-empty">Chưa có số liệu quảng cáo trong khoảng thời gian này.</p>}{report.hasMoreCampaigns && <p className="meta-note">Đang hiển thị 100 chiến dịch đầu tiên; tổng quan vẫn tính trên toàn tài khoản.</p>}</section>
      <p className="data-note">Leads Meta = số cuộc trò chuyện bắt đầu + bình luận được Meta ghi nhận. Mô hình được nhận diện từ tên chiến dịch; ô đánh giá để trống cho phần phân tích sau.</p>
      <p className="data-note">Cập nhật lúc {report.updatedAt ? new Date(report.updatedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}) : '—'} · Đơn vị chi tiêu: {report.currency || 'theo tài khoản quảng cáo'}. Số liệu Meta có thể cập nhật trễ.</p>
      {canEdit&&<button className="meta-token-toggle" onClick={()=>setEditingToken(!editingToken)}>{editingToken?'Đóng':'Thay mã truy cập Meta'}</button>}
      {canEdit&&editingToken && <div className="panel meta-message"><p>Nhập mã mới khi mã hiện tại hết hạn hoặc cần thay quyền truy cập.</p><TokenForm token={token} setToken={setToken} saving={saving} error={formError} onSubmit={connect}/></div>}
    </>}
  </>;
}

function Metric({label,value}:{label:string;value:string}) { return <div className="stat-card meta-metric"><p>{label}</p><strong>{value}</strong></div>; }
function TokenForm({token,setToken,saving,error,onSubmit}:{token:string;setToken:(value:string)=>void;saving:boolean;error:string;onSubmit:(event:React.FormEvent<HTMLFormElement>)=>void}) {
  return <form className="meta-token-form" onSubmit={onSubmit}><label htmlFor="meta-token">Access token có quyền ads_read</label><div><input id="meta-token" type="password" autoComplete="off" spellCheck={false} value={token} onChange={event=>setToken(event.target.value)} placeholder="Dán mã từ Meta vào đây" required minLength={16}/><button className="button primary" type="submit" disabled={saving}>{saving?'Đang kiểm tra…':'Kết nối Meta'}</button></div>{error && <p role="alert" className="form-error">{error}</p>}<small>Mã không hiện lại sau khi lưu. Không chia sẻ mã này trong chat.</small></form>;
}
