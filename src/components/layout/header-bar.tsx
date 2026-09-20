'use client';

import {
  Activity, Search, Sun, Moon, Radio, PenLine, Mail, Users, LogOut,
  Bell, Eye, EyeOff, Check, CheckCheck,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '@/store';
import { useSmartPoll } from '@/hooks/use-smart-poll';
import { timeAgo } from '@/lib/utils';
import type { Notification } from '@/types';

interface HeaderCrmData {
  summary: { total: number; emails_sent: number; conversion_rate: number; };
}

export function HeaderBar() {
  const { feedOpen, toggleFeed, realOnly, toggleRealOnly } = useDashboard();

  const { data: crm } = useSmartPoll<HeaderCrmData>(
    () => fetch(`/api/crm${realOnly ? '?real=true' : ''}`).then(r => r.json()),
    { interval: 60_000, key: realOnly },
  );
  const stats = crm?.summary;

  return (
    <header className="fixed top-0 left-0 right-0 h-[var(--header-height)] bg-card/90 backdrop-blur-sm border-b border-border/70 flex items-center justify-between px-3 sm:px-4 z-50">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-primary/20 flex items-center justify-center">
          <span className="text-primary font-bold text-xs">L</span>
        </div>
        <span className="font-semibold text-sm tracking-tight">CRM Labcos</span>

        {/* Quick stats — hidden on small screens */}
        {stats && (
          <div className="hidden lg:flex items-center gap-2.5 ml-2.5 pl-2.5 border-l border-border/30">
            <QuickStat icon={Users} value={stats.total} label="lead" />
            <QuickStat icon={Mail} value={stats.emails_sent} label="email" />
            <QuickStat icon={Activity} value={stats.conversion_rate} label="phản hồi" suffix="%" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <SeedToggle active={realOnly} onToggle={toggleRealOnly} />
        <SearchTrigger />
        <NotificationBell />
        <ThemeToggle />
        <FeedToggle open={feedOpen} onToggle={toggleFeed} />
        <SyncStatus />
        <LogoutButton />
      </div>
    </header>
  );
}

function QuickStat({ icon: Icon, value, label, suffix = '' }: { icon: typeof PenLine; value: number; label: string; suffix?: string }) {
  return (
    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
      <Icon size={11} />
      <span className="font-mono font-medium text-foreground">{value}{suffix}</span>
      <span>{label}</span>
    </div>
  );
}

function SeedToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      className={`h-7 flex items-center gap-1.5 px-2.5 rounded-md text-[11px] font-medium transition-colors ${
        active
          ? 'bg-success/15 text-success border border-success/30'
          : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-border/30'
      }`}
      onClick={onToggle}
      title={active ? 'Chỉ hiển thị dữ liệu thật' : 'Hiển thị cả dữ liệu mẫu'}
    >
      {active ? <Eye size={13} /> : <EyeOff size={13} />}
      <span className="hidden sm:inline">{active ? 'Thật' : 'Tất cả'}</span>
    </button>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const realOnly = useDashboard(s => s.realOnly);

  const { data: notifications, refetch } = useSmartPoll<Notification[]>(
    () => fetch(`/api/notifications?limit=20${realOnly ? '&real=true' : ''}`).then(r => r.json()),
    { interval: 30_000, key: realOnly },
  );

  const unreadCount = notifications?.filter(n => !n.read).length ?? 0;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function markRead(id: number) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    refetch();
  }

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_all_read: true }),
    });
    refetch();
  }

  const SEVERITY_COLORS = {
    info: 'text-primary',
    warning: 'text-warning',
    error: 'text-destructive',
  };

  return (
    <div className="relative" ref={ref}>
      <button
      className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors relative ${
        open ? 'bg-primary/15 text-primary' : 'hover:bg-muted text-muted-foreground hover:text-foreground'
      }`}
        onClick={() => setOpen(!open)}
        title="Thông báo"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[9px] font-bold rounded-full count-badge flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 card border shadow-lg max-h-96 overflow-hidden flex flex-col animate-slide-in z-50">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30">
            <span className="text-sm font-medium">Thông báo</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <CheckCheck size={12} /> Đánh dấu đã đọc
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {(!notifications || notifications.length === 0) ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <Bell size={24} className="mx-auto mb-2 opacity-30" />
                Chưa có thông báo
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-border/20 hover:bg-muted/30 transition-colors ${
                    !n.read ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 ${SEVERITY_COLORS[n.severity] || 'text-muted-foreground'}`}>
                      <Bell size={12} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {n.title && (
                        <div className="text-xs font-medium truncate">{n.title}</div>
                      )}
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{n.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                        {!n.read && (
                          <button
                            onClick={() => markRead(n.id)}
                            className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                          >
                            <Check size={10} /> Read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchTrigger() {
  return (
    <button
      className="hidden md:flex items-center gap-2 h-7 px-3 rounded-md bg-muted/55 hover:bg-muted border border-border/30 text-xs text-muted-foreground transition-colors"
      onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
    >
      <Search size={13} />
      <span className="hidden sm:inline">Tìm kiếm</span>
      <kbd className="hidden sm:inline text-[10px] bg-muted px-1 py-0.5 rounded ml-1">⌘K</kbd>
    </button>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const currentTheme = theme === 'dark' ? 'dark' : 'light';

  return (
    <button
      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      onClick={() => setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
      title={`Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {currentTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function FeedToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
        open
          ? 'bg-primary/15 text-primary'
          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
      }`}
      onClick={onToggle}
      title="Mở luồng hoạt động"
    >
      <Radio size={16} />
    </button>
  );
}

function SyncStatus() {
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <div className="w-2 h-2 rounded-full bg-success pulse-dot" />
      <Activity size={12} />
      <span className="font-mono">{lastSync}</span>
    </div>
  );
}

function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
      onClick={handleLogout}
      disabled={loading}
      title="Đăng xuất"
    >
      <LogOut size={15} />
    </button>
  );
}
