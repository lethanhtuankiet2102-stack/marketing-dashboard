'use client';

import { useEffect, useState, useCallback } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { FunnelChart } from '@/components/ui/funnel-chart';
import { ApprovalCard } from '@/components/ui/approval-card';
import { formatDateTime, STATUS_LABELS } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import { useDashboard } from '@/store';
import type { Lead, Chuỗi, FunnelBước, Loại trừ } from '@/types';

type Tab = 'pipeline' | 'leads' | 'sequences' | 'approvals' | 'suppression';

export default function OutreachPage() {
  const [leads, setLead] = useState<Lead[]>([]);
  const [funnel, setFunnel] = useState<FunnelBước[]>([]);
  const [sequences, setChuỗi email] = useState<Chuỗi[]>([]);
  const [pendingChờ duyệt, setPendingChờ duyệt] = useState<Chuỗi[]>([]);
  const [suppression, setLoại trừ] = useState<Loại trừ[]>([]);
  const [tab, setTab] = useState<Tab>('pipeline');
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setTrạng tháiFilter] = useState('');
  const { realOnly } = useDashboard();

  const load = useCallback(() => {
    const realParam = realOnly ? '&real=true' : '';
    fetch(`/api/outreach?_=1${realParam}`).then(r => r.json()).then(data => {
      setLead(data.leads || []);
      setFunnel(data.funnel || []);
      setPendingChờ duyệt(data.pendingChờ duyệt || []);
    }).catch(() => {});
    const realParam2 = realOnly ? '?real=true' : '';
    fetch(`/api/sequences${realParam2}`).then(r => r.json()).then(setChuỗi email).catch(() => {});
    fetch(`/api/suppression${realParam2}`).then(r => r.json()).then(setLoại trừ).catch(() => {});
  }, [realOnly]);

  useEffect(() => { load(); }, [load]);

  const updateLeadTrạng thái = async (id: string, status: string) => {
    try {
      await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Loại': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      toast.success(`Đã cập nhật trạng thái lead: ${status}`);
      load();
    } catch {
      toast.error('Không thể cập nhật trạng thái lead');
    }
  };

  const updateChuỗiTrạng thái = async (id: string, status: string) => {
    try {
      await fetch('/api/sequences', {
        method: 'PATCH',
        headers: { 'Content-Loại': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      toast.success(status === 'approved' ? 'Email đã được duyệt' : 'Email đã bị từ chối');
      load();
    } catch {
      toast.error('Không thể cập nhật trạng thái email');
    }
  };

  const filteredLead = leads.filter(l => {
    if (tierFilter && l.tier !== tierFilter) return false;
    if (statusFilter && l.status !== statusFilter) return false;
    return true;
  });

  return (
    <div classTên="space-y-6 animate-in">
      <div classTên="flex items-center justify-between flex-wrap gap-3">
        <h1 classTên="text-xl font-semibold">Chăm sóc & Email</h1>
        <div classTên="text-xs text-muted-foreground">
          Lead <span classTên="font-mono text-foreground">{leads.length}</span>
          {' · '}
          Chờ duyệt <span classTên="font-mono text-foreground">{pendingChờ duyệt.length}</span>
          {' · '}
          Loại trừ <span classTên="font-mono text-foreground">{suppression.length}</span>
        </div>
      </div>

      <div classTên="panel">
        <div classTên="panel-body !p-0">
      <div classTên="flex gap-0 border-b border-border overflow-x-auto">
        {([
          { key: 'pipeline' as Tab, label: 'Pipeline' },
          { key: 'leads' as Tab, label: `Lead (${leads.length})` },
          { key: 'sequences' as Tab, label: `Chuỗi email (${sequences.length})` },
          { key: 'approvals' as Tab, label: `Chờ duyệt (${pendingChờ duyệt.length})` },
          { key: 'suppression' as Tab, label: `Loại trừ (${suppression.length})` },
        ]).map(t => (
          <button
            key={t.key}
            classTên={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      </div>
      </div>

      {tab === 'pipeline' && (
        <div classTên="panel">
          <div classTên="panel-header">
            <h3 classTên="section-title">Phễu chuyển đổi lead</h3>
          </div>
          <div classTên="panel-body">
          <FunnelChart steps={funnel} />
          </div>
        </div>
      )}

      {tab === 'leads' && (
        <>
          <div classTên="panel">
            <div classTên="panel-body !p-3 flex gap-3 flex-wrap">
            <select
              classTên="px-3"
              value={tierFilter}
              onChange={e => setTierFilter(e.target.value)}
            >
              <option value="">Tất cả nhóm</option>
              <option value="A">Tier A</option>
              <option value="B">Tier B</option>
              <option value="C">Tier C</option>
            </select>
            <select
              classTên="px-3"
              value={statusFilter}
              onChange={e => setTrạng tháiFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              {["new", "validated", "approved", "contacted", "replied", "interested", "booked", "qualified", "rejected", "disqualified"].map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
              ))}
            </select>
            </div>
          </div>
          <div classTên="panel">
            <div classTên="panel-header">
              <h3 classTên="section-title">Lead</h3>
            </div>
            <div classTên="panel-body !p-0">
              <DataTable
                columns={[
                  { key: 'first_name', label: 'Tên', render: (r: Lead) => (
                    <span classTên="font-medium text-sm">{r.first_name} {r.last_name}</span>
                  )},
                  { key: 'company', label: 'Doanh nghiệp' },
                  { key: 'title', label: 'Chức danh', render: (r: Lead) => (
                    <span classTên="text-xs text-muted-foreground">{r.title}</span>
                  )},
                  { key: 'tier', label: 'Tier', render: (r: Lead) => r.tier ? (
                    <span classTên={`badge ${r.tier === 'A' ? 'badge-success' : r.tier === 'B' ? 'badge-info' : 'badge-neutral'}`}>
                      {r.tier}
                    </span>
                  ) : <span>\u2014</span> },
                  { key: 'status', label: 'Trạng thái', render: (r: Lead) => (
                    <select
                      classTên="px-2 py-0.5 text-xs min-h-[24px]"
                      value={r.status}
                      onChange={e => updateLeadTrạng thái(r.id, e.target.value)}
                    >
                      {["new", "validated", "approved", "contacted", "replied", "interested", "booked", "qualified", "rejected", "disqualified"].map(s => (
                        <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
                      ))}
                    </select>
                  )},
                  { key: 'score', label: 'Điểm', sortable: true, render: (r: Lead) => (
                    <span classTên="font-mono text-xs">{r.score ?? '\u2014'}</span>
                  )},
                  { key: 'source', label: 'Nguồn', render: (r: Lead) => (
                    <span classTên="text-xs text-muted-foreground">{r.source || '\u2014'}</span>
                  )},
                  { key: 'last_touch_at', label: 'Chăm sóc gần nhất', render: (r: Lead) => (
                    <span classTên="text-xs">{formatDateTime(r.last_touch_at)}</span>
                  )},
                ]}
                data={filteredLead}
                keyField="id"
                emptyMessage="Chưa có lead"
              />
            </div>
          </div>
        </>
      )}

      {tab === 'sequences' && (
        <div classTên="panel">
          <div classTên="panel-header">
            <h3 classTên="section-title">Chuỗi email</h3>
          </div>
          <div classTên="panel-body !p-0">
          <DataTable
            columns={[
              { key: 'sequence_name', label: 'Chuỗi' },
              { key: 'lead_id', label: 'Lead', render: (r: Chuỗi) => (
                <span classTên="font-mono text-xs">{r.lead_id?.slice(0, 8)}</span>
              )},
              { key: 'step', label: 'Bước' },
              { key: 'subject', label: 'Tiêu đề', render: (r: Chuỗi) => (
                <span classTên="text-sm max-w-xs truncate block">{r.subject || '\u2014'}</span>
              )},
              { key: 'status', label: 'Trạng thái', render: (r: Chuỗi) => <Badge status={r.status || 'queued'} /> },
              { key: 'tier', label: 'Tier' },
              { key: 'scheduled_for', label: 'Lịch gửi', render: (r: Chuỗi) => (
                <span classTên="text-xs">{formatDateTime(r.scheduled_for)}</span>
              )},
            ]}
            data={sequences}
            keyField="id"
            emptyMessage="Chưa có chuỗi email"
          />
          </div>
        </div>
      )}

      {tab === 'approvals' && (
        <div classTên="space-y-3">
          {pendingChờ duyệt.length === 0 ? (
            <div classTên="panel p-8 text-center text-muted-foreground text-sm">
              Không có email nào đang chờ duyệt
            </div>
          ) : (
            pendingChờ duyệt.map(seq => (
              <ApprovalCard
                key={seq.id}
                id={seq.id}
                title={seq.subject || 'Email chưa có tiêu đề'}
                subtitle={`Bước ${seq.step} \u2014 ${seq.sequence_name || 'Unknown Chuỗi'} \u2014 Tier ${seq.tier || '?'}`}
                body={seq.body || ''}
                status={seq.status || 'pending_approval'}
                meta={`Lịch gửi: ${formatDateTime(seq.scheduled_for)}`}
                onApprove={(id) => updateChuỗiTrạng thái(id, 'approved')}
                onReject={(id) => updateChuỗiTrạng thái(id, 'cancelled')}
              />
            ))
          )}
        </div>
      )}

      {tab === 'suppression' && (
        <div classTên="panel">
          <div classTên="panel-header">
            <h3 classTên="section-title">Loại trừ</h3>
          </div>
          <div classTên="panel-body !p-0">
          <DataTable
            columns={[
              { key: 'email', label: 'Email' },
              { key: 'type', label: 'Loại', render: (r: Loại trừ) => <Badge status={r.type || 'opt_out'} /> },
              { key: 'added_at', label: 'Ngày thêm', render: (r: Loại trừ) => (
                <span classTên="text-xs">{formatDateTime(r.added_at)}</span>
              )},
            ]}
            data={suppression}
            keyField="email"
            emptyMessage="Chưa có email bị loại trừ"
          />
          </div>
        </div>
      )}
    </div>
  );
}
