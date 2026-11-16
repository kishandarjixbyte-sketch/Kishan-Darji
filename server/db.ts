import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type AdminRole = 'super_admin' | 'sub_admin';
export type OccupationType = 'Student' | 'Job' | 'Business' | 'Other';
export type RegistrationStatus = 'New' | 'Contacted' | 'Follow-up' | 'Completed';

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

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'join_bajrang_dal.db');
export const sqlite = new DatabaseSync(dbPath);

sqlite.exec('PRAGMA journal_mode = WAL;');
sqlite.exec('PRAGMA foreign_keys = ON;');

sqlite.exec(`
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

function upsertDefaultAdmin(params: {
  full_name: string;
  email: string;
  mobile: string;
  whatsapp_number: string;
  role: AdminRole;
  is_primary: number;
  notifications_enabled: number;
  password: string;
}) {
  const existing = sqlite
    .prepare('SELECT id FROM admins WHERE mobile = ? OR LOWER(email) = ? LIMIT 1')
    .get(params.mobile, params.email.toLowerCase()) as { id: string } | undefined;

  const now = new Date().toISOString();
  if (!existing) {
    if (params.is_primary === 1) {
      sqlite.prepare('UPDATE admins SET is_primary = 0').run();
    }
    sqlite.prepare(`
      INSERT INTO admins (id, full_name, email, mobile, whatsapp_number, role, is_primary, notifications_enabled, is_active, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      params.full_name,
      params.email.toLowerCase(),
      params.mobile,
      params.whatsapp_number,
      params.role,
      params.is_primary,
      params.notifications_enabled,
      hashPassword(params.password),
      now,
      now
    );
  }
}

function seedInitialData() {
  // Disable placeholder default super admin alerts if present from initial boot
  sqlite.prepare(`
    UPDATE admins
    SET is_primary = 0, notifications_enabled = 0
    WHERE mobile = '9876543210' AND email = 'superadmin@bajrangdal.org'
  `).run();

  // Configured Admin WhatsApp recipients requested by user
  upsertDefaultAdmin({
    full_name: 'Kishan Darji',
    email: 'kishan.darji.xbyte@gmail.com',
    mobile: '9638236795',
    whatsapp_number: '919638236795',
    role: 'super_admin',
    is_primary: 1,
    notifications_enabled: 1,
    password: 'Admin@2026',
  });

  upsertDefaultAdmin({
    full_name: 'Ronakisinh Parmar',
    email: 'ronakisinh.parmar@bajrangdal.org',
    mobile: '9016877373',
    whatsapp_number: '919016877373',
    role: 'super_admin',
    is_primary: 0,
    notifications_enabled: 1,
    password: 'Admin@2026',
  });

  // Sub Admin account for RBAC testing (alerts off by default)
  upsertDefaultAdmin({
    full_name: 'Vikram Desai (Sub Admin)',
    email: 'subadmin@bajrangdal.org',
    mobile: '9825011223',
    whatsapp_number: '919825011223',
    role: 'sub_admin',
    is_primary: 0,
    notifications_enabled: 0,
    password: 'SubAdmin@2026',
  });

  // Reassign any registrations previously assigned to placeholder admin over to Kishan Darji
  const kishan = sqlite.prepare('SELECT id FROM admins WHERE mobile = ?').get('9638236795') as { id: string } | undefined;
  const placeholder = sqlite.prepare('SELECT id FROM admins WHERE mobile = ?').get('9876543210') as { id: string } | undefined;
  if (kishan && placeholder) {
    sqlite.prepare('UPDATE registrations SET assigned_admin_id = ? WHERE assigned_admin_id = ?').run(kishan.id, placeholder.id);
    sqlite.prepare('DELETE FROM admins WHERE id = ?').run(placeholder.id);
  }

  sqlite.prepare(`
    INSERT OR IGNORE INTO notification_settings (id, global_enabled, extra_whatsapp_numbers)
    VALUES (1, 1, '[]')
  `).run();
}

seedInitialData();

export function writeAuditLog(
  actorAdminId: string | null,
  action: string,
  targetTable: string,
  targetId: string,
  metadata: Record<string, unknown> = {}
) {
  const id = crypto.randomUUID();
  sqlite.prepare(`
    INSERT INTO audit_logs (id, actor_admin_id, action, target_table, target_id, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, actorAdminId, action, targetTable, targetId, JSON.stringify(metadata));
}

export function generateRegistrationCode(): string {
  const year = new Date().getFullYear();
  const countRow = sqlite.prepare('SELECT COUNT(*) as count FROM registrations').get() as { count: number };
  const seq = 1001 + countRow.count;
  const suffix = crypto.randomInt(10, 99);
  return `JBD-${year}-${seq}${suffix}`;
}

export async function mirrorToSupabase(table: string, payload: Record<string, unknown>) {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) return;

  try {
    const cleanPayload: Record<string, unknown> = { ...payload };
    if (table === 'registrations') {
      cleanPayload.privacy_consent = Boolean(cleanPayload.privacy_consent);
      cleanPayload.whatsapp_consent = Boolean(cleanPayload.whatsapp_consent);
      delete cleanPayload.assigned_admin_name;
    } else if (table === 'admins') {
      cleanPayload.is_primary = Boolean(cleanPayload.is_primary);
      cleanPayload.notifications_enabled = Boolean(cleanPayload.notifications_enabled);
      cleanPayload.is_active = Boolean(cleanPayload.is_active);
    }

    const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(cleanPayload),
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error(`Supabase mirror warning (${table}):`, errText);
    }
  } catch (err) {
    console.error(`Supabase mirror error (${table}):`, err);
  }
}

export async function hydrateFromSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) return;

  try {
    const base = supabaseUrl.replace(/\/$/, '');
    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    };

    const adminsRes = await fetch(`${base}/rest/v1/admins?select=*`, { headers });
    if (adminsRes.ok) {
      const remoteAdmins = (await adminsRes.json()) as Array<Record<string, unknown>>;
      for (const a of remoteAdmins) {
        if (!a.id || !a.email || !a.mobile) continue;
        sqlite.prepare(`
          INSERT OR IGNORE INTO admins (
            id, full_name, email, mobile, whatsapp_number, role,
            is_primary, notifications_enabled, is_active, password_hash, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          String(a.id),
          String(a.full_name || 'Admin'),
          String(a.email).toLowerCase(),
          String(a.mobile),
          String(a.whatsapp_number || a.mobile),
          a.role === 'super_admin' ? 'super_admin' : 'sub_admin',
          a.is_primary ? 1 : 0,
          a.notifications_enabled !== false ? 1 : 0,
          a.is_active !== false ? 1 : 0,
          String(a.password_hash || hashPassword('Admin@2026')),
          String(a.created_at || new Date().toISOString()),
          String(a.updated_at || new Date().toISOString())
        );
      }
    }

    const regRes = await fetch(`${base}/rest/v1/registrations?select=*`, { headers });
    if (regRes.ok) {
      const remoteRegs = (await regRes.json()) as Array<Record<string, unknown>>;
      for (const r of remoteRegs) {
        if (!r.id || !r.registration_code || !r.mobile) continue;
        sqlite.prepare(`
          INSERT OR IGNORE INTO registrations (
            id, registration_code, full_name, mobile, age, dob, full_address,
            occupation, status, assigned_admin_id, follow_up_notes,
            privacy_consent, whatsapp_consent, source, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          String(r.id),
          String(r.registration_code),
          String(r.full_name || ''),
          String(r.mobile),
          Number(r.age) || 18,
          String(r.dob || '2000-01-01'),
          String(r.full_address || ''),
          String(r.occupation || 'Other'),
          String(r.status || 'New'),
          r.assigned_admin_id ? String(r.assigned_admin_id) : null,
          String(r.follow_up_notes || ''),
          r.privacy_consent ? 1 : 0,
          r.whatsapp_consent ? 1 : 0,
          String(r.source || 'direct_link'),
          String(r.created_at || new Date().toISOString()),
          String(r.updated_at || new Date().toISOString())
        );
      }
    }
  } catch (err) {
    console.error('Supabase hydration warning:', err);
  }
}

void hydrateFromSupabase();
