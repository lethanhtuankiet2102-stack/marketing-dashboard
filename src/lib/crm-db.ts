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

interface NeonField {
  name: string;
  dataTypeID?: number;
}

interface NeonHttpResult {
  fields?: NeonField[];
  rows?: Array<Array<string | null>>;
  rowCount?: number;
  command?: string;
}

let tursoSchemaReady = false;
let postgresSchemaReady = false;

function postgresUrl(): string | null {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.NEON_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    null
  );
}

function hasTursoDb(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL?.trim() && process.env.TURSO_AUTH_TOKEN?.trim());
}

export function hasRemoteCrmDb(): boolean {
  return Boolean(postgresUrl() || hasTursoDb());
}

export function crmStorageProvider(): 'neon' | 'turso' | 'sqlite' {
  if (postgresUrl()) return 'neon';
  if (hasTursoDb()) return 'turso';
  return 'sqlite';
}

// ─── Neon / Postgres over HTTP ─────────────────────────

function toPostgresSql(sql: string): string {
  let idx = 0;
  return sql
    .replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/\?/g, () => `$${++idx}`);
}

function preparePostgresParam(value: SqlPrimitive): unknown {
  if (value === undefined) return null;
  return value;
}

function parsePostgresValue(raw: string | null, typeId?: number): unknown {
  if (raw === null) return null;
  switch (typeId) {
    case 16: // bool
      return raw === 't' || raw === 'true' || raw === '1';
    case 20: // int8
    case 21: // int2
    case 23: // int4
      {
        const n = Number(raw);
        return Number.isSafeInteger(n) ? n : raw;
      }
    case 700: // float4
    case 701: // float8
    case 1700: // numeric
      {
        const n = Number(raw);
        return Number.isFinite(n) ? n : raw;
      }
    default:
      return raw;
  }
}

async function neonExecute(
  sql: string,
  args: SqlPrimitive[] = [],
): Promise<NeonHttpResult> {
  const connectionString = postgresUrl();
  if (!connectionString) throw new Error('DATABASE_URL is not configured');

  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL is not a valid Postgres URL');
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL must use postgres:// or postgresql://');
  }

  const endpoint = `https://${parsed.hostname}/sql`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Neon-Connection-String': connectionString,
      'Neon-Raw-Text-Output': 'true',
      'Neon-Array-Mode': 'true',
    },
    body: JSON.stringify({
      query: toPostgresSql(sql),
      params: args.map(preparePostgresParam),
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Neon CRM database error (HTTP ${response.status}): ${body.slice(0, 500)}`);
  }

  return response.json() as Promise<NeonHttpResult>;
}

async function ensurePostgresSchema(): Promise<void> {
  if (!postgresUrl() || postgresSchemaReady) return;

  await neonExecute(`
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
      deal_value NUMERIC DEFAULT 0,
      expected_revenue NUMERIC DEFAULT 0,
      won_revenue NUMERIC DEFAULT 0,
      last_touch_at TIMESTAMPTZ,
      next_action_at TIMESTAMPTZ,
      closed_at TIMESTAMPTZ,
      lost_reason TEXT,
      sequence_name TEXT,
      reply_type TEXT,
      notes TEXT,
      pause_outreach INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await neonExecute('CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)');
  await neonExecute('CREATE INDEX IF NOT EXISTS idx_leads_tier ON leads(tier)');
  await neonExecute('CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(assigned_to)');
  await neonExecute('CREATE INDEX IF NOT EXISTS idx_leads_source_channel ON leads(source_channel)');
  postgresSchemaReady = true;
}

async function postgresAll<T>(
  sql: string,
  args: SqlPrimitive[] = [],
): Promise<T[]> {
  await ensurePostgresSchema();
  const result = await neonExecute(sql, args);
  const fields = result.fields || [];
  return (result.rows || []).map(row => {
    const out: Record<string, unknown> = {};
    fields.forEach((field, i) => {
      out[field.name] = parsePostgresValue(row[i] ?? null, field.dataTypeID);
    });
    return out as T;
  });
}

// ─── Turso / libSQL over Hrana HTTP ────────────────────

function tursoEndpoint(): string {
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

async function tursoExecute(
  sql: string,
  args: SqlPrimitive[] = [],
  wantRows = true,
): Promise<HranaExecuteResult> {
  const token = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!token) throw new Error('TURSO_AUTH_TOKEN is not configured');

  const response = await fetch(tursoEndpoint(), {
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

async function ensureTursoSchema(): Promise<void> {
  if (!hasTursoDb() || tursoSchemaReady) return;

  await tursoExecute(`
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
  `, [], false);
  await tursoExecute('CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)', [], false);
  await tursoExecute('CREATE INDEX IF NOT EXISTS idx_leads_tier ON leads(tier)', [], false);
  await tursoExecute('CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(assigned_to)', [], false);
  await tursoExecute('CREATE INDEX IF NOT EXISTS idx_leads_source_channel ON leads(source_channel)', [], false);
  tursoSchemaReady = true;
}

// ─── Unified CRM storage API ────────────────────────────

export async function crmAll<T = Record<string, unknown>>(
  sql: string,
  args: SqlPrimitive[] = [],
): Promise<T[]> {
  if (postgresUrl()) {
    return postgresAll<T>(sql, args);
  }

  if (hasTursoDb()) {
    await ensureTursoSchema();
    const result = await tursoExecute(sql, args, true);
    const names = (result.cols || []).map(c => c.name || '');
    return (result.rows || []).map(row => {
      const out: Record<string, unknown> = {};
      names.forEach((name, i) => { if (name) out[name] = decodeValue(row[i]); });
      return out as T;
    });
  }

  return getDb().prepare(sql).all(...args) as T[];
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
  if (postgresUrl()) {
    await ensurePostgresSchema();
    const result = await neonExecute(sql, args);
    return { changes: result.rowCount || 0 };
  }

  if (hasTursoDb()) {
    await ensureTursoSchema();
    const result = await tursoExecute(sql, args, false);
    return { changes: result.affected_row_count || 0 };
  }

  const result = getDb().prepare(sql).run(...args);
  return { changes: result.changes };
}
