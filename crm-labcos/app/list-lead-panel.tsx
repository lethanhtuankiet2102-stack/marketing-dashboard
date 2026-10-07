'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Download, RefreshCw, Search, Users } from 'lucide-react';
import { listLeadChannel } from './list-lead-summary';

type Item = { id:string; sheetRow:number; date:string; number:string; name:string; phone:string; status:string; sales:string; need:string; note:string };
type Payload = { source:string; fromDate:string; throughDate:string; items:Item[]; live?:boolean; manual?:boolean; fileName?:string; lastSyncedAt?:string|null; warning?:string; error?:string };
const formatDate = (value:string) => `${value.slice(8,10)}/${value.slice(5,7)}/${value.slice(0,4)}`;
const normalized = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
const leadSource = (item:Item) => listLeadChannel(item)==='google' ? 'zalo' : 'messenger';
const sourceNames:Record<string,string> = { zalo:'Lead Zalo OA/Google', messenger:'Lead Messenger/Facebook Ads' };

export default function ListLeadPanel(_props:{canEdit?:boolean}) {
  const [data,setData] = useState<Payload|null>(null);
  const [error,setError] = useState('');
  const [refreshing,setRefreshing] = useState(false);
  const [month,setMonth] = useState('all');
  const [sales,setSales] = useState('all');
  const [status,setStatus] = useState('all');
  const [source,setSource] = useState('all');
  const [query,setQuery] = useState('');
  const [page,setPage] = useState(1);
  const busy=useRef(false);
  async function refresh() {
    if(busy.current)return;
    busy.current=true;
    setRefreshing(true);
    try {
      const response=await fetch('/api/list-lead',{cache:'no-store'});
      const result=await response.json() as Payload;
      if (!response.ok) throw new Error(result.error || 'Không tải được List Lead.');
      setData(result);setError('');
    } catch (e) {setError(e instanceof Error?e.message:'Không tải được List Lead.');}
    finally {busy.current=false;setRefreshing(false);}
  }
  useEffect(()=>{
    void refresh();
    const timer=window.setInterval(()=>{if(!document.hidden)void refresh()},60000);
    const onFocus=()=>void refresh();
    window.addEventListener('focus',onFocus);
    return ()=>{window.clearInterval(timer);window.removeEventListener('focus',onFocus)};
  },[]);

  const rows = useMemo(()=>data?.items.filter(item=>
    (month==='all'||item.date.startsWith(month)) &&
    (sales==='all'||item.sales===sales) &&
    (status==='all'||(status==='contacted'?!!item.status:!item.status)) &&
    (source==='all'||leadSource(item)===source) &&
    (!query||normalized([item.name,item.phone,item.need,item.note,item.sales].join(' ')).includes(normalized(query.trim())))
  )||[],[data,month,sales,status,source,query]);
  const owners=useMemo(()=>[...new Set((data?.items||[]).map(x=>x.sales||'Chưa phân công'))].sort((a,b)=>a.localeCompare(b,'vi')),[data]);
  const total=rows.length;
  const contacted=rows.filter(x=>!!x.status).length;
  const withNeed=rows.filter(x=>!!x.need).length;
  const sourceRows = data?.items.filter(item=>(month==='all'||item.date.startsWith(month)) && (sales==='all'||item.sales===sales) && (status==='all'||(status==='contacted'?!!item.status:!item.status)) && (!query||normalized([item.name,item.phone,item.need,item.note,item.sales].join(' ')).includes(normalized(query.trim())))) || [];
  const sourceCounts = { zalo:sourceRows.filter(item=>leadSource(item)==='zalo').length, messenger:sourceRows.filter(item=>leadSource(item)==='messenger').length };
  const months=useMemo(()=>[...new Set((data?.items||[]).map(x=>x.date.slice(0,7)))].sort(),[data]);
  const monthLabel=(key:string)=>`Tháng ${Number(key.slice(5))}/${key.slice(0,4)}`;
  const monthly=months.map(key=>({key,count:rows.filter(x=>x.date.startsWith(key)).length}));
  const byOwner=Object.entries(rows.reduce<Record<string,number>>((acc,item)=>{const name=item.sales||'Chưa phân công';acc[name]=(acc[name]||0)+1;return acc},{})).sort((a,b)=>b[1]-a[1]);
  const perPage=25;
  const pageCount=Math.max(1,Math.ceil(total/perPage));
  const currentPage=Math.min(page,pageCount);
  const visible=rows.slice((currentPage-1)*perPage,currentPage*perPage);
  const changeFilters=(fn:()=>void)=>{fn();setPage(1)};

  function exportCsv() {
    const columns=['Ngày','STT trong sheet','Tên khách','SĐT','Nhóm lead','Tình trạng','Sale trực','Nhu cầu','Ghi chú'];
    const values=rows.map(x=>[formatDate(x.date),x.number,x.name,x.phone,sourceNames[leadSource(x)],x.status,x.sales,x.need,x.note]);
    const csv='\uFEFF'+[columns,...values].map(record=>record.map(value=>{
      const safe=/^[\s\uFEFF]*[=+@-]/.test(value)?`'${value}`:value;
      return '"'+safe.replaceAll('"','""')+'"';
    }).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=`labcos-list-lead-${month==='all'?'tu-thang-7':month}.csv`;link.click();URL.revokeObjectURL(url);
  }

  return <>
    <div className="page-heading"><div><p className="eyebrow">KHÔNG GIAN LÀM VIỆC / DỮ LIỆU SHEET</p><h1>List Lead</h1><p>Danh sách lead từ sheet “LEAD LIST”, bắt đầu từ 01/07/2026.</p></div></div>
    {error&&<div className="alert error" role="alert">{error}</div>}
    {!data&&!error&&<div className="loading-state">Đang tải List Lead…</div>}
    {data&&<>
      <div className="list-lead-period" role="group" aria-label="Lọc theo tháng">
        {[['all','Từ tháng 7'],...months.map(key=>[key,monthLabel(key)])].map(([key,label])=><button key={key} className={month===key?'selected':''} onClick={()=>changeFilters(()=>setMonth(key))}>{label}</button>)}
      </div>
      <div className={data.live||data.manual?'data-note':'alert error'} role={data.live||data.manual?undefined:'alert'}>{data.manual?`Đã cập nhật từ ${data.fileName||'Excel'}${data.lastSyncedAt?` lúc ${new Date(data.lastSyncedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}`:''}.`:data.live&&data.lastSyncedAt?`Đã đồng bộ file nguồn lúc ${new Date(data.lastSyncedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}. Tự kiểm tra mỗi phút khi trang đang mở.`:data.warning} <button className="button outline" type="button" onClick={()=>void refresh()} disabled={refreshing}><RefreshCw size={15} className={refreshing?'spin':''}/>{refreshing?'Đang tải…':data.manual?'Tải lại dữ liệu':'Cập nhật ngay'}</button></div>
      <div className="list-lead-stats">
        <div className="list-lead-stat"><span className="list-lead-icon"><Users size={19}/></span><span>Tổng lead</span><strong>{total.toLocaleString('vi-VN')}</strong><small>Trong bộ lọc đang chọn</small></div>
        <div className="list-lead-stat"><span className="list-lead-icon green"><Users size={19}/></span><span>Đã ghi liên hệ</span><strong>{contacted.toLocaleString('vi-VN')}</strong><small>{total?Math.round(contacted/total*100):0}% tổng lead</small></div>
        <div className="list-lead-stat"><span className="list-lead-icon amber"><CalendarDays size={19}/></span><span>Chưa ghi tình trạng</span><strong>{(total-contacted).toLocaleString('vi-VN')}</strong><small>Theo cột Tình trạng của sheet</small></div>
        <div className="list-lead-stat"><span className="list-lead-icon blue"><Search size={19}/></span><span>Có ghi nhu cầu</span><strong>{withNeed.toLocaleString('vi-VN')}</strong><small>{total?Math.round(withNeed/total*100):0}% tổng lead</small></div>
      </div>
      <div className="list-lead-sources" aria-label="Lead theo nguồn">
        {(['zalo','messenger'] as const).map(key=><button key={key} type="button" className={`list-lead-source ${source===key?'selected':''}`} onClick={()=>changeFilters(()=>setSource(source===key?'all':key))} aria-pressed={source===key}><span>{sourceNames[key]}</span><strong>{sourceCounts[key].toLocaleString('vi-VN')}</strong><small>{key==='zalo'?'Ghi chú có “Zalo OA”':'Ghi chú không có “Zalo OA”'}</small></button>)}
      </div>
      <div className="list-lead-overview">
        <section className="panel"><div className="panel-title"><div><h2>Lead theo tháng</h2><p>Từ tháng 7/2026 đến hiện tại</p></div></div><div className="list-lead-bars">{monthly.map(item=><div className="list-lead-bar" key={item.key}><span>{monthLabel(item.key)}</span><div className="list-lead-track"><i style={{width:`${total?item.count/Math.max(...monthly.map(x=>x.count),1)*100:0}%`}}/></div><strong>{item.count}</strong></div>)}</div></section>
        <section className="panel"><div className="panel-title"><div><h2>Theo sale trực</h2><p>Người được ghi trên từng lead</p></div></div><div className="list-lead-bars">{byOwner.length?byOwner.map(([name,count])=><div className="list-lead-bar" key={name}><span title={name}>{name}</span><div className="list-lead-track owner"><i style={{width:`${count/Math.max(byOwner[0][1],1)*100}%`}}/></div><strong>{count}</strong></div>):<p className="list-lead-no-result">Không có dữ liệu trong bộ lọc.</p>}</div></section>
      </div>
      <section className="panel data-panel"><div className="panel-title"><div><h2>Danh sách lead</h2><p>{total} dòng phù hợp · từ {formatDate(data.fromDate)} đến {formatDate(data.throughDate)}</p></div></div>
        <div className="tools-row list-lead-tools"><label className="search-box"><Search size={17}/><input value={query} onChange={e=>changeFilters(()=>setQuery(e.target.value))} placeholder="Tìm tên, số điện thoại, nhu cầu…" aria-label="Tìm List Lead"/></label><select aria-label="Lọc nguồn lead" value={source} onChange={e=>changeFilters(()=>setSource(e.target.value))}><option value="all">Tất cả nguồn lead</option><option value="zalo">Lead Zalo OA/Google</option><option value="messenger">Lead Messenger/Facebook Ads</option></select><select aria-label="Lọc sale trực" value={sales} onChange={e=>changeFilters(()=>setSales(e.target.value))}><option value="all">Tất cả sale trực</option>{owners.map(name=><option key={name} value={name==='Chưa phân công'?'':name}>{name}</option>)}</select><select aria-label="Lọc tình trạng" value={status} onChange={e=>changeFilters(()=>setStatus(e.target.value))}><option value="all">Tất cả tình trạng</option><option value="contacted">Có ghi tình trạng</option><option value="blank">Chưa ghi tình trạng</option></select><button className="button outline" onClick={exportCsv} disabled={!total}><Download size={16}/> Xuất CSV</button></div>
        {total?<><div className="table-scroll"><table className="list-lead-table"><thead><tr><th>Ngày</th><th>Khách hàng</th><th>Nguồn lead</th><th>Tình trạng</th><th>Sale trực</th><th>Nhu cầu</th><th>Ghi chú</th></tr></thead><tbody>{visible.map(item=><tr key={item.id}><td>{formatDate(item.date)}</td><td><strong>{item.name||'Chưa ghi tên'}</strong><small>{item.phone||'Chưa ghi SĐT'}</small></td><td>{sourceNames[leadSource(item)]}</td><td><span className={`pill ${item.status?'contacted':'new'}`}>{item.status||'Chưa ghi'}</span></td><td>{item.sales||'—'}</td><td className="list-lead-wrap">{item.need||'—'}</td><td className="list-lead-note">{item.note?<details><summary>{item.note.length>90?`${item.note.slice(0,90)}…`:item.note}</summary><p>{item.note}</p></details>:'—'}</td></tr>)}</tbody></table></div><div className="list-lead-pagination"><span>Hiển thị {(currentPage-1)*perPage+1}–{Math.min(currentPage*perPage,total)} / {total}</span><div><button disabled={currentPage===1} onClick={()=>setPage(currentPage-1)} aria-label="Trang trước"><ChevronLeft size={17}/></button><span>Trang {currentPage}/{pageCount}</span><button disabled={currentPage===pageCount} onClick={()=>setPage(currentPage+1)} aria-label="Trang sau"><ChevronRight size={17}/></button></div></div></>:<p className="list-lead-no-result">Không tìm thấy lead phù hợp. Thử đổi bộ lọc hoặc từ khóa.</p>}
      </section><p className="data-note">Ngày nhập dạng chữ và ô ngày đã được chuẩn hóa theo thứ tự ghi trong sheet.</p>
    </>}
  </>;
}
