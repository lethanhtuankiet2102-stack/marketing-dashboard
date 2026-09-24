import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { crmAll, crmGet, crmRun, hasRemoteCrmDb } from '@/lib/crm-db';
import { maybeSeedExclude } from '@/lib/seed-filter';
import { writebackLeadUpdate, writebackSequenceStatus } from '@/lib/writeback';
import type { Lead, Sequence, FunnelStep } from '@/types';
import { requireApiEditor, requireApiUser } from '@/lib/api-auth';
import { requireUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = "force-dynamic";

const LEAD_APPROVED_STATUS = "approved";
const ALLOWED_LEAD_STATUSES = new Set([
  "new",
  "validated",
  "approved",
  "contacted",
  "replied",
  "interested",
  "booked",
  "qualified",
  "won",
  "lost",
  "rejected",
  "disqualified",
]);

export async function GET(request: Request) {
  const auth = requireApiUser(request as Request);
  if (auth) return auth;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const db = getDb();

  // Single lead detail
  if (id) {
    const lead = await crmGet<Lead>('SELECT * FROM leads WHERE id = ?', [id]);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const sequences = db.prepare(
      'SELECT * FROM sequences WHERE lead_id = ? ORDER BY step ASC, created_at DESC'
    ).all(id) as Sequence[];

    // Build timeline from sequences + activity
    const timeline: { id: number; type: string; description: string; timestamp: string }[] = [];
    let timelineId = 0;

    for (const seq of sequences) {
      if (seq.sent_at) {
        timeline.push({
          id: ++timelineId,
          type: 'sequence_sent',
          description: `Email step ${seq.step}: "${seq.subject || 'No subject'}" sent`,
          timestamp: seq.sent_at,
        });
      }
      if (seq.status === 'pending_approval') {
        timeline.push({
          id: ++timelineId,
          type: 'pending_approval',
          description: `Email step ${seq.step}: "${seq.subject || 'No subject'}" awaiting approval`,
          timestamp: seq.created_at,
        });
      }
      if (seq.status === 'approved') {
        timeline.push({
          id: ++timelineId,
          type: 'approved',
          description: `Email step ${seq.step}: approved`,
          timestamp: seq.created_at,
        });
      }
      if (seq.status === 'cancelled') {
        timeline.push({
          id: ++timelineId,
          type: 'cancelled',
          description: `Email step ${seq.step}: cancelled`,
          timestamp: seq.created_at,
        });
      }
      if (seq.status === 'queued') {
        timeline.push({
          id: ++timelineId,
          type: 'queued',
          description: `Email step ${seq.step}: queued`,
          timestamp: seq.created_at,
        });
      }
    }

    if (lead.created_at) {
      timeline.push({
        id: ++timelineId,
        type: 'discovery',
        description: `Lead discovered via ${lead.source || 'unknown source'}`,
        timestamp: lead.created_at,
      });
    }

    // CRM activity log entries (status/notes updates, etc.)
    const activityRows = db.prepare(
      "SELECT ts, detail FROM activity_log WHERE action = 'crm' AND detail LIKE ? ORDER BY ts DESC LIMIT 50"
    ).all(`lead:${id}%`) as { ts: string; detail: string }[];
    for (const row of activityRows) {
      timeline.push({
        id: ++timelineId,
        type: 'crm',
        description: row.detail,
        timestamp: row.ts,
      });
    }

    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ lead, sequences, timeline });
  }

  // List all leads with summary stats
  const status = searchParams.get('status');
  const tier = searchParams.get('tier');
  const search = searchParams.get('search');

  if (hasRemoteCrmDb()) {
    const allRemoteLeads = await crmAll<Lead>('SELECT * FROM leads ORDER BY score DESC, created_at DESC');
    let remoteLeads = allRemoteLeads;
    if (status) remoteLeads = remoteLeads.filter(lead => lead.status === status);
    if (tier) remoteLeads = remoteLeads.filter(lead => lead.tier === tier);
    if (search) {
      const needle = search.toLocaleLowerCase('vi');
      remoteLeads = remoteLeads.filter(lead =>
        [lead.first_name, lead.last_name, lead.company, lead.email, lead.phone, lead.service_interest, lead.assigned_to]
          .some(value => String(value || '').toLocaleLowerCase('vi').includes(needle))
      );
    }

    const stages = ["new","validated","approved","contacted","replied","interested","booked","qualified","won","lost","rejected","disqualified"];
    const funnel: FunnelStep[] = stages.map(name => ({
      name,
      value: allRemoteLeads.filter(lead => lead.status === name).length,
    }));
    const scores = allRemoteLeads.map(l => Number(l.score)).filter(Number.isFinite);
    const avgScore = scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : 0;
    const tierBreakdown = ['A','B','C'].map(tierName => ({
      tier: tierName,
      c: allRemoteLeads.filter(lead => lead.tier === tierName).length,
    })).filter(row => row.c > 0);

    const localDb = getDb();
    const pendingApprovals = (localDb.prepare("SELECT COUNT(*) as c FROM sequences WHERE status = 'pending_approval'").get() as { c: number })?.c ?? 0;
    const emailsSent = (localDb.prepare("SELECT COUNT(*) as c FROM sequences WHERE status = 'sent'").get() as { c: number })?.c ?? 0;
    const contacted = allRemoteLeads.filter(l => ['contacted','replied','interested','booked','qualified','won'].includes(l.status)).length;
    const replied = allRemoteLeads.filter(l => ['replied','interested','booked','qualified','won'].includes(l.status)).length;
    const activeStatuses = new Set(['new','validated','approved','contacted','replied','interested','booked','qualified']);
    const pipelineValue = allRemoteLeads.filter(l => activeStatuses.has(l.status)).reduce((sum,l)=>sum+Number(l.deal_value||0),0);
    const expectedRevenue = allRemoteLeads.filter(l => activeStatuses.has(l.status)).reduce((sum,l)=>sum+Number(l.expected_revenue||0),0);
    const wonRevenue = allRemoteLeads.filter(l => l.status === 'won').reduce((sum,l)=>sum+Number(l.won_revenue || l.deal_value || 0),0);

    return NextResponse.json({
      leads: remoteLeads,
      funnel,
      summary: {
        total: allRemoteLeads.length,
        avg_score: Math.round(avgScore),
        tier_breakdown: tierBreakdown,
        pending_approvals: pendingApprovals,
        emails_sent: emailsSent,
        conversion_rate: contacted > 0 ? Math.round((replied / contacted) * 100) : 0,
        pipeline_value: pipelineValue,
        expected_revenue: expectedRevenue,
        won_revenue: wonRevenue,
        won_count: allRemoteLeads.filter(l => l.status === 'won').length,
        lost_count: allRemoteLeads.filter(l => l.status === 'lost').length,
        persistent: true,
      },
    });
  }
  const seedExcludeLeads = maybeSeedExclude(request, 'leads');

  let sql = `SELECT * FROM leads WHERE 1=1${seedExcludeLeads}`;
  const params: unknown[] = [];

  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (tier) { sql += ' AND tier = ?'; params.push(tier); }
  if (search) {
    sql += ' AND (first_name LIKE ? OR last_name LIKE ? OR company LIKE ? OR email LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  sql += ' ORDER BY score DESC, created_at DESC';
  const leads = db.prepare(sql).all(...params) as Lead[];

  const stages = ["new", "validated", "approved", "contacted", "replied", "interested", "booked", "qualified", "won", "lost", "rejected", "disqualified"]; 
  const funnel: FunnelStep[] = stages.map(name => {
    const row = db.prepare(`SELECT COUNT(*) as c FROM leads WHERE status = ?${seedExcludeLeads}`).get(name) as { c: number };
    return { name, value: row?.c ?? 0 };
  });

  const totalLeads = (db.prepare(`SELECT COUNT(*) as c FROM leads WHERE 1=1${seedExcludeLeads}`).get() as { c: number })?.c ?? 0;
  const avgScore = (db.prepare(`SELECT AVG(score) as avg FROM leads WHERE score IS NOT NULL${seedExcludeLeads}`).get() as { avg: number | null })?.avg ?? 0;
  const tierBreakdown = db.prepare(
    `SELECT tier, COUNT(*) as c FROM leads WHERE tier IS NOT NULL${seedExcludeLeads} GROUP BY tier ORDER BY tier`
  ).all() as { tier: string; c: number }[];

  // Sequence analytics
  const seedExcludeSeqs = maybeSeedExclude(request, 'sequences');
  const pendingApprovals = (db.prepare(
    `SELECT COUNT(*) as c FROM sequences WHERE status = 'pending_approval'${seedExcludeSeqs}`
  ).get() as { c: number })?.c ?? 0;

  const emailsSent = (db.prepare(
    `SELECT COUNT(*) as c FROM sequences WHERE status = 'sent'${seedExcludeSeqs}`
  ).get() as { c: number })?.c ?? 0;

  // Conversion rate: leads that replied or further / leads that were contacted
  const contacted = (db.prepare(
    `SELECT COUNT(*) as c FROM leads WHERE status IN ('contacted','replied','interested','booked','qualified','won')${seedExcludeLeads}`
  ).get() as { c: number })?.c ?? 0;
  const replied = (db.prepare(
    `SELECT COUNT(*) as c FROM leads WHERE status IN ('replied','interested','booked','qualified','won')${seedExcludeLeads}`
  ).get() as { c: number })?.c ?? 0;
  const conversionRate = contacted > 0 ? Math.round((replied / contacted) * 100) : 0;
  const pipelineValue = (db.prepare(`SELECT COALESCE(SUM(deal_value), 0) as total FROM leads WHERE status IN ('new','validated','approved','contacted','replied','interested','booked','qualified')${seedExcludeLeads}`).get() as { total: number })?.total ?? 0;
  const expectedRevenue = (db.prepare(`SELECT COALESCE(SUM(expected_revenue), 0) as total FROM leads WHERE status IN ('new','validated','approved','contacted','replied','interested','booked','qualified')${seedExcludeLeads}`).get() as { total: number })?.total ?? 0;
  const wonRevenue = (db.prepare(`SELECT COALESCE(SUM(CASE WHEN won_revenue > 0 THEN won_revenue ELSE deal_value END), 0) as total FROM leads WHERE status = 'won'${seedExcludeLeads}`).get() as { total: number })?.total ?? 0;
  const wonCount = (db.prepare(`SELECT COUNT(*) as c FROM leads WHERE status = 'won'${seedExcludeLeads}`).get() as { c: number })?.c ?? 0;
  const lostCount = (db.prepare(`SELECT COUNT(*) as c FROM leads WHERE status = 'lost'${seedExcludeLeads}`).get() as { c: number })?.c ?? 0;

  return NextResponse.json({
    leads,
    funnel,
    summary: {
      total: totalLeads,
      avg_score: Math.round(avgScore),
      tier_breakdown: tierBreakdown,
      pending_approvals: pendingApprovals,
      emails_sent: emailsSent,
      conversion_rate: conversionRate,
      pipeline_value: pipelineValue,
      expected_revenue: expectedRevenue,
      won_revenue: wonRevenue,
      won_count: wonCount,
      lost_count: lostCount,
      persistent: false,
    },
  });
}

export async function PATCH(request: Request) {
  const auth = requireApiEditor(request as Request);
  if (auth) return auth;
  const actor = requireUser(request as Request);
  try {
    const body = await request.json();
    const { id, type, task_done, ...updates } = body as { id?: string; type?: string; task_done?: boolean } & Record<string, unknown>;

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const db = getDb();

    // Sequence update (approve/reject)
    if (type === "sequence") {
      const allowedStatuses = ["approved", "cancelled", "queued"];
      const nextStatus = typeof updates.status === "string" ? updates.status : null;
      if (!nextStatus || !allowedStatuses.includes(nextStatus)) {
        return NextResponse.json({ error: "Invalid sequence status" }, { status: 400 });
      }

      if (nextStatus === "approved" || nextStatus === "queued") {
        const lead = db.prepare(
          "SELECT l.status as lead_status FROM sequences s LEFT JOIN leads l ON l.id = s.lead_id WHERE s.id = ?"
        ).get(id) as { lead_status: string | null } | undefined;
        if (!lead || lead.lead_status !== LEAD_APPROVED_STATUS) {
          return NextResponse.json({ error: "Lead must be approved before outreach can be queued or approved" }, { status: 409 });
        }
      }

      db.prepare("UPDATE sequences SET status = ? WHERE id = ?").run(nextStatus, id);
      writebackSequenceStatus(id, nextStatus);
      logAudit({
        actor,
        action: "crm.sequence.update_status",
        target: `sequence:${id}`,
        detail: { status: nextStatus },
      });
      return NextResponse.json({ ok: true });
    }

    // Lead update
    const allowed = ["status", "tier", "notes", "pause_outreach", "next_action_at", "closed_at", "lost_reason"]; 
    const cols: string[] = [];
    const params: unknown[] = [];
    const before = await crmGet<Lead>('SELECT * FROM leads WHERE id = ?', [id]);

    for (const key of allowed) {
      if (updates[key] !== undefined) {
        if (key === "status") {
          if (typeof updates[key] !== "string" || !ALLOWED_LEAD_STATUSES.has(updates[key] as string)) {
            return NextResponse.json({ error: "Invalid lead status" }, { status: 400 });
          }
        }
        if (key === "pause_outreach") {
          cols.push(`${key} = ?`);
          params.push(updates[key] ? 1 : 0);
        } else {
          cols.push(`${key} = ?`);
          params.push(updates[key]);
        }
      }
    }

    if (cols.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    if ((updates.status === 'won' || updates.status === 'lost') && updates.closed_at === undefined) {
      cols.push("closed_at = datetime('now')");
    }
    cols.push("last_touch_at = datetime('now')");
    params.push(id);

    await crmRun(`UPDATE leads SET ${cols.join(', ')} WHERE id = ?`, params as Array<string | number | boolean | null>);

    // Writeback to state file
    const writebackUpdates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) writebackUpdates[key] = updates[key];
    }
    writebackLeadUpdate(id, writebackUpdates);

    const lead = await crmGet('SELECT * FROM leads WHERE id = ?', [id]);
    if (before) {
      const changes: string[] = [];
      if (updates.status && before.status !== updates.status) changes.push(`status: ${before.status} -> ${updates.status}`);
      if (updates.tier && before.tier !== updates.tier) changes.push(`tier: ${before.tier ?? '—'} -> ${updates.tier}`);
      if (updates.notes !== undefined && before.notes !== updates.notes) changes.push('notes updated');
      if (updates.pause_outreach !== undefined && before.pause_outreach !== updates.pause_outreach) {
        changes.push(`outreach ${updates.pause_outreach ? 'paused' : 'resumed'}`);
      }
      if (updates.next_action_at !== undefined && before.next_action_at !== updates.next_action_at) {
        changes.push('next action updated');
      }
      if (task_done) {
        changes.push('task completed');
      }
      if (changes.length > 0) {
        db.prepare(
          `INSERT INTO activity_log (ts, action, detail, result)
           VALUES (datetime('now'), ?, ?, ?)`
        ).run(
          'crm',
          `lead:${id} ${changes.join(', ')}`,
          null,
        );
      }
    }
    logAudit({
      actor,
      action: 'crm.lead.update',
      target: `lead:${id}`,
      detail: { updates: writebackUpdates },
    });
    return NextResponse.json({ ok: true, lead });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
