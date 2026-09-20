'use client';

import { useEffect, useState, useCallback } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { FunnelChart } from '@/components/ui/funnel-chart';
import { ApprovalCard } from '@/components/ui/approval-card';
import { formatDateTime, STATUS_LABELS } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import { useDashboard } from '@/store';
import type { Lead, Sequence, FunnelStep, Suppression } from '@/types';

type Tab = 'pipeline' | 'leads' | 'sequences' | 'approvals' | 'suppression';

export default function OutreachPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Sequence[]>([]);
  const [suppression, setSuppression] = useState<Suppression[]>([]);
  const [tab, setTab] = useState<Tab>('pipeline');
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { realOnly } = useDashboard();

  const load = useCallback(() => {
    const realParam = realOnly ? '&real=true' : '';
    fetch(`/api/outreach?_=1${realParam}`).then(r => r.json()).then(data => {
      setLeads(data.leads || []);
      setFunnel(data.funnel || []);
      setPendingApprovals(data.pendingApprovals || []);
    }).catch(() => {});
    const realParam2 = realOnly ? '?real=true' : '';
    fetch(`/api/sequences${realParam2}`).then(r => r.json()).then(setSequences).catch(() => {});
    fetch(`/api/suppression${realParam2}`).then(r => r.json()).then(setSuppression).catch(() => {});
  }, [realOnly]);

  useEffect(() => { load(); }, [load]);

  const updateLeadStatus = async (id: string, status: string) => {
    try {
      await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      toast.success(`Đã cập nhật trạng thái lead: ${status}`);
      load();
    } catch {
      toast.error('Không thể cập nhật trạng thái lead');
    }
  };

  const updateSequenceStatus = async (id: string, status: string) => {
    try {
      await fetch('/api/sequences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      toast.success(status === 'approved' ? 'Email đã được duyệt' : 'Email đã bị từ chối');
      load();
    } catch {
      toast.error('Không thể cập nhật trạng thái email');
    }
  };

  const filteredLeads = leads.filter(l => {
    if (tierFilter && l.tier !== tierFilter) return false;
    if (statusFilter && l.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Chăm sóc & Email</h1>
        <div className="text-xs text-muted-foreground">
          Lead <span className="font-mono text-foreground">{leads.length}</span>
          {' · '}
          Chờ duyệt <span className="font-mono text-foreground">{pendingApprovals.length}</span>
          {' · '}
          Loại trừ <span className="font-mono text-foreground">{suppression.length}</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-body !p-0">
      <div className="flex gap-0 border-b border-border overflow-x-auto">
        {([
          { key: 'pipeline' as Tab, label: 'Pipeline' },
          { key: 'leads' as Tab, label: `Lead (${leads.length})` },
          { key: 'sequences' as Tab, label: `Chuỗi email (${sequences.length})` },
          { key: 'approvals' as Tab, label: `Chờ duyệt (${pendingApprovals.length})` },
          { key: 'suppression' as Tab, label: `Loại trừ (${suppression.length})` },
        ]).map(t => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      </div>
      </div>

      {tab === 'pipeline' && (
        <div className="panel">
          <div className="panel-header">
            <h3 className="section-title">Phễu chuyển đổi lead</h3>
          </div>
          <div className="panel-body">
          <FunnelChart steps={funnel} />
          </div>
        </div>
      )}

      {tab === 'leads' && (
        <>
          <div className="panel">
            <div className="panel-body !p-3 flex gap-3 flex-wrap">
            <select
              className="px-3"
              value={tierFilter}
              onChange={e => setTierFilter(e.target.value)}
            >
              <option value="">Tất cả nhóm</option>
              <option value="A">Tier A</option>
              <option value="B">Tier B</option>
              <option value="C">Tier C</option>
            </select>
            <select
              className="px-3"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              {["new", "validated", "approved", "contacted", "replied", "interested", "booked", "qualified", "rejected", "disqualified"].map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
              ))}
            </select>
            </div>
          </div>
          <div className="panel">
            <div className="panel-header">
              <h3 className="section-title">Danh sách lead</h3>
            </div>
            <div className="panel-body !p-0">
              <DataTable
                columns={[
                  { key: 'first_name', label: 'Tên', render: (r: Lead) => (
                    <span className="font-medium text-sm">{r.first_name} {r.last_name}</span>
                  )},
                  { key: 'company', label: 'Doanh nghiệp' },
                  { key: 'title', label: 'Chức danh', render: (r: Lead) => (
                    <span className="text-xs text-muted-foreground">{r.title}</span>
                  )},
                  { key: 'tier', label: 'Tier', render: (r: Lead) => r.tier ? (
                    <span className={`badge ${r.tier === 'A' ? 'badge-success' : r.tier === 'B' ? 'badge-info' : 'badge-neutral'}`}>
                      {r.tier}
                    </span>
                  ) : <span>\u2014</span> },
                  { key: 'status', label: 'Trạng thái', render: (r: Lead) => (
                    <select
                      className="px-2 py-0.5 text-xs min-h-[24px]"
                      value={r.status}
                      onChange={e => updateLeadStatus(r.id, e.target.value)}
                    >
                      {["new", "validated", "approved", "contacted", "replied", "interested", "booked", "qualified", "rejected", "disqualified"].map(s => (
                        <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
                      ))}
                    </select>
                  )},
                  { key: 'score', label: 'Điểm', sortable: true, render: (r: Lead) => (
                    <span className="font-mono text-xs">{r.score ?? '\u2014'}</span>
                  )},
                  { key: 'source', label: 'Nguồn', render: (r: Lead) => (
                    <span className="text-xs text-muted-foreground">{r.source || '\u2014'}</span>
                  )},
                  { key: 'last_touch_at', label: 'Chăm sóc gần nhất', render: (r: Lead) => (
                    <span className="text-xs">{formatDateTime(r.last_touch_at)}</span>
                  )},
                ]}
                data={filteredLeads}
                keyField="id"
                emptyMessage="Chưa có lead"
              />
            </div>
          </div>
        </>
      )}

      {tab === 'sequences' && (
        <div className="panel">
          <div className="panel-header">
            <h3 className="section-title">Chuỗi email</h3>
          </div>
          <div className="panel-body !p-0">
          <DataTable
            columns={[
              { key: 'sequence_name', label: 'Chuỗi' },
              { key: 'lead_id', label: 'Lead', render: (r: Sequence) => (
                <span className="font-mono text-xs">{r.lead_id?.slice(0, 8)}</span>
              )},
              { key: 'step', label: 'Bước' },
              { key: 'subject', label: 'Tiêu đề', render: (r: Sequence) => (
                <span className="text-sm max-w-xs truncate block">{r.subject || '\u2014'}</span>
              )},
              { key: 'status', label: 'Trạng thái', render: (r: Sequence) => <Badge status={r.status || 'queued'} /> },
              { key: 'tier', label: 'Tier' },
              { key: 'scheduled_for', label: 'Lịch gửi', render: (r: Sequence) => (
                <span className="text-xs">{formatDateTime(r.scheduled_for)}</span>
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
        <div className="space-y-3">
          {pendingApprovals.length === 0 ? (
            <div className="panel p-8 text-center text-muted-foreground text-sm">
              Không có email nào đang chờ duyệt
            </div>
          ) : (
            pendingApprovals.map(seq => (
              <ApprovalCard
                key={seq.id}
                id={seq.id}
                title={seq.subject || 'Email chưa có tiêu đề'}
                subtitle={`Step ${seq.step} \u2014 ${seq.sequence_name || 'Unknown Sequence'} \u2014 Tier ${seq.tier || '?'}`}
                body={seq.body || ''}
                status={seq.status || 'pending_approval'}
                meta={`Scheduled: ${formatDateTime(seq.scheduled_for)}`}
                onApprove={(id) => updateSequenceStatus(id, 'approved')}
                onReject={(id) => updateSequenceStatus(id, 'cancelled')}
              />
            ))
          )}
        </div>
      )}

      {tab === 'suppression' && (
        <div className="panel">
          <div className="panel-header">
            <h3 className="section-title">Danh sách loại trừ</h3>
          </div>
          <div className="panel-body !p-0">
          <DataTable
            columns={[
              { key: 'email', label: 'Email' },
              { key: 'type', label: 'Loại', render: (r: Suppression) => <Badge status={r.type || 'opt_out'} /> },
              { key: 'added_at', label: 'Ngày thêm', render: (r: Suppression) => (
                <span className="text-xs">{formatDateTime(r.added_at)}</span>
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
