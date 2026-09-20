'use client';

import { useEffect, useState } from 'react';
import { PenLine, MessageCircle, Mail, Search, Info, Activity } from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import { useDashboard } from '@/store';
import type { ActivityEntry } from '@/types';

const ACTION_FILTERS = [
  { key: '', label: 'Tất cả hoạt động' },
  { key: 'post', label: 'Đăng bài' },
  { key: 'engage', label: 'Tương tác' },
  { key: 'discover', label: 'Tìm lead' },
  { key: 'send', label: 'Gửi email' },
  { key: 'triage', label: 'Phân loại' },
  { key: 'research', label: 'Nghiên cứu' },
];

export default function ActivityPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [filter, setFilter] = useState('');
  const { realOnly } = useDashboard();

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter) params.set('action', filter);
    params.set('limit', '200');
    if (realOnly) params.set('real', 'true');
    fetch(`/api/activity?${params}`).then(r => r.json()).then(setEntries).catch(() => {});
  }, [filter, realOnly]);

  return (
    <div className="space-y-6 animate-in">
      <div className="panel">
        <div className="panel-header flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-semibold">Nhật ký hoạt động</h1>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-ghost text-xs"
              onClick={() => {
                const params = new URLSearchParams();
                if (filter) params.set('action', filter);
                params.set('limit', '500');
                if (realOnly) params.set('real', 'true');
                params.set('format', 'csv');
                window.open(`/api/activity?${params.toString()}`, '_blank', 'noopener,noreferrer');
              }}
            >
              Xuất CSV
            </button>
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
            >
              {ACTION_FILTERS.map(f => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-body space-y-0">
          {entries.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Chưa có hoạt động được ghi nhận
            </div>
          ) : (
            groupByDay(entries).map(group => (
              <div key={group.day}>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground py-2">
                  {group.day}
                </div>
                {group.items.map((entry, i) => (
                  <div
                    key={entry.id}
                    className={`flex items-start gap-4 py-3 ${
                      i < group.items.length - 1 ? 'border-b border-border/30' : ''
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <ActionIcon action={entry.action} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {entry.action && (
                            <span className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded-full ${severityClass(entry.action)}`}>
                              {entry.action}
                            </span>
                          )}
                          <span className="text-sm">{entry.detail || '\u2014'}</span>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {timeAgo(entry.ts)}
                        </span>
                      </div>
                      {entry.result && (
                        <p className="text-xs text-success mt-1">{entry.result}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ActionIcon({ action }: { action: string | null }) {
  const size = 14;
  const iconMap: Record<string, React.ReactNode> = {
    post: <PenLine size={size} />,
    engage: <MessageCircle size={size} />,
    send: <Mail size={size} />,
    discover: <Search size={size} />,
    research: <Search size={size} />,
    triage: <Activity size={size} />,
  };
  return <>{iconMap[action || ''] || <Info size={size} />}</>;
}

function severityClass(action: string) {
  const type = action.toLowerCase();
  if (type.includes('fail') || type.includes('error') || type.includes('reject')) {
    return 'bg-destructive/15 text-destructive';
  }
  if (type.includes('warn') || type.includes('triage')) {
    return 'bg-warning/15 text-warning';
  }
  if (type.includes('discover') || type.includes('research')) {
    return 'bg-info/15 text-info';
  }
  return 'bg-primary/10 text-primary';
}

function groupByDay(items: ActivityEntry[]) {
  const groups: { day: string; items: ActivityEntry[] }[] = [];
  const byDay = new Map<string, ActivityEntry[]>();
  for (const entry of items) {
    const day = entry.ts ? new Date(entry.ts).toLocaleDateString('vi-VN') : 'Không rõ ngày';
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(entry);
  }
  for (const [day, groupItems] of byDay.entries()) {
    groups.push({ day, items: groupItems });
  }
  return groups;
}
