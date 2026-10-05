'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, FileText, Megaphone, Users } from 'lucide-react';
import { summarizeListLeads, type ListLeadData } from './list-lead-summary';

type Month='2026-07'|'2026-08'|'2026-09';
type Period='all'|'reported'|Month;
type LeadSummary={covered:boolean;leads:number;qualityLeads:number;sourceThroughDate:string};
type MetaResponse={status:string;summary?:{spend?:string};currency?:string;message?:string};
type Channel={name:string;spend:number|null;leads:number|null;quality:number|null};
type MonthlyChannels={month:Month;facebook:Channel;google:Channel};
type GoogleReport={month:string;summary:{spend:number}};
const months:Month[]=['2026-07','2026-08','2026-09'];
const count=(n:number)=>new Intl.NumberFormat('vi-VN').format(n);
const money=(n:number)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(n);
const monthLabel=(m:Month)=>`Tháng ${Number(m.slice(5))}/${m.slice(0,4)}`;
const monthUntil=(m:Month)=>`${m}-${m==='2026-09'?'30':'31'}`;
const selectedMonths=(period:Period)=>period==='all'?months:period==='reported'?months.slice(0,2):[period];

export default function MarketingOverviewPanel({onNavigate,contentCount}:{onNavigate:(tab:'meta'|'google'|'list-lead'|'content')=>void;contentCount:number}){
  const [period,setPeriod]=useState<Period>('all');
  const [meta,setMeta]=useState<Partial<Record<Month,number|null>>>({});
  const [leads,setLeads]=useState<Partial<Record<Month,{facebook:LeadSummary|null;google:LeadSummary|null}>>>({});
  const [listLead,setListLead]=useState<ListLeadData|null>(null);
  const [googleReports,setGoogleReports]=useState<GoogleReport[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;
    async function load(){
      setLoading(true);
      const [results,listResult,googleResult]=await Promise.all([Promise.all(months.map(async month=>{
        const since=`${month}-01`;
        const until=monthUntil(month);
        const [metaResult,facebook,google]=await Promise.all([
          fetch(`/api/meta?period=custom_month&month=${month}`,{cache:'no-store'}).then(async r=>r.ok?await r.json() as MetaResponse:null).catch(()=>null),
          fetch(`/api/sale-lead-summary?since=${since}&until=${until}&channel=facebook`,{cache:'no-store'}).then(async r=>r.ok?await r.json() as LeadSummary:null).catch(()=>null),
          fetch(`/api/sale-lead-summary?since=${since}&until=${until}&channel=google`,{cache:'no-store'}).then(async r=>r.ok?await r.json() as LeadSummary:null).catch(()=>null),
        ]);
        return {month,spend:metaResult?.status==='connected'&&metaResult.currency==='VND'&&metaResult.summary?.spend!==undefined?Number(metaResult.summary.spend):null,facebook,google};
      })),fetch('/api/list-lead',{cache:'no-store'}).then(async r=>r.ok?await r.json() as ListLeadData:null).catch(()=>null),fetch('/api/google-ads-summary',{cache:'no-store'}).then(async r=>r.ok?await r.json() as GoogleReport[]:[]).catch(()=>[])]);
      if(!active)return;
      setMeta(Object.fromEntries(results.map(x=>[x.month,x.spend])));
      setLeads(Object.fromEntries(results.map(x=>[x.month,{facebook:x.facebook,google:x.google}])));
      setListLead(listResult);
      setGoogleReports(googleResult);
      setLoading(false);
    }
    void load();
    return()=>{active=false};
  },[]);
  const monthlyChannels=useMemo<MonthlyChannels[]>(()=>months.map(month=>{
    const leadCount=(channel:'facebook'|'google')=>{
      if(!listLead)return null;
      const result=summarizeListLeads(listLead,`${month}-01`,monthUntil(month),channel);
      return result.covered?result.leads:null;
    };
    const quality=(channel:'facebook'|'google')=>leads[month]?.[channel]?.covered?leads[month]?.[channel]?.qualityLeads??null:null;
    return {
      month,
      facebook:{name:'Meta Ads',spend:meta[month]??null,leads:leadCount('facebook'),quality:quality('facebook')},
      google:{name:'Google Ads',spend:googleReports.find(report=>report.month===month)?.summary.spend??null,leads:leadCount('google'),quality:quality('google')},
    };
  }),[meta,leads,listLead,googleReports]);
  const selected=selectedMonths(period);
  const selectedRows=monthlyChannels.filter(row=>selected.includes(row.month));
  const channels=useMemo(()=>{
    const aggregate=(key:'facebook'|'google'):Channel=>{
      const values=selectedRows.map(row=>row[key]);
      const sum=(metric:'spend'|'leads'|'quality')=>values.every(value=>value[metric]!==null)?values.reduce((n,value)=>n+(value[metric]??0),0):null;
      return {name:key==='facebook'?'Meta Ads':'Google Ads',spend:sum('spend'),leads:sum('leads'),quality:sum('quality')};
    };
    return [aggregate('facebook'),aggregate('google')];
  },[monthlyChannels,period]);
  const totalSpend=channels.every(x=>x.spend!==null)?channels.reduce((n,x)=>n+(x.spend||0),0):null;
  const totalLeads=channels.every(x=>x.leads!==null)?channels.reduce((n,x)=>n+(x.leads||0),0):null;
  const totalQuality=channels.every(x=>x.quality!==null)?channels.reduce((n,x)=>n+(x.quality||0),0):null;
  const cpl=(channel:Channel)=>channel.spend!==null&&channel.leads!==null&&channel.leads>0?money(channel.spend/channel.leads):'—';
  const periodText=period==='all'?'Tháng 7–9/2026':period==='reported'?'Tháng 7–8/2026':monthLabel(period);
  return <>
    <div className="page-heading"><div><p className="eyebrow">KHÔNG GIAN LÀM VIỆC / MARKETING</p><h1>Marketing Overview</h1><p>Chi phí quảng cáo, lead từ List Lead và Quality Lead từ Sale Lead Report trong cùng kỳ.</p></div></div>
    <div className="list-lead-period" role="group" aria-label="Kỳ Marketing Overview">{([['all','Tháng 7–9/2026'],['reported','Tháng 7–8/2026'],...months.map(m=>[m,monthLabel(m)])] as [Period,string][]).map(([key,label])=><button key={key} className={period===key?'selected':''} onClick={()=>setPeriod(key)}>{label}</button>)}</div>
    {loading&&<div className="loading-state">Đang tải số liệu Marketing…</div>}
    {!loading&&<>
      <div className="stat-grid marketing-summary"><Metric label="Tổng chi phí" value={totalSpend===null?'—':money(totalSpend)} detail="Meta Ads + Google Ads"/><Metric label="Lead" value={totalLeads===null?'—':count(totalLeads)} detail="Facebook + Google từ List Lead"/><Metric label="Quality Lead" value={totalQuality===null?'—':count(totalQuality)} detail="Checkbox Quality lead từ Sale Lead Report"/><Metric label="CPL" value={totalSpend!==null&&totalLeads!==null&&totalLeads>0?money(totalSpend/totalLeads):'—'} detail="Tổng chi phí / tổng lead"/></div>
      <div className="marketing-channel-grid">{channels.map(channel=><section className="panel marketing-channel" key={channel.name}><div className="panel-title"><div><h2>{channel.name}</h2><p>{periodText}</p></div></div><div className="marketing-channel-metrics"><div><span>Chi phí</span><strong>{channel.spend===null?'—':money(channel.spend)}</strong></div><div><span>Lead</span><strong>{channel.leads===null?'—':count(channel.leads)}</strong></div><div><span>Quality Lead</span><strong>{channel.quality===null?'—':count(channel.quality)}</strong></div><div><span>CPL</span><strong>{cpl(channel)}</strong></div></div></section>)}</div>
      {selectedRows.length>1&&<MonthlyComparison rows={selectedRows}/>}
      <p className="data-note">Meta lấy chi tiêu từ tài khoản quảng cáo; Google lấy từ báo cáo HTML tháng 7–8. Lead lấy từ List Lead: ghi chú có “Zalo OA” thuộc Google, còn lại thuộc Facebook/Messenger. Quality Lead lấy từ Sale Lead Report theo nguồn Facebook hoặc Google. Tháng 9 chưa có báo cáo Google Ads, nên chi phí Google, tổng chi phí và CPL của kỳ có tháng 9 hiển thị “—” đến khi bổ sung báo cáo.</p>
      {listLead&&!listLead.live&&<p className="data-note">List Lead hiện dùng bản lưu vì chưa đồng bộ được file nguồn. Lead và CPL có thể chưa mới.</p>}
      <div className="sale-detail-heading"><BarChart3 size={20}/><h2>Chi tiết Marketing</h2></div>
      <div className="marketing-links"><button onClick={()=>onNavigate('meta')}><Megaphone size={20}/><strong>Meta Ads</strong><small>Chiến dịch và chỉ số Meta</small></button><button onClick={()=>onNavigate('google')}><BarChart3 size={20}/><strong>Google Ads</strong><small>Báo cáo gốc theo tháng</small></button><button onClick={()=>onNavigate('list-lead')}><Users size={20}/><strong>List Lead</strong><small>Danh sách lead từ file trực page</small></button><button onClick={()=>onNavigate('content')}><FileText size={20}/><strong>Nội dung</strong><small>{contentCount} nội dung trong CRM</small></button></div>
    </>}
  </>;
}

function Metric({label,value,detail}:{label:string;value:string;detail:string}){return <div className="stat-card"><p>{label}</p><strong>{value}</strong><small>{detail}</small></div>}

function MonthlyComparison({rows}:{rows:MonthlyChannels[]}){
  const metrics:[string,(channel:Channel)=>number|null,(value:number)=>string][]=[
    ['Chi phí',channel=>channel.spend,money],
    ['Lead',channel=>channel.leads,count],
    ['Quality Lead',channel=>channel.quality,count],
    ['CPL',channel=>channel.spend!==null&&channel.leads!==null&&channel.leads>0?channel.spend/channel.leads:null,money],
  ];
  return <section className="panel monthly-comparison"><div className="panel-title"><div><h2>So sánh theo tháng</h2><p>Meta Ads và Google Ads trong kỳ đang chọn</p></div><div className="monthly-legend"><span><i className="meta"/>Meta Ads</span><span><i className="google"/>Google Ads</span></div></div>
    <div className="monthly-comparison-grid">{metrics.map(([title,valueOf,format])=>{
      const maximum=Math.max(1,...rows.flatMap(row=>[valueOf(row.facebook),valueOf(row.google)].filter((value):value is number=>value!==null)));
      return <div className="monthly-chart" key={title}><h3>{title}</h3>{rows.map(row=><div className="monthly-chart-month" key={row.month}><strong>{monthLabel(row.month)}</strong>{([['facebook',row.facebook],['google',row.google]] as const).map(([key,channel])=>{
        const value=valueOf(channel);
        return <div className="monthly-chart-series" key={key}><span>{key==='facebook'?'Meta':'Google'}</span><div className="monthly-chart-track"><i className={key} style={{width:value===null?'0%':`${value/maximum*100}%`}}/></div><b>{value===null?'—':format(value)}</b></div>;
      })}</div>)}</div>;
    })}</div>
    <p className="data-note">Lead từ List Lead; Quality Lead từ Sale Lead Report. Chi phí Google tháng 9 chưa có báo cáo nên chi phí và CPL tháng đó hiển thị “—”.</p>
  </section>;
}
