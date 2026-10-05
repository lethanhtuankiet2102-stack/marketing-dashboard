'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Banknote, ShoppingBag, Target } from 'lucide-react';

type Channel={name:string;orders:number;revenue:number};
type Month={month:string;target:number;signed:number;revenue:number;orders:number;collectionTarget:number;collected:number;channels:Channel[]};
type Person={name:string;months:Month[]};
type Report={source:string;fromDate:string;throughDate:string;people:Person[]};
const amount=(n:number)=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(n);
const compact=(n:number)=>new Intl.NumberFormat('vi-VN',{notation:'compact',maximumFractionDigits:1}).format(n)+' ₫';
const monthName=(key:string)=>`Tháng ${Number(key.slice(5))}/${key.slice(0,4)}`;
const sum=(rows:Month[],key:'target'|'revenue'|'orders'|'collected'|'collectionTarget')=>rows.reduce((acc,row)=>acc+row[key],0);

export default function SalePerformancePanel(){
  const [report,setReport]=useState<Report|null>(null);
  const [error,setError]=useState('');
  const [month,setMonth]=useState('all');
  useEffect(()=>{
    let active=true;
    fetch('/api/sale-performance',{cache:'no-store'}).then(async response=>{
      const data=await response.json() as Report & {error?:string};
      if(!response.ok)throw new Error(data.error||'Không tải được báo cáo sale.');
      if(active)setReport(data);
    }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Không tải được báo cáo sale.');});
    return ()=>{active=false};
  },[]);
  const months=useMemo(()=>[...new Set(report?.people.flatMap(person=>person.months.map(row=>row.month))||[])].sort(),[report]);
  const people=useMemo(()=>report?.people.map(person=>({...person,months:person.months.filter(row=>month==='all'||row.month===month)}))||[],[report,month]);
  const rows=people.flatMap(person=>person.months);
  const total={target:sum(rows,'target'),revenue:sum(rows,'revenue'),orders:sum(rows,'orders'),collected:sum(rows,'collected')};
  const sources=report?.people[0]?.months[0]?.channels.map(channel=>({name:channel.name,orders:rows.reduce((n,row)=>n+(row.channels.find(x=>x.name===channel.name)?.orders||0),0),revenue:rows.reduce((n,row)=>n+(row.channels.find(x=>x.name===channel.name)?.revenue||0),0)}))||[];
  return <>
    <div className="page-heading"><div><p className="eyebrow">KHÔNG GIAN LÀM VIỆC / BÁO CÁO SALE</p><h1>Sale Performance</h1><p>Tổng hợp từ báo cáo của Trinh Đỗ, Quỳnh Lê và Kimmy, từ tháng 7/2026.</p></div></div>
    {error&&<div className="alert error" role="alert">{error}</div>}
    {!report&&!error&&<div className="loading-state">Đang tải Sale Performance…</div>}
    {report&&<>
      <div className="list-lead-period" role="group" aria-label="Lọc tháng báo cáo">{[['all','Tổng quan từ tháng 7'],...months.map(key=>[key,monthName(key)])].map(([key,label])=><button key={key} className={month===key?'selected':''} onClick={()=>setMonth(key)}>{label}</button>)}</div>
      <div className="list-lead-stats sale-stats">
        <div className="list-lead-stat"><span className="list-lead-icon blue"><Banknote size={19}/></span><span>Doanh số thành công</span><strong>{compact(total.revenue)}</strong><small>{total.target?Math.round(total.revenue/total.target*100):0}% mục tiêu doanh số</small></div>
        <div className="list-lead-stat"><span className="list-lead-icon green"><Banknote size={19}/></span><span>Tiền thu về thực tế</span><strong>{compact(total.collected)}</strong><small>Ghi nhận trong kỳ</small></div>
        <div className="list-lead-stat"><span className="list-lead-icon amber"><ShoppingBag size={19}/></span><span>Tổng đơn hàng</span><strong>{amount(total.orders)}</strong><small>Gộp 3 báo cáo sale</small></div>
        <div className="list-lead-stat"><span className="list-lead-icon"><Target size={19}/></span><span>Mục tiêu doanh số</span><strong>{compact(total.target)}</strong><small>Theo kỳ đang chọn</small></div>
      </div>
      <section className="panel sale-panel"><div className="panel-title"><div><h2>Tổng quan theo nhân viên</h2><p>{month==='all'?'Tháng 7–9/2026':monthName(month)}</p></div></div><div className="table-scroll"><table className="list-lead-table sale-table"><thead><tr><th>Nhân viên</th><th>Mục tiêu</th><th>Doanh số thành công</th><th>Hoàn thành</th><th>Đơn hàng</th><th>Tiền thực thu</th></tr></thead><tbody>{people.map(person=>{const target=sum(person.months,'target'),revenue=sum(person.months,'revenue');return <tr key={person.name}><td><strong>{person.name}</strong></td><td>{amount(target)} ₫</td><td><strong>{amount(revenue)} ₫</strong></td><td>{target?Math.round(revenue/target*100):0}%</td><td>{amount(sum(person.months,'orders'))}</td><td>{amount(sum(person.months,'collected'))} ₫</td></tr>})}</tbody></table></div></section>
      <section className="panel sale-panel"><div className="panel-title"><div><h2>Đơn hàng theo nguồn</h2><p>Doanh số của từng nguồn được cộng từ CD3, CD4 và CD5 trong file.</p></div></div><div className="sale-source-grid">{sources.map(source=><div className="sale-source" key={source.name}><span>{source.name}</span><strong>{amount(source.orders)} đơn</strong><small>{compact(source.revenue)} doanh số</small></div>)}</div></section>
      <div className="sale-detail-heading"><BarChart3 size={20}/><h2>Chi tiết từng sale</h2></div>
      {people.map(person=><section className="panel sale-panel" key={person.name}><div className="panel-title"><div><h2>{person.name}</h2><p>Báo cáo tháng từ file 2026 - OEM SALE PERFORMANCE REPORT - {person.name}</p></div></div><div className="table-scroll"><table className="list-lead-table sale-table"><thead><tr><th>Tháng</th><th>Doanh số dự kiến</th><th>Doanh số thành công</th><th>Đơn hàng</th><th>Tiền thu dự kiến</th><th>Tiền thực thu</th></tr></thead><tbody>{person.months.map(row=><tr key={row.month}><td><strong>{monthName(row.month)}</strong></td><td>{amount(row.target)} ₫</td><td>{amount(row.revenue)} ₫</td><td>{amount(row.orders)}</td><td>{amount(row.collectionTarget)} ₫</td><td>{amount(row.collected)} ₫</td></tr>)}</tbody></table></div><div className="sale-month-details">{person.months.map(row=><details key={row.month}><summary>{monthName(row.month)} · nguồn đơn và doanh số</summary><div className="table-scroll"><table className="list-lead-table sale-table"><thead><tr><th>Nguồn</th><th>Đơn hàng</th><th>Doanh số</th></tr></thead><tbody>{row.channels.map(channel=><tr key={channel.name}><td>{channel.name}</td><td>{amount(channel.orders)}</td><td>{amount(channel.revenue)} ₫</td></tr>)}</tbody></table></div></details>)}</div></section>)}
      <p className="data-note">Số liệu lấy từ sheet “MONTHLY-SALE PERFORMANCE” trong ba file ông gửi. Đây là bản dữ liệu tại lúc thêm báo cáo; các thay đổi sau trong file nguồn chưa tự đồng bộ vào mục này. Tiền thực thu có thể thuộc đơn của kỳ trước, nên không dùng để suy ra doanh số thành công của cùng tháng.</p>
    </>}
  </>;
}
