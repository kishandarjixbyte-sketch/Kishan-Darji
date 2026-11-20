import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type AdminRole = 'super_admin' | 'sub_admin';
export type OrganizationWing = 'bajrang_dal' | 'durga_vahini';
export type EventWingScope = 'all' | 'bajrang_dal' | 'durga_vahini' | 'vhp';
export type OccupationType = 'Student' | 'Job' | 'Business' | 'Other';
export type RegistrationStatus = 'New' | 'Contacted' | 'Follow-up' | 'Completed';
export type MembershipStatus = 'Pending' | 'Approved' | 'Rejected';
export type IdentityVerificationStatus = 'Pending' | 'Verified' | 'Rejected';
export type EventApprovalStatus = 'Pending' | 'Approved' | 'Rejected';
export type DeliveryStatus = 'sent' | 'delivered' | 'failed' | 'skipped_disabled' | 'queued_unconfigured';
export type BackupType = 'daily_auto' | 'weekly_auto' | 'manual';
export type FestivalThemeId =
  | 'normal'
  | 'diwali'
  | 'navratri'
  | 'ram_navami'
  | 'hanuman_jayanti'
  | 'janmashtami'
  | 'holi'
  | 'makar_sankranti';

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
  assigned_area: string;
  assigned_district: string;
  assigned_city: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface RegistrationRecord {
  id: string;
  registration_code: string;
  organization_wing: OrganizationWing;
  full_name: string;
  father_or_guardian_name: string;
  mobile: string;
  whatsapp_number: string;
  email: string;
  age: number;
  dob: string;
  full_address: string;
  city_village: string;
  district: string;
  state: string;
  pincode: string;
  occupation: OccupationType;
  education: string;
  profile_photo_data: string;
  identity_doc_data?: string;
  identity_doc_name: string;
  has_identity_doc?: boolean;
  identity_verification_status: IdentityVerificationStatus;
  membership_status: MembershipStatus;
  registration_date: string;
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

export interface EventRecord {
  id: string;
  slug: string;
  title: string;
  description: string;
  poster_data: string;
  event_date: string;
  event_time: string;
  venue: string;
  location_city: string;
  reg_start_date: string;
  reg_end_date: string;
  max_capacity: number;
  registration_enabled: number;
  category: string;
  organization_wing: EventWingScope;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  stats?: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    available_seats: number;
  };
}

export interface EventRegistrationRecord {
  id: string;
  event_id: string;
  registration_code: string;
  full_name: string;
  mobile: string;
  whatsapp_number: string;
  email: string;
  city_village: string;
  district: string;
  age: number;
  organization_wing: string;
  notes: string;
  approval_status: EventApprovalStatus;
  whatsapp_consent: number;
  created_at: string;
  updated_at: string;
}

export interface OrganizationFaqItem {
  q: string;
  a: string;
}

export interface OrganizationPageRecord {
  slug: 'bajrang_dal' | 'vhp' | 'durga_vahini';
  title: string;
  subtitle: string;
  introduction: string;
  history: string;
  objectives: string;
  activities: string;
  structure: string;
  faqs: OrganizationFaqItem[];
  new_joinee_guide: string;
  contact_info: string;
  updated_by: string | null;
  updated_at: string;
}

export interface ThemeScheduleRule {
  theme: FestivalThemeId;
  start_date: string; // MM-DD or YYYY-MM-DD
  end_date: string;
  banner_text?: string;
}

export interface ThemeSettingsRecord {
  id: number;
  active_theme: FestivalThemeId;
  effective_theme?: FestivalThemeId;
  auto_schedule_enabled: boolean;
  custom_banner_text: string;
  custom_bg_style: string;
  animations_enabled: boolean;
  schedules: ThemeScheduleRule[];
  updated_by: string | null;
  updated_at: string;
}

export interface BackupRecord {
  id: string;
  backup_type: BackupType;
  status: 'success' | 'failed';
  record_counts: Record<string, unknown>;
  encrypted_payload?: string;
  checksum: string;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
}

export interface NotificationLogRecord {
  id: string;
  registration_id: string | null;
  admin_id: string | null;
  recipient_whatsapp: string;
  language: string;
  message_type: string;
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

export function resolveSupabaseEnv(): { baseUrl: string; serviceKey: string } {
  const baseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '');
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
  return { baseUrl, serviceKey };
}

export function isSupabaseConfigured(): boolean {
  const { baseUrl, serviceKey } = resolveSupabaseEnv();
  return Boolean(baseUrl && serviceKey && baseUrl.startsWith('http'));
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

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
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
    assigned_area: String(raw.assigned_area || ''),
    assigned_district: String(raw.assigned_district || ''),
    assigned_city: String(raw.assigned_city || ''),
    password_hash: String(raw.password_hash || ''),
    created_at: String(raw.created_at || new Date().toISOString()),
    updated_at: String(raw.updated_at || new Date().toISOString()),
  };
}

function normalizeRegistrationRow(
  raw: Record<string, unknown>,
  adminNameMap?: Map<string, string>,
  includePrivateDoc = false
): RegistrationRecord {
  const assignedId = raw.assigned_admin_id ? String(raw.assigned_admin_id) : null;
  const docData = String(raw.identity_doc_data || '');
  const wing: OrganizationWing = raw.organization_wing === 'durga_vahini' ? 'durga_vahini' : 'bajrang_dal';
  return {
    id: String(raw.id),
    registration_code: String(raw.registration_code || ''),
    organization_wing: wing,
    full_name: String(raw.full_name || ''),
    father_or_guardian_name: String(raw.father_or_guardian_name || ''),
    mobile: String(raw.mobile || ''),
    whatsapp_number: String(raw.whatsapp_number || raw.mobile || ''),
    email: String(raw.email || ''),
    age: Number(raw.age) || 18,
    dob: String(raw.dob || ''),
    full_address: String(raw.full_address || ''),
    city_village: String(raw.city_village || ''),
    district: String(raw.district || ''),
    state: String(raw.state || 'Gujarat'),
    pincode: String(raw.pincode || ''),
    occupation: (raw.occupation as OccupationType) || 'Other',
    education: String(raw.education || ''),
    profile_photo_data: String(raw.profile_photo_data || ''),
    ...(includePrivateDoc ? { identity_doc_data: docData } : {}),
    identity_doc_name: String(raw.identity_doc_name || ''),
    has_identity_doc: docData.length > 0,
    identity_verification_status:
      (raw.identity_verification_status as IdentityVerificationStatus) || 'Pending',
    membership_status: (raw.membership_status as MembershipStatus) || 'Pending',
    registration_date: String(raw.registration_date || String(raw.created_at || '').slice(0, 10)),
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

function normalizeEventRow(raw: Record<string, unknown>): EventRecord {
  const wing = raw.organization_wing;
  const validWing: EventWingScope =
    wing === 'bajrang_dal' || wing === 'durga_vahini' || wing === 'vhp' ? wing : 'all';
  return {
    id: String(raw.id),
    slug: String(raw.slug || ''),
    title: String(raw.title || ''),
    description: String(raw.description || ''),
    poster_data: String(raw.poster_data || ''),
    event_date: String(raw.event_date || ''),
    event_time: String(raw.event_time || ''),
    venue: String(raw.venue || ''),
    location_city: String(raw.location_city || ''),
    reg_start_date: String(raw.reg_start_date || ''),
    reg_end_date: String(raw.reg_end_date || ''),
    max_capacity: Number(raw.max_capacity) || 100,
    registration_enabled: toBit(raw.registration_enabled),
    category: String(raw.category || 'Seva'),
    organization_wing: validWing,
    created_by: raw.created_by ? String(raw.created_by) : null,
    created_at: String(raw.created_at || new Date().toISOString()),
    updated_at: String(raw.updated_at || new Date().toISOString()),
  };
}

function normalizeEventRegistrationRow(raw: Record<string, unknown>): EventRegistrationRecord {
  const status = raw.approval_status;
  const validStatus: EventApprovalStatus =
    status === 'Approved' || status === 'Rejected' ? status : 'Pending';
  return {
    id: String(raw.id),
    event_id: String(raw.event_id),
    registration_code: String(raw.registration_code || ''),
    full_name: String(raw.full_name || ''),
    mobile: String(raw.mobile || ''),
    whatsapp_number: String(raw.whatsapp_number || raw.mobile || ''),
    email: String(raw.email || ''),
    city_village: String(raw.city_village || ''),
    district: String(raw.district || ''),
    age: Number(raw.age) || 18,
    organization_wing: String(raw.organization_wing || 'general'),
    notes: String(raw.notes || ''),
    approval_status: validStatus,
    whatsapp_consent: toBit(raw.whatsapp_consent),
    created_at: String(raw.created_at || new Date().toISOString()),
    updated_at: String(raw.updated_at || new Date().toISOString()),
  };
}

function normalizeOrgPageRow(raw: Record<string, unknown>): OrganizationPageRecord {
  const slug =
    raw.slug === 'vhp' || raw.slug === 'durga_vahini' ? raw.slug : 'bajrang_dal';
  return {
    slug,
    title: String(raw.title || ''),
    subtitle: String(raw.subtitle || ''),
    introduction: String(raw.introduction || ''),
    history: String(raw.history || ''),
    objectives: String(raw.objectives || ''),
    activities: String(raw.activities || ''),
    structure: String(raw.structure || ''),
    faqs: safeJsonParse<OrganizationFaqItem[]>(raw.faqs, []),
    new_joinee_guide: String(raw.new_joinee_guide || ''),
    contact_info: String(raw.contact_info || ''),
    updated_by: raw.updated_by ? String(raw.updated_by) : null,
    updated_at: String(raw.updated_at || new Date().toISOString()),
  };
}

// ============================================================================
// SUPABASE REST CLIENT
// ============================================================================
function getSupabaseConfig(): { baseUrl: string; serviceKey: string } {
  const { baseUrl, serviceKey } = resolveSupabaseEnv();
  if (!baseUrl || !serviceKey) {
    throw new DatabaseError(
      'Database is not configured on Vercel. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) in Vercel Environment Variables and run supabase/schema.sql.',
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
    'Content-Type': 'application/json',
  };
  if (!serviceKey.startsWith('sb_secret_')) {
    headers.Authorization = `Bearer ${serviceKey}`;
  }
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
// LAZY SQLITE CLIENT WITH SAFE SCHEMA MIGRATION
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

function ensureSqliteColumns(db: SqliteSyncInstance, table: string, columns: Array<{ name: string; ddl: string }>) {
  const existingCols = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
    (c) => c.name
  );
  for (const col of columns) {
    if (!existingCols.includes(col.name)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.ddl};`);
    }
  }
}

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
          assigned_area TEXT NOT NULL DEFAULT '',
          assigned_district TEXT NOT NULL DEFAULT '',
          assigned_city TEXT NOT NULL DEFAULT '',
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE TABLE IF NOT EXISTS registrations (
          id TEXT PRIMARY KEY,
          registration_code TEXT NOT NULL UNIQUE,
          full_name TEXT NOT NULL,
          mobile TEXT NOT NULL UNIQUE,
          age INTEGER NOT NULL CHECK (age >= 15),
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
          registration_id TEXT REFERENCES registrations(id) ON DELETE CASCADE,
          admin_id TEXT REFERENCES admins(id) ON DELETE SET NULL,
          recipient_whatsapp TEXT NOT NULL,
          language TEXT NOT NULL DEFAULT 'en',
          message_type TEXT NOT NULL DEFAULT 'registration_alert',
          message_preview TEXT NOT NULL,
          provider_message_id TEXT,
          delivery_status TEXT NOT NULL CHECK (delivery_status IN ('sent', 'delivered', 'failed', 'skipped_disabled', 'queued_unconfigured')),
          error_message TEXT,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
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

        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          poster_data TEXT NOT NULL DEFAULT '',
          event_date TEXT NOT NULL,
          event_time TEXT NOT NULL DEFAULT '10:00',
          venue TEXT NOT NULL,
          location_city TEXT NOT NULL DEFAULT '',
          reg_start_date TEXT NOT NULL DEFAULT '',
          reg_end_date TEXT NOT NULL DEFAULT '',
          max_capacity INTEGER NOT NULL DEFAULT 200,
          registration_enabled INTEGER NOT NULL DEFAULT 1,
          category TEXT NOT NULL DEFAULT 'Seva',
          organization_wing TEXT NOT NULL DEFAULT 'all',
          created_by TEXT REFERENCES admins(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE TABLE IF NOT EXISTS event_registrations (
          id TEXT PRIMARY KEY,
          event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          registration_code TEXT NOT NULL UNIQUE,
          full_name TEXT NOT NULL,
          mobile TEXT NOT NULL,
          whatsapp_number TEXT NOT NULL DEFAULT '',
          email TEXT NOT NULL DEFAULT '',
          city_village TEXT NOT NULL DEFAULT '',
          district TEXT NOT NULL DEFAULT '',
          age INTEGER NOT NULL DEFAULT 18,
          organization_wing TEXT NOT NULL DEFAULT 'general',
          notes TEXT NOT NULL DEFAULT '',
          approval_status TEXT NOT NULL DEFAULT 'Pending',
          whatsapp_consent INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          UNIQUE (event_id, mobile)
        );

        CREATE TABLE IF NOT EXISTS organization_pages (
          slug TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          subtitle TEXT NOT NULL DEFAULT '',
          introduction TEXT NOT NULL DEFAULT '',
          history TEXT NOT NULL DEFAULT '',
          objectives TEXT NOT NULL DEFAULT '',
          activities TEXT NOT NULL DEFAULT '',
          structure TEXT NOT NULL DEFAULT '',
          faqs TEXT NOT NULL DEFAULT '[]',
          new_joinee_guide TEXT NOT NULL DEFAULT '',
          contact_info TEXT NOT NULL DEFAULT '',
          updated_by TEXT REFERENCES admins(id) ON DELETE SET NULL,
          updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE TABLE IF NOT EXISTS theme_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          active_theme TEXT NOT NULL DEFAULT 'normal',
          auto_schedule_enabled INTEGER NOT NULL DEFAULT 1,
          custom_banner_text TEXT NOT NULL DEFAULT '',
          custom_bg_style TEXT NOT NULL DEFAULT '',
          animations_enabled INTEGER NOT NULL DEFAULT 1,
          schedules TEXT NOT NULL DEFAULT '[]',
          updated_by TEXT REFERENCES admins(id) ON DELETE SET NULL,
          updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE TABLE IF NOT EXISTS backups (
          id TEXT PRIMARY KEY,
          backup_type TEXT NOT NULL,
          status TEXT NOT NULL,
          record_counts TEXT NOT NULL DEFAULT '{}',
          encrypted_payload TEXT NOT NULL DEFAULT '',
          checksum TEXT NOT NULL DEFAULT '',
          error_message TEXT,
          created_by TEXT REFERENCES admins(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );
      `);

      ensureSqliteColumns(db, 'registrations', [
        { name: 'organization_wing', ddl: "TEXT NOT NULL DEFAULT 'bajrang_dal'" },
        { name: 'father_or_guardian_name', ddl: "TEXT NOT NULL DEFAULT ''" },
        { name: 'whatsapp_number', ddl: "TEXT NOT NULL DEFAULT ''" },
        { name: 'email', ddl: "TEXT NOT NULL DEFAULT ''" },
        { name: 'city_village', ddl: "TEXT NOT NULL DEFAULT ''" },
        { name: 'district', ddl: "TEXT NOT NULL DEFAULT ''" },
        { name: 'state', ddl: "TEXT NOT NULL DEFAULT 'Gujarat'" },
        { name: 'pincode', ddl: "TEXT NOT NULL DEFAULT ''" },
        { name: 'education', ddl: "TEXT NOT NULL DEFAULT ''" },
        { name: 'profile_photo_data', ddl: "TEXT NOT NULL DEFAULT ''" },
        { name: 'identity_doc_data', ddl: "TEXT NOT NULL DEFAULT ''" },
        { name: 'identity_doc_name', ddl: "TEXT NOT NULL DEFAULT ''" },
        { name: 'identity_verification_status', ddl: "TEXT NOT NULL DEFAULT 'Pending'" },
        { name: 'membership_status', ddl: "TEXT NOT NULL DEFAULT 'Pending'" },
        { name: 'registration_date', ddl: "TEXT NOT NULL DEFAULT ''" },
      ]);

      ensureSqliteColumns(db, 'admins', [
        { name: 'assigned_area', ddl: "TEXT NOT NULL DEFAULT ''" },
        { name: 'assigned_district', ddl: "TEXT NOT NULL DEFAULT ''" },
        { name: 'assigned_city', ddl: "TEXT NOT NULL DEFAULT ''" },
      ]);

      ensureSqliteColumns(db, 'notification_logs', [
        { name: 'language', ddl: "TEXT NOT NULL DEFAULT 'en'" },
        { name: 'message_type', ddl: "TEXT NOT NULL DEFAULT 'registration_alert'" },
      ]);

      // Upgrade legacy CHECK (age >= 18) constraint on existing SQLite DBs to age >= 15 for Durga Vahini
      const regTableMeta = db
        .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'registrations'")
        .get() as { sql?: string } | undefined;
      if (regTableMeta?.sql && /age\s*>=\s*18/i.test(regTableMeta.sql)) {
        db.exec('PRAGMA foreign_keys = OFF;');
        db.exec('BEGIN TRANSACTION;');
        try {
          db.exec(`
            CREATE TABLE registrations_migrated (
              id TEXT PRIMARY KEY,
              registration_code TEXT NOT NULL UNIQUE,
              full_name TEXT NOT NULL,
              mobile TEXT NOT NULL UNIQUE,
              age INTEGER NOT NULL CHECK (age >= 15),
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
              updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
              organization_wing TEXT NOT NULL DEFAULT 'bajrang_dal',
              father_or_guardian_name TEXT NOT NULL DEFAULT '',
              whatsapp_number TEXT NOT NULL DEFAULT '',
              email TEXT NOT NULL DEFAULT '',
              city_village TEXT NOT NULL DEFAULT '',
              district TEXT NOT NULL DEFAULT '',
              state TEXT NOT NULL DEFAULT 'Gujarat',
              pincode TEXT NOT NULL DEFAULT '',
              education TEXT NOT NULL DEFAULT '',
              profile_photo_data TEXT NOT NULL DEFAULT '',
              identity_doc_data TEXT NOT NULL DEFAULT '',
              identity_doc_name TEXT NOT NULL DEFAULT '',
              identity_verification_status TEXT NOT NULL DEFAULT 'Pending',
              membership_status TEXT NOT NULL DEFAULT 'Pending',
              registration_date TEXT NOT NULL DEFAULT ''
            );
            INSERT INTO registrations_migrated (
              id, registration_code, full_name, mobile, age, dob, full_address, occupation, status,
              assigned_admin_id, follow_up_notes, privacy_consent, whatsapp_consent, source,
              created_at, updated_at, organization_wing, father_or_guardian_name, whatsapp_number,
              email, city_village, district, state, pincode, education, profile_photo_data,
              identity_doc_data, identity_doc_name, identity_verification_status, membership_status, registration_date
            )
            SELECT
              id, registration_code, full_name, mobile, age, dob, full_address, occupation, status,
              assigned_admin_id, follow_up_notes, privacy_consent, whatsapp_consent, source,
              created_at, updated_at, organization_wing, father_or_guardian_name, whatsapp_number,
              email, city_village, district, state, pincode, education, profile_photo_data,
              identity_doc_data, identity_doc_name, identity_verification_status, membership_status, registration_date
            FROM registrations;
            DROP TABLE registrations;
            ALTER TABLE registrations_migrated RENAME TO registrations;
          `);
          db.exec('COMMIT;');
        } catch (migrationErr) {
          db.exec('ROLLBACK;');
          throw migrationErr;
        } finally {
          db.exec('PRAGMA foreign_keys = ON;');
        }
      }

      return db;
    })();
  }
  return sqlitePromise;
}

// ============================================================================
// DEFAULT SEED DATA (Admins, Org Info Pages, Default Festival Schedules)
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
];

const DEFAULT_ORG_PAGES: Array<Omit<OrganizationPageRecord, 'updated_by' | 'updated_at'>> = [
  {
    slug: 'bajrang_dal',
    title: 'Bajrang Dal',
    subtitle: 'Youth Wing of Vishva Hindu Parishad — Seva, Suraksha, Sanskar',
    introduction:
      'Bajrang Dal is the youth organization associated with the Vishva Hindu Parishad (VHP), dedicated to community service, cultural preservation, youth character building, and social discipline across India.',
    history:
      'Established in 1984 in Uttar Pradesh as a youth volunteer corps supporting cultural awareness initiatives, Bajrang Dal grew into a nationwide youth movement organized across prants, districts, and local prakhand units.',
    objectives:
      'Instill values of Seva (selfless service), Suraksha (community support and safety), and Sanskar (cultural values) among youth while encouraging civic responsibility and social harmony.',
    activities:
      'Blood donation camps, disaster relief assistance, tree plantation drives, cow welfare awareness, youth physical fitness sessions, and cultural festival coordination.',
    structure:
      'Organized hierarchically from Akhil Bharatiya (National) Convenor -> Prant (State/Region) -> Vibhag -> Jila (District) -> Prakhand / Nagar -> Local Samiti units.',
    faqs: [
      {
        q: 'Who is eligible to register as a Bajrang Dal member?',
        a: 'Adult citizens aged 18 years and above who align with community service values and provide valid identification details may apply.',
      },
      {
        q: 'How is my membership registration confirmed?',
        a: 'Once you submit the form, you immediately receive a Reference ID and confirmation message. An authorized administrator verifies your submitted profile and sends further membership updates via WhatsApp/message.',
      },
      {
        q: 'Is my identity document shown publicly?',
        a: 'No. Uploaded identity documents are stored privately and can only be inspected by authorized administrators for verification.',
      },
    ],
    new_joinee_guide:
      '1. Complete the Bajrang Dal registration form with accurate contact and district details.\n2. Upload a clear profile photo and identity document.\n3. Attend your local district orientation / monthly Shakha or Milan session once contacted by your district coordinator.',
    contact_info: 'Gujarat Prant Coordination Desk · Contact via District Admin or Official Portal.',
  },
  {
    slug: 'vhp',
    title: 'Vishva Hindu Parishad (VHP)',
    subtitle: 'Global Cultural, Social Service & Heritage Organization',
    introduction:
      'Vishva Hindu Parishad (VHP) is a cultural and social organization founded in 1964 to unite, serve, and preserve Indian spiritual traditions, charitable institutions, and community welfare programs globally.',
    history:
      'Founded on Janmashtami (29 August 1964) in Mumbai by spiritual leaders and social thinkers including Swami Chinmayananda and S. S. Apte, VHP established schools, medical clinics, orphanages, and cultural forums.',
    objectives:
      'Strengthen social unity without caste discrimination, preserve heritage temples and traditions, run charitable educational and healthcare projects, and coordinate youth and women wings.',
    activities:
      'Seva Bharati medical camps, Ekal Vidyalaya literacy centers, Annakshetra food relief, cultural seminars, and festival coordination across India and abroad.',
    structure:
      'Guided by a Central Margdarshak Mandal and Board of Trustees, operating through Kshetra, Prant, Vibhag, Jila, and Prakhand committees alongside Bajrang Dal and Durga Vahini.',
    faqs: [
      {
        q: 'How are Bajrang Dal and Durga Vahini connected to VHP?',
        a: 'Bajrang Dal is the young men’s wing and Durga Vahini is the young women’s wing operating under the guidance and cultural framework of Vishva Hindu Parishad.',
      },
      {
        q: 'Can anyone participate in VHP Seva events?',
        a: 'Yes. Through the Events section on this portal, community members can register directly for public service camps, blood donation drives, and cultural seminars.',
      },
    ],
    new_joinee_guide:
      '1. Explore ongoing Seva and cultural initiatives in the Events portal.\n2. Select either Bajrang Dal or Durga Vahini membership based on your wing.\n3. Stay updated via verified WhatsApp announcements.',
    contact_info: 'Vishva Hindu Parishad Coordination Office · Official Portal Helpdesk.',
  },
  {
    slug: 'durga_vahini',
    title: 'Durga Vahini',
    subtitle: 'Women & Young Women’s Empowerment, Seva & Cultural Wing',
    introduction:
      'Durga Vahini is the dedicated women’s wing of Vishva Hindu Parishad, empowering girls and women through self-defense training, leadership workshops, cultural education, and community welfare service.',
    history:
      'Founded in 1991 under the leadership of Sadhvi Rithambara and VHP women coordinators, Durga Vahini provides a dedicated, respectful, and disciplined space for young women to lead social and cultural initiatives.',
    objectives:
      'Build confidence, physical fitness, self-reliance, leadership skills, and cultural awareness among women and girls while promoting women’s safety and community service.',
    activities:
      'Annual Shaurya Prashikshan Varg (leadership & self-defense camps), Matrushakti cultural gatherings, health & hygiene awareness drives, educational mentoring, and festival seva.',
    structure:
      'Coordinated independently by women office-bearers (Sanyojika / Sah-Sanyojika) at National, Prant, Vibhag, District, and Nagar levels.',
    faqs: [
      {
        q: 'Why does Durga Vahini have a separate registration form?',
        a: 'Durga Vahini operates as a dedicated women’s wing with women coordinators, women-specific training camps, and guardian contact options where appropriate.',
      },
      {
        q: 'Who reviews Durga Vahini applications and documents?',
        a: 'Applications and identity verifications are handled strictly by authorized administrators with full privacy protection.',
      },
    ],
    new_joinee_guide:
      '1. Use the Join Durga Vahini form on the homepage.\n2. Enter accurate district/city details and upload your photo and verification document.\n3. You will receive a confirmation message with your Reference ID once submitted and when reviewed by an administrator.',
    contact_info: 'Durga Vahini Women’s Wing Desk · Coordinated via Authorized District Admins.',
  },
];

const DEFAULT_THEME_SCHEDULES: ThemeScheduleRule[] = [
  { theme: 'makar_sankranti', start_date: '01-13', end_date: '01-15', banner_text: 'Happy Makar Sankranti · Uttarayan Seva Greetings' },
  { theme: 'holi', start_date: '03-01', end_date: '03-26', banner_text: 'Holi Cultural Festival Greetings' },
  { theme: 'ram_navami', start_date: '03-27', end_date: '04-18', banner_text: 'Jai Shri Ram · Ram Navami Celebrations' },
  { theme: 'hanuman_jayanti', start_date: '04-19', end_date: '04-26', banner_text: 'Hanuman Jayanti · Seva & Shakti Week' },
  { theme: 'janmashtami', start_date: '08-15', end_date: '09-05', banner_text: 'Shri Krishna Janmashtami & VHP Foundation Day' },
  { theme: 'navratri', start_date: '10-01', end_date: '10-20', banner_text: 'Shubh Navratri · Matrushakti & Durga Vahini Utsav' },
  { theme: 'diwali', start_date: '10-21', end_date: '11-15', banner_text: 'Shubh Deepavali & Nutan Varshabhinandan' },
];

export function computeEffectiveTheme(settings: ThemeSettingsRecord): FestivalThemeId {
  if (settings.active_theme && settings.active_theme !== 'normal') {
    return settings.active_theme;
  }
  if (!settings.auto_schedule_enabled || !Array.isArray(settings.schedules)) {
    return settings.active_theme || 'normal';
  }
  const todayMmDd = new Date().toISOString().slice(5, 10);
  const todayFull = new Date().toISOString().slice(0, 10);
  for (const rule of settings.schedules) {
    if (!rule.start_date || !rule.end_date) continue;
    if (rule.start_date.length === 10 && rule.end_date.length === 10) {
      if (todayFull >= rule.start_date && todayFull <= rule.end_date) return rule.theme;
    } else if (todayMmDd >= rule.start_date && todayMmDd <= rule.end_date) {
      return rule.theme;
    }
  }
  return settings.active_theme || 'normal';
}

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
      const settingsRows = await supabaseFetch<Array<{ id: number }>>(
        'notification_settings?select=id&id=eq.1&limit=1'
      );
      if (settingsRows.length === 0) {
        await supabaseFetch('notification_settings', {
          method: 'POST',
          prefer: 'resolution=ignore-duplicates',
          body: { id: 1, global_enabled: true, extra_whatsapp_numbers: [] },
        });
      }

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

      if (existingAdmins.some((a) => a.email.toLowerCase() === 'subadmin@bajrangdal.org' && a.mobile === '9825011223')) {
        await supabaseFetch('admins?email=eq.subadmin%40bajrangdal.org&mobile=eq.9825011223', {
          method: 'DELETE',
        });
      }

      // Seed organization_pages & theme_settings
      try {
        const orgRows = await supabaseFetch<Array<{ slug: string }>>('organization_pages?select=slug');
        for (const page of DEFAULT_ORG_PAGES) {
          if (!orgRows.some((r) => r.slug === page.slug)) {
            await supabaseFetch('organization_pages', {
              method: 'POST',
              prefer: 'resolution=ignore-duplicates',
              body: page,
            });
          }
        }
        const themeRows = await supabaseFetch<Array<{ id: number }>>('theme_settings?select=id&id=eq.1&limit=1');
        if (themeRows.length === 0) {
          await supabaseFetch('theme_settings', {
            method: 'POST',
            prefer: 'resolution=ignore-duplicates',
            body: {
              id: 1,
              active_theme: 'normal',
              auto_schedule_enabled: true,
              custom_banner_text: '',
              custom_bg_style: '',
              animations_enabled: true,
              schedules: DEFAULT_THEME_SCHEDULES,
            },
          });
        }
      } catch (err) {
        console.error('Optional table seed warning:', err);
      }
      return;
    }

    // SQLite seeding
    const sqlite = await getSqlite();
    sqlite
      .prepare("UPDATE admins SET is_primary = 0, notifications_enabled = 0 WHERE mobile = '9876543210' AND email = 'superadmin@bajrangdal.org'")
      .run();
    sqlite
      .prepare("DELETE FROM admins WHERE LOWER(email) = 'subadmin@bajrangdal.org' AND mobile = '9825011223'")
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

    for (const page of DEFAULT_ORG_PAGES) {
      const existingPage = sqlite.prepare('SELECT slug FROM organization_pages WHERE slug = ?').get(page.slug);
      if (!existingPage) {
        sqlite
          .prepare(`
            INSERT INTO organization_pages (slug, title, subtitle, introduction, history, objectives, activities, structure, faqs, new_joinee_guide, contact_info)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(
            page.slug,
            page.title,
            page.subtitle,
            page.introduction,
            page.history,
            page.objectives,
            page.activities,
            page.structure,
            JSON.stringify(page.faqs),
            page.new_joinee_guide,
            page.contact_info
          );
      }
    }

    const existingTheme = sqlite.prepare('SELECT id FROM theme_settings WHERE id = 1').get();
    if (!existingTheme) {
      sqlite
        .prepare(`
          INSERT INTO theme_settings (id, active_theme, auto_schedule_enabled, custom_banner_text, custom_bg_style, animations_enabled, schedules)
          VALUES (1, 'normal', 1, '', '', 1, ?)
        `)
        .run(JSON.stringify(DEFAULT_THEME_SCHEDULES));
    }
  })().catch((err) => {
    seedPromise = null;
    throw err;
  });

  return seedPromise;
}

// ============================================================================
// HEALTH & AUDIT
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

export async function generateRegistrationCode(prefix = 'JBD'): Promise<string> {
  const year = new Date().getFullYear();
  let count = 0;

  if (isSupabaseConfigured()) {
    const table = prefix === 'EVT' ? 'event_registrations' : 'registrations';
    const rows = await supabaseFetch<Array<{ id: string }>>(`${table}?select=id`);
    count = rows.length;
  } else {
    const sqlite = await getSqlite();
    const table = prefix === 'EVT' ? 'event_registrations' : 'registrations';
    const countRow = sqlite.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
    count = countRow.count;
  }

  const seq = 1001 + count;
  const suffix = crypto.randomInt(10, 99);
  return `${prefix}-${year}-${seq}${suffix}`;
}

// ============================================================================
// REGISTRATIONS (BAJRANG DAL & DURGA VAHINI)
// ============================================================================
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

function splitAreaTokens(raw: string): string[] {
  return raw
    .split(/[,;/|\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 2);
}

function scoreAreaMatch(
  reg: {
    district?: string;
    city_village?: string;
    pincode?: string;
    full_address?: string;
    assigned_admin_id?: string | null;
  },
  admin: Pick<AdminRecord, 'id' | 'role' | 'assigned_area' | 'assigned_district' | 'assigned_city'>
): number {
  if (admin.role === 'super_admin') return 100;
  if (reg.assigned_admin_id && reg.assigned_admin_id === admin.id) return 90;

  const districtTokens = splitAreaTokens(admin.assigned_district || '');
  const cityTokens = splitAreaTokens(admin.assigned_city || '');
  const areaTokens = splitAreaTokens(admin.assigned_area || '');

  if (districtTokens.length === 0 && cityTokens.length === 0 && areaTokens.length === 0) {
    return 0;
  }

  const regDistrict = String(reg.district || '').trim().toLowerCase();
  const regCity = String(reg.city_village || '').trim().toLowerCase();
  const regPin = String(reg.pincode || '').trim().toLowerCase();
  const regAddr = String(reg.full_address || '').trim().toLowerCase();
  const regFullHay = `${regDistrict} ${regCity} ${regPin} ${regAddr}`.trim();

  if (!regFullHay) return 0;

  const districtMatches =
    districtTokens.length === 0
      ? false
      : districtTokens.some(
          (tok) => regDistrict === tok || regDistrict.includes(tok) || regFullHay.includes(tok)
        );

  const cityMatches =
    cityTokens.length === 0
      ? false
      : cityTokens.some(
          (tok) =>
            regCity === tok ||
            regCity.includes(tok) ||
            regPin === tok ||
            regAddr.includes(tok)
        );

  // If admin is configured with BOTH district and specific cities/talukas/pincodes:
  // require district match (if district present) AND city match
  if (districtTokens.length > 0 && cityTokens.length > 0) {
    if (districtMatches && cityMatches) return 80;
    return 0;
  }

  // Only district configured -> matches entire district
  if (districtTokens.length > 0 && districtMatches) return 60;

  // Only city/pincode list configured
  if (cityTokens.length > 0 && cityMatches) return 70;

  // Fallback to free-form assigned_area label tokens
  if (
    districtTokens.length === 0 &&
    cityTokens.length === 0 &&
    areaTokens.some((tok) => regFullHay.includes(tok))
  ) {
    return 50;
  }

  return 0;
}

export function doesRegistrationMatchAdminArea(
  reg: {
    district?: string;
    city_village?: string;
    pincode?: string;
    full_address?: string;
    assigned_admin_id?: string | null;
  },
  admin: Pick<AdminRecord, 'id' | 'role' | 'assigned_area' | 'assigned_district' | 'assigned_city'>
): boolean {
  return scoreAreaMatch(reg, admin) > 0;
}

export function canAdminAccessRegistration(
  admin: Pick<AdminRecord, 'id' | 'role' | 'assigned_area' | 'assigned_district' | 'assigned_city'>,
  reg: Pick<RegistrationRecord, 'assigned_admin_id' | 'district' | 'city_village' | 'pincode' | 'full_address'>
): boolean {
  if (admin.role === 'super_admin') return true;
  if (reg.assigned_admin_id === admin.id) return true;
  return scoreAreaMatch(reg, admin) > 0;
}

export async function findMatchingAreaAdminForRegistration(input: {
  district: string;
  city_village: string;
  pincode: string;
  full_address: string;
  preferred_admin_id?: string | null;
}): Promise<{ adminId: string | null; reason: string }> {
  await ensureInitialized();
  const allAdmins = await listAdmins();
  const activeAdmins = allAdmins.filter((a) => a.is_active === 1);

  if (input.preferred_admin_id) {
    const preferred = activeAdmins.find((a) => a.id === input.preferred_admin_id);
    if (preferred) {
      return {
        adminId: preferred.id,
        reason: `Assigned to Area Coordinator ${preferred.full_name}`,
      };
    }
  }

  const subAdmins = activeAdmins.filter((a) => a.role === 'sub_admin');
  let bestAdmin: Omit<AdminRecord, 'password_hash'> | null = null;
  let bestScore = 0;

  for (const adm of subAdmins) {
    const score = scoreAreaMatch(
      {
        district: input.district,
        city_village: input.city_village,
        pincode: input.pincode,
        full_address: input.full_address,
        assigned_admin_id: null,
      },
      adm
    );
    if (score > bestScore) {
      bestScore = score;
      bestAdmin = adm;
    }
  }

  if (bestAdmin && bestScore > 0) {
    return {
      adminId: bestAdmin.id,
      reason: `Auto-routed by area (${bestAdmin.assigned_area || bestAdmin.assigned_district || bestAdmin.assigned_city})`,
    };
  }

  const fallbackId = await getPrimaryOrFallbackAdminId();
  return {
    adminId: fallbackId,
    reason: 'Auto-assigned to Primary Admin on submission',
  };
}

export async function createRegistration(input: {
  organization_wing: OrganizationWing;
  full_name: string;
  father_or_guardian_name: string;
  mobile: string;
  whatsapp_number: string;
  email: string;
  age: number;
  dob: string;
  full_address: string;
  city_village: string;
  district: string;
  state: string;
  pincode: string;
  occupation: OccupationType;
  education: string;
  profile_photo_data: string;
  identity_doc_data: string;
  identity_doc_name: string;
  registration_date: string;
  whatsapp_consent: boolean;
  source: string;
  preferred_admin_id?: string | null;
}): Promise<RegistrationRecord> {
  await ensureInitialized();
  const id = crypto.randomUUID();
  const prefix = input.organization_wing === 'durga_vahini' ? 'DV' : 'JBD';
  const registrationCode = await generateRegistrationCode(prefix);
  const routing = await findMatchingAreaAdminForRegistration({
    district: input.district,
    city_village: input.city_village,
    pincode: input.pincode,
    full_address: input.full_address,
    preferred_admin_id: input.preferred_admin_id,
  });
  const assignedAdminId = routing.adminId;
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const inserted = await supabaseFetch<Array<Record<string, unknown>>>('registrations', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        id,
        registration_code: registrationCode,
        organization_wing: input.organization_wing,
        full_name: input.full_name,
        father_or_guardian_name: input.father_or_guardian_name,
        mobile: input.mobile,
        whatsapp_number: input.whatsapp_number,
        email: input.email,
        age: input.age,
        dob: input.dob,
        full_address: input.full_address,
        city_village: input.city_village,
        district: input.district,
        state: input.state,
        pincode: input.pincode,
        occupation: input.occupation,
        education: input.education,
        profile_photo_data: input.profile_photo_data,
        identity_doc_data: input.identity_doc_data,
        identity_doc_name: input.identity_doc_name,
        identity_verification_status: 'Pending',
        membership_status: 'Pending',
        registration_date: input.registration_date || now.slice(0, 10),
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
          notes: routing.reason,
          assigned_at: now,
        },
      });
    }

    await writeAuditLog(null, 'PUBLIC_REGISTRATION_CREATED', 'registrations', id, {
      registration_code: registrationCode,
      wing: input.organization_wing,
      source: input.source,
      assigned_admin_id: assignedAdminId,
    });

    const row = inserted[0];
    if (!row) throw new DatabaseError('Registration insert returned empty response.', 500);
    return normalizeRegistrationRow(row);
  }

  const sqlite = await getSqlite();
  sqlite
    .prepare(`
      INSERT INTO registrations (
        id, registration_code, organization_wing, full_name, father_or_guardian_name,
        mobile, whatsapp_number, email, age, dob, full_address, city_village, district,
        state, pincode, occupation, education, profile_photo_data, identity_doc_data,
        identity_doc_name, identity_verification_status, membership_status, registration_date,
        status, assigned_admin_id, follow_up_notes, privacy_consent, whatsapp_consent, source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Pending', ?, 'New', ?, '', 1, ?, ?, ?, ?)
    `)
    .run(
      id,
      registrationCode,
      input.organization_wing,
      input.full_name,
      input.father_or_guardian_name,
      input.mobile,
      input.whatsapp_number,
      input.email,
      input.age,
      input.dob,
      input.full_address,
      input.city_village,
      input.district,
      input.state,
      input.pincode,
      input.occupation,
      input.education,
      input.profile_photo_data,
      input.identity_doc_data,
      input.identity_doc_name,
      input.registration_date || now.slice(0, 10),
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
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(crypto.randomUUID(), id, assignedAdminId, routing.reason, now);
  }

  await writeAuditLog(null, 'PUBLIC_REGISTRATION_CREATED', 'registrations', id, {
    registration_code: registrationCode,
    wing: input.organization_wing,
    source: input.source,
    assigned_admin_id: assignedAdminId,
  });

  const created = sqlite
    .prepare(`
      SELECT r.*, a.full_name as assigned_admin_name
      FROM registrations r
      LEFT JOIN admins a ON r.assigned_admin_id = a.id
      WHERE r.id = ?
    `)
    .get(id) as Record<string, unknown>;
  return normalizeRegistrationRow(created);
}

export async function listRegistrationsForAdmin(
  _admin: Omit<AdminRecord, 'password_hash'>
): Promise<RegistrationRecord[]> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    const [admins, regs] = await Promise.all([
      supabaseFetch<Array<{ id: string; full_name: string }>>('admins?select=id,full_name'),
      supabaseFetch<Array<Record<string, unknown>>>('registrations?select=*&order=created_at.desc'),
    ]);
    const nameMap = new Map(admins.map((a) => [a.id, a.full_name]));
    return regs.map((r) => normalizeRegistrationRow(r, nameMap, false));
  }

  const sqlite = await getSqlite();
  const rows = sqlite
    .prepare(`
      SELECT r.*, a.full_name as assigned_admin_name
      FROM registrations r
      LEFT JOIN admins a ON r.assigned_admin_id = a.id
      ORDER BY r.created_at DESC
    `)
    .all() as Array<Record<string, unknown>>;

  return rows.map((r) => normalizeRegistrationRow(r, undefined, false));
}

export async function getRegistrationById(id: string, includePrivateDoc = false): Promise<RegistrationRecord | null> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    const rows = await supabaseFetch<Array<Record<string, unknown>>>(
      `registrations?select=*&id=eq.${encodeURIComponent(id)}&limit=1`
    );
    if (!rows[0]) return null;
    const admins = await supabaseFetch<Array<{ id: string; full_name: string }>>('admins?select=id,full_name');
    const nameMap = new Map(admins.map((a) => [a.id, a.full_name]));
    return normalizeRegistrationRow(rows[0], nameMap, includePrivateDoc);
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
  return row ? normalizeRegistrationRow(row, undefined, includePrivateDoc) : null;
}

export async function verifyMemberPublicByCode(code: string): Promise<{
  registration_code: string;
  full_name: string;
  organization_wing: OrganizationWing;
  membership_status: MembershipStatus;
  identity_verification_status: IdentityVerificationStatus;
  district: string;
  city_village: string;
  state: string;
  registration_date: string;
  profile_photo_data: string;
} | null> {
  await ensureInitialized();
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return null;

  let raw: Record<string, unknown> | undefined;
  if (isSupabaseConfigured()) {
    const rows = await supabaseFetch<Array<Record<string, unknown>>>(
      `registrations?select=registration_code,full_name,organization_wing,membership_status,identity_verification_status,district,city_village,state,registration_date,created_at,profile_photo_data&registration_code=eq.${encodeURIComponent(
        cleanCode
      )}&limit=1`
    );
    raw = rows[0];
  } else {
    const sqlite = await getSqlite();
    raw = sqlite
      .prepare(
        'SELECT registration_code, full_name, organization_wing, membership_status, identity_verification_status, district, city_village, state, registration_date, created_at, profile_photo_data FROM registrations WHERE UPPER(registration_code) = ? LIMIT 1'
      )
      .get(cleanCode) as Record<string, unknown> | undefined;
  }

  if (!raw) return null;
  const reg = normalizeRegistrationRow(raw);
  // Strict privacy: Only Approved members display public verification profile, never expose phone/address/DOB/ID docs
  if (reg.membership_status !== 'Approved') {
    return {
      registration_code: reg.registration_code,
      full_name: reg.full_name,
      organization_wing: reg.organization_wing,
      membership_status: reg.membership_status,
      identity_verification_status: reg.identity_verification_status,
      district: reg.district,
      city_village: reg.city_village,
      state: reg.state,
      registration_date: reg.registration_date,
      profile_photo_data: '',
    };
  }
  return {
    registration_code: reg.registration_code,
    full_name: reg.full_name,
    organization_wing: reg.organization_wing,
    membership_status: reg.membership_status,
    identity_verification_status: reg.identity_verification_status,
    district: reg.district,
    city_village: reg.city_village,
    state: reg.state,
    registration_date: reg.registration_date,
    profile_photo_data: reg.profile_photo_data,
  };
}

export async function updateRegistrationById(
  id: string,
  updates: Partial<{
    organization_wing: OrganizationWing;
    full_name: string;
    father_or_guardian_name: string;
    mobile: string;
    whatsapp_number: string;
    email: string;
    age: number;
    dob: string;
    full_address: string;
    city_village: string;
    district: string;
    state: string;
    pincode: string;
    occupation: OccupationType;
    education: string;
    profile_photo_data: string;
    identity_verification_status: IdentityVerificationStatus;
    membership_status: MembershipStatus;
    status: RegistrationStatus;
    assigned_admin_id: string | null;
    follow_up_notes: string;
  }>,
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

    if (updates.assigned_admin_id && updates.assigned_admin_id !== reassignedFrom) {
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

    const updated = await getRegistrationById(id, false);
    if (!updated) throw new DatabaseError('Registration not found after update.', 404);
    return updated;
  }

  const sqlite = await getSqlite();
  const existing = await getRegistrationById(id, true);
  if (!existing) throw new DatabaseError('Registration not found.', 404);

  sqlite
    .prepare(`
      UPDATE registrations
      SET organization_wing = ?, full_name = ?, father_or_guardian_name = ?,
          mobile = ?, whatsapp_number = ?, email = ?, age = ?, dob = ?,
          full_address = ?, city_village = ?, district = ?, state = ?, pincode = ?,
          occupation = ?, education = ?, profile_photo_data = ?,
          identity_verification_status = ?, membership_status = ?, status = ?,
          assigned_admin_id = ?, follow_up_notes = ?, updated_at = ?
      WHERE id = ?
    `)
    .run(
      updates.organization_wing ?? existing.organization_wing,
      updates.full_name ?? existing.full_name,
      updates.father_or_guardian_name ?? existing.father_or_guardian_name,
      updates.mobile ?? existing.mobile,
      updates.whatsapp_number ?? existing.whatsapp_number,
      updates.email ?? existing.email,
      updates.age ?? existing.age,
      updates.dob ?? existing.dob,
      updates.full_address ?? existing.full_address,
      updates.city_village ?? existing.city_village,
      updates.district ?? existing.district,
      updates.state ?? existing.state,
      updates.pincode ?? existing.pincode,
      updates.occupation ?? existing.occupation,
      updates.education ?? existing.education,
      updates.profile_photo_data ?? existing.profile_photo_data,
      updates.identity_verification_status ?? existing.identity_verification_status,
      updates.membership_status ?? existing.membership_status,
      updates.status ?? existing.status,
      updates.assigned_admin_id !== undefined ? updates.assigned_admin_id : existing.assigned_admin_id,
      updates.follow_up_notes ?? existing.follow_up_notes,
      now,
      id
    );

  const nextAssigned = updates.assigned_admin_id;
  if (nextAssigned && nextAssigned !== reassignedFrom) {
    sqlite
      .prepare(`
        INSERT INTO admin_assignments (id, registration_id, admin_id, assigned_by, notes, assigned_at)
        VALUES (?, ?, ?, ?, 'Reassigned by Super Admin', ?)
      `)
      .run(crypto.randomUUID(), id, nextAssigned, actorAdminId, now);
  }

  const updated = await getRegistrationById(id, false);
  if (!updated) throw new DatabaseError('Registration not found after update.', 404);
  return updated;
}

export async function deleteRegistrationById(id: string): Promise<void> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    await supabaseFetch(`registrations?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    return;
  }
  const sqlite = await getSqlite();
  sqlite.prepare('DELETE FROM registrations WHERE id = ?').run(id);
}

// ============================================================================
// EVENTS & EVENT-SPECIFIC REGISTRATIONS
// ============================================================================
function computeEventStats(event: EventRecord, regs: EventRegistrationRecord[]) {
  const total = regs.length;
  const approved = regs.filter((r) => r.approval_status === 'Approved').length;
  const pending = regs.filter((r) => r.approval_status === 'Pending').length;
  const rejected = regs.filter((r) => r.approval_status === 'Rejected').length;
  const occupied = approved + pending;
  const available_seats = Math.max(0, event.max_capacity - occupied);
  return { total, approved, pending, rejected, available_seats };
}

export async function listEventsWithStats(): Promise<EventRecord[]> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    const [rawEvents, rawRegs] = await Promise.all([
      supabaseFetch<Array<Record<string, unknown>>>('events?select=*&order=event_date.asc'),
      supabaseFetch<Array<Record<string, unknown>>>('event_registrations?select=*'),
    ]);
    const regs = rawRegs.map(normalizeEventRegistrationRow);
    return rawEvents.map((ev) => {
      const normalized = normalizeEventRow(ev);
      const evRegs = regs.filter((r) => r.event_id === normalized.id);
      return { ...normalized, stats: computeEventStats(normalized, evRegs) };
    });
  }

  const sqlite = await getSqlite();
  const rawEvents = sqlite.prepare('SELECT * FROM events ORDER BY event_date ASC').all() as Array<Record<string, unknown>>;
  const rawRegs = sqlite.prepare('SELECT * FROM event_registrations').all() as Array<Record<string, unknown>>;
  const regs = rawRegs.map(normalizeEventRegistrationRow);
  return rawEvents.map((ev) => {
    const normalized = normalizeEventRow(ev);
    const evRegs = regs.filter((r) => r.event_id === normalized.id);
    return { ...normalized, stats: computeEventStats(normalized, evRegs) };
  });
}

export async function getEventByIdOrSlug(idOrSlug: string): Promise<EventRecord | null> {
  await ensureInitialized();
  const events = await listEventsWithStats();
  return events.find((e) => e.id === idOrSlug || e.slug === idOrSlug) ?? null;
}

export async function createEvent(input: {
  title: string;
  description: string;
  poster_data: string;
  event_date: string;
  event_time: string;
  venue: string;
  location_city: string;
  reg_start_date: string;
  reg_end_date: string;
  max_capacity: number;
  registration_enabled: boolean;
  category: string;
  organization_wing: EventWingScope;
  created_by: string;
}): Promise<EventRecord> {
  await ensureInitialized();
  const id = crypto.randomUUID();
  const baseSlug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'event';
  const slug = `${baseSlug}-${crypto.randomInt(100, 999)}`;
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const rows = await supabaseFetch<Array<Record<string, unknown>>>('events', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        id,
        slug,
        title: input.title,
        description: input.description,
        poster_data: input.poster_data,
        event_date: input.event_date,
        event_time: input.event_time,
        venue: input.venue,
        location_city: input.location_city,
        reg_start_date: input.reg_start_date,
        reg_end_date: input.reg_end_date,
        max_capacity: input.max_capacity,
        registration_enabled: input.registration_enabled,
        category: input.category,
        organization_wing: input.organization_wing,
        created_by: input.created_by,
        created_at: now,
        updated_at: now,
      },
    });
    const ev = normalizeEventRow(rows[0]);
    return { ...ev, stats: computeEventStats(ev, []) };
  }

  const sqlite = await getSqlite();
  sqlite
    .prepare(`
      INSERT INTO events (
        id, slug, title, description, poster_data, event_date, event_time,
        venue, location_city, reg_start_date, reg_end_date, max_capacity,
        registration_enabled, category, organization_wing, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      id,
      slug,
      input.title,
      input.description,
      input.poster_data,
      input.event_date,
      input.event_time,
      input.venue,
      input.location_city,
      input.reg_start_date,
      input.reg_end_date,
      input.max_capacity,
      input.registration_enabled ? 1 : 0,
      input.category,
      input.organization_wing,
      input.created_by,
      now,
      now
    );

  const created = await getEventByIdOrSlug(id);
  return created!;
}

export async function updateEvent(
  id: string,
  updates: Partial<{
    title: string;
    description: string;
    poster_data: string;
    event_date: string;
    event_time: string;
    venue: string;
    location_city: string;
    reg_start_date: string;
    reg_end_date: string;
    max_capacity: number;
    registration_enabled: boolean;
    category: string;
    organization_wing: EventWingScope;
  }>
): Promise<EventRecord> {
  await ensureInitialized();
  const existing = await getEventByIdOrSlug(id);
  if (!existing) throw new DatabaseError('Event not found.', 404);
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    await supabaseFetch(`events?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { ...updates, updated_at: now },
    });
    return (await getEventByIdOrSlug(id))!;
  }

  const sqlite = await getSqlite();
  sqlite
    .prepare(`
      UPDATE events
      SET title = ?, description = ?, poster_data = ?, event_date = ?, event_time = ?,
          venue = ?, location_city = ?, reg_start_date = ?, reg_end_date = ?,
          max_capacity = ?, registration_enabled = ?, category = ?, organization_wing = ?, updated_at = ?
      WHERE id = ?
    `)
    .run(
      updates.title ?? existing.title,
      updates.description ?? existing.description,
      updates.poster_data ?? existing.poster_data,
      updates.event_date ?? existing.event_date,
      updates.event_time ?? existing.event_time,
      updates.venue ?? existing.venue,
      updates.location_city ?? existing.location_city,
      updates.reg_start_date ?? existing.reg_start_date,
      updates.reg_end_date ?? existing.reg_end_date,
      updates.max_capacity ?? existing.max_capacity,
      updates.registration_enabled !== undefined
        ? updates.registration_enabled
          ? 1
          : 0
        : existing.registration_enabled,
      updates.category ?? existing.category,
      updates.organization_wing ?? existing.organization_wing,
      now,
      id
    );

  return (await getEventByIdOrSlug(id))!;
}

export async function deleteEvent(id: string): Promise<void> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    await supabaseFetch(`events?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    return;
  }
  const sqlite = await getSqlite();
  sqlite.prepare('DELETE FROM events WHERE id = ?').run(id);
}

export async function listEventRegistrations(eventId: string): Promise<EventRegistrationRecord[]> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    const rows = await supabaseFetch<Array<Record<string, unknown>>>(
      `event_registrations?select=*&event_id=eq.${encodeURIComponent(eventId)}&order=created_at.desc`
    );
    return rows.map(normalizeEventRegistrationRow);
  }
  const sqlite = await getSqlite();
  const rows = sqlite
    .prepare('SELECT * FROM event_registrations WHERE event_id = ? ORDER BY created_at DESC')
    .all(eventId) as Array<Record<string, unknown>>;
  return rows.map(normalizeEventRegistrationRow);
}

export async function listAllEventRegistrationsCount(): Promise<number> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    const rows = await supabaseFetch<Array<{ id: string }>>('event_registrations?select=id');
    return rows.length;
  }
  const sqlite = await getSqlite();
  const row = sqlite.prepare('SELECT COUNT(*) as count FROM event_registrations').get() as { count: number };
  return row.count;
}

export async function createEventRegistration(input: {
  event_id: string;
  full_name: string;
  mobile: string;
  whatsapp_number: string;
  email: string;
  city_village: string;
  district: string;
  age: number;
  organization_wing: string;
  notes: string;
  whatsapp_consent: boolean;
}): Promise<EventRegistrationRecord> {
  await ensureInitialized();
  const existingRegs = await listEventRegistrations(input.event_id);
  const dup = existingRegs.find((r) => r.mobile === input.mobile);
  if (dup) {
    throw new DatabaseError(
      `This mobile number is already registered for this event (Pass ID: ${dup.registration_code}).`,
      409
    );
  }

  const id = crypto.randomUUID();
  const code = await generateRegistrationCode('EVT');
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const rows = await supabaseFetch<Array<Record<string, unknown>>>('event_registrations', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        id,
        event_id: input.event_id,
        registration_code: code,
        full_name: input.full_name,
        mobile: input.mobile,
        whatsapp_number: input.whatsapp_number,
        email: input.email,
        city_village: input.city_village,
        district: input.district,
        age: input.age,
        organization_wing: input.organization_wing,
        notes: input.notes,
        approval_status: 'Pending',
        whatsapp_consent: Boolean(input.whatsapp_consent),
        created_at: now,
        updated_at: now,
      },
    });
    return normalizeEventRegistrationRow(rows[0]);
  }

  const sqlite = await getSqlite();
  sqlite
    .prepare(`
      INSERT INTO event_registrations (
        id, event_id, registration_code, full_name, mobile, whatsapp_number,
        email, city_village, district, age, organization_wing, notes,
        approval_status, whatsapp_consent, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?)
    `)
    .run(
      id,
      input.event_id,
      code,
      input.full_name,
      input.mobile,
      input.whatsapp_number,
      input.email,
      input.city_village,
      input.district,
      input.age,
      input.organization_wing,
      input.notes,
      input.whatsapp_consent ? 1 : 0,
      now,
      now
    );

  const row = sqlite.prepare('SELECT * FROM event_registrations WHERE id = ?').get(id) as Record<string, unknown>;
  return normalizeEventRegistrationRow(row);
}

export async function updateEventRegistrationStatus(
  regId: string,
  approval_status: EventApprovalStatus
): Promise<EventRegistrationRecord> {
  await ensureInitialized();
  const now = new Date().toISOString();
  if (isSupabaseConfigured()) {
    const rows = await supabaseFetch<Array<Record<string, unknown>>>(
      `event_registrations?id=eq.${encodeURIComponent(regId)}`,
      {
        method: 'PATCH',
        prefer: 'return=representation',
        body: { approval_status, updated_at: now },
      }
    );
    if (!rows[0]) throw new DatabaseError('Event registration not found.', 404);
    return normalizeEventRegistrationRow(rows[0]);
  }
  const sqlite = await getSqlite();
  sqlite
    .prepare('UPDATE event_registrations SET approval_status = ?, updated_at = ? WHERE id = ?')
    .run(approval_status, now, regId);
  const row = sqlite.prepare('SELECT * FROM event_registrations WHERE id = ?').get(regId) as Record<string, unknown> | undefined;
  if (!row) throw new DatabaseError('Event registration not found.', 404);
  return normalizeEventRegistrationRow(row);
}

// ============================================================================
// ORGANIZATION INFORMATION PAGES (Bajrang Dal, VHP, Durga Vahini)
// ============================================================================
export async function listOrganizationPages(): Promise<OrganizationPageRecord[]> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    const rows = await supabaseFetch<Array<Record<string, unknown>>>('organization_pages?select=*');
    if (rows.length > 0) return rows.map(normalizeOrgPageRow);
  } else {
    const sqlite = await getSqlite();
    const rows = sqlite.prepare('SELECT * FROM organization_pages').all() as Array<Record<string, unknown>>;
    if (rows.length > 0) return rows.map(normalizeOrgPageRow);
  }
  return DEFAULT_ORG_PAGES.map((p) => ({
    ...p,
    updated_by: null,
    updated_at: new Date().toISOString(),
  }));
}

export async function updateOrganizationPage(
  slug: 'bajrang_dal' | 'vhp' | 'durga_vahini',
  payload: Partial<Omit<OrganizationPageRecord, 'slug' | 'updated_by' | 'updated_at'>>,
  actorAdminId: string
): Promise<OrganizationPageRecord> {
  await ensureInitialized();
  const pages = await listOrganizationPages();
  const existing = pages.find((p) => p.slug === slug);
  if (!existing) throw new DatabaseError('Organization page not found.', 404);
  const now = new Date().toISOString();

  const merged = {
    title: payload.title ?? existing.title,
    subtitle: payload.subtitle ?? existing.subtitle,
    introduction: payload.introduction ?? existing.introduction,
    history: payload.history ?? existing.history,
    objectives: payload.objectives ?? existing.objectives,
    activities: payload.activities ?? existing.activities,
    structure: payload.structure ?? existing.structure,
    faqs: Array.isArray(payload.faqs) ? payload.faqs : existing.faqs,
    new_joinee_guide: payload.new_joinee_guide ?? existing.new_joinee_guide,
    contact_info: payload.contact_info ?? existing.contact_info,
    updated_by: actorAdminId,
    updated_at: now,
  };

  if (isSupabaseConfigured()) {
    const rows = await supabaseFetch<Array<Record<string, unknown>>>(
      `organization_pages?slug=eq.${encodeURIComponent(slug)}`,
      {
        method: 'PATCH',
        prefer: 'return=representation',
        body: merged,
      }
    );
    return normalizeOrgPageRow(rows[0] || { slug, ...merged });
  }

  const sqlite = await getSqlite();
  sqlite
    .prepare(`
      UPDATE organization_pages
      SET title = ?, subtitle = ?, introduction = ?, history = ?, objectives = ?,
          activities = ?, structure = ?, faqs = ?, new_joinee_guide = ?,
          contact_info = ?, updated_by = ?, updated_at = ?
      WHERE slug = ?
    `)
    .run(
      merged.title,
      merged.subtitle,
      merged.introduction,
      merged.history,
      merged.objectives,
      merged.activities,
      merged.structure,
      JSON.stringify(merged.faqs),
      merged.new_joinee_guide,
      merged.contact_info,
      actorAdminId,
      now,
      slug
    );
  return { slug, ...merged };
}

// ============================================================================
// FESTIVAL DYNAMIC THEME SETTINGS
// ============================================================================
export async function getThemeSettings(): Promise<ThemeSettingsRecord> {
  await ensureInitialized();
  let record: ThemeSettingsRecord;
  if (isSupabaseConfigured()) {
    const rows = await supabaseFetch<Array<Record<string, unknown>>>('theme_settings?select=*&id=eq.1&limit=1');
    const row = rows[0];
    record = {
      id: 1,
      active_theme: (row?.active_theme as FestivalThemeId) || 'normal',
      auto_schedule_enabled: row ? Boolean(row.auto_schedule_enabled) : true,
      custom_banner_text: String(row?.custom_banner_text || ''),
      custom_bg_style: String(row?.custom_bg_style || ''),
      animations_enabled: row ? Boolean(row.animations_enabled) : true,
      schedules: safeJsonParse<ThemeScheduleRule[]>(row?.schedules, DEFAULT_THEME_SCHEDULES),
      updated_by: row?.updated_by ? String(row.updated_by) : null,
      updated_at: String(row?.updated_at || new Date().toISOString()),
    };
  } else {
    const sqlite = await getSqlite();
    const row = sqlite.prepare('SELECT * FROM theme_settings WHERE id = 1').get() as Record<string, unknown> | undefined;
    record = {
      id: 1,
      active_theme: (row?.active_theme as FestivalThemeId) || 'normal',
      auto_schedule_enabled: row ? toBit(row.auto_schedule_enabled) === 1 : true,
      custom_banner_text: String(row?.custom_banner_text || ''),
      custom_bg_style: String(row?.custom_bg_style || ''),
      animations_enabled: row ? toBit(row.animations_enabled) === 1 : true,
      schedules: safeJsonParse<ThemeScheduleRule[]>(row?.schedules, DEFAULT_THEME_SCHEDULES),
      updated_by: row?.updated_by ? String(row.updated_by) : null,
      updated_at: String(row?.updated_at || new Date().toISOString()),
    };
  }
  record.effective_theme = computeEffectiveTheme(record);
  return record;
}

export async function updateThemeSettings(
  updates: Partial<Omit<ThemeSettingsRecord, 'id' | 'effective_theme' | 'updated_by' | 'updated_at'>>,
  actorAdminId: string
): Promise<ThemeSettingsRecord> {
  const existing = await getThemeSettings();
  const now = new Date().toISOString();
  const next = {
    active_theme: updates.active_theme ?? existing.active_theme,
    auto_schedule_enabled:
      updates.auto_schedule_enabled !== undefined
        ? updates.auto_schedule_enabled
        : existing.auto_schedule_enabled,
    custom_banner_text: updates.custom_banner_text ?? existing.custom_banner_text,
    custom_bg_style: updates.custom_bg_style ?? existing.custom_bg_style,
    animations_enabled:
      updates.animations_enabled !== undefined
        ? updates.animations_enabled
        : existing.animations_enabled,
    schedules: Array.isArray(updates.schedules) ? updates.schedules : existing.schedules,
    updated_by: actorAdminId,
    updated_at: now,
  };

  if (isSupabaseConfigured()) {
    await supabaseFetch('theme_settings?id=eq.1', {
      method: 'PATCH',
      body: next,
    });
  } else {
    const sqlite = await getSqlite();
    sqlite
      .prepare(`
        UPDATE theme_settings
        SET active_theme = ?, auto_schedule_enabled = ?, custom_banner_text = ?,
            custom_bg_style = ?, animations_enabled = ?, schedules = ?, updated_by = ?, updated_at = ?
        WHERE id = 1
      `)
      .run(
        next.active_theme,
        next.auto_schedule_enabled ? 1 : 0,
        next.custom_banner_text,
        next.custom_bg_style,
        next.animations_enabled ? 1 : 0,
        JSON.stringify(next.schedules),
        actorAdminId,
        now
      );
  }
  return getThemeSettings();
}

// ============================================================================
// BACKUPS STORAGE & FULL SNAPSHOT EXPORT/RESTORE
// ============================================================================
export async function exportFullDatabaseSnapshot() {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    const [registrations, events, event_registrations, organization_pages, themeRows] =
      await Promise.all([
        supabaseFetch<Array<Record<string, unknown>>>('registrations?select=*'),
        supabaseFetch<Array<Record<string, unknown>>>('events?select=*'),
        supabaseFetch<Array<Record<string, unknown>>>('event_registrations?select=*'),
        supabaseFetch<Array<Record<string, unknown>>>('organization_pages?select=*'),
        supabaseFetch<Array<Record<string, unknown>>>('theme_settings?select=*&id=eq.1&limit=1'),
      ]);
    return {
      exported_at: new Date().toISOString(),
      registrations,
      events,
      event_registrations,
      organization_pages,
      theme_settings: themeRows[0] ?? null,
    };
  }

  const sqlite = await getSqlite();
  return {
    exported_at: new Date().toISOString(),
    registrations: sqlite.prepare('SELECT * FROM registrations').all() as Array<Record<string, unknown>>,
    events: sqlite.prepare('SELECT * FROM events').all() as Array<Record<string, unknown>>,
    event_registrations: sqlite.prepare('SELECT * FROM event_registrations').all() as Array<Record<string, unknown>>,
    organization_pages: sqlite.prepare('SELECT * FROM organization_pages').all() as Array<Record<string, unknown>>,
    theme_settings: (sqlite.prepare('SELECT * FROM theme_settings WHERE id = 1').get() as Record<string, unknown> | undefined) ?? null,
  };
}

export async function createBackupRecord(params: {
  id: string;
  backup_type: BackupType;
  status: 'success' | 'failed';
  record_counts: Record<string, unknown>;
  encrypted_payload: string;
  checksum: string;
  error_message?: string;
  created_by: string | null;
}): Promise<BackupRecord> {
  await ensureInitialized();
  const now = new Date().toISOString();
  if (isSupabaseConfigured()) {
    const rows = await supabaseFetch<Array<Record<string, unknown>>>('backups', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        id: params.id,
        backup_type: params.backup_type,
        status: params.status,
        record_counts: params.record_counts,
        encrypted_payload: params.encrypted_payload,
        checksum: params.checksum,
        error_message: params.error_message ?? null,
        created_by: params.created_by,
        created_at: now,
      },
    });
    const r = rows[0];
    return {
      id: String(r.id),
      backup_type: r.backup_type as BackupType,
      status: r.status as 'success' | 'failed',
      record_counts: safeJsonParse(r.record_counts, {}),
      checksum: String(r.checksum || ''),
      error_message: r.error_message ? String(r.error_message) : null,
      created_by: r.created_by ? String(r.created_by) : null,
      created_at: String(r.created_at),
    };
  }

  const sqlite = await getSqlite();
  sqlite
    .prepare(`
      INSERT INTO backups (id, backup_type, status, record_counts, encrypted_payload, checksum, error_message, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      params.id,
      params.backup_type,
      params.status,
      JSON.stringify(params.record_counts),
      params.encrypted_payload,
      params.checksum,
      params.error_message ?? null,
      params.created_by,
      now
    );

  return {
    id: params.id,
    backup_type: params.backup_type,
    status: params.status,
    record_counts: params.record_counts,
    checksum: params.checksum,
    error_message: params.error_message ?? null,
    created_by: params.created_by,
    created_at: now,
  };
}

export async function listBackups(limit = 25): Promise<BackupRecord[]> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    const rows = await supabaseFetch<Array<Record<string, unknown>>>(
      `backups?select=id,backup_type,status,record_counts,checksum,error_message,created_by,created_at&order=created_at.desc&limit=${limit}`
    );
    return rows.map((r) => ({
      id: String(r.id),
      backup_type: r.backup_type as BackupType,
      status: r.status as 'success' | 'failed',
      record_counts: safeJsonParse(r.record_counts, {}),
      checksum: String(r.checksum || ''),
      error_message: r.error_message ? String(r.error_message) : null,
      created_by: r.created_by ? String(r.created_by) : null,
      created_at: String(r.created_at),
    }));
  }
  const sqlite = await getSqlite();
  const rows = sqlite
    .prepare('SELECT id, backup_type, status, record_counts, checksum, error_message, created_by, created_at FROM backups ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    backup_type: r.backup_type as BackupType,
    status: r.status as 'success' | 'failed',
    record_counts: safeJsonParse(r.record_counts, {}),
    checksum: String(r.checksum || ''),
    error_message: r.error_message ? String(r.error_message) : null,
    created_by: r.created_by ? String(r.created_by) : null,
    created_at: String(r.created_at),
  }));
}

export async function getBackupById(id: string): Promise<BackupRecord | null> {
  await ensureInitialized();
  if (isSupabaseConfigured()) {
    const rows = await supabaseFetch<Array<Record<string, unknown>>>(
      `backups?select=*&id=eq.${encodeURIComponent(id)}&limit=1`
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: String(r.id),
      backup_type: r.backup_type as BackupType,
      status: r.status as 'success' | 'failed',
      record_counts: safeJsonParse(r.record_counts, {}),
      encrypted_payload: String(r.encrypted_payload || ''),
      checksum: String(r.checksum || ''),
      error_message: r.error_message ? String(r.error_message) : null,
      created_by: r.created_by ? String(r.created_by) : null,
      created_at: String(r.created_at),
    };
  }
  const sqlite = await getSqlite();
  const r = sqlite.prepare('SELECT * FROM backups WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    id: String(r.id),
    backup_type: r.backup_type as BackupType,
    status: r.status as 'success' | 'failed',
    record_counts: safeJsonParse(r.record_counts, {}),
    encrypted_payload: String(r.encrypted_payload || ''),
    checksum: String(r.checksum || ''),
    error_message: r.error_message ? String(r.error_message) : null,
    created_by: r.created_by ? String(r.created_by) : null,
    created_at: String(r.created_at),
  };
}

export async function restoreFullDatabaseSnapshot(
  snapshot: {
    registrations: Array<Record<string, unknown>>;
    events?: Array<Record<string, unknown>>;
    event_registrations?: Array<Record<string, unknown>>;
    organization_pages?: Array<Record<string, unknown>>;
  },
  actorAdminId: string
): Promise<{ membersRestored: number; eventsRestored: number; eventRegsRestored: number }> {
  const membersRestored = await restoreBackupRegistrations(
    snapshot.registrations as Array<Partial<RegistrationRecord>>,
    actorAdminId
  );

  let eventsRestored = 0;
  if (Array.isArray(snapshot.events)) {
    const existingEvents = await listEventsWithStats();
    const existingSlugs = new Set(existingEvents.map((e) => e.slug));
    for (const ev of snapshot.events) {
      if (!ev.id || !ev.slug || !ev.title || existingSlugs.has(String(ev.slug))) continue;
      if (isSupabaseConfigured()) {
        await supabaseFetch('events', {
          method: 'POST',
          prefer: 'resolution=ignore-duplicates',
          body: ev,
        });
      } else {
        const sqlite = await getSqlite();
        sqlite
          .prepare(`
            INSERT OR IGNORE INTO events (id, slug, title, description, poster_data, event_date, event_time, venue, location_city, reg_start_date, reg_end_date, max_capacity, registration_enabled, category, organization_wing, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(
            String(ev.id),
            String(ev.slug),
            String(ev.title),
            String(ev.description || ''),
            String(ev.poster_data || ''),
            String(ev.event_date || ''),
            String(ev.event_time || '10:00'),
            String(ev.venue || ''),
            String(ev.location_city || ''),
            String(ev.reg_start_date || ''),
            String(ev.reg_end_date || ''),
            Number(ev.max_capacity) || 100,
            toBit(ev.registration_enabled),
            String(ev.category || 'Seva'),
            String(ev.organization_wing || 'all'),
            actorAdminId,
            String(ev.created_at || new Date().toISOString()),
            new Date().toISOString()
          );
      }
      eventsRestored++;
    }
  }

  let eventRegsRestored = 0;
  if (Array.isArray(snapshot.event_registrations)) {
    for (const er of snapshot.event_registrations) {
      if (!er.id || !er.event_id || !er.registration_code || !er.mobile) continue;
      if (isSupabaseConfigured()) {
        await supabaseFetch('event_registrations', {
          method: 'POST',
          prefer: 'resolution=ignore-duplicates',
          body: er,
        });
      } else {
        const sqlite = await getSqlite();
        sqlite
          .prepare(`
            INSERT OR IGNORE INTO event_registrations (id, event_id, registration_code, full_name, mobile, whatsapp_number, email, city_village, district, age, organization_wing, notes, approval_status, whatsapp_consent, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(
            String(er.id),
            String(er.event_id),
            String(er.registration_code),
            String(er.full_name || ''),
            String(er.mobile),
            String(er.whatsapp_number || ''),
            String(er.email || ''),
            String(er.city_village || ''),
            String(er.district || ''),
            Number(er.age) || 18,
            String(er.organization_wing || 'general'),
            String(er.notes || ''),
            String(er.approval_status || 'Pending'),
            toBit(er.whatsapp_consent),
            String(er.created_at || new Date().toISOString()),
            new Date().toISOString()
          );
      }
      eventRegsRestored++;
    }
  }

  return { membersRestored, eventsRestored, eventRegsRestored };
}

// ============================================================================
// SYNC, ADMINS, NOTIFICATIONS & LOGS
// ============================================================================
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
      'SELECT id, full_name, email, mobile, whatsapp_number, role, is_primary, notifications_enabled, is_active, assigned_area, assigned_district, assigned_city, created_at, updated_at FROM admins WHERE id = ? AND is_active = 1'
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const { password_hash: _ph, ...safe } = normalizeAdminRow(row);
  return safe;
}

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
    .prepare('SELECT id, full_name, email, mobile, whatsapp_number, role, is_primary, notifications_enabled, is_active, assigned_area, assigned_district, assigned_city, created_at, updated_at FROM admins ORDER BY is_primary DESC, created_at ASC')
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
  assigned_area?: string;
  assigned_district?: string;
  assigned_city?: string;
  password: string;
}): Promise<Omit<AdminRecord, 'password_hash'>> {
  await ensureInitialized();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = hashPassword(input.password);
  const assignedArea = (input.assigned_area || '').trim();
  const assignedDistrict = (input.assigned_district || '').trim();
  const assignedCity = (input.assigned_city || '').trim();

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
        assigned_area: assignedArea,
        assigned_district: assignedDistrict,
        assigned_city: assignedCity,
        password_hash: passwordHash,
        created_at: now,
        updated_at: now,
      },
    });
    const { password_hash: _ph, ...safe } = normalizeAdminRow(inserted[0]);
    return safe;
  }

  const sqlite = await getSqlite();
  if (input.is_primary) sqlite.prepare('UPDATE admins SET is_primary = 0').run();
  sqlite
    .prepare(`
      INSERT INTO admins (id, full_name, email, mobile, whatsapp_number, role, is_primary, notifications_enabled, is_active, assigned_area, assigned_district, assigned_city, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
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
      assignedArea,
      assignedDistrict,
      assignedCity,
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
    assigned_area?: string;
    assigned_district?: string;
    assigned_city?: string;
    password_hash: string;
  }
): Promise<Omit<AdminRecord, 'password_hash'>> {
  await ensureInitialized();
  const now = new Date().toISOString();
  const assignedArea = updates.assigned_area !== undefined ? updates.assigned_area.trim() : existing.assigned_area;
  const assignedDistrict = updates.assigned_district !== undefined ? updates.assigned_district.trim() : existing.assigned_district;
  const assignedCity = updates.assigned_city !== undefined ? updates.assigned_city.trim() : existing.assigned_city;

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
          assigned_area: assignedArea,
          assigned_district: assignedDistrict,
          assigned_city: assignedCity,
          password_hash: updates.password_hash,
          updated_at: now,
        },
      }
    );
    const { password_hash: _ph, ...safe } = normalizeAdminRow(updatedRows[0]);
    return safe;
  }

  const sqlite = await getSqlite();
  if (updates.is_primary) sqlite.prepare('UPDATE admins SET is_primary = 0').run();
  sqlite
    .prepare(`
      UPDATE admins
      SET full_name = ?, email = ?, mobile = ?, whatsapp_number = ?, role = ?,
          is_primary = ?, notifications_enabled = ?, is_active = ?, assigned_area = ?, assigned_district = ?, assigned_city = ?, password_hash = ?, updated_at = ?
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
      assignedArea,
      assignedDistrict,
      assignedCity,
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
    await supabaseFetch(`admins?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    return;
  }
  const sqlite = await getSqlite();
  sqlite.prepare('UPDATE registrations SET assigned_admin_id = ? WHERE assigned_admin_id = ?').run(reassignToAdminId, id);
  sqlite.prepare('DELETE FROM admins WHERE id = ?').run(id);
}

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
    return rows.map(normalizeAdminRow).filter((a) => a.role === 'super_admin' || a.is_primary === 1);
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
  registrationId: string | null;
  adminId: string | null;
  recipientWhatsapp: string;
  language?: string;
  messageType?: string;
  messagePreview: string;
  providerMessageId?: string;
  deliveryStatus: DeliveryStatus;
  errorMessage?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const logId = params.existingId || crypto.randomUUID();
  const lang = params.language || 'en';
  const msgType = params.messageType || 'registration_alert';

  if (isSupabaseConfigured()) {
    if (params.existingId) {
      await supabaseFetch(`notification_logs?id=eq.${encodeURIComponent(params.existingId)}`, {
        method: 'PATCH',
        body: {
          delivery_status: params.deliveryStatus,
          provider_message_id: params.providerMessageId ?? null,
          error_message: params.errorMessage ?? null,
          message_preview: params.messagePreview,
          language: lang,
          message_type: msgType,
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
          language: lang,
          message_type: msgType,
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
        SET delivery_status = ?, provider_message_id = ?, error_message = ?, message_preview = ?, language = ?, message_type = ?, created_at = ?
        WHERE id = ?
      `)
      .run(
        params.deliveryStatus,
        params.providerMessageId ?? null,
        params.errorMessage ?? null,
        params.messagePreview,
        lang,
        msgType,
        now,
        params.existingId
      );
  } else {
    sqlite
      .prepare(`
        INSERT INTO notification_logs (id, registration_id, admin_id, recipient_whatsapp, language, message_type, message_preview, provider_message_id, delivery_status, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        logId,
        params.registrationId,
        params.adminId,
        params.recipientWhatsapp,
        lang,
        msgType,
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
      supabaseFetch<Array<Record<string, unknown>>>('notification_logs?select=*&order=created_at.desc&limit=80'),
      supabaseFetch<Array<Record<string, unknown>>>('sync_logs?select=*&order=created_at.desc&limit=30'),
      supabaseFetch<Array<Record<string, unknown>>>('audit_logs?select=*&order=created_at.desc&limit=60'),
      supabaseFetch<Array<{ id: string; registration_code: string; full_name: string }>>('registrations?select=id,registration_code,full_name'),
      supabaseFetch<Array<{ id: string; full_name: string }>>('admins?select=id,full_name'),
    ]);

    const regMap = new Map(regs.map((r) => [r.id, r]));
    const adminMap = new Map(admins.map((a) => [a.id, a.full_name]));

    return {
      notificationLogs: notifRows.map((nl) => {
        const reg = nl.registration_id ? regMap.get(String(nl.registration_id)) : undefined;
        return {
          id: String(nl.id),
          registration_id: nl.registration_id ? String(nl.registration_id) : null,
          admin_id: nl.admin_id ? String(nl.admin_id) : null,
          recipient_whatsapp: String(nl.recipient_whatsapp),
          language: String(nl.language || 'en'),
          message_type: String(nl.message_type || 'registration_alert'),
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
      LIMIT 80
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
      LIMIT 60
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

    const wing: OrganizationWing = r.organization_wing === 'durga_vahini' ? 'durga_vahini' : 'bajrang_dal';
    const id = r.id ? String(r.id) : crypto.randomUUID();
    const code = r.registration_code
      ? String(r.registration_code)
      : await generateRegistrationCode(wing === 'durga_vahini' ? 'DV' : 'JBD');
    const ageVal = Number(r.age) >= 15 ? Number(r.age) : 18;
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
          organization_wing: wing,
          full_name: String(r.full_name),
          father_or_guardian_name: String(r.father_or_guardian_name || ''),
          mobile: cleanMobile,
          whatsapp_number: String(r.whatsapp_number || cleanMobile),
          email: String(r.email || ''),
          age: ageVal,
          dob: String(r.dob),
          full_address: String(r.full_address),
          city_village: String(r.city_village || ''),
          district: String(r.district || ''),
          state: String(r.state || 'Gujarat'),
          pincode: String(r.pincode || ''),
          occupation: validOcc,
          education: String(r.education || ''),
          profile_photo_data: String(r.profile_photo_data || ''),
          identity_doc_data: String(r.identity_doc_data || ''),
          identity_doc_name: String(r.identity_doc_name || ''),
          identity_verification_status: String(r.identity_verification_status || 'Pending'),
          membership_status: String(r.membership_status || 'Pending'),
          registration_date: String(r.registration_date || now.slice(0, 10)),
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
            id, registration_code, organization_wing, full_name, father_or_guardian_name,
            mobile, whatsapp_number, email, age, dob, full_address, city_village, district,
            state, pincode, occupation, education, profile_photo_data, identity_doc_data,
            identity_doc_name, identity_verification_status, membership_status, registration_date,
            status, assigned_admin_id, follow_up_notes, privacy_consent, whatsapp_consent, source, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
        `)
        .run(
          id,
          code,
          wing,
          String(r.full_name),
          String(r.father_or_guardian_name || ''),
          cleanMobile,
          String(r.whatsapp_number || cleanMobile),
          String(r.email || ''),
          ageVal,
          String(r.dob),
          String(r.full_address),
          String(r.city_village || ''),
          String(r.district || ''),
          String(r.state || 'Gujarat'),
          String(r.pincode || ''),
          validOcc,
          String(r.education || ''),
          String(r.profile_photo_data || ''),
          String(r.identity_doc_data || ''),
          String(r.identity_doc_name || ''),
          String(r.identity_verification_status || 'Pending'),
          String(r.membership_status || 'Pending'),
          String(r.registration_date || now.slice(0, 10)),
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
