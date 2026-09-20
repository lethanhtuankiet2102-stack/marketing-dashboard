'use client';

import { useEffect, useState } from 'react';
import {
  PenLine, MessageCircle, Mail, Users, AlertTriangle, Info, AlertCircle,
  Bell, ThumbsUp, ThumbsDown, Loader2, Zap,
  CheckCircle, Search, Send,
} from 'lucide-react';
import Link from 'next/link';
import { StatCard } from '@/components/ui/stat-card';
import { TrendChart } from '@/components/ui/trend-chart';
import { useSmartPoll } from '@/hooks/use-smart-poll';
import { useDashboard } from '@/store';
import { timeAgo } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import type { OverviewStats, Alert, ActivityEntry, DailyMetrics } from '@/types';
import { PipelineFunnel } from '@/components/pipeline/pipeline-funnel';
import { AgentSessions } from '@/components/sessions/agent-sessions';
import { ContentCalendar } from '@/components/content/content-calendar';

interface AgentBrief {
  id: string;
  name: string;
  emoji: string;
  status: string;
  model: string;
  last_action?: string;
  last_action_at?: string;
  actions_today: number;
  next_job?: string;
  next_job_time?: string;
}

interface ActionItem {
  id: string;
  type: 'content' | 'sequence';
  title: string;
  subtitle: string;
  tier?: string;
  created_at: string;
}

interface XBudget {
  date: string;
  calls: number;
  posts: number;
  daily_search_limit: number;
  daily_post_limit: number;
  search_remaining: number;
  post_remaining: number;
}

interface OverviewData {
  stats: OverviewStats;
  alerts: Alert[];
  recentActivity: ActivityEntry[];
  metrics: DailyMetrics[];
  agents?: AgentBrief[];
  action_items?: ActionItem[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.json() as { error?: string };
      detail = payload?.error ? `: ${payload.error}` : '';
    } catch {
      // Ignore non-JSON error bodies.
    }
    throw new Error(`${response.status} ${response.statusText}${detail}`);
  }
  return response.json() as Promise<T>;
}

type Role = 'admin' | 'editor' | 'viewer';

interface CycleTimeBenchmarkPayload {
  metric: string;
  days: number;
  baseline_mode: 'rolling_window' | 'launch_anchored';
  window: {
    before: { start: string; end: string };
    after: { start: string; end: string };
    now: string;
    launch_at: string | null;
  };
  before: { n: number; medianHours: number | null; p90Hours: number | null };
  after: { n: number; medianHours: number | null; p90Hours: number | null };
  delta: { median_pct: number | null; p90_pct: number | null };
}

export default function OverviewPage() {
  const { realOnly } = useDashboard();
  const realParam = realOnly ? '?real=true' : '';
  const [refreshKey, setRefreshKey] = useState(0);
  const [role, setRole] = useState<Role>('viewer');

  const { data, loading, error: overviewError } = useSmartPoll<OverviewData>(
    () => fetchJson<OverviewData>(`/api/overview${realParam}`),
    { interval: 30_000, key: `${realOnly}-${refreshKey}` },
  );

  const { data: budget } = useSmartPoll<XBudget>(
    () => fetchJson<XBudget>('/api/x-budget'),
    { interval: 60_000 },
  );

  const { data: cycleBenchmark } = useSmartPoll<CycleTimeBenchmarkPayload>(
    () => fetchJson<CycleTimeBenchmarkPayload>(`/api/benchmarks/cycle-time?days=30${realOnly ? '&real=true' : ''}`),
    { interval: 300_000, key: `cycle-${realOnly}` },
  );

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((payload) => setRole(payload?.user?.role === 'admin' || payload?.user?.role === 'editor' ? payload.user.role : 'viewer'))
      .catch(() => setRole('viewer'));
  }, []);

  // Start sync service once
  useEffect(() => { fetch('/api/sync').catch(() => {}); }, []);

  if (overviewError && !data) {
    return <DashboardLoadError message={overviewError.message} />;
  }

  if (!data || loading) {
    return <PageSkeleton />;
  }

  if (!data.stats) {
    return <DashboardLoadError message="The overview API returned an unexpected response." />;
  }

  const stats = data.stats;
  const alerts = Array.isArray(data.alerts) ? data.alerts : [];
  const recentActivity = Array.isArray(data.recentActivity) ? data.recentActivity : [];
  const metrics = Array.isArray(data.metrics) ? data.metrics : [];
  const agents = Array.isArray(data.agents) ? data.agents : undefined;
  const action_items = Array.isArray(data.action_items) ? data.action_items : undefined;
  const canEdit = role === 'admin' || role === 'editor';

  const metricsReversed = [...metrics].reverse();
  const impressionData = metricsReversed.map(m => ({ date: m.date, value: m.total_impressions }));
  const engagementData = metricsReversed.map(m => ({ date: m.date, value: m.total_engagement }));
  const sendsData = metricsReversed.map(m => ({ date: m.date, value: m.sends }));
  const discoveryData = metricsReversed.map(m => ({ date: m.date, value: m.discoveries }));

  return (
    <div className="space-y-6 animate-in">
      <div className="panel">
        <div className="panel-header">
          <h1 className="text-xl font-semibold">Overview</h1>
        </div>
      </div>

      {/* Agent Status Strip */}
      {agents && agents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {agents.map(agent => (
            <Link key={agent.id} href="/agents/squads" className="panel card-hover p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-lg shrink-0">
                {agent.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{agent.name}</span>
                  <span className={`w-2 h-2 rounded-full ${
                    agent.status === 'active' ? 'bg-success' :
                    agent.status === 'idle' ? 'bg-warning' :
                    agent.status === 'error' ? 'bg-destructive' : 'bg-muted-foreground'
                  }`} />
                  <span className="text-[10px] text-muted-foreground capitalize">{agent.status}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="font-mono">{agent.actions_today} actions today</span>
                  {agent.last_action_at && (
                    <span className="truncate">Last: {timeAgo(agent.last_action_at)}</span>
                  )}
                </div>
              </div>
              {agent.next_job && (
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-muted-foreground">Next</div>
                  <div className="text-xs font-medium">{agent.next_job}</div>
                  {agent.next_job_time && (
                    <div className="text-[10px] text-muted-foreground font-mono">{agent.next_job_time}</div>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* X API Budget + Action Items row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* X API Budget Widget */}
        {budget && !('error' in budget) && (
          <div className="panel">
            <div className="panel-header">
              <h3 className="section-title flex items-center gap-2">
              <Search size={14} />
              X API Budget
              <span className="text-[10px] text-muted-foreground font-mono ml-auto">{budget.date}</span>
              </h3>
            </div>
            <div className="panel-body space-y-3">
              <BudgetBar
                label="Search"
                used={budget.calls}
                limit={budget.daily_search_limit}
                icon={<Search size={12} />}
              />
              <BudgetBar
                label="Posts"
                used={budget.posts}
                limit={budget.daily_post_limit}
                icon={<Send size={12} />}
              />
            </div>
          </div>
        )}

        {/* Action Items — pending approvals */}
        {action_items && action_items.length > 0 && (
          <div className="panel lg:col-span-2">
            <div className="panel-header flex items-center justify-between">
              <h3 className="section-title flex items-center gap-2">
                <Zap size={14} className="text-warning" />
                Action Items
                <span className="text-[10px] bg-warning/15 text-warning px-2 py-0.5 rounded-full font-semibold">
                  {action_items.length}
                </span>
              </h3>
              <div className="flex gap-2">
                <Link
                  href="/content"
                  className="text-[10px] text-primary hover:underline"
                >
                  Content Queue
                </Link>
                <Link
                  href="/outreach"
                  className="text-[10px] text-primary hover:underline"
                >
                  Outreach Approvals
                </Link>
              </div>
            </div>
            <div className="panel-body space-y-2 max-h-64 overflow-y-auto">
              {action_items.map(item => (
                <ActionItemCard
                  key={item.id}
                  item={item}
                  canEdit={canEdit}
                  onAction={() => setRefreshKey(k => k + 1)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Posts Today"
          value={stats.posts_today}
          icon={PenLine}
          sparkline={impressionData.slice(-14).map(d => ({ value: d.value }))}
          color="var(--primary)"
        />
        <StatCard
          label="Engagements Today"
          value={stats.engagement_today}
          icon={MessageCircle}
          sparkline={engagementData.slice(-14).map(d => ({ value: d.value }))}
          color="var(--success)"
        />
        <StatCard
          label="Emails Sent"
          value={stats.emails_sent}
          icon={Mail}
          sparkline={sendsData.slice(-14).map(d => ({ value: d.value }))}
          color="var(--warning)"
        />
        <StatCard
          label="Pipeline"
          value={stats.pipeline_count}
          icon={Users}
          sparkline={discoveryData.slice(-14).map(d => ({ value: d.value }))}
          color="var(--info)"
        />
      </div>

      <CycleTimeBenchmarkPanel data={cycleBenchmark || undefined} />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel">
          <div className="panel-header">
            <h3 className="section-title">Impressions (12 weeks)</h3>
          </div>
          <div className="panel-body">
          <TrendChart
            data={metricsReversed.map(m => ({ date: m.date.slice(5), impressions: m.total_impressions }))}
            xKey="date"
            lines={[{ key: 'impressions', color: 'var(--primary)', label: 'Impressions' }]}
          />
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">
            <h3 className="section-title">Engagement & Sends (12 weeks)</h3>
          </div>
          <div className="panel-body">
          <TrendChart
            data={metricsReversed.map(m => ({
              date: m.date.slice(5),
              engagement: m.total_engagement,
              sends: m.sends,
            }))}
            xKey="date"
            lines={[
              { key: 'engagement', color: 'var(--success)', label: 'Engagement' },
              { key: 'sends', color: 'var(--warning)', label: 'Sends' },
            ]}
          />
          </div>
        </div>
      </div>

      {/* Pipeline + Sessions + Content row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PipelineFunnel />
        <ContentCalendar />
        <AgentSessions />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity Feed */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="section-title">Recent Activity</h3>
          </div>
          <div className="panel-body space-y-2 max-h-80 overflow-y-auto">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet</p>
            ) : (
              recentActivity.map(entry => (
                <div key={entry.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
                    <ActionIcon action={entry.action} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{entry.detail || entry.action}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(entry.ts)}</p>
                  </div>
                  {entry.result && (
                    <span className="text-xs text-success">{entry.result}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Alerts */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="section-title">Alerts</h3>
          </div>
          <div className="panel-body space-y-2">
            {alerts.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
                <CheckCircle size={16} className="mr-2 text-success" />
                All clear
              </div>
            ) : (
              alerts.map(alert => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 p-3 rounded-lg ${
                    alert.type === 'error' ? 'bg-destructive/10' :
                    alert.type === 'warning' ? 'bg-warning/10' :
                    'bg-info/10'
                  }`}
                >
                  {alert.type === 'error' && <AlertCircle size={16} className="text-destructive mt-0.5" />}
                  {alert.type === 'warning' && <AlertTriangle size={16} className="text-warning mt-0.5" />}
                  {alert.type === 'info' && <Info size={16} className="text-info mt-0.5" />}
                  <p className="text-sm">{alert.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BudgetBar({ label, used, limit, icon }: { label: string; used: number; limit: number; icon: React.ReactNode }) {
  const pct = Math.min(100, (used / limit) * 100);
  const isHigh = pct >= 80;
  const isDepleted = pct >= 100;

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className={`font-mono font-medium ${isDepleted ? 'text-destructive' : isHigh ? 'text-warning' : ''}`}>
          {used}/{limit}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isDepleted ? 'bg-destructive' : isHigh ? 'bg-warning' : 'bg-primary'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function formatHours(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (value < 1) return `${Math.round(value * 60)}m`;
  return `${value.toFixed(1)}h`;
}

function formatDelta(deltaPct: number | null): string {
  if (deltaPct === null || !Number.isFinite(deltaPct)) return '—';
  const rounded = Math.round(deltaPct * 10) / 10;
  const prefix = rounded > 0 ? '+' : '';
  return `${prefix}${rounded}%`;
}

function CycleTimeBenchmarkPanel({ data }: { data?: CycleTimeBenchmarkPayload }) {
  if (!data) return null;
  const improveCls = (data.delta.median_pct ?? -1) >= 0 ? 'text-success' : 'text-warning';

  return (
    <div className="panel">
      <div className="panel-header flex items-center justify-between">
        <h3 className="section-title">Lead → Approved Campaign Cycle Time</h3>
        <span className="text-[10px] text-muted-foreground font-mono">
          {data.baseline_mode === 'launch_anchored' ? 'launch anchored' : `rolling ${data.days}d`}
        </span>
      </div>
      <div className="panel-body space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card p-4">
            <div className="text-xs text-muted-foreground">Before median</div>
            <div className="text-lg font-mono font-semibold mt-1">{formatHours(data.before.medianHours)}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-muted-foreground">After median</div>
            <div className="text-lg font-mono font-semibold mt-1">{formatHours(data.after.medianHours)}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-muted-foreground">Before p90</div>
            <div className="text-lg font-mono font-semibold mt-1">{formatHours(data.before.p90Hours)}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-muted-foreground">After p90</div>
            <div className="text-lg font-mono font-semibold mt-1">{formatHours(data.after.p90Hours)}</div>
          </div>
        </div>

        <div className="card p-4 text-sm flex flex-wrap items-center justify-between gap-2">
          <div className="text-muted-foreground">
            n before <span className="font-mono text-foreground">{data.before.n}</span> · n after <span className="font-mono text-foreground">{data.after.n}</span>
          </div>
          <div className={`font-mono ${improveCls}`}>
            median {formatDelta(data.delta.median_pct)} · p90 {formatDelta(data.delta.p90_pct)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionItemCard({ item, onAction, canEdit }: { item: ActionItem; onAction: () => void; canEdit: boolean }) {
  const [acting, setActing] = useState<string | null>(null);

  async function handleAction(action: 'approve' | 'reject') {
    if (!canEdit) return;
    setActing(action);
    try {
      if (item.type === 'content') {
        await fetch('/api/content', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, status: action === 'approve' ? 'ready' : 'rejected' }),
        });
      } else {
        await fetch('/api/sequences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, status: action === 'approve' ? 'approved' : 'cancelled' }),
        });
      }
      toast.success(action === 'approve' ? 'Approved' : 'Rejected');
      onAction();
    } catch {
      toast.error('Failed to update');
    }
    setActing(null);
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${
      item.type === 'content' ? 'bg-primary/5' : 'bg-warning/5'
    }`}>
      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
        {item.type === 'content' ? <PenLine size={14} /> : <Mail size={14} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium truncate">{item.title}</span>
          {item.tier && (
            <span className="text-[9px] bg-muted px-1 rounded">Tier {item.tier}</span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
      </div>
      {canEdit ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => handleAction('approve')}
            disabled={acting !== null}
            className="flex items-center gap-1 text-[10px] font-medium bg-success/15 text-success hover:bg-success/25 px-2 py-1 rounded transition-colors disabled:opacity-50"
          >
            {acting === 'approve' ? <Loader2 size={10} className="animate-spin" /> : <ThumbsUp size={10} />}
          </button>
          <button
            onClick={() => handleAction('reject')}
            disabled={acting !== null}
            className="flex items-center gap-1 text-[10px] font-medium bg-destructive/15 text-destructive hover:bg-destructive/25 px-2 py-1 rounded transition-colors disabled:opacity-50"
          >
            {acting === 'reject' ? <Loader2 size={10} className="animate-spin" /> : <ThumbsDown size={10} />}
          </button>
        </div>
      ) : (
        <span className="text-[10px] text-muted-foreground shrink-0">read-only</span>
      )}
    </div>
  );
}

function ActionIcon({ action }: { action: string | null }) {
  const size = 12;
  switch (action) {
    case 'post': return <PenLine size={size} />;
    case 'engage': return <MessageCircle size={size} />;
    case 'send': return <Mail size={size} />;
    case 'alert': return <Bell size={size} />;
    default: return <Info size={size} />;
  }
}

function DashboardLoadError({ message }: { message: string }) {
  return (
    <div className="panel p-6 max-w-2xl">
      <h1 className="text-xl font-semibold">Dashboard unavailable</h1>
      <p className="text-sm text-muted-foreground mt-2">
        The dashboard API could not be loaded. This page will retry automatically.
      </p>
      <pre className="mt-4 p-3 rounded-lg bg-muted/40 text-xs overflow-x-auto">{message}</pre>
      <a href="/login" className="inline-block mt-4 text-sm text-primary hover:underline">
        Sign in again
      </a>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-in">
      <h1 className="text-xl font-semibold">Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2].map(i => (
          <div key={i} className="panel p-4 h-20 animate-pulse bg-muted/20" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="panel p-4 h-32 animate-pulse bg-muted/20" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2].map(i => (
          <div key={i} className="panel p-4 h-64 animate-pulse bg-muted/20" />
        ))}
      </div>
    </div>
  );
}
