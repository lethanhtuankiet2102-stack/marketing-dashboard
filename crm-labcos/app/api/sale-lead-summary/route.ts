import { getChatGPTUser } from '../../chatgpt-auth';
import { readPrivate } from '../../../lib/private-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RecordLead={date:string;source:string;quality:boolean};
type Report={fromDate:string;throughDate:string;people:{records:RecordLead[]}[]};

export async function GET(request:Request) {
  if (!await getChatGPTUser()) return Response.json({error:'Cần đăng nhập.'},{status:401,headers:{'Cache-Control':'no-store'}});
  const params=new URL(request.url).searchParams;
  const since=params.get('since')||'';
  const until=params.get('until')||'';
  const channel=params.get('channel')||'';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)||!/^\d{4}-\d{2}-\d{2}$/.test(until)||since>until||!['facebook','google'].includes(channel)) {
    return Response.json({error:'Khoảng thời gian hoặc nguồn không hợp lệ.'},{status:400,headers:{'Cache-Control':'no-store'}});
  }
  const report=await readPrivate<Report|null>('labcos/sale-lead-report.json',null);
  if(!report)return Response.json({error:'Chưa chuyển báo cáo Sale Lead Report sang Vercel.'},{status:503,headers:{'Cache-Control':'private, no-store'}});
  const covered=since>=report.fromDate&&until<=report.throughDate;
  const rows=covered?report.people.flatMap(person=>person.records).filter(item=>item.date>=since&&item.date<=until&&(channel==='facebook'?item.source.trim().toLowerCase()==='facebook':item.source.trim().toLowerCase().startsWith('google'))):[];
  return Response.json({covered,leads:rows.length,qualityLeads:rows.filter(item=>item.quality).length,sourceThroughDate:report.throughDate},{headers:{'Cache-Control':'private, no-store'}});
}
