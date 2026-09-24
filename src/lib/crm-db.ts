import { getDb } from './db';

type SqlPrimitive = string | number | boolean | null;

type HranaValue =
  | { type: 'null' }
  | { type: 'integer'; value: string }
  | { type: 'float'; value: number }
  | { type: 'text'; value: string }
  | { type: 'blob'; base64: string };

interface HranaExecuteResult {
  cols?: Array<{ name: string | null }>;
  rows?: HranaValue[][];
  affected_row_count?: number;
}

let schemaReady = false;

export function hasRemoteCrmDb(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL?.trim() && process.env.TURSO_AUTH_TOKEN?.trim());
}

function remoteEndpoint(): string {
  const raw = process.env.TURSO_DATABASE_URL?.trim();
  if (!raw) throw new Error('TURSO_DATABASE_URL is not configured');
  const httpUrl = raw.startsWith('libsql://')
    ? `https://${raw.slice('libsql://'.length)}`
    : raw;
  return `${httpUrl.replace(/\/$/, '')}/v2/pipeline`;
}

function encodeValue(value: SqlPrimitive): HranaValue {
  if (value === null || value === undefined) return { type: 'null' };
  if (typeof value === 'boolean') return { type: 'integer', value: value ? '1' : '0' };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { type: 'integer', value: String(value) }
      : { type: 'float', value };
  }
  return { type: 'text', value: String(value) };
}

function decodeValue(value: HranaValue | undefined): unknown {
  if (!value || value.type === 'null') return null;
  if (value.type === 'integer') {
    const n = Number(value.value);
    return Number.isSafeInteger(n) ? n : value.value;
  }
  if (value.type === 'float' || value.type === 'text') return value.value;
  if (value.type === 'blob') return value.base64;
  return null;
}

async function remoteExecute(
  sql: string,
  args: SqlPrimitive[] = [],
  wantRows = true,
): Promise<HranaExecuteResult> {
  const token = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!token) throw new Error('TURSO_AUTH_TOKEN is not configured');

  const response = await fetch(remoteEndpoint(), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      baton: null,
      requests: [
        {
          type: 'execute',
          stmt: {
            sql,
            args: args.map(encodeValue),
            want_rows: wantRows,
          },
        },
        { type: 'close' },
      ],
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Remote CRM database returned HTTP ${response.status}`);
  }

  const payload = await response.json() as {
    results?: Array<
      | { type: 'ok'; response?: { type?: string; result?: HranaExecuteResult } }
      | { type: 'error'; error?: { message?: string } }
    >;
  };
  const first = payload.results?.[0];
  if (!first) throw new Error('Remote CRM database returned an empty response');
  if (first.type === 'error') throw new Error(first.error?.message || 'Remote CRM database query failed');
  if (first.response?.type !== 'execute') throw new Error('Unexpected remote CRM database response');
  return first.response.result || {};
}

async function ensureRemoteSchema(): Promise<void> {
  if (!hasRemoteCrmDb() || schemaReady) return;

  const createSql = `
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      title TEXT,
      company TEXT,
      company_size TEXT,
      industry_segment TEXT,
      source TEXT,
      source_channel TEXT,
      email TEXT,
      phone TEXT,
      linkedin_url TEXT,
      assigned_to TEXT,
      service_interest TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      score INTEGER,
      tier TEXT,
      deal_value REAL DEFAULT 0,
      expected_revenue REAL DEFAULT 0,
      won_revenue REAL DEFAULT 0,
      last_touch_at DATETIME,
      next_action_at DATETIME,
      closed_at DATETIME,
      lost_reason TEXT,
      sequence_name TEXT,
      reply_type TEXT,
      notes TEXT,
      pause_outreach INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await remoteExecute(createSql, [], false);
  await remoteExecute('CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)', [], false);
  await remoteExecute('CREATE INDEX IF NOT EXISTS idx_leads_tier ON leads(tier)', [], false);
  await remoteExecute('CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(assigned_to)', [], false);
  await remoteExecute('CREATE INDEX IF NOT EXISTS idx_leads_source_channel ON leads(source_channel)', [], false);
  schemaReady = true;
}

export async function crmAll<T = Record<string, unknown>>(
  sql: string,
  args: SqlPrimitive[] = [],
): Promise<T[]> {
  if (!hasRemoteCrmDb()) {
    return getDb().prepare(sql).all(...args) as T[];
  }
  await ensureRemoteSchema();
  const result = await remoteExecute(sql, args, true);
  const names = (result.cols || []).map(c => c.name || '');
  return (result.rows || []).map(row => {
    const out: Record<string, unknown> = {};
    names.forEach((name, i) => { if (name) out[name] = decodeValue(row[i]); });
    return out as T;
  });
}

export async function crmGet<T = Record<string, unknown>>(
  sql: string,
  args: SqlPrimitive[] = [],
): Promise<T | undefined> {
  const rows = await crmAll<T>(sql, args);
  return rows[0];
}

export async function crmRun(
  sql: string,
  args: SqlPrimitive[] = [],
): Promise<{ changes: number }> {
  if (!hasRemoteCrmDb()) {
    const result = getDb().prepare(sql).run(...args);
    return { changes: result.changes };
  }
  await ensureRemoteSchema();
  const result = await remoteExecute(sql, args, false);
  return { changes: result.affected_row_count || 0 };
}
