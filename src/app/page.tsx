'use client';

import Link from 'next/link';
import {
  Users, UserPlus, CalendarCheck, Mail, PenLine, Target, Clock,
  Building2, ArrowRight, Activity, BarChart3, TrendingUp,
} from 'lucide-react';
import { useSmartPoll } from '@/hooks/use-smart-poll';
import { TrendChart } from '@/components/ui/trend-chart';
import { useDashboard } from '@/store';
import { timeAgo, STATUS_LABELS } from '@/lib/utils';
import type {
  Lead, FunnelStep, WeeklyKPI, DailyMetrics, ContentPost, ActivityEntry,
} from '@/types';

interface CrmData {
  leads: Lead[];
  funnel: FunnelStep[];
  summary: {
    total: number;
    avg_score: number;
    tier_breakdown: { tier: string; c: number }[];
    pending_approvals: number;
    emails_sent: number;
    conversion_rate: number;
  };
}

interface KpiData {
  daily: DailyMetrics[];
  weekly: WeeklyKPI[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.json() as { error?: string };
      detail = payload?.error ? `: ${payload.error}` : '';
    } catch {}
    throw new Error(`${response.status} ${response.statusText}${detail}`);
  }
  return response.json() as Promise<T>;
}

export default function LabcosOverviewPage() {
  const realOnly = useDashboard(s => s.realOnly);
  const realQuery = realOnly ? '?real=true' : '';
  const realAmp = realOnly ? '&real=true' : '';

  const { data: crm, loading, error } = useSmartPoll<CrmData>(
    () => fetchJson<CrmData>(`/api/crm${realQuery}`),
    { interval: 30_000, key: realOnly },
  );
  const { data: kpis } = useSmartPoll<KpiData>(
    () => fetchJson<KpiData>(`/api/kpis?weeks=12${realAmp}`),
    { interval: 60_000, key: realOnly },
  );
  const { data: content } = useSmartPoll<ContentPost[]>(
    () => fetchJson<ContentPost[]>(`/api/content${realQuery}`),
    { interval: 60_000, key: realOnly },
  );
  const { data: activity } = useSmartPoll<ActivityEntry[]>(
    () => fetchJson<ActivityEntry[]>(`/api/activity?limit=12${realAmp}`),
    { interval: 45_000, key: realOnly },
  );

  if (error && !crm) {
    return (
      <div className="panel p-6 max-w-2xl">
        <h1 className="text-xl font-semibold">CRM Labcos</h1>
        <p className="text-sm text-muted-foreground mt-2">Không tải được dữ liệu tổng quan. Hệ thống sẽ tự thử lại.</p>
        <pre className="mt-4 p-3 rounded-lg bg-muted/40 text-xs overflow-x-auto">{error.message}</pre>
      </div>
    );
  }
  if (!crm || loading) return <DashboardSkeleton />;

  const leads = Array.isArray(crm.leads) ? crm.leads : [];
  const funnel = Array.isArray(crm.funnel) ? crm.funnel : [];
  const weekly = Array.isArray(kpis?.weekly) ? kpis!.weekly : [];
  const weeklyAsc = [...weekly].reverse();
  const posts = Array.isArray(content) ? content : [];
  const activities = Array.isArray(activity) ? activity : [];

  const stageCount = (name: string) => funnel.find(s => s.name === name)?.value ?? 0;
  const newLeads = stageCount('new');
  const booked = stageCount('booked') + stageCount('qualified');
  const hotLeads = stageCount('interested') + booked;
  const publishedPosts = posts.filter(p => p.status === 'published').length;
  const now = Date.now();
  const dueTasks = leads.filter(l => l.next_action_at)
    .sort((a,b)=>new Date(a.next_action_at as string).getTime()-new Date(b.next_action_at as string).getTime());
  const overdueTasks = dueTasks.filter(l => new Date(l.next_action_at as string).getTime() < now).length;
  const recentLeads = [...leads].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).slice(0,6);

  const sourceMap = new Map<string, number>();
  for (const lead of leads) {
    const source = lead.source?.trim() || 'Chưa xác định';
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
  }
  const sources = [...sourceMap.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count).slice(0,6);
  const maxSource = Math.max(...sources.map(s=>s.count),1);

  return (
    <div className="space-y-5 animate-in">
      <section className="panel overflow-hidden">
        <div className="panel-body relative p-5 sm:p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-info/5 pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-primary font-semibold">CRM LABCOS</div>
              <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Tổng quan khách hàng & tăng trưởng</h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-2xl">Theo dõi lead, pipeline, lịch chăm sóc, email và hiệu quả marketing trong một màn hình.</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/crm" className="btn btn-primary btn-sm"><Users size={14}/> Quản lý khách hàng</Link>
              <Link href="/outreach" className="btn btn-ghost btn-sm">Chăm sóc lead <ArrowRight size={13}/></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard label="Tổng lead" value={crm.summary.total} helper="Toàn bộ pipeline" icon={Users} tone="text-primary bg-primary/15"/>
        <MetricCard label="Lead mới" value={newLeads} helper="Chưa xử lý" icon={UserPlus} tone="text-info bg-info/15"/>
        <MetricCard label="Đã hẹn / tiềm năng" value={booked} helper={hotLeads > booked ? `${hotLeads} lead đang nóng` : 'Lead gần chuyển đổi'} icon={CalendarCheck} tone="text-success bg-success/15"/>
        <MetricCard label="Tỷ lệ phản hồi" value={`${crm.summary.conversion_rate}%`} helper="Sau khi đã liên hệ" icon={TrendingUp} tone="text-warning bg-warning/15"/>
      </section>

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <MiniMetric label="Email đã gửi" value={crm.summary.emails_sent} icon={Mail}/>
        <MiniMetric label="Nội dung đã đăng" value={publishedPosts} icon={PenLine}/>
        <MiniMetric label="Việc quá hạn" value={overdueTasks} icon={Clock} warning={overdueTasks>0}/>
        <MiniMetric label="Điểm lead trung bình" value={crm.summary.avg_score} icon={Target}/>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="panel xl:col-span-2">
          <div className="panel-header flex items-center justify-between">
            <div><h2 className="section-title flex items-center gap-2"><BarChart3 size={14}/> Pipeline khách hàng</h2><p className="text-[11px] text-muted-foreground mt-1">Phân bổ lead theo từng giai đoạn</p></div>
            <Link href="/crm?view=kanban" className="text-xs text-primary hover:underline">Mở Kanban</Link>
          </div>
          <div className="panel-body">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {funnel.filter(s=>!['rejected','disqualified'].includes(s.name)).map(step=>{
                const max=Math.max(...funnel.map(s=>s.value),1);
                const pct=Math.max(4,(step.value/max)*100);
                return (
                  <Link key={step.name} href={`/crm?status=${step.name}`} className="rounded-xl border border-border/50 p-3 hover:border-primary/40 hover:bg-primary/5 transition-colors">
                    <div className="flex items-center justify-between gap-2"><span className="text-[11px] text-muted-foreground">{STATUS_LABELS[step.name]||step.name}</span><span className="font-mono font-semibold">{step.value}</span></div>
                    <div className="h-1.5 bg-muted rounded-full mt-3 overflow-hidden"><div className="h-full bg-primary/70 rounded-full" style={{width:`${pct}%`}}/></div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><h2 className="section-title flex items-center gap-2"><Building2 size={14}/> Nguồn lead</h2></div>
          <div className="panel-body space-y-3">
            {sources.length===0 ? <EmptyText>Chưa có dữ liệu nguồn lead</EmptyText> : sources.map(source=>(
              <div key={source.name}>
                <div className="flex items-center justify-between text-xs mb-1"><span className="truncate text-muted-foreground">{source.name}</span><span className="font-mono">{source.count}</span></div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-info/70 rounded-full" style={{width:`${Math.max(5,(source.count/maxSource)*100)}%`}}/></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><div><h2 className="section-title flex items-center gap-2"><TrendingUp size={14}/> Hiệu suất 12 tuần</h2><p className="text-[11px] text-muted-foreground mt-1">Lead mới và email chăm sóc theo tuần</p></div></div>
        <div className="panel-body">
          {weeklyAsc.length>1 ? <TrendChart data={weeklyAsc.map(w=>({week:w.week,leads:w.leads_added,emails:w.emails_sent}))} xKey="week" lines={[{key:'leads',color:'var(--info)',label:'Lead mới'},{key:'emails',color:'var(--primary)',label:'Email đã gửi'}]}/> : <EmptyText>Chưa đủ dữ liệu để vẽ biểu đồ</EmptyText>}
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="panel">
          <div className="panel-header flex items-center justify-between"><h2 className="section-title flex items-center gap-2"><UserPlus size={14}/> Lead mới gần đây</h2><Link href="/crm" className="text-xs text-primary hover:underline">Xem tất cả</Link></div>
          <div className="panel-body !p-0">
            {recentLeads.length===0 ? <div className="p-6"><EmptyText>Chưa có lead</EmptyText></div> : recentLeads.map(lead=>(
              <Link key={lead.id} href={`/crm?lead=${lead.id}`} className="flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">{(lead.first_name?.[0]||lead.company?.[0]||'L').toUpperCase()}</div>
                <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{[lead.first_name,lead.last_name].filter(Boolean).join(' ')||lead.company||'Lead chưa đặt tên'}</div><div className="text-[11px] text-muted-foreground truncate">{lead.company||'Chưa có doanh nghiệp'} · {lead.source||'Chưa rõ nguồn'}</div></div>
                <div className="text-right shrink-0"><div className="text-[10px] text-primary">{STATUS_LABELS[lead.status]||lead.status}</div><div className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(lead.created_at)}</div></div>
              </Link>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header flex items-center justify-between"><h2 className="section-title flex items-center gap-2"><Clock size={14}/> Lịch chăm sóc</h2><Link href="/crm" className="text-xs text-primary hover:underline">Mở CRM</Link></div>
          <div className="panel-body !p-0">
            {dueTasks.length===0 ? <div className="p-6"><EmptyText>Chưa có lịch chăm sóc</EmptyText></div> : dueTasks.slice(0,6).map(lead=>{
              const overdue=new Date(lead.next_action_at as string).getTime()<now;
              return (
                <Link key={lead.id} href={`/crm?lead=${lead.id}`} className="flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${overdue?'bg-destructive':'bg-warning'}`}/>
                  <div className="flex-1 min-w-0"><div className="text-sm truncate">{[lead.first_name,lead.last_name].filter(Boolean).join(' ')||lead.company||'Lead chưa đặt tên'}</div><div className="text-[11px] text-muted-foreground truncate">{lead.company||'Chưa có doanh nghiệp'}</div></div>
                  <span className={`text-[10px] font-medium ${overdue?'text-destructive':'text-warning'}`}>{timeAgo(lead.next_action_at)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header flex items-center justify-between"><h2 className="section-title flex items-center gap-2"><Activity size={14}/> Hoạt động gần đây</h2><Link href="/activity" className="text-xs text-primary hover:underline">Xem nhật ký</Link></div>
        <div className="panel-body">
          {activities.length===0 ? <EmptyText>Chưa có hoạt động được ghi nhận</EmptyText> : <div className="space-y-0">{activities.slice(0,8).map(entry=>(
            <div key={entry.id} className="flex items-start gap-3 py-2.5 border-b border-border/30 last:border-0">
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center mt-0.5"><Activity size={12} className="text-muted-foreground"/></div>
              <div className="flex-1 min-w-0"><p className="text-sm truncate">{entry.detail||entry.action||'Hoạt động CRM'}</p><p className="text-[11px] text-muted-foreground">{timeAgo(entry.ts)}</p></div>
              {entry.result && <span className="text-[10px] text-success">{entry.result}</span>}
            </div>
          ))}</div>}
        </div>
      </section>
    </div>
  );
}

function MetricCard({label,value,helper,icon:Icon,tone}:{label:string;value:number|string;helper:string;icon:typeof Users;tone:string}) {
  return <div className="card card-hover p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-semibold font-mono mt-1">{typeof value==='number'?value.toLocaleString('vi-VN'):value}</p><p className="text-[10px] text-muted-foreground mt-1">{helper}</p></div><div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}><Icon size={18}/></div></div></div>;
}
function MiniMetric({label,value,icon:Icon,warning=false}:{label:string;value:number;icon:typeof Mail;warning?:boolean}) {
  return <div className="panel p-3.5 flex items-center gap-3"><div className={`w-8 h-8 rounded-lg flex items-center justify-center ${warning?'bg-destructive/15 text-destructive':'bg-muted text-muted-foreground'}`}><Icon size={15}/></div><div><div className="text-lg font-semibold font-mono">{value.toLocaleString('vi-VN')}</div><div className="text-[10px] text-muted-foreground">{label}</div></div></div>;
}
function EmptyText({children}:{children:React.ReactNode}) { return <div className="text-sm text-muted-foreground text-center py-5">{children}</div>; }
function DashboardSkeleton() {
  return <div className="space-y-5 animate-in"><div className="panel h-32 animate-pulse bg-muted/20"/><div className="grid grid-cols-2 xl:grid-cols-4 gap-3">{[1,2,3,4].map(i=><div key={i} className="panel h-28 animate-pulse bg-muted/20"/>)}</div><div className="grid grid-cols-1 xl:grid-cols-3 gap-4"><div className="panel xl:col-span-2 h-64 animate-pulse bg-muted/20"/><div className="panel h-64 animate-pulse bg-muted/20"/></div></div>;
}
