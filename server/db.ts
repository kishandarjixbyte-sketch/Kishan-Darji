import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type AdminRole = 'super_admin' | 'sub_admin';
export type OccupationType = 'Student' | 'Job' | 'Business' | 'Other';
export type RegistrationStatus = 'New' | 'Contacted' | 'Follow-up' | 'Completed';
export type DeliveryStatus = 'sent' | 'delivered' | 'failed' | 'skipped_disabled' | 'queued_unconfigured';

export interface AdminRecord {
  id: string;
  full_name: string;
  email: string;
  mobile: string;
  whatsapp_number: string;
  role: AdminRole;
  is_primary: number;
  notifications_enabled: number;
  is_active: number;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface RegistrationRecord {
  id: string;
  registration_code: string;
  full_name: string;
  mobile: string;
  age: number;
  dob: string;
  full_address: string;
  occupation: OccupationType;
  status: RegistrationStatus;
  assigned_admin_id: string | null;
  assigned_admin_name?: string | null;
  follow_up_notes: string;
  privacy_consent: number;
  whatsapp_consent: number;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationLogRecord {
  id: string;
  registration_id: string;
  admin_id: string | null;
  recipient_whatsapp: string;
  message_preview: string;
  provider_message_id: string | null;
  delivery_status: DeliveryStatus;
  error_message: string | null;
  created_at: string;
  registration_code?: string;
  registrant_name?: string;
}

export interface SyncLogRecord {
  id: string;
  admin_id: string;
  device_id: string;
  records_pulled: number;
  records_pushed: number;
  sync_status: 'synced' | 'partial' | 'failed';
  created_at: string;
  admin_name?: string;
}

export interface AuditLogRecord {
  id: string;
  actor_admin_id: string | null;
  action: string;
  target_table: string;
  target_id: string;
  metadata: string;
  created_at: string;
  actor_name?: string;
}

export interface NotificationSettingsRecord {
  global_enabled: boolean;
  extra_whatsapp_numbers: string[];
  updated_at: string;
}

export class DatabaseError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'DatabaseError';
    this.statusCode = statusCode;
  }
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return Boolean(url && key && url.startsWith('http'));
}

export function isVercelRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
}

export function getStorageMode(): 'supabase' | 'sqlite' | 'unconfigured_vercel' {
  if (isSupabaseConfigured()) return 'supabase';
  if (isVercelRuntime()) return 'unconfigured_vercel';
  return 'sqlite';
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function toBit(val: unknown): number {
  return val === true || val === 1 || val === '1' ? 1 : 0;
}

function normalizeAdminRow(raw: Record<string, unknown>): AdminRecord {
  return {
    id: String(raw.id),
    full_name: String(raw.full_name || ''),
    email: String(raw.email || '').toLowerCase(),
    mobile: String(raw.mobile || ''),
    whatsapp_number: String(raw.whatsapp_number || ''),
    role: raw.role === 'super_admin' ? 'super_admin' : 'sub_admin',
    is_primary: toBit(raw.is_primary),
    notifications_enabled: toBit(raw.notifications_enabled),
    is_active: toBit(raw.is_active),
    password_hash: String(raw.password_hash || ''),
    created_at: String(raw.created_at || new Date().toISOString()),
    updated_at: String(raw.updated_at || new Date().toISOString()),
  };
}

function normalizeRegistrationRow(
  raw: Record<string, unknown>,
  adminNameMap?: Map<string, string>
): RegistrationRecord {
  const assignedId = raw.assigned_admin_id ? String(raw.assigned_admin_id) : null;
  return {
    id: String(raw.id),
    registration_code: String(raw.registration_code || ''),
    full_name: String(raw.full_name || ''),
    mobile: String(raw.mobile || ''),
    age: Number(raw.age) || 18,
    dob: String(raw.dob || ''),
    full_address: String(raw.full_address || ''),
    occupation: (raw.occupation as OccupationType) || 'Other',
    status: (raw.status as RegistrationStatus) || 'New',
    assigned_admin_id: assignedId,
    assigned_admin_name:
      raw.assigned_admin_name !== undefined
        ? (raw.assigned_admin_name as string | null)
        : assignedId && adminNameMap
        ? adminNameMap.get(assignedId) ?? null
        : null,
    follow_up_notes: String(raw.follow_up_notes || ''),
    privacy_consent: toBit(raw.privacy_consent),
    whatsapp_consent: toBit(raw.whatsapp_consent),
    source: String(raw.source || 'direct_link'),
    created_at: String(raw.created_at || new Date().toISOString()),
    updated_at: String(raw.updated_at || new Date().toISOString()),
  };
}

// ============================================================================
// SUPABASE REST CLIENT (Works seamlessly on Vercel Serverless, Render, Local)
// ============================================================================
function getSupabaseConfig(): { baseUrl: string; serviceKey: string } {
  const baseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, '') || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  if (!baseUrl || !serviceKey) {
    throw new DatabaseError(
      'Database is not configured on Vercel. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel Environment Variables and run supabase/schema.sql.',
      503
    );
  }
  return { baseUrl, serviceKey };
}

async function supabaseFetch<T = unknown>(
  restPath: string,
  options: {
    method?: string;
    body?: unknown;
    prefer?: string;
  } = {}
): Promise<T> {
  const { baseUrl, serviceKey } = getSupabaseConfig();
  const headers: Record<string, string> = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };
  if (options.prefer) {
    headers.Prefer = options.prefer;
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/rest/v1/${restPath}`, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown network error';
    throw new DatabaseError(`Unable to connect to Supabase database (${msg}).`, 503);
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { message: text };
    }
  }

  if (!res.ok) {
    const errObj = (parsed && typeof parsed === 'object' ? parsed : {}) as {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
    };
    const rawMsg = errObj.message || `Supabase HTTP ${res.status}`;
    if (errObj.code === '42P01' || errObj.code === 'PGRST205') {
      throw new DatabaseError(
        'Supabase database tables are not initialized. Please run supabase/schema.sql in your Supabase SQL Editor.',
        503
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new DatabaseError(
        'Supabase authentication failed. Please check SUPABASE_SERVICE_ROLE_KEY.',
        503
      );
    }
    if (errObj.code === '23505') {
      throw new DatabaseError(errObj.details || rawMsg, 409);
    }
    throw new DatabaseError(rawMsg, res.status >= 400 && res.status < 600 ? res.status : 500);
  }

  return parsed as T;
}

// ============================================================================
// LAZY SQLITE CLIENT (Local dev / Render without Supabase; never loaded on Vercel)
// ============================================================================
type SqliteSyncInstance = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
    run: (...args: unknown[]) => { changes: number };
  };
};

let sqlitePromise: Promise<SqliteSyncInstance> | null = null;

async function getSqlite(): Promise<SqliteSyncInstance> {
  if (isVercelRuntime()) {
    throw new DatabaseError(
      'Database is not configured on Vercel. Please add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel Project Settings -> Environment Variables and run supabase/schema.sql.',
      503
    );
  }

  if (!sqlitePromise) {
    sqlitePromise = (async () => {
      const { DatabaseSync } = await import('node:sqlite');
      const dataDir = path.resolve(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const dbPath = path.join(dataDir, 'join_bajrang_dal.db');
      const db = new DatabaseSync(dbPath) as unknown as SqliteSyncInstance;
      db.exec('PRAGMA journal_mode = WAL;');
      db.exec('PRAGMA foreign_keys = ON;');
      db.exec(`
        CREATE TABLE IF NOT EXISTS admins (
          id TEXT PRIMARY KEY,
          full_name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          mobile TEXT NOT NULL UNIQUE,
          whatsapp_number TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('super_admin', 'sub_admin')) DEFAULT 'sub_admin',
          is_primary INTEGER NOT NULL DEFAULT 0,
          notifications_enabled INTEGER NOT NULL DEFAULT 1,
          is_active INTEGER NOT NULL DEFAULT 1,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE TABLE IF NOT EXISTS registrations (
          id TEXT PRIMARY KEY,
          registration_code TEXT NOT NULL UNIQUE,
          full_name TEXT NOT NULL,
          mobile TEXT NOT NULL UNIQUE,
          age INTEGER NOT NULL CHECK (age >= 18),
          dob TEXT NOT NULL,
          full_address TEXT NOT NULL,
          occupation TEXT NOT NULL CHECK (occupation IN ('Student', 'Job', 'Business', 'Other')),
          status TEXT NOT NULL CHECK (status IN ('New', 'Contacted', 'Follow-up', 'Completed')) DEFAULT 'New',
          assigned_admin_id TEXT REFERENCES admins(id) ON DELETE SET NULL,
          follow_up_notes TEXT NOT NULL DEFAULT '',
          privacy_consent INTEGER NOT NULL DEFAULT 1,
          whatsapp_consent INTEGER NOT NULL DEFAULT 0,
          source TEXT NOT NULL DEFAULT 'direct_link',
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE TABLE IF NOT EXISTS admin_assignments (
          id TEXT PRIMARY KEY,
          registration_id TEXT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
          admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
          assigned_by TEXT REFERENCES admins(id) ON DELETE SET NULL,
          notes TEXT NOT NULL DEFAULT '',
          assigned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE TABLE IF NOT EXISTS notification_logs (
          id TEXT PRIMARY KEY,
          registration_id TEXT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
          admin_id TEXT REFERENCES admins(id) ON DELETE SET NULL,
          recipient_whatsapp TEXT NOT NULL,
          message_preview TEXT NOT NULL,
          provider_message_id TEXT,
          delivery_status TEXT NOT NULL CHECK (delivery_status IN ('sent', 'delivered', 'failed', 'skipped_disabled', 'queued_unconfigured')),
          error_message TEXT,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          UNIQUE (registration_id, recipient_whatsapp)
        );

        CREATE TABLE IF NOT EXISTS sync_logs (
          id TEXT PRIMARY KEY,
          admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
          device_id TEXT NOT NULL,
          records_pulled INTEGER NOT NULL DEFAULT 0,
          records_pushed INTEGER NOT NULL DEFAULT 0,
          sync_status TEXT NOT NULL CHECK (sync_status IN ('synced', 'partial', 'failed')),
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          actor_admin_id TEXT REFERENCES admins(id) ON DELETE SET NULL,
          action TEXT NOT NULL,
          target_table TEXT NOT NULL,
          target_id TEXT NOT NULL,
          metadata TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE TABLE IF NOT EXISTS notification_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          global_enabled INTEGER NOT NULL DEFAULT 1,
          extra_whatsapp_numbers TEXT NOT NULL DEFAULT '[]',
          updated_by TEXT REFERENCES admins(id) ON DELETE SET NULL,
          updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );
      `);
      return db;
    })();
  }
  return sqlitePromise;
}

// ============================================================================
// SEEDING (Idempotent for both Supabase & SQLite)
// ============================================================================
const DEFAULT_SEED_ADMINS = [
  {
    full_name: 'Kishan Darji',
    email: 'kishan.darji.xbyte@gmail.com',
    mobile: '9638236795',
    whatsapp_number: '919638236795',
    role: 'super_admin' as AdminRole,
    is_primary: true,
    notifications_enabled: true,
    password: 'Admin@2026',
  },
  {
    full_name: 'Ronakisinh Parmar',
    email: 'ronakisinh.parmar@bajrangdal.org',
    mobile: '9016877373',
    whatsapp_number: '919016877373',
    role: 'super_admin' as AdminRole,
    is_primary: false,
    notifications_enabled: true,
    password: 'Admin@2026',
  },
  {
    full_name: 'Vikram Desai (Sub Admin)',
    email: 'subadmin@bajrangdal.org',
    mobile: '9825011223',
    whatsapp_number: '919825011223',
    role: 'sub_admin' as AdminRole,
    is_primary: false,
    notifications_enabled: false,
    password: 'SubAdmin@2026',
  },
];

let seedPromise: Promise<void> | null = null;

export async function ensureInitialized(): Promise<void> {
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    const mode = getStorageMode();
    if (mode === 'unconfigured_vercel') {
      throw new DatabaseError(
        'Database is not configured on Vercel. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel Environment Variables and run supabase/schema.sql.',
        503
      );
    }

    if (mode === 'supabase') {
      // Ensure notification_settings row 1 exists
      const settingsRows = await supabaseFetch<Array<{ id: number }>>(
        'notification_settings?select=id&id=eq.1&limit=1'
      );
      if (settingsRows.length === 0) {
        await supabaseFetch('notification_settings', {
          method: 'POST',
          prefer: 'resolution=ignore-duplicates',
          body: {
            id: 1,
            global_enabled: true,
            extra_whatsapp_numbers: [],
          },
        });
      }

      // Ensure seeded admins exist
      const existingAdmins = await supabaseFetch<Array<{ id: string; email: string; mobile: string }>>(
        'admins?select=id,email,mobile'
      );
      const hasPrimary = await supabaseFetch<Array<{ id: string }>>(
        'admins?select=id&is_primary=eq.true&limit=1'
      );

      for (const seed of DEFAULT_SEED_ADMINS) {
        const exists = existingAdmins.some(
          (a) => a.mobile === seed.mobile || a.email.toLowerCase() === seed.email.toLowerCase()
        );
        if (!exists) {
          await supabaseFetch('admins', {
            method: 'POST',
            prefer: 'resolution=ignore-duplicates',
            body: {
              id: crypto.randomUUID(),
              full_name: seed.full_name,
              email: seed.email.toLowerCase(),
              mobile: seed.mobile,
              whatsapp_number: seed.whatsapp_number,
              role: seed.role,
              is_primary: hasPrimary.length === 0 ? seed.is_primary : false,
              notifications_enabled: seed.notifications_enabled,
              is_active: true,
              password_hash: hashPassword(seed.password),
            },
          });
        }
      }
      return;
    }

    // SQLite seeding
    const sqlite = await getSqlite();
    sqlite
      .prepare("UPDATE admins SET is_primary = 0, notifications_enabled = 0 WHERE mobile = '9876543210' AND email = 'superadmin@bajrangdal.org'")
      .run();

    for (const seed of DEFAULT_SEED_ADMINS) {
      const existing = sqlite
        .prepare('SELECT id FROM admins WHERE mobile = ? OR LOWER(email) = ? LIMIT 1')
        .get(seed.mobile, seed.email.toLowerCase()) as { id: string } | undefined;
      if (!existing) {
        if (seed.is_primary) {
          sqlite.prepare('UPDATE admins SET is_primary = 0').run();
        }
        const now = new Date().toISOString();
        sqlite
          .prepare(`
            INSERT INTO admins (id, full_name, email, mobile, whatsapp_number, role, is_primary, notifications_enabled, is_active, password_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
          `)
          .run(
            crypto.randomUUID(),
            seed.full_name,
            seed.email.toLowerCase(),
            seed.mobile,
            seed.whatsapp_number,
            seed.role,
            seed.is_primary ? 1 : 0,
            seed.notifications_enabled ? 1 : 0,
            hashPassword(seed.password),
            now,
            now
          );
      }
    }

    const kishan = sqlite.prepare('SELECT id FROM admins WHERE mobile = ?').get('9638236795') as { id: string } | undefined;
    const placeholder = sqlite.prepare('SELECT id FROM admins WHERE mobile = ?').get('9876543210') as { id: string } | undefined;
    if (kishan && placeholder) {
      sqlite.prepare('UPDATE registrations SET assigned_admin_id = ? WHERE assigned_admin_id = ?').run(kishan.id, placeholder.id);
      sqlite.prepare('DELETE FROM admins WHERE id = ?').run(placeholder.id);
    }

    sqlite
      .prepare("INSERT OR IGNORE INTO notification_settings (id, global_enabled, extra_whatsapp_numbers) VALUES (1, 1, '[]')")
      .run();
  })().catch((err) => {
    seedPromise = null;
    throw err;
  });

  return seedPromise;
}

// ============================================================================
// PUBLIC DATA ACCESS FUNCTIONS
// ============================================================================
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  mode: 'supabase' | 'sqlite' | 'unconfigured_vercel';
  error?: string;
}> {
  const mode = getStorageMode();
  if (mode === 'unconfigured_vercel') {
    return {
      connected: false,
      mode,
      error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables on Vercel.',
    };
  }
  try {
    await ensureInitialized();
    if (mode === 'supabase') {
      await supabaseFetch('admins?select=id&limit=1');
    } else {
      const sqlite = await getSqlite();
      sqlite.prepare('SELECT 1 as ok').get();
    }
    return { connected: true, mode };
  } catch (err) {
    return {
      connected: false,
      mode,
      error: err instanceof Error ? err.message : 'Database check failed',
    };
  }
}

export async function writeAuditLog(
  actorAdminId: string | null,
  action: string,
  targetTable: string,
  targetId: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const id = crypto.randomUUID();
    if (isSupabaseConfigured()) {
      await supabaseFetch('audit_logs', {
        method: 'POST',
        body: {
          id,
          actor_admin_id: actorAdminId,
          action,
          target_table: targetTable,
          target_id: targetId,
          metadata,
        },
      });
      return;
    }

    const sqlite = await getSqlite();
    sqlite
      .prepare('INSERT INTO audit_logs (id, actor_admin_id, action, target_table, target_id, metadata) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, actorAdminId, action, targetTable, targetId, JSON.stringify(metadata));
  } catch (err) {
    console.error('Audit log write warning:', err);
  }
}

export async function generateRegistrationCode(): Promise<string> {
  const year = new Date().getFullYear();
  let count = 0;

  if (isSupabaseConfigured()) {
    const rows = await supabaseFetch<Array<{ id: string }>>('registrations?select=id');
    count = rows.length;
  } else {
    const sqlite = await getSqlite();
    const countRow = sqlite.prepare('SELECT COUNT(*) as count FROM registrations').get() as { count: number };
    count = countRow.count;
  }

  const seq = 1001 + count;
  const suffix = crypto.randomInt(10, 99);
  return `JBD-${year}-${seq}${suffix}`;
}

export async function findRegistrationByMobile(
  mobile: string
): Promise<{ id: string; registration_code: string } | null> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    const rows = await supabaseFetch<Array<{ id: string; registration_code: string }>>(
      `registrations?select=id,registration_code&mobile=eq.${encodeURIComponent(mobile)}&limit=1`
    );
    return rows[0] ?? null;
  }
  const sqlite = await getSqlite();
  const row = sqlite
    .prepare('SELECT id, registration_code FROM registrations WHERE mobile = ?')
    .get(mobile) as { id: string; registration_code: string } | undefined;
  return row ?? null;
}

export async function getPrimaryOrFallbackAdminId(): Promise<string | null> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    const primary = await supabaseFetch<Array<{ id: string }>>(
      'admins?select=id&is_active=eq.true&is_primary=eq.true&limit=1'
    );
    if (primary[0]?.id) return primary[0].id;
    const superAdmin = await supabaseFetch<Array<{ id: string }>>(
      'admins?select=id&is_active=eq.true&role=eq.super_admin&limit=1'
    );
    return superAdmin[0]?.id ?? null;
  }

  const sqlite = await getSqlite();
  const primary = sqlite
    .prepare('SELECT id FROM admins WHERE is_active = 1 AND is_primary = 1 LIMIT 1')
    .get() as { id: string } | undefined;
  if (primary?.id) return primary.id;
  const fallback = sqlite
    .prepare("SELECT id FROM admins WHERE is_active = 1 AND role = 'super_admin' LIMIT 1")
    .get() as { id: string } | undefined;
  return fallback?.id ?? null;
}

export async function createRegistration(input: {
  full_name: string;
  mobile: string;
  age: number;
  dob: string;
  full_address: string;
  occupation: OccupationType;
  whatsapp_consent: boolean;
  source: string;
}): Promise<RegistrationRecord> {
  await ensureInitialized();
  const id = crypto.randomUUID();
  const registrationCode = await generateRegistrationCode();
  const assignedAdminId = await getPrimaryOrFallbackAdminId();
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const inserted = await supabaseFetch<Array<Record<string, unknown>>>('registrations', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        id,
        registration_code: registrationCode,
        full_name: input.full_name,
        mobile: input.mobile,
        age: input.age,
        dob: input.dob,
        full_address: input.full_address,
        occupation: input.occupation,
        status: 'New',
        assigned_admin_id: assignedAdminId,
        follow_up_notes: '',
        privacy_consent: true,
        whatsapp_consent: Boolean(input.whatsapp_consent),
        source: input.source,
        created_at: now,
        updated_at: now,
      },
    });

    if (assignedAdminId) {
      await supabaseFetch('admin_assignments', {
        method: 'POST',
        body: {
          id: crypto.randomUUID(),
          registration_id: id,
          admin_id: assignedAdminId,
          notes: 'Auto-assigned to Primary Admin on submission',
          assigned_at: now,
        },
      });
    }

    await writeAuditLog(null, 'PUBLIC_REGISTRATION_CREATED', 'registrations', id, {
      registration_code: registrationCode,
      source: input.source,
    });

    const row = inserted[0];
    if (!row) {
      throw new DatabaseError('Registration insert returned empty response.', 500);
    }
    return normalizeRegistrationRow(row);
  }

  const sqlite = await getSqlite();
  sqlite
    .prepare(`
      INSERT INTO registrations (
        id, registration_code, full_name, mobile, age, dob, full_address,
        occupation, status, assigned_admin_id, follow_up_notes,
        privacy_consent, whatsapp_consent, source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, '', 1, ?, ?, ?, ?)
    `)
    .run(
      id,
      registrationCode,
      input.full_name,
      input.mobile,
      input.age,
      input.dob,
      input.full_address,
      input.occupation,
      assignedAdminId,
      input.whatsapp_consent ? 1 : 0,
      input.source,
      now,
      now
    );

  if (assignedAdminId) {
    sqlite
      .prepare(`
        INSERT INTO admin_assignments (id, registration_id, admin_id, notes, assigned_at)
        VALUES (?, ?, ?, 'Auto-assigned to Primary Admin on submission', ?)
      `)
      .run(crypto.randomUUID(), id, assignedAdminId, now);
  }

  await writeAuditLog(null, 'PUBLIC_REGISTRATION_CREATED', 'registrations', id, {
    registration_code: registrationCode,
    source: input.source,
  });

  const created = sqlite
    .prepare('SELECT * FROM registrations WHERE id = ?')
    .get(id) as Record<string, unknown>;
  return normalizeRegistrationRow(created);
}

export async function findActiveAdminByIdentifier(
  emailLower: string,
  mobileDigits: string
): Promise<AdminRecord | null> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    const admins = await supabaseFetch<Array<Record<string, unknown>>>(
      'admins?select=*&is_active=eq.true'
    );
    const match = admins.find((a) => {
      const em = String(a.email || '').toLowerCase();
      const mob = String(a.mobile || '');
      return em === emailLower || (mobileDigits.length > 0 && mob === mobileDigits);
    });
    return match ? normalizeAdminRow(match) : null;
  }

  const sqlite = await getSqlite();
  const row = sqlite
    .prepare('SELECT * FROM admins WHERE (LOWER(email) = ? OR mobile = ?) AND is_active = 1 LIMIT 1')
    .get(emailLower, mobileDigits || '__none__') as Record<string, unknown> | undefined;
  return row ? normalizeAdminRow(row) : null;
}

export async function getActiveAdminById(id: string): Promise<Omit<AdminRecord, 'password_hash'> | null> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    const rows = await supabaseFetch<Array<Record<string, unknown>>>(
      `admins?select=*&id=eq.${encodeURIComponent(id)}&is_active=eq.true&limit=1`
    );
    if (!rows[0]) return null;
    const { password_hash: _ph, ...safe } = normalizeAdminRow(rows[0]);
    return safe;
  }

  const sqlite = await getSqlite();
  const row = sqlite
    .prepare(
      'SELECT id, full_name, email, mobile, whatsapp_number, role, is_primary, notifications_enabled, is_active, created_at, updated_at FROM admins WHERE id = ? AND is_active = 1'
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: String(row.id),
    full_name: String(row.full_name),
    email: String(row.email).toLowerCase(),
    mobile: String(row.mobile),
    whatsapp_number: String(row.whatsapp_number),
    role: row.role === 'super_admin' ? 'super_admin' : 'sub_admin',
    is_primary: toBit(row.is_primary),
    notifications_enabled: toBit(row.notifications_enabled),
    is_active: toBit(row.is_active),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listRegistrationsForAdmin(
  admin: Omit<AdminRecord, 'password_hash'>
): Promise<RegistrationRecord[]> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    const [admins, regs] = await Promise.all([
      supabaseFetch<Array<{ id: string; full_name: string }>>('admins?select=id,full_name'),
      admin.role === 'super_admin'
        ? supabaseFetch<Array<Record<string, unknown>>>('registrations?select=*&order=created_at.desc')
        : supabaseFetch<Array<Record<string, unknown>>>(
            `registrations?select=*&assigned_admin_id=eq.${encodeURIComponent(admin.id)}&order=created_at.desc`
          ),
    ]);
    const nameMap = new Map(admins.map((a) => [a.id, a.full_name]));
    return regs.map((r) => normalizeRegistrationRow(r, nameMap));
  }

  const sqlite = await getSqlite();
  const rows =
    admin.role === 'super_admin'
      ? (sqlite
          .prepare(`
            SELECT r.*, a.full_name as assigned_admin_name
            FROM registrations r
            LEFT JOIN admins a ON r.assigned_admin_id = a.id
            ORDER BY r.created_at DESC
          `)
          .all() as Array<Record<string, unknown>>)
      : (sqlite
          .prepare(`
            SELECT r.*, a.full_name as assigned_admin_name
            FROM registrations r
            LEFT JOIN admins a ON r.assigned_admin_id = a.id
            WHERE r.assigned_admin_id = ?
            ORDER BY r.created_at DESC
          `)
          .all(admin.id) as Array<Record<string, unknown>>);

  return rows.map((r) => normalizeRegistrationRow(r));
}

export async function getRegistrationById(id: string): Promise<RegistrationRecord | null> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    const rows = await supabaseFetch<Array<Record<string, unknown>>>(
      `registrations?select=*&id=eq.${encodeURIComponent(id)}&limit=1`
    );
    if (!rows[0]) return null;
    const admins = await supabaseFetch<Array<{ id: string; full_name: string }>>('admins?select=id,full_name');
    const nameMap = new Map(admins.map((a) => [a.id, a.full_name]));
    return normalizeRegistrationRow(rows[0], nameMap);
  }

  const sqlite = await getSqlite();
  const row = sqlite
    .prepare(`
      SELECT r.*, a.full_name as assigned_admin_name
      FROM registrations r
      LEFT JOIN admins a ON r.assigned_admin_id = a.id
      WHERE r.id = ?
    `)
    .get(id) as Record<string, unknown> | undefined;
  return row ? normalizeRegistrationRow(row) : null;
}

export async function updateRegistrationById(
  id: string,
  updates: {
    full_name?: string;
    mobile?: string;
    age?: number;
    dob?: string;
    full_address?: string;
    occupation?: OccupationType;
    status?: RegistrationStatus;
    assigned_admin_id?: string | null;
    follow_up_notes?: string;
  },
  actorAdminId: string,
  reassignedFrom?: string | null
): Promise<RegistrationRecord> {
  await ensureInitialized();
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    await supabaseFetch(`registrations?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { ...updates, updated_at: now },
    });

    if (
      updates.assigned_admin_id &&
      updates.assigned_admin_id !== reassignedFrom
    ) {
      await supabaseFetch('admin_assignments', {
        method: 'POST',
        body: {
          id: crypto.randomUUID(),
          registration_id: id,
          admin_id: updates.assigned_admin_id,
          assigned_by: actorAdminId,
          notes: 'Reassigned by Super Admin',
          assigned_at: now,
        },
      });
    }

    const updated = await getRegistrationById(id);
    if (!updated) throw new DatabaseError('Registration not found after update.', 404);
    return updated;
  }

  const sqlite = await getSqlite();
  const existing = await getRegistrationById(id);
  if (!existing) throw new DatabaseError('Registration not found.', 404);

  const nextName = updates.full_name ?? existing.full_name;
  const nextMobile = updates.mobile ?? existing.mobile;
  const nextAge = updates.age ?? existing.age;
  const nextDob = updates.dob ?? existing.dob;
  const nextAddress = updates.full_address ?? existing.full_address;
  const nextOccupation = updates.occupation ?? existing.occupation;
  const nextStatus = updates.status ?? existing.status;
  const nextAssigned =
    updates.assigned_admin_id !== undefined ? updates.assigned_admin_id : existing.assigned_admin_id;
  const nextNotes = updates.follow_up_notes ?? existing.follow_up_notes;

  sqlite
    .prepare(`
      UPDATE registrations
      SET full_name = ?, mobile = ?, age = ?, dob = ?, full_address = ?,
          occupation = ?, status = ?, assigned_admin_id = ?, follow_up_notes = ?, updated_at = ?
      WHERE id = ?
    `)
    .run(
      nextName,
      nextMobile,
      nextAge,
      nextDob,
      nextAddress,
      nextOccupation,
      nextStatus,
      nextAssigned,
      nextNotes,
      now,
      id
    );

  if (nextAssigned && nextAssigned !== reassignedFrom) {
    sqlite
      .prepare(`
        INSERT INTO admin_assignments (id, registration_id, admin_id, assigned_by, notes, assigned_at)
        VALUES (?, ?, ?, ?, 'Reassigned by Super Admin', ?)
      `)
      .run(crypto.randomUUID(), id, nextAssigned, actorAdminId, now);
  }

  const updated = await getRegistrationById(id);
  if (!updated) throw new DatabaseError('Registration not found after update.', 404);
  return updated;
}

export async function deleteRegistrationById(id: string): Promise<void> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    await supabaseFetch(`registrations?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return;
  }
  const sqlite = await getSqlite();
  sqlite.prepare('DELETE FROM registrations WHERE id = ?').run(id);
}

export async function recordSyncLog(
  adminId: string,
  deviceId: string,
  recordsPulled: number,
  recordsPushed: number
): Promise<void> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  if (isSupabaseConfigured()) {
    await supabaseFetch('sync_logs', {
      method: 'POST',
      body: {
        id,
        admin_id: adminId,
        device_id: deviceId,
        records_pulled: recordsPulled,
        records_pushed: recordsPushed,
        sync_status: 'synced',
        created_at: now,
      },
    });
    return;
  }
  const sqlite = await getSqlite();
  sqlite
    .prepare(`
      INSERT INTO sync_logs (id, admin_id, device_id, records_pulled, records_pushed, sync_status, created_at)
      VALUES (?, ?, ?, ?, ?, 'synced', ?)
    `)
    .run(id, adminId, deviceId, recordsPulled, recordsPushed, now);
}

// ============================================================================
// ADMINS MANAGEMENT
// ============================================================================
export async function listAdmins(): Promise<Array<Omit<AdminRecord, 'password_hash'>>> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    const rows = await supabaseFetch<Array<Record<string, unknown>>>(
      'admins?select=*&order=is_primary.desc,created_at.asc'
    );
    return rows.map((r) => {
      const { password_hash: _ph, ...safe } = normalizeAdminRow(r);
      return safe;
    });
  }

  const sqlite = await getSqlite();
  const rows = sqlite
    .prepare('SELECT id, full_name, email, mobile, whatsapp_number, role, is_primary, notifications_enabled, is_active, created_at, updated_at FROM admins ORDER BY is_primary DESC, created_at ASC')
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => {
    const { password_hash: _ph, ...safe } = normalizeAdminRow(r);
    return safe;
  });
}

export async function getAdminByIdRaw(id: string): Promise<AdminRecord | null> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    const rows = await supabaseFetch<Array<Record<string, unknown>>>(
      `admins?select=*&id=eq.${encodeURIComponent(id)}&limit=1`
    );
    return rows[0] ? normalizeAdminRow(rows[0]) : null;
  }
  const sqlite = await getSqlite();
  const row = sqlite.prepare('SELECT * FROM admins WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? normalizeAdminRow(row) : null;
}

export async function findAdminByEmailOrMobile(emailLower: string, mobile: string): Promise<{ id: string } | null> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    const admins = await supabaseFetch<Array<{ id: string; email: string; mobile: string }>>(
      'admins?select=id,email,mobile'
    );
    const match = admins.find((a) => a.email.toLowerCase() === emailLower || a.mobile === mobile);
    return match ? { id: match.id } : null;
  }
  const sqlite = await getSqlite();
  const row = sqlite.prepare('SELECT id FROM admins WHERE LOWER(email) = ? OR mobile = ?').get(emailLower, mobile) as { id: string } | undefined;
  return row ?? null;
}

export async function createAdmin(input: {
  full_name: string;
  email: string;
  mobile: string;
  whatsapp_number: string;
  role: AdminRole;
  is_primary: boolean;
  notifications_enabled: boolean;
  password: string;
}): Promise<Omit<AdminRecord, 'password_hash'>> {
  await ensureInitialized();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = hashPassword(input.password);

  if (isSupabaseConfigured()) {
    if (input.is_primary) {
      await supabaseFetch('admins?is_primary=eq.true', {
        method: 'PATCH',
        body: { is_primary: false, updated_at: now },
      });
    }
    const inserted = await supabaseFetch<Array<Record<string, unknown>>>('admins', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        id,
        full_name: input.full_name,
        email: input.email.toLowerCase(),
        mobile: input.mobile,
        whatsapp_number: input.whatsapp_number,
        role: input.role,
        is_primary: input.is_primary,
        notifications_enabled: input.notifications_enabled,
        is_active: true,
        password_hash: passwordHash,
        created_at: now,
        updated_at: now,
      },
    });
    const { password_hash: _ph, ...safe } = normalizeAdminRow(inserted[0]);
    return safe;
  }

  const sqlite = await getSqlite();
  if (input.is_primary) {
    sqlite.prepare('UPDATE admins SET is_primary = 0').run();
  }
  sqlite
    .prepare(`
      INSERT INTO admins (id, full_name, email, mobile, whatsapp_number, role, is_primary, notifications_enabled, is_active, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `)
    .run(
      id,
      input.full_name,
      input.email.toLowerCase(),
      input.mobile,
      input.whatsapp_number,
      input.role,
      input.is_primary ? 1 : 0,
      input.notifications_enabled ? 1 : 0,
      passwordHash,
      now,
      now
    );

  const created = await getAdminByIdRaw(id);
  const { password_hash: _ph, ...safe } = created!;
  return safe;
}

export async function updateAdmin(
  id: string,
  existing: AdminRecord,
  updates: {
    full_name: string;
    email: string;
    mobile: string;
    whatsapp_number: string;
    role: AdminRole;
    is_primary: boolean;
    notifications_enabled: boolean;
    is_active: boolean;
    password_hash: string;
  }
): Promise<Omit<AdminRecord, 'password_hash'>> {
  await ensureInitialized();
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    if (updates.is_primary && existing.is_primary !== 1) {
      await supabaseFetch('admins?is_primary=eq.true', {
        method: 'PATCH',
        body: { is_primary: false, updated_at: now },
      });
    }
    const updatedRows = await supabaseFetch<Array<Record<string, unknown>>>(
      `admins?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        prefer: 'return=representation',
        body: {
          full_name: updates.full_name,
          email: updates.email,
          mobile: updates.mobile,
          whatsapp_number: updates.whatsapp_number,
          role: updates.role,
          is_primary: updates.is_primary,
          notifications_enabled: updates.notifications_enabled,
          is_active: updates.is_active,
          password_hash: updates.password_hash,
          updated_at: now,
        },
      }
    );
    const { password_hash: _ph, ...safe } = normalizeAdminRow(updatedRows[0]);
    return safe;
  }

  const sqlite = await getSqlite();
  if (updates.is_primary) {
    sqlite.prepare('UPDATE admins SET is_primary = 0').run();
  }
  sqlite
    .prepare(`
      UPDATE admins
      SET full_name = ?, email = ?, mobile = ?, whatsapp_number = ?, role = ?,
          is_primary = ?, notifications_enabled = ?, is_active = ?, password_hash = ?, updated_at = ?
      WHERE id = ?
    `)
    .run(
      updates.full_name,
      updates.email,
      updates.mobile,
      updates.whatsapp_number,
      updates.role,
      updates.is_primary ? 1 : 0,
      updates.notifications_enabled ? 1 : 0,
      updates.is_active ? 1 : 0,
      updates.password_hash,
      now,
      id
    );

  const updated = await getAdminByIdRaw(id);
  const { password_hash: _ph, ...safe } = updated!;
  return safe;
}

export async function deleteAdminAndReassign(id: string, reassignToAdminId: string): Promise<void> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    await supabaseFetch(`registrations?assigned_admin_id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { assigned_admin_id: reassignToAdminId },
    });
    await supabaseFetch(`admins?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return;
  }
  const sqlite = await getSqlite();
  sqlite.prepare('UPDATE registrations SET assigned_admin_id = ? WHERE assigned_admin_id = ?').run(reassignToAdminId, id);
  sqlite.prepare('DELETE FROM admins WHERE id = ?').run(id);
}

// ============================================================================
// NOTIFICATIONS & LOGS
// ============================================================================
export async function getNotificationSettings(): Promise<NotificationSettingsRecord> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    const rows = await supabaseFetch<Array<{
      global_enabled: boolean;
      extra_whatsapp_numbers: string[] | null;
      updated_at: string;
    }>>('notification_settings?select=global_enabled,extra_whatsapp_numbers,updated_at&id=eq.1&limit=1');
    const row = rows[0];
    return {
      global_enabled: row ? Boolean(row.global_enabled) : true,
      extra_whatsapp_numbers: Array.isArray(row?.extra_whatsapp_numbers) ? row.extra_whatsapp_numbers : [],
      updated_at: row?.updated_at || new Date().toISOString(),
    };
  }

  const sqlite = await getSqlite();
  const row = sqlite
    .prepare('SELECT global_enabled, extra_whatsapp_numbers, updated_at FROM notification_settings WHERE id = 1')
    .get() as { global_enabled: number; extra_whatsapp_numbers: string; updated_at: string } | undefined;
  return {
    global_enabled: row ? row.global_enabled === 1 : true,
    extra_whatsapp_numbers: row ? (JSON.parse(row.extra_whatsapp_numbers || '[]') as string[]) : [],
    updated_at: row?.updated_at || new Date().toISOString(),
  };
}

export async function updateNotificationSettings(
  globalEnabled: boolean,
  extraNumbers: string[],
  updatedByAdminId: string
): Promise<NotificationSettingsRecord> {
  await ensureInitialized();
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    await supabaseFetch('notification_settings?id=eq.1', {
      method: 'PATCH',
      body: {
        global_enabled: globalEnabled,
        extra_whatsapp_numbers: extraNumbers,
        updated_by: updatedByAdminId,
        updated_at: now,
      },
    });
    return { global_enabled: globalEnabled, extra_whatsapp_numbers: extraNumbers, updated_at: now };
  }

  const sqlite = await getSqlite();
  sqlite
    .prepare('UPDATE notification_settings SET global_enabled = ?, extra_whatsapp_numbers = ?, updated_by = ?, updated_at = ? WHERE id = 1')
    .run(globalEnabled ? 1 : 0, JSON.stringify(extraNumbers), updatedByAdminId, now);
  return { global_enabled: globalEnabled, extra_whatsapp_numbers: extraNumbers, updated_at: now };
}

export async function getEnabledAlertSuperAdmins(): Promise<AdminRecord[]> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    const rows = await supabaseFetch<Array<Record<string, unknown>>>(
      'admins?select=*&is_active=eq.true&notifications_enabled=eq.true'
    );
    return rows
      .map(normalizeAdminRow)
      .filter((a) => a.role === 'super_admin' || a.is_primary === 1);
  }
  const sqlite = await getSqlite();
  const rows = sqlite
    .prepare('SELECT * FROM admins WHERE is_active = 1 AND notifications_enabled = 1 AND (role = ? OR is_primary = 1)')
    .all('super_admin') as Array<Record<string, unknown>>;
  return rows.map(normalizeAdminRow);
}

export async function getNotificationLogEntry(
  registrationId: string,
  recipientWhatsapp: string
): Promise<{ id: string; delivery_status: string } | null> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    const rows = await supabaseFetch<Array<{ id: string; delivery_status: string }>>(
      `notification_logs?select=id,delivery_status&registration_id=eq.${encodeURIComponent(
        registrationId
      )}&recipient_whatsapp=eq.${encodeURIComponent(recipientWhatsapp)}&limit=1`
    );
    return rows[0] ?? null;
  }
  const sqlite = await getSqlite();
  const row = sqlite
    .prepare('SELECT id, delivery_status FROM notification_logs WHERE registration_id = ? AND recipient_whatsapp = ?')
    .get(registrationId, recipientWhatsapp) as { id: string; delivery_status: string } | undefined;
  return row ?? null;
}

export async function saveNotificationLogEntry(params: {
  existingId?: string;
  registrationId: string;
  adminId: string | null;
  recipientWhatsapp: string;
  messagePreview: string;
  providerMessageId?: string;
  deliveryStatus: DeliveryStatus;
  errorMessage?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const logId = params.existingId || crypto.randomUUID();

  if (isSupabaseConfigured()) {
    if (params.existingId) {
      await supabaseFetch(`notification_logs?id=eq.${encodeURIComponent(params.existingId)}`, {
        method: 'PATCH',
        body: {
          delivery_status: params.deliveryStatus,
          provider_message_id: params.providerMessageId ?? null,
          error_message: params.errorMessage ?? null,
          message_preview: params.messagePreview,
          created_at: now,
        },
      });
    } else {
      await supabaseFetch('notification_logs', {
        method: 'POST',
        body: {
          id: logId,
          registration_id: params.registrationId,
          admin_id: params.adminId,
          recipient_whatsapp: params.recipientWhatsapp,
          message_preview: params.messagePreview,
          provider_message_id: params.providerMessageId ?? null,
          delivery_status: params.deliveryStatus,
          error_message: params.errorMessage ?? null,
          created_at: now,
        },
      });
    }
    return;
  }

  const sqlite = await getSqlite();
  if (params.existingId) {
    sqlite
      .prepare(`
        UPDATE notification_logs
        SET delivery_status = ?, provider_message_id = ?, error_message = ?, message_preview = ?, created_at = ?
        WHERE id = ?
      `)
      .run(
        params.deliveryStatus,
        params.providerMessageId ?? null,
        params.errorMessage ?? null,
        params.messagePreview,
        now,
        params.existingId
      );
  } else {
    sqlite
      .prepare(`
        INSERT INTO notification_logs (id, registration_id, admin_id, recipient_whatsapp, message_preview, provider_message_id, delivery_status, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        logId,
        params.registrationId,
        params.adminId,
        params.recipientWhatsapp,
        params.messagePreview,
        params.providerMessageId ?? null,
        params.deliveryStatus,
        params.errorMessage ?? null
      );
  }
}

export async function listLogsForSuperAdmin(): Promise<{
  notificationLogs: NotificationLogRecord[];
  syncLogs: SyncLogRecord[];
  auditLogs: AuditLogRecord[];
}> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    const [notifRows, syncRows, auditRows, regs, admins] = await Promise.all([
      supabaseFetch<Array<Record<string, unknown>>>('notification_logs?select=*&order=created_at.desc&limit=50'),
      supabaseFetch<Array<Record<string, unknown>>>('sync_logs?select=*&order=created_at.desc&limit=30'),
      supabaseFetch<Array<Record<string, unknown>>>('audit_logs?select=*&order=created_at.desc&limit=40'),
      supabaseFetch<Array<{ id: string; registration_code: string; full_name: string }>>('registrations?select=id,registration_code,full_name'),
      supabaseFetch<Array<{ id: string; full_name: string }>>('admins?select=id,full_name'),
    ]);

    const regMap = new Map(regs.map((r) => [r.id, r]));
    const adminMap = new Map(admins.map((a) => [a.id, a.full_name]));

    return {
      notificationLogs: notifRows.map((nl) => {
        const reg = regMap.get(String(nl.registration_id));
        return {
          id: String(nl.id),
          registration_id: String(nl.registration_id),
          admin_id: nl.admin_id ? String(nl.admin_id) : null,
          recipient_whatsapp: String(nl.recipient_whatsapp),
          message_preview: String(nl.message_preview),
          provider_message_id: nl.provider_message_id ? String(nl.provider_message_id) : null,
          delivery_status: nl.delivery_status as DeliveryStatus,
          error_message: nl.error_message ? String(nl.error_message) : null,
          created_at: String(nl.created_at),
          registration_code: reg?.registration_code,
          registrant_name: reg?.full_name,
        };
      }),
      syncLogs: syncRows.map((sl) => ({
        id: String(sl.id),
        admin_id: String(sl.admin_id),
        device_id: String(sl.device_id),
        records_pulled: Number(sl.records_pulled) || 0,
        records_pushed: Number(sl.records_pushed) || 0,
        sync_status: (sl.sync_status as 'synced' | 'partial' | 'failed') || 'synced',
        created_at: String(sl.created_at),
        admin_name: adminMap.get(String(sl.admin_id)),
      })),
      auditLogs: auditRows.map((al) => ({
        id: String(al.id),
        actor_admin_id: al.actor_admin_id ? String(al.actor_admin_id) : null,
        action: String(al.action),
        target_table: String(al.target_table),
        target_id: String(al.target_id),
        metadata: typeof al.metadata === 'string' ? al.metadata : JSON.stringify(al.metadata || {}),
        created_at: String(al.created_at),
        actor_name: al.actor_admin_id ? adminMap.get(String(al.actor_admin_id)) : undefined,
      })),
    };
  }

  const sqlite = await getSqlite();
  const notificationLogs = sqlite
    .prepare(`
      SELECT nl.*, r.registration_code, r.full_name as registrant_name
      FROM notification_logs nl
      LEFT JOIN registrations r ON nl.registration_id = r.id
      ORDER BY nl.created_at DESC
      LIMIT 50
    `)
    .all() as NotificationLogRecord[];

  const syncLogs = sqlite
    .prepare(`
      SELECT sl.*, a.full_name as admin_name
      FROM sync_logs sl
      LEFT JOIN admins a ON sl.admin_id = a.id
      ORDER BY sl.created_at DESC
      LIMIT 30
    `)
    .all() as SyncLogRecord[];

  const auditLogs = sqlite
    .prepare(`
      SELECT al.*, a.full_name as actor_name
      FROM audit_logs al
      LEFT JOIN admins a ON al.actor_admin_id = a.id
      ORDER BY al.created_at DESC
      LIMIT 40
    `)
    .all() as AuditLogRecord[];

  return { notificationLogs, syncLogs, auditLogs };
}

export async function restoreBackupRegistrations(
  records: Array<Partial<RegistrationRecord>>,
  actorAdminId: string
): Promise<number> {
  await ensureInitialized();
  let restored = 0;
  const now = new Date().toISOString();

  for (const r of records) {
    if (!r.full_name || !r.mobile || !r.dob || !r.full_address || !r.occupation) continue;
    const cleanMobile = String(r.mobile).replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) continue;

    const existing = await findRegistrationByMobile(cleanMobile);
    if (existing) continue;

    const id = r.id ? String(r.id) : crypto.randomUUID();
    const code = r.registration_code ? String(r.registration_code) : await generateRegistrationCode();
    const ageVal = Number(r.age) >= 18 ? Number(r.age) : 18;
    const validOcc = ['Student', 'Job', 'Business', 'Other'].includes(String(r.occupation))
      ? String(r.occupation)
      : 'Other';
    const validStatus = ['New', 'Contacted', 'Follow-up', 'Completed'].includes(String(r.status))
      ? String(r.status)
      : 'New';

    if (isSupabaseConfigured()) {
      await supabaseFetch('registrations', {
        method: 'POST',
        prefer: 'resolution=ignore-duplicates',
        body: {
          id,
          registration_code: code,
          full_name: String(r.full_name),
          mobile: cleanMobile,
          age: ageVal,
          dob: String(r.dob),
          full_address: String(r.full_address),
          occupation: validOcc,
          status: validStatus,
          assigned_admin_id: actorAdminId,
          follow_up_notes: String(r.follow_up_notes || ''),
          privacy_consent: true,
          whatsapp_consent: Boolean(r.whatsapp_consent),
          source: String(r.source || 'direct_link'),
          created_at: String(r.created_at || now),
          updated_at: now,
        },
      });
    } else {
      const sqlite = await getSqlite();
      sqlite
        .prepare(`
          INSERT INTO registrations (
            id, registration_code, full_name, mobile, age, dob, full_address,
            occupation, status, assigned_admin_id, follow_up_notes,
            privacy_consent, whatsapp_consent, source, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
        `)
        .run(
          id,
          code,
          String(r.full_name),
          cleanMobile,
          ageVal,
          String(r.dob),
          String(r.full_address),
          validOcc,
          validStatus,
          actorAdminId,
          String(r.follow_up_notes || ''),
          r.whatsapp_consent ? 1 : 0,
          String(r.source || 'direct_link'),
          String(r.created_at || now),
          now
        );
    }
    restored++;
  }

  await writeAuditLog(actorAdminId, 'BACKUP_RESTORED', 'registrations', 'batch', { restored });
  return restored;
}
