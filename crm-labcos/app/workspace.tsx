'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowUpRight, BarChart3, CalendarDays, Check, ChevronRight, Download, FileText, LayoutDashboard, Megaphone, Menu, Pencil, Plus, RefreshCw, Search, Trash2, Users, X } from 'lucide-react';
import MetaPanel from './meta-panel';
import ListLeadPanel from './list-lead-panel';
import GoogleAdsPanel from './google-ads-panel';
import SalePerformancePanel from './sale-performance-panel';
import SaleLeadReportPanel from './sale-lead-report-panel';
import MarketingOverviewPanel from './marketing-overview-panel';
import UserAccessPanel from './user-access-panel';
import DesignerPanel from './designer-panel';

type Tab = 'overview' | 'marketing' | 'leads' | 'list-lead' | 'sale-performance' | 'sale-lead-report' | 'content' | 'kpis' | 'meta' | 'google' | 'users' | 'designer';
type Lead = { id:string; name:string; company:string; phone:string; source:string; status:string; value:number; next_action:string; note:string; created_at:string; updated_at:string };
type Content = { id:string; title:string; channel:string; status:string; publish_date:string; brief:string; created_at:string; updated_at:string };
type LeadForm = { name:string; company:string; phone:string; source:string; status:string; value:string; nextAction:string; note:string };
type ContentForm = { title:string; channel:string; status:string; publishDate:string; brief:string };
const stages = [ ['new','Mới'], ['contacted','Đã liên hệ'], ['interested','Quan tâm'], ['booked','Đã hẹn'], ['won','Chốt đơn'], ['lost','Không phù hợp'] ] as const;
const contentStages = [ ['draft','Bản nháp'], ['review','Chờ duyệt'], ['scheduled','Đã lên lịch'], ['published','Đã đăng'] ] as const;
const tabs = [ { id:'overview', label:'Tổng quan', icon:LayoutDashboard }, { id:'marketing', label:'Marketing', icon:Megaphone }, { id:'leads', label:'Khách hàng & Lead', icon:Users }, { id:'sale-performance', label:'Sale Performance', icon:BarChart3 }, { id:'sale-lead-report', label:'Sale Lead Report', icon:Users }, { id:'designer', label:'Designer', icon:Pencil }, { id:'kpis', label:'KPI', icon:BarChart3 }, { id:'users', label:'Người dùng', icon:Users } ] as const;
const marketingTabs = [ { id:'marketing', label:'Overview', icon:LayoutDashboard }, { id:'meta', label:'Meta Ads', icon:Megaphone }, { id:'google', label:'Google Ads', icon:BarChart3 }, { id:'list-lead', label:'List Lead', icon:FileText }, { id:'content', label:'Nội dung', icon:FileText } ] as const;
const emptyLead:LeadForm = { name:'', company:'', phone:'', source:'Facebook Ads', status:'new', value:'', nextAction:'', note:'' };
const emptyContent:ContentForm = { title:'', channel:'Facebook', status:'draft', publishDate:'', brief:'' };
const money = (n:number) => new Intl.NumberFormat('vi-VN', { notation:'compact', maximumFractionDigits:1 }).format(n) + ' ₫';
const date = (s:string) => s ? new Date(`${s.slice(0,10)}T12:00:00`).toLocaleDateString('vi-VN') : 'Chưa đặt';
const stageLabel = (s:string) => stages.find(x=>x[0]===s)?.[1] || s;
const contentLabel = (s:string) => contentStages.find(x=>x[0]===s)?.[1] || s;

export default function Dashboard() {
  const [tab,setTab] = useState<Tab>('overview');
  const [leads,setLeads] = useState<Lead[]>([]);
  const [content,setContent] = useState<Content[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [modal,setModal] = useState<'lead'|'content'|null>(null);
  const [editing,setEditing] = useState<string|null>(null);
  const [leadForm,setLeadForm] = useState<LeadForm>(emptyLead);
  const [contentForm,setContentForm] = useState<ContentForm>(emptyContent);
  const [saving,setSaving] = useState(false);
  const [search,setSearch] = useState('');
  const [statusFilter,setStatusFilter] = useState('all');
  const [contentFilter,setContentFilter] = useState('all');
  const [menuOpen,setMenuOpen] = useState(false);
  const [role,setRole] = useState<'owner'|'viewer'|'designer'|null>(null);
  const canEdit = role === 'owner';

  const load = useCallback(async () => {
    try {
      setError('');
      const response = await fetch('/api/dashboard', { cache:'no-store' });
      const data = await response.json() as { error?:string; leads?:Lead[]; content?:Content[]; role?:'owner'|'viewer'|'designer' };
      if (!response.ok) throw new Error(data.error || 'Không tải được dữ liệu.');
      setLeads(data.leads || []); setContent(data.content || []); setRole(data.role || null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Không tải được dữ liệu.'); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{ const timer=window.setTimeout(()=>{void load()},0); return ()=>window.clearTimeout(timer); },[load]);

  const summary = useMemo(()=>{
    const newCount = leads.filter(l=>l.status==='new').length;
    const won = leads.filter(l=>l.status==='won');
    const contacted = leads.filter(l=>!['new','lost'].includes(l.status)).length;
    const pipeline = leads.filter(l=>!['won','lost'].includes(l.status)).reduce((v,l)=>v+Number(l.value||0),0);
    const overdue = leads.filter(l=>l.next_action && l.next_action < new Date().toISOString().slice(0,10) && !['won','lost'].includes(l.status)).length;
    return { newCount, won:won.length, contacted, pipeline, overdue, revenue:won.reduce((v,l)=>v+Number(l.value||0),0), rate:leads.length?Math.round(won.length/leads.length*100):0 };
  },[leads]);
  const filteredLeads = leads.filter(l=>(statusFilter==='all'||l.status===statusFilter) && [l.name,l.company,l.phone,l.source].join(' ').toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')));
  const filteredContent = content.filter(c=>contentFilter==='all'||c.status===contentFilter);
  const upcoming = leads.filter(l=>l.next_action && !['won','lost'].includes(l.status)).sort((a,b)=>a.next_action.localeCompare(b.next_action)).slice(0,5);
  const sources = Object.entries(leads.reduce<Record<string,number>>((acc,l)=>{ acc[l.source||'Khác']=(acc[l.source||'Khác']||0)+1; return acc; },{})).sort((a,b)=>b[1]-a[1]);

  function openLead(lead?:Lead) {
    if (!canEdit) return;
    setEditing(lead?.id || null);
    setLeadForm(lead ? { name:lead.name, company:lead.company, phone:lead.phone, source:lead.source, status:lead.status, value:String(lead.value||''), nextAction:lead.next_action, note:lead.note } : emptyLead);
    setModal('lead'); setError('');
  }
  function openContent(item?:Content) {
    if (!canEdit) return;
    setEditing(item?.id || null);
    setContentForm(item ? { title:item.title, channel:item.channel, status:item.status, publishDate:item.publish_date, brief:item.brief } : emptyContent);
    setModal('content'); setError('');
  }
  async function mutate(method:'POST'|'PATCH'|'DELETE', body:Record<string,unknown>) {
    if (!canEdit) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const response=await fetch('/api/dashboard',{ method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      const result=await response.json() as { error?:string };
      if(!response.ok) throw new Error(result.error || 'Không lưu được dữ liệu.');
      await load(); setModal(null); setEditing(null);
      setNotice(method==='DELETE'?'Đã xóa bản ghi.':'Đã lưu thay đổi.');
      window.setTimeout(()=>setNotice(''),3500);
    } catch(e) { setError(e instanceof Error ? e.message : 'Không lưu được dữ liệu.'); }
    finally { setSaving(false); }
  }
  async function remove(kind:'lead'|'content',id:string,name:string) {
    if(!window.confirm(`Xóa “${name}”? Thao tác này không thể hoàn tác.`)) return;
    await mutate('DELETE',{kind,id});
  }
  function exportCsv() {
    const rows=[['Tên','Doanh nghiệp','Số điện thoại','Nguồn','Giai đoạn','Giá trị','Ngày chăm sóc','Ghi chú'],...filteredLeads.map(l=>[l.name,l.company,l.phone,l.source,stageLabel(l.status),String(l.value),l.next_action,l.note])];
    const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a'); link.href=url; link.download='labcos-leads.csv'; link.click(); URL.revokeObjectURL(url);
  }
  function navigate(next:Tab){setTab(next);setMenuOpen(false);setError('');}

  return <div className="workspace">
    <aside className={`sidebar ${menuOpen?'sidebar-open':''}`}>
      <div className="brand"><span className="brand-mark">L</span><span><strong>CRM Labcos</strong><small>Growth workspace</small></span><button className="mobile-close" aria-label="Đóng menu" onClick={()=>setMenuOpen(false)}><X size={20}/></button></div>
      <p className="nav-caption">KHÔNG GIAN LÀM VIỆC</p>
      <nav aria-label="Điều hướng chính">{tabs.filter(item=>item.id!=='users'||canEdit).map(item=><div key={item.id}><button className={`nav-item ${(item.id==='marketing'?marketingTabs.some(child=>child.id===tab):tab===item.id)?'active':''}`} onClick={()=>navigate(item.id)} aria-expanded={item.id==='marketing'?marketingTabs.some(child=>child.id===tab):undefined}><item.icon size={18}/><span>{item.label}</span>{(item.id==='marketing'?marketingTabs.some(child=>child.id===tab):tab===item.id)&&<ChevronRight size={15} className="nav-chevron"/>}</button>{item.id==='marketing'&&marketingTabs.some(child=>child.id===tab)&&<div className="nav-subitems">{marketingTabs.map(child=><button key={child.id} className={`nav-subitem ${tab===child.id?'active':''}`} onClick={()=>navigate(child.id)}><child.icon size={15}/>{child.label}</button>)}</div>}</div>)}</nav>
      <div className="sidebar-foot"><div className="secure-mark"><span className="secure-dot"/> Bản làm việc riêng tư</div><p>Dữ liệu CRM được lưu trên Vercel. Báo cáo Meta đọc từ tài khoản quảng cáo khi được cấp mã.</p></div>
    </aside>
    {menuOpen && <button className="menu-backdrop" aria-label="Đóng menu" onClick={()=>setMenuOpen(false)}/>}
    <div className="main-area">
      <header className="topbar"><div className="top-left"><button className="menu-toggle" aria-label="Mở menu" onClick={()=>setMenuOpen(true)}><Menu size={21}/></button><span className="breadcrumb">LABCOS <ChevronRight size={14}/> {marketingTabs.some(child=>child.id===tab)?`Marketing / ${marketingTabs.find(child=>child.id===tab)?.label}`:tabs.find(x=>x.id===tab)?.label}</span></div><div className="top-actions"><span className="updated">{role==='designer'?'Designer':role==='viewer'?'Quyền chỉ xem':role==='owner'?'Quản trị':'Dữ liệu trực tiếp'}</span><button className="icon-button" title="Tải lại dữ liệu" aria-label="Tải lại dữ liệu" onClick={()=>{setLoading(true);void load();}}><RefreshCw size={17}/></button><button className="button outline" onClick={async()=>{await fetch('/api/auth/logout',{method:'POST'});window.location.assign('/login')}}>Đăng xuất</button><div className="avatar" title="Workspace riêng tư">L</div></div></header>
      <main className={`page-content ${tab==='google'?'google-page-content':''}`}>
        {error && <div className="alert error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Đóng"><X size={16}/></button></div>}
        {notice && <div className="alert success" role="status"><Check size={16}/>{notice}</div>}
        {loading ? <div className="loading-state">Đang tải dashboard…</div> : <>
          {tab==='overview'&&<>
            <div className="page-heading"><div><p className="eyebrow">TỔNG QUAN / LABCOS</p><h1>Khách hàng & tăng trưởng</h1><p>Theo dõi pipeline, lịch chăm sóc và kế hoạch nội dung trên một màn hình.</p></div>{canEdit&&<button className="button primary" onClick={()=>openLead()}><Plus size={17}/> Thêm lead</button>}</div>
            <div className="stat-grid"><Stat label="Tổng lead" value={String(leads.length)} detail="Trong pipeline" icon={Users} color="violet"/><Stat label="Lead mới" value={String(summary.newCount)} detail="Chưa liên hệ" icon={Activity} color="blue"/><Stat label="Đã chốt" value={String(summary.won)} detail={`${summary.rate}% tổng lead`} icon={Check} color="green"/><Stat label="Giá trị pipeline" value={money(summary.pipeline)} detail="Chưa gồm đơn đã chốt" icon={BarChart3} color="amber"/></div>
            <div className="two-col"><section className="panel"><PanelTitle title="Pipeline khách hàng" detail="Lead theo từng giai đoạn" action="Mở CRM" onAction={()=>navigate('leads')}/><div className="stage-list">{stages.map(([key,label])=>{const count=leads.filter(l=>l.status===key).length;return <button className="stage-row" key={key} onClick={()=>{setStatusFilter(key);navigate('leads')}}><span>{label}</span><div className="stage-track"><span style={{width:`${leads.length?Math.max(count/leads.length*100,count?6:0):0}%`}}/></div><strong>{count}</strong></button>})}</div></section><section className="panel"><PanelTitle title="Nguồn lead" detail="Phân bổ theo nguồn tiếp cận"/><div className="source-list">{sources.length?sources.map(([name,count])=><div className="source-row" key={name}><div><span>{name}</span><strong>{count}</strong></div><div className="source-track"><span style={{width:`${count/leads.length*100}%`}}/></div></div>):<Empty title="Chưa có nguồn lead" detail="Thêm lead để xem nguồn tiếp cận."/>}</div></section></div>
            <div className="two-col"><section className="panel"><PanelTitle title="Lịch chăm sóc" detail={`${summary.overdue} việc quá hạn`} action="Xem lead" onAction={()=>navigate('leads')}/>{upcoming.length?<div className="compact-list">{upcoming.map(l=><button key={l.id} onClick={()=>openLead(l)}><span className={`date-box ${l.next_action<new Date().toISOString().slice(0,10)?'overdue':''}`}>{l.next_action.slice(8,10)}</span><span className="compact-main"><strong>{l.name}</strong><small>{l.company||stageLabel(l.status)}</small></span><span className="compact-end">{date(l.next_action)}</span></button>)}</div>:<Empty title="Chưa có lịch chăm sóc" detail="Thêm ngày chăm sóc cho lead để theo dõi."/>}</section><section className="panel"><PanelTitle title="Nội dung gần đây" detail="Tiến độ sản xuất và đăng bài" action="Mở nội dung" onAction={()=>navigate('content')}/>{content.length?<div className="compact-list">{content.slice(0,5).map(c=><button key={c.id} onClick={()=>openContent(c)}><span className="content-square"><Megaphone size={17}/></span><span className="compact-main"><strong>{c.title}</strong><small>{c.channel} · {date(c.publish_date)}</small></span><span className={`pill ${c.status}`}>{contentLabel(c.status)}</span></button>)}</div>:<Empty title="Chưa có nội dung" detail="Tạo kế hoạch bài đăng đầu tiên." action="Thêm nội dung" onAction={()=>openContent()}/>}</section></div>
          </>}
          {tab==='leads'&&<><div className="page-heading"><div><p className="eyebrow">CRM / PIPELINE</p><h1>Khách hàng & Lead</h1><p>Ghi nhận cơ hội, cập nhật giai đoạn và lịch chăm sóc.</p></div>{canEdit&&<button className="button primary" onClick={()=>openLead()}><Plus size={17}/> Thêm lead</button>}</div><div className="summary-strip"><span><b>{leads.length}</b> tổng lead</span><span><b>{summary.contacted}</b> đã liên hệ hoặc tiến xa hơn</span><span><b>{summary.overdue}</b> cần chăm sóc quá hạn</span></div><div className="panel data-panel"><div className="tools-row"><label className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm tên, công ty, số điện thoại…" aria-label="Tìm lead"/></label><select aria-label="Lọc giai đoạn" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Tất cả giai đoạn</option>{stages.map(([key,label])=><option value={key} key={key}>{label}</option>)}</select><button className="button outline" onClick={exportCsv} disabled={!filteredLeads.length}><Download size={16}/> Xuất CSV</button></div>{filteredLeads.length?<div className="table-scroll"><table><thead><tr><th>Khách hàng</th><th>Nguồn</th><th>Giai đoạn</th><th>Giá trị</th><th>Chăm sóc tiếp</th>{canEdit&&<th><span className="sr-only">Thao tác</span></th>}</tr></thead><tbody>{filteredLeads.map(l=><tr key={l.id}><td><strong>{l.name}</strong><small>{l.company||l.phone||'—'}</small></td><td>{l.source}</td><td><span className={`pill ${l.status}`}>{stageLabel(l.status)}</span></td><td>{l.value?money(l.value):'—'}</td><td className={l.next_action<new Date().toISOString().slice(0,10)&&l.next_action?'overdue-text':''}>{date(l.next_action)}</td>{canEdit&&<td className="row-actions"><button title="Sửa lead" aria-label={`Sửa ${l.name}`} onClick={()=>openLead(l)}><Pencil size={16}/></button><button title="Xóa lead" aria-label={`Xóa ${l.name}`} onClick={()=>remove('lead',l.id,l.name)}><Trash2 size={16}/></button></td>}</tr>)}</tbody></table></div>:<Empty title={leads.length?'Không tìm thấy lead':'Chưa có lead'} detail={leads.length?'Thử thay từ khóa hoặc bộ lọc.':'Thêm lead đầu tiên để bắt đầu quản lý pipeline.'} action={canEdit&&!leads.length?'Thêm lead':undefined} onAction={()=>openLead()}/>}</div></>}
          {tab==='content'&&<><div className="page-heading"><div><p className="eyebrow">MARKETING / NỘI DUNG</p><h1>Kế hoạch nội dung</h1><p>Lưu brief, kênh đăng, ngày dự kiến và tiến độ duyệt.</p></div>{canEdit&&<button className="button primary" onClick={()=>openContent()}><Plus size={17}/> Thêm nội dung</button>}</div><div className="content-statuses">{contentStages.map(([key,label])=><button className={contentFilter===key?'selected':''} key={key} onClick={()=>setContentFilter(contentFilter===key?'all':key)}><span>{label}</span><b>{content.filter(c=>c.status===key).length}</b></button>)}</div><div className="panel data-panel"><div className="tools-row"><span className="list-count">{filteredContent.length} nội dung {contentFilter!=='all'&&<button onClick={()=>setContentFilter('all')}>Xóa lọc</button>}</span></div>{filteredContent.length?<div className="content-list">{filteredContent.map(c=><article className="content-item" key={c.id}><div className="content-icon"><FileText size={19}/></div><div className="content-info"><div className="content-title"><h3>{c.title}</h3><span className={`pill ${c.status}`}>{contentLabel(c.status)}</span></div><p>{c.brief||'Chưa có brief'}</p><div className="content-meta"><span><Megaphone size={14}/>{c.channel}</span><span><CalendarDays size={14}/>{date(c.publish_date)}</span></div></div>{canEdit&&<div className="item-buttons"><button title="Sửa nội dung" aria-label={`Sửa ${c.title}`} onClick={()=>openContent(c)}><Pencil size={16}/></button><button title="Xóa nội dung" aria-label={`Xóa ${c.title}`} onClick={()=>remove('content',c.id,c.title)}><Trash2 size={16}/></button></div>}</article>)}</div>:<Empty title={content.length?'Không có nội dung ở trạng thái này':'Chưa có nội dung'} detail={content.length?'Chọn trạng thái khác hoặc xóa bộ lọc.':'Tạo nội dung đầu tiên để theo dõi tiến độ.'} action={canEdit&&!content.length?'Thêm nội dung':undefined} onAction={()=>openContent()}/>}</div></>}
          {tab==='kpis'&&<><div className="page-heading"><div><p className="eyebrow">MARKETING / KPI</p><h1>Chỉ số vận hành</h1><p>Chỉ số được tính trực tiếp từ lead và nội dung đã nhập.</p></div></div><div className="stat-grid"><Stat label="Lead đã ghi nhận" value={String(leads.length)} detail="Tất cả nguồn" icon={Users} color="violet"/><Stat label="Tỷ lệ chốt" value={`${summary.rate}%`} detail={`${summary.won} / ${leads.length} lead`} icon={ArrowUpRight} color="green"/><Stat label="Doanh thu đã chốt" value={money(summary.revenue)} detail="Giá trị lead ở giai đoạn chốt" icon={BarChart3} color="blue"/><Stat label="Nội dung đã đăng" value={String(content.filter(c=>c.status==='published').length)} detail={`${content.length} nội dung tổng cộng`} icon={FileText} color="amber"/></div><div className="two-col"><section className="panel"><PanelTitle title="Theo nguồn lead" detail="Số lead và tỷ trọng"/><div className="kpi-breakdown">{sources.length?sources.map(([name,count])=><div key={name}><span>{name}</span><div className="stage-track"><span style={{width:`${count/leads.length*100}%`}}/></div><strong>{count} · {Math.round(count/leads.length*100)}%</strong></div>):<Empty title="Chưa có dữ liệu" detail="Thêm lead để xem hiệu quả theo nguồn."/>}</div></section><section className="panel"><PanelTitle title="Tiến độ nội dung" detail="Số bài theo trạng thái"/><div className="kpi-breakdown">{contentStages.map(([key,label])=><div key={key}><span>{label}</span><div className="stage-track"><span style={{width:`${content.length?content.filter(c=>c.status===key).length/content.length*100:0}%`}}/></div><strong>{content.filter(c=>c.status===key).length}</strong></div>)}</div></section></div><p className="data-note">Chỉ số phản ánh dữ liệu được nhập trên dashboard; chưa lấy dữ liệu tự động từ Meta, Google hoặc TikTok.</p></>}
          {tab==='meta'&&<MetaPanel canEdit={canEdit}/>}
          {tab==='marketing'&&<MarketingOverviewPanel onNavigate={navigate} contentCount={content.length}/>}
          {tab==='google'&&<GoogleAdsPanel/>}
          {tab==='designer'&&<DesignerPanel/>}
          {tab==='list-lead'&&<ListLeadPanel canEdit={canEdit}/>}
          {tab==='sale-performance'&&<SalePerformancePanel/>}
          {tab==='sale-lead-report'&&<SaleLeadReportPanel/>}
          {tab==='users'&&canEdit&&<UserAccessPanel/>}
        </>}
      </main>
    </div>
    {modal&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setModal(null)}}><div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><p className="eyebrow">{modal==='lead'?'CRM / KHÁCH HÀNG':'MARKETING / NỘI DUNG'}</p><h2 id="modal-title">{editing?'Chỉnh sửa':'Thêm'} {modal==='lead'?'lead':'nội dung'}</h2></div><button aria-label="Đóng" onClick={()=>setModal(null)} disabled={saving}><X size={21}/></button></div><form onSubmit={e=>{e.preventDefault();void mutate(editing?'PATCH':'POST',modal==='lead'?{kind:'lead',id:editing,...leadForm,value:Number(leadForm.value||0)}:{kind:'content',id:editing,...contentForm})}}>{modal==='lead'?<div className="form-grid"><label className="full">Tên khách hàng <input required maxLength={120} value={leadForm.name} onChange={e=>setLeadForm({...leadForm,name:e.target.value})} placeholder="Tên người liên hệ"/></label><label>Doanh nghiệp <input maxLength={120} value={leadForm.company} onChange={e=>setLeadForm({...leadForm,company:e.target.value})} placeholder="Tên công ty"/></label><label>Số điện thoại <input type="tel" maxLength={40} value={leadForm.phone} onChange={e=>setLeadForm({...leadForm,phone:e.target.value})} placeholder="Số liên hệ"/></label><label>Nguồn lead <input maxLength={80} value={leadForm.source} onChange={e=>setLeadForm({...leadForm,source:e.target.value})} placeholder="Facebook Ads, website…"/></label><label>Giai đoạn <select value={leadForm.status} onChange={e=>setLeadForm({...leadForm,status:e.target.value})}>{stages.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Giá trị dự kiến (₫) <input type="number" min="0" max="1000000000000" value={leadForm.value} onChange={e=>setLeadForm({...leadForm,value:e.target.value})} placeholder="0"/></label><label>Ngày chăm sóc tiếp <input type="date" value={leadForm.nextAction} onChange={e=>setLeadForm({...leadForm,nextAction:e.target.value})}/></label><label className="full">Ghi chú <textarea rows={3} maxLength={3000} value={leadForm.note} onChange={e=>setLeadForm({...leadForm,note:e.target.value})} placeholder="Nhu cầu, bước tiếp theo…"/></label></div>:<div className="form-grid"><label className="full">Tiêu đề nội dung <input required maxLength={180} value={contentForm.title} onChange={e=>setContentForm({...contentForm,title:e.target.value})} placeholder="Tên bài viết hoặc chiến dịch"/></label><label>Kênh <select value={contentForm.channel} onChange={e=>setContentForm({...contentForm,channel:e.target.value})}>{['Facebook','Instagram','TikTok','Google Ads','Khác'].map(s=><option key={s}>{s}</option>)}</select></label><label>Trạng thái <select value={contentForm.status} onChange={e=>setContentForm({...contentForm,status:e.target.value})}>{contentStages.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label className="full">Ngày dự kiến đăng <input type="date" value={contentForm.publishDate} onChange={e=>setContentForm({...contentForm,publishDate:e.target.value})}/></label><label className="full">Brief / ghi chú <textarea rows={5} maxLength={4000} value={contentForm.brief} onChange={e=>setContentForm({...contentForm,brief:e.target.value})} placeholder="Thông điệp, CTA, yêu cầu media…"/></label></div>}{error&&<p className="form-error" role="alert">{error}</p>}<div className="modal-footer"><button type="button" className="button outline" onClick={()=>setModal(null)} disabled={saving}>Hủy</button><button className="button primary" type="submit" disabled={saving}>{saving?'Đang lưu…':editing?'Lưu thay đổi':'Tạo mới'}</button></div></form></div></div>}
  </div>;
}

function Stat({label,value,detail,icon:Icon,color}:{label:string;value:string;detail:string;icon:typeof Users;color:string}){return <div className="stat-card"><div className={`stat-icon ${color}`}><Icon size={20}/></div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div>}
function PanelTitle({title,detail,action,onAction}:{title:string;detail:string;action?:string;onAction?:()=>void}){return <div className="panel-title"><div><h2>{title}</h2><p>{detail}</p></div>{action&&<button onClick={onAction}>{action}<ChevronRight size={15}/></button>}</div>}
function Empty({title,detail,action,onAction}:{title:string;detail:string;action?:string;onAction?:()=>void}){return <div className="empty-state"><div className="empty-icon"><FileText size={21}/></div><strong>{title}</strong><p>{detail}</p>{action&&<button className="button outline" onClick={onAction}><Plus size={15}/>{action}</button>}</div>}
