'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Search, Users } from 'lucide-react';

type Lead={id:string;sheetRow:number;number:string;date:string;group:string;status:string;name:string;product:string;note:string;nextAction:string;actionDate:string;specialNote:string;failReason:string;expectedValue:number;contactDate:string;source:string;phone:string;quality:boolean;fit:string;unfitReason:string;form:string;business:string;region:string;moq:string;decisionMaker:string};
type Person={name:string;records:Lead[]};
type Report={source:string;fromDate:string;throughDate:string;people:Person[]};
const monthName=(s:string)=>s==='undated'?'Chưa ghi ngày':`Tháng ${Number(s.slice(5))}/${s.slice(0,4)}`;
const dateName=(s:string)=>s?`${s.slice(8,10)}/${s.slice(5,7)}/${s.slice(0,4)}`:'Chưa ghi ngày';
const number=(n:number)=>new Intl.NumberFormat('vi-VN').format(n);
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();

export default function SaleLeadReportPanel(){
  const [report,setReport]=useState<Report|null>(null);
  const [error,setError]=useState('');
  const [month,setMonth]=useState('all');
  const [query,setQuery]=useState('');
  useEffect(()=>{let active=true;fetch('/api/sale-lead-report',{cache:'no-store'}).then(async response=>{const data=await response.json() as Report&{error?:string};if(!response.ok)throw new Error(data.error||'Không tải được báo cáo lead.');if(active)setReport(data)}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Không tải được báo cáo lead.');});return()=>{active=false}},[]);
  const months=useMemo(()=>[...new Set(report?.people.flatMap(p=>p.records.filter(x=>x.date).map(x=>x.date.slice(0,7)))||[])].sort(),[report]);
  const dated=report?.people.flatMap(p=>p.records.filter(x=>x.date))||[];
  const allUndated=report?.people.flatMap(p=>p.records.filter(x=>!x.date))||[];
  const period=dated.filter(x=>month==='all'||x.date.startsWith(month));
  const bySource=[...new Set(period.map(x=>x.source||'Chưa ghi nguồn'))].map(name=>({name,count:period.filter(x=>(x.source||'Chưa ghi nguồn')===name).length,quality:period.filter(x=>(x.source||'Chưa ghi nguồn')===name&&x.quality).length})).sort((a,b)=>b.count-a.count);
  const people=report?.people.map(p=>({...p,visible:p.records.filter(x=>(month==='all' || (month==='undated'?!x.date:x.date.startsWith(month))) && (!query||norm([x.name,x.phone,x.product,x.source,x.status,x.note,x.specialNote].join(' ')).includes(norm(query.trim()))))}))||[];
  const total=period.length;
  return <>
    <div className="page-heading"><div><p className="eyebrow">KHÔNG GIAN LÀM VIỆC / BÁO CÁO LEAD SALE</p><h1>Sale Lead Report</h1><p>Tổng hợp sheet LEAD của Trinh Đỗ, Quỳnh Lê và Kimmy từ tháng 7/2026.</p></div></div>
    {error&&<div className="alert error" role="alert">{error}</div>}
    {!report&&!error&&<div className="loading-state">Đang tải Sale Lead Report…</div>}
    {report&&<>
      <div className="list-lead-period" role="group" aria-label="Lọc theo tháng">{[['all','Từ tháng 7'],...months.map(x=>[x,monthName(x)]),['undated',`Chưa ghi ngày (${allUndated.length})`]].map(([key,label])=><button key={key} className={month===key?'selected':''} onClick={()=>setMonth(key)}>{label}</button>)}</div>
      <div className="list-lead-stats sale-lead-stats"><div className="list-lead-stat"><span className="list-lead-icon blue"><Users size={19}/></span><span>Lead có ngày trong kỳ</span><strong>{number(total)}</strong><small>Gộp 3 file, từ tháng 7/2026</small></div><div className="list-lead-stat"><span className="list-lead-icon green"><CheckCircle2 size={19}/></span><span>Quality Lead</span><strong>{number(period.filter(x=>x.quality).length)}</strong><small>Ô Quality lead được tích</small></div><div className="list-lead-stat"><span className="list-lead-icon green"><CheckCircle2 size={19}/></span><span>Fit Lead</span><strong>{number(period.filter(x=>norm(x.fit)==='fit lead').length)}</strong><small>Theo cột Fit lead/Unfit Lead</small></div><div className="list-lead-stat"><span className="list-lead-icon"><CalendarDays size={19}/></span><span>Chưa ghi ngày</span><strong>{number(allUndated.length)}</strong><small>Xem riêng, không cộng vào tháng</small></div></div>
      <div className="list-lead-overview"><section className="panel"><div className="panel-title"><div><h2>Lead theo nhân viên</h2><p>{month==='undated'?'Các dòng chưa ghi ngày':month==='all'?'Từ tháng 7/2026':monthName(month)}</p></div></div><div className="list-lead-bars">{report.people.map(p=>{const count=(month==='undated'?p.records.filter(x=>!x.date):p.records.filter(x=>x.date&&(month==='all'||x.date.startsWith(month)))).length;return <div className="list-lead-bar" key={p.name}><span>{p.name}</span><div className="list-lead-track owner"><i style={{width:`${count/Math.max(1,...report.people.map(person=>person.records.filter(x=>month==='undated'?!x.date:!!x.date&&(month==='all'||x.date.startsWith(month))).length))*100}%`}}/></div><strong>{count}</strong></div>})}</div></section><section className="panel"><div className="panel-title"><div><h2>Nguồn lead và Quality Lead</h2><p>Tổng lead / Quality Lead theo từng nguồn có ngày trong kỳ</p></div></div><div className="list-lead-bars">{bySource.map(x=><div className="list-lead-bar sale-source-bar" key={x.name}><span title={x.name}>{x.name}</span><div className="list-lead-track"><i style={{width:`${x.count/Math.max(1,bySource[0]?.count||0)*100}%`}}/></div><strong>{x.count} / {x.quality}</strong></div>)}</div></section></div>
      <div className="sale-detail-heading"><Users size={20}/><h2>Chi tiết từng file</h2></div>
      <div className="tools-row sale-lead-search"><label className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm khách hàng, sản phẩm, nguồn, ghi chú…" aria-label="Tìm lead sale"/></label></div>
      {people.map(p=><section className="panel sale-panel" key={p.name}><div className="panel-title"><div><h2>{p.name}</h2><p>{p.visible.length} lead phù hợp · sheet {report.source} trong file của {p.name}</p></div></div>{p.visible.length?<div className="table-scroll"><table className="list-lead-table sale-lead-table"><thead><tr><th>Ngày thu lead</th><th>Khách hàng</th><th>Nhóm</th><th>Trạng thái</th><th>Nguồn</th><th>Sản phẩm quan tâm</th><th>Quality Lead</th><th>Fit / Unfit</th><th>Chi tiết</th></tr></thead><tbody>{p.visible.map(x=><tr key={x.id}><td>{dateName(x.date)}</td><td><strong>{x.name}</strong><small>{x.phone||'Chưa ghi SĐT'}</small></td><td>{x.group||'—'}</td><td><span className={`pill ${norm(x.status)==='dang cham soc'?'contacted':'new'}`}>{x.status||'Chưa ghi'}</span></td><td>{x.source||'—'}</td><td className="list-lead-wrap">{x.product||'—'}</td><td>{x.quality?'Đã tích':'Chưa tích'}</td><td>{x.fit||'—'}</td><td><details><summary>Xem</summary><div className="sale-lead-extra"><p><b>STT trong file:</b> {x.number||'—'} · <b>Ngày liên hệ:</b> {dateName(x.contactDate)} · <b>Hình thức:</b> {x.form||'—'}</p>{x.note&&<p><b>Ghi chú tương tác:</b> {x.note}</p>}{x.nextAction&&<p><b>Action tiếp theo:</b> {x.nextAction}{x.actionDate?` (${dateName(x.actionDate)})`:''}</p>}{x.specialNote&&<p><b>Ghi chú khách:</b> {x.specialNote}</p>}{x.failReason&&<p><b>Lí do fail:</b> {x.failReason}</p>}{x.unfitReason&&<p><b>Lí do unfit:</b> {x.unfitReason}</p>}{x.expectedValue>0&&<p><b>Doanh số đơn dự kiến:</b> {number(x.expectedValue)} ₫</p>}{(x.business||x.region||x.moq||x.decisionMaker)&&<p><b>Thông tin thêm:</b> {[x.business,x.region,x.moq,x.decisionMaker].filter(Boolean).join(' · ')}</p>}</div></details></td></tr>)}</tbody></table></div>:<p className="list-lead-no-result">Không có lead phù hợp.</p>}</section>)}
      <p className="data-note">Dữ liệu từ ba file ông gửi, lấy sheet “LEAD”. Quality Lead lấy trực tiếp từ checkbox của sheet và được hiển thị riêng với Fit Lead. Các dòng không ghi “Ngày thu lead” được hiển thị riêng và không cộng vào tổng theo tháng. Đây là bản tại lúc thêm mục; chỉnh sửa file nguồn sau đó chưa tự đồng bộ vào Sale Lead Report.</p>
    </>}
  </>;
}
