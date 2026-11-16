import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  sqlite,
  hashPassword,
  verifyPassword,
  writeAuditLog,
  generateRegistrationCode,
  mirrorToSupabase,
  type AdminRecord,
  type RegistrationRecord,
  type OccupationType,
  type RegistrationStatus,
} from './server/db.ts';
import {
  signSessionToken,
  requireAdmin,
  requireSuperAdmin,
  type AuthenticatedRequest,
} from './server/auth.ts';
import {
  dispatchRegistrationNotifications,
  normalizeWhatsAppNumber,
} from './server/whatsapp.ts';

const VALID_OCCUPATIONS: OccupationType[] = ['Student', 'Job', 'Business', 'Other'];
const VALID_STATUSES: RegistrationStatus[] = ['New', 'Contacted', 'Follow-up', 'Completed'];

function calculateAgeFromDob(dobStr: string): number {
  const dob = new Date(dobStr);
  if (Number.isNaN(dob.getTime())) return -1;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

function getAppBaseUrl(req: express.Request): string {
  if (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL') {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

async function startServer() {
  const app = express();
  const portArgIdx = process.argv.indexOf('--port');
  const cliPort = portArgIdx !== -1 ? Number(process.argv[portArgIdx + 1]) : NaN;
  const isProduction = process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'start';
  const PORT = !Number.isNaN(cliPort) && cliPort > 0
    ? cliPort
    : isProduction
    ? Number(process.env.PORT) || 3000
    : 3000;

  app.use(express.json({ limit: '5mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      whatsappConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
      supabaseMirrorConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    });
  });

  // ==========================================================================
  // PUBLIC REGISTRATION SUBMISSION
  // ==========================================================================
  app.post('/api/registrations', async (req, res) => {
    try {
      const {
        full_name,
        mobile,
        age,
        dob,
        full_address,
        occupation,
        privacy_consent,
        whatsapp_consent,
        source,
      } = req.body as Record<string, unknown>;

      const cleanName = typeof full_name === 'string' ? full_name.trim() : '';
      const cleanMobile = typeof mobile === 'string' ? mobile.replace(/\D/g, '') : '';
      const cleanDob = typeof dob === 'string' ? dob.trim() : '';
      const cleanAddress = typeof full_address === 'string' ? full_address.trim() : '';
      const cleanOccupation = typeof occupation === 'string' ? occupation.trim() : '';
      const numericAge = Number(age);

      if (cleanName.length < 2 || cleanName.length > 120) {
        return res.status(400).json({ error: 'Please enter a valid full name (2-120 characters).' });
      }
      if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
      }
      if (!cleanDob) {
        return res.status(400).json({ error: 'Date of Birth is required.' });
      }
      const computedAge = calculateAgeFromDob(cleanDob);
      if (computedAge < 18 || Number.isNaN(numericAge) || numericAge < 18 || numericAge > 110) {
        return res.status(400).json({ error: 'Registrations are strictly limited to adults aged 18 and above.' });
      }
      if (Math.abs(computedAge - numericAge) > 1) {
        return res.status(400).json({ error: 'Entered age does not match the selected Date of Birth.' });
      }
      if (cleanAddress.length < 5 || cleanAddress.length > 500) {
        return res.status(400).json({ error: 'Please enter your complete residential address.' });
      }
      if (!VALID_OCCUPATIONS.includes(cleanOccupation as OccupationType)) {
        return res.status(400).json({ error: 'Please select a valid occupation.' });
      }
      if (privacy_consent !== true) {
        return res.status(400).json({ error: 'Privacy policy consent is required to register.' });
      }

      const duplicate = sqlite
        .prepare('SELECT id, registration_code FROM registrations WHERE mobile = ?')
        .get(cleanMobile) as { id: string; registration_code: string } | undefined;

      if (duplicate) {
        return res.status(409).json({
          error: `This mobile number is already registered (ID: ${duplicate.registration_code}). Duplicate submissions are not permitted.`,
          existingCode: duplicate.registration_code,
        });
      }

      // Find Primary Admin to auto-assign
      const primaryAdmin = sqlite
        .prepare("SELECT id FROM admins WHERE is_active = 1 AND is_primary = 1 LIMIT 1")
        .get() as { id: string } | undefined;

      const fallbackAdmin = !primaryAdmin
        ? (sqlite.prepare("SELECT id FROM admins WHERE is_active = 1 AND role = 'super_admin' LIMIT 1").get() as { id: string } | undefined)
        : undefined;

      const assignedAdminId = primaryAdmin?.id ?? fallbackAdmin?.id ?? null;
      const id = crypto.randomUUID();
      const registrationCode = generateRegistrationCode();
      const now = new Date().toISOString();
      const cleanSource = source === 'qr_code' ? 'qr_code' : source === 'admin_manual' ? 'admin_manual' : 'direct_link';

      sqlite.prepare(`
        INSERT INTO registrations (
          id, registration_code, full_name, mobile, age, dob, full_address,
          occupation, status, assigned_admin_id, follow_up_notes,
          privacy_consent, whatsapp_consent, source, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, '', 1, ?, ?, ?, ?)
      `).run(
        id,
        registrationCode,
        cleanName,
        cleanMobile,
        computedAge,
        cleanDob,
        cleanAddress,
        cleanOccupation,
        assignedAdminId,
        whatsapp_consent ? 1 : 0,
        cleanSource,
        now,
        now
      );

      if (assignedAdminId) {
        const assignId = crypto.randomUUID();
        sqlite.prepare(`
          INSERT INTO admin_assignments (id, registration_id, admin_id, notes, assigned_at)
          VALUES (?, ?, ?, 'Auto-assigned to Primary Admin on submission', ?)
        `).run(assignId, id, assignedAdminId, now);
      }

      writeAuditLog(null, 'PUBLIC_REGISTRATION_CREATED', 'registrations', id, {
        registration_code: registrationCode,
        source: cleanSource,
      });

      const createdRecord = sqlite
        .prepare('SELECT * FROM registrations WHERE id = ?')
        .get(id) as unknown as RegistrationRecord;

      void mirrorToSupabase('registrations', createdRecord as unknown as Record<string, unknown>);

      const dashboardUrl = `${getAppBaseUrl(req)}/?view=admin`;
      const notificationResults = await dispatchRegistrationNotifications(createdRecord, dashboardUrl);

      res.status(201).json({
        success: true,
        registration: {
          id: createdRecord.id,
          registration_code: createdRecord.registration_code,
          full_name: createdRecord.full_name,
          mobile: createdRecord.mobile,
          age: createdRecord.age,
          occupation: createdRecord.occupation,
          created_at: createdRecord.created_at,
        },
        notifications: notificationResults,
      });
    } catch (err) {
      console.error('Registration creation error:', err);
      res.status(500).json({ error: 'Unable to save registration. Please try again.' });
    }
  });

  // ==========================================================================
  // ADMIN AUTHENTICATION
  // ==========================================================================
  app.post('/api/auth/login', (req, res) => {
    const { identifier, password } = req.body as { identifier?: string; password?: string };
    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanMobile = (identifier || '').replace(/\D/g, '');
    if (!cleanId || !password) {
      return res.status(400).json({ error: 'Email or mobile number and password are required.' });
    }

    const admin = sqlite
      .prepare('SELECT * FROM admins WHERE (LOWER(email) = ? OR mobile = ?) AND is_active = 1 LIMIT 1')
      .get(cleanId, cleanMobile || '__none__') as AdminRecord | undefined;

    if (!admin || !verifyPassword(password, admin.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials or inactive admin account.' });
    }

    const token = signSessionToken(admin);
    writeAuditLog(admin.id, 'ADMIN_LOGIN', 'admins', admin.id, { role: admin.role });

    const { password_hash: _ph, ...safeAdmin } = admin;
    res.json({ token, admin: safeAdmin });
  });

  app.get('/api/auth/me', requireAdmin, (req: AuthenticatedRequest, res) => {
    res.json({ admin: req.admin });
  });

  // ==========================================================================
  // PROTECTED REGISTRATIONS MANAGEMENT
  // ==========================================================================
  app.get('/api/registrations', requireAdmin, (req: AuthenticatedRequest, res) => {
    const admin = req.admin!;
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : '';
    const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : '';

    let rows: RegistrationRecord[];
    if (admin.role === 'super_admin') {
      rows = sqlite
        .prepare(`
          SELECT r.*, a.full_name as assigned_admin_name
          FROM registrations r
          LEFT JOIN admins a ON r.assigned_admin_id = a.id
          ORDER BY r.created_at DESC
        `)
        .all() as unknown as RegistrationRecord[];
    } else {
      rows = sqlite
        .prepare(`
          SELECT r.*, a.full_name as assigned_admin_name
          FROM registrations r
          LEFT JOIN admins a ON r.assigned_admin_id = a.id
          WHERE r.assigned_admin_id = ?
          ORDER BY r.created_at DESC
        `)
        .all(admin.id) as unknown as RegistrationRecord[];
    }

    // Compute stats on full authorized dataset before filtering
    const todayPrefix = new Date().toISOString().slice(0, 10);
    const stats = {
      total: rows.length,
      today: rows.filter((r) => r.created_at.startsWith(todayPrefix)).length,
      newCount: rows.filter((r) => r.status === 'New').length,
      contactedCount: rows.filter((r) => r.status === 'Contacted').length,
      followUpCount: rows.filter((r) => r.status === 'Follow-up').length,
      completedCount: rows.filter((r) => r.status === 'Completed').length,
    };

    const filtered = rows.filter((r) => {
      if (statusFilter && statusFilter !== 'All' && r.status !== statusFilter) {
        return false;
      }
      if (dateFrom && r.created_at.slice(0, 10) < dateFrom) {
        return false;
      }
      if (dateTo && r.created_at.slice(0, 10) > dateTo) {
        return false;
      }
      if (search) {
        const hay = `${r.full_name} ${r.mobile} ${r.registration_code} ${r.occupation}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    res.json({ registrations: filtered, stats, serverTime: new Date().toISOString() });
  });

  app.patch('/api/registrations/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
    const admin = req.admin!;
    const { id } = req.params;
    const existing = sqlite.prepare('SELECT * FROM registrations WHERE id = ?').get(id) as RegistrationRecord | undefined;

    if (!existing) {
      return res.status(404).json({ error: 'Registration not found.' });
    }

    if (admin.role !== 'super_admin' && existing.assigned_admin_id !== admin.id) {
      return res.status(403).json({ error: 'Access denied: this registration is not assigned to you.' });
    }

    const body = req.body as Record<string, unknown>;
    const now = new Date().toISOString();

    if (admin.role === 'sub_admin') {
      const nextStatus = typeof body.status === 'string' && VALID_STATUSES.includes(body.status as RegistrationStatus)
        ? body.status
        : existing.status;
      const nextNotes = typeof body.follow_up_notes === 'string' ? body.follow_up_notes : existing.follow_up_notes;

      sqlite.prepare('UPDATE registrations SET status = ?, follow_up_notes = ?, updated_at = ? WHERE id = ?')
        .run(nextStatus, nextNotes, now, id);
      writeAuditLog(admin.id, 'SUB_ADMIN_UPDATE_STATUS', 'registrations', id, {
        status: nextStatus,
      });
    } else {
      const nextName = typeof body.full_name === 'string' && body.full_name.trim().length >= 2
        ? body.full_name.trim()
        : existing.full_name;
      const nextMobile = typeof body.mobile === 'string' && /^[6-9]\d{9}$/.test(body.mobile.replace(/\D/g, ''))
        ? body.mobile.replace(/\D/g, '')
        : existing.mobile;
      const nextDob = typeof body.dob === 'string' && body.dob.trim() ? body.dob.trim() : existing.dob;
      const nextAge = body.age !== undefined && Number(body.age) >= 18 ? Number(body.age) : existing.age;
      const nextAddress = typeof body.full_address === 'string' && body.full_address.trim().length >= 5
        ? body.full_address.trim()
        : existing.full_address;
      const nextOccupation = typeof body.occupation === 'string' && VALID_OCCUPATIONS.includes(body.occupation as OccupationType)
        ? body.occupation
        : existing.occupation;
      const nextStatus = typeof body.status === 'string' && VALID_STATUSES.includes(body.status as RegistrationStatus)
        ? body.status
        : existing.status;
      const nextAssigned = body.assigned_admin_id === null
        ? null
        : typeof body.assigned_admin_id === 'string'
        ? body.assigned_admin_id
        : existing.assigned_admin_id;
      const nextNotes = typeof body.follow_up_notes === 'string' ? body.follow_up_notes : existing.follow_up_notes;

      sqlite.prepare(`
        UPDATE registrations
        SET full_name = ?, mobile = ?, age = ?, dob = ?, full_address = ?,
            occupation = ?, status = ?, assigned_admin_id = ?, follow_up_notes = ?, updated_at = ?
        WHERE id = ?
      `).run(
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

      if (nextAssigned && nextAssigned !== existing.assigned_admin_id) {
        sqlite.prepare(`
          INSERT INTO admin_assignments (id, registration_id, admin_id, assigned_by, notes, assigned_at)
          VALUES (?, ?, ?, ?, 'Reassigned by Super Admin', ?)
        `).run(crypto.randomUUID(), id, nextAssigned, admin.id, now);
      }

      writeAuditLog(admin.id, 'SUPER_ADMIN_UPDATE_REGISTRATION', 'registrations', id, {
        status: nextStatus,
        assigned_admin_id: nextAssigned,
      });
    }

    const updated = sqlite
      .prepare(`
        SELECT r.*, a.full_name as assigned_admin_name
        FROM registrations r
        LEFT JOIN admins a ON r.assigned_admin_id = a.id
        WHERE r.id = ?
      `)
      .get(id) as unknown as RegistrationRecord;

    void mirrorToSupabase('registrations', updated as unknown as Record<string, unknown>);
    res.json({ registration: updated });
  });

  app.delete('/api/registrations/:id', requireAdmin, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const existing = sqlite.prepare('SELECT id, registration_code FROM registrations WHERE id = ?').get(id) as { id: string; registration_code: string } | undefined;
    if (!existing) {
      return res.status(404).json({ error: 'Registration not found.' });
    }
    sqlite.prepare('DELETE FROM registrations WHERE id = ?').run(id);
    writeAuditLog(req.admin!.id, 'DELETE_REGISTRATION', 'registrations', id, {
      registration_code: existing.registration_code,
    });
    res.json({ deleted: true, id });
  });

  // ==========================================================================
  // ADMIN MOBILE STORAGE SYNCHRONIZATION (PWA IndexedDB <-> Central DB)
  // ==========================================================================
  app.post('/api/registrations/sync', requireAdmin, (req: AuthenticatedRequest, res) => {
    const admin = req.admin!;
    const { deviceId, pendingUpdates } = req.body as {
      deviceId?: string;
      pendingUpdates?: Array<{
        id: string;
        status?: RegistrationStatus;
        follow_up_notes?: string;
        updated_at?: string;
      }>;
    };

    let pushedCount = 0;
    const now = new Date().toISOString();

    if (Array.isArray(pendingUpdates)) {
      for (const item of pendingUpdates) {
        if (!item?.id) continue;
        const reg = sqlite.prepare('SELECT * FROM registrations WHERE id = ?').get(item.id) as RegistrationRecord | undefined;
        if (!reg) continue;
        if (admin.role !== 'super_admin' && reg.assigned_admin_id !== admin.id) continue;

        const nextStatus = item.status && VALID_STATUSES.includes(item.status) ? item.status : reg.status;
        const nextNotes = typeof item.follow_up_notes === 'string' ? item.follow_up_notes : reg.follow_up_notes;

        sqlite.prepare('UPDATE registrations SET status = ?, follow_up_notes = ?, updated_at = ? WHERE id = ?')
          .run(nextStatus, nextNotes, now, item.id);
        pushedCount++;
      }
    }

    const authorizedRecords =
      admin.role === 'super_admin'
        ? (sqlite
            .prepare(`
              SELECT r.*, a.full_name as assigned_admin_name
              FROM registrations r
              LEFT JOIN admins a ON r.assigned_admin_id = a.id
              ORDER BY r.created_at DESC
            `)
            .all() as unknown as RegistrationRecord[])
        : (sqlite
            .prepare(`
              SELECT r.*, a.full_name as assigned_admin_name
              FROM registrations r
              LEFT JOIN admins a ON r.assigned_admin_id = a.id
              WHERE r.assigned_admin_id = ?
              ORDER BY r.created_at DESC
            `)
            .all(admin.id) as unknown as RegistrationRecord[]);

    const syncLogId = crypto.randomUUID();
    sqlite.prepare(`
      INSERT INTO sync_logs (id, admin_id, device_id, records_pulled, records_pushed, sync_status, created_at)
      VALUES (?, ?, ?, ?, ?, 'synced', ?)
    `).run(syncLogId, admin.id, deviceId || 'mobile-pwa', authorizedRecords.length, pushedCount, now);

    res.json({
      syncedAt: now,
      pushedCount,
      pulledCount: authorizedRecords.length,
      registrations: authorizedRecords,
    });
  });

  // ==========================================================================
  // ADMIN MANAGEMENT (SUPER ADMIN)
  // ==========================================================================
  app.get('/api/admins', requireAdmin, (req: AuthenticatedRequest, res) => {
    const admins = sqlite
      .prepare('SELECT id, full_name, email, mobile, whatsapp_number, role, is_primary, notifications_enabled, is_active, created_at, updated_at FROM admins ORDER BY is_primary DESC, created_at ASC')
      .all() as Array<Omit<AdminRecord, 'password_hash'>>;

    if (req.admin!.role !== 'super_admin') {
      // Sub admins only need basic names/IDs
      return res.json({
        admins: admins.map((a) => ({ id: a.id, full_name: a.full_name, role: a.role, is_primary: a.is_primary })),
      });
    }
    res.json({ admins });
  });

  app.post('/api/admins', requireAdmin, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const { full_name, email, mobile, whatsapp_number, role, is_primary, notifications_enabled, password } =
      req.body as Record<string, unknown>;

    const cleanName = typeof full_name === 'string' ? full_name.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanMobile = typeof mobile === 'string' ? mobile.replace(/\D/g, '') : '';
    const cleanWa = typeof whatsapp_number === 'string' && whatsapp_number.trim()
      ? normalizeWhatsAppNumber(whatsapp_number)
      : normalizeWhatsAppNumber(cleanMobile);
    const cleanRole = role === 'super_admin' ? 'super_admin' : 'sub_admin';
    const cleanPass = typeof password === 'string' && password.length >= 6 ? password : '';

    if (cleanName.length < 2 || !cleanEmail.includes('@') || !/^[6-9]\d{9}$/.test(cleanMobile) || !cleanPass) {
      return res.status(400).json({ error: 'Valid name, email, 10-digit mobile, and password (6+ chars) are required.' });
    }

    const exists = sqlite.prepare('SELECT id FROM admins WHERE LOWER(email) = ? OR mobile = ?').get(cleanEmail, cleanMobile);
    if (exists) {
      return res.status(409).json({ error: 'An admin with this email or mobile number already exists.' });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    if (is_primary === true) {
      sqlite.prepare('UPDATE admins SET is_primary = 0').run();
    }

    sqlite.prepare(`
      INSERT INTO admins (id, full_name, email, mobile, whatsapp_number, role, is_primary, notifications_enabled, is_active, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      id,
      cleanName,
      cleanEmail,
      cleanMobile,
      cleanWa,
      cleanRole,
      is_primary === true ? 1 : 0,
      notifications_enabled === false ? 0 : 1,
      hashPassword(cleanPass),
      now,
      now
    );

    writeAuditLog(req.admin!.id, 'CREATE_ADMIN', 'admins', id, { email: cleanEmail, role: cleanRole });
    const created = sqlite
      .prepare('SELECT id, full_name, email, mobile, whatsapp_number, role, is_primary, notifications_enabled, is_active, created_at, updated_at FROM admins WHERE id = ?')
      .get(id);

    res.status(201).json({ admin: created });
  });

  app.patch('/api/admins/:id', requireAdmin, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const existing = sqlite.prepare('SELECT * FROM admins WHERE id = ?').get(id) as AdminRecord | undefined;
    if (!existing) {
      return res.status(404).json({ error: 'Admin not found.' });
    }

    const body = req.body as Record<string, unknown>;
    const now = new Date().toISOString();

    if (body.is_primary === true) {
      sqlite.prepare('UPDATE admins SET is_primary = 0').run();
    }

    const nextName = typeof body.full_name === 'string' && body.full_name.trim() ? body.full_name.trim() : existing.full_name;
    const nextEmail = typeof body.email === 'string' && body.email.includes('@') ? body.email.trim().toLowerCase() : existing.email;
    const nextMobile = typeof body.mobile === 'string' && /^[6-9]\d{9}$/.test(body.mobile.replace(/\D/g, ''))
      ? body.mobile.replace(/\D/g, '')
      : existing.mobile;
    const nextWa = typeof body.whatsapp_number === 'string' && body.whatsapp_number.trim()
      ? normalizeWhatsAppNumber(body.whatsapp_number)
      : existing.whatsapp_number;
    const nextRole = body.role === 'super_admin' || body.role === 'sub_admin' ? body.role : existing.role;
    const nextPrimary = typeof body.is_primary === 'boolean' ? (body.is_primary ? 1 : 0) : existing.is_primary;
    const nextNotify = typeof body.notifications_enabled === 'boolean' ? (body.notifications_enabled ? 1 : 0) : existing.notifications_enabled;
    const nextActive = typeof body.is_active === 'boolean' ? (body.is_active ? 1 : 0) : existing.is_active;
    const nextPassHash = typeof body.password === 'string' && body.password.length >= 6
      ? hashPassword(body.password)
      : existing.password_hash;

    sqlite.prepare(`
      UPDATE admins
      SET full_name = ?, email = ?, mobile = ?, whatsapp_number = ?, role = ?,
          is_primary = ?, notifications_enabled = ?, is_active = ?, password_hash = ?, updated_at = ?
      WHERE id = ?
    `).run(nextName, nextEmail, nextMobile, nextWa, nextRole, nextPrimary, nextNotify, nextActive, nextPassHash, now, id);

    writeAuditLog(req.admin!.id, 'UPDATE_ADMIN', 'admins', id, { role: nextRole, is_primary: nextPrimary });

    const updated = sqlite
      .prepare('SELECT id, full_name, email, mobile, whatsapp_number, role, is_primary, notifications_enabled, is_active, created_at, updated_at FROM admins WHERE id = ?')
      .get(id);

    res.json({ admin: updated });
  });

  app.delete('/api/admins/:id', requireAdmin, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    if (id === req.admin!.id) {
      return res.status(400).json({ error: 'You cannot delete your own active Super Admin account.' });
    }
    const existing = sqlite.prepare('SELECT id, email FROM admins WHERE id = ?').get(id) as { id: string; email: string } | undefined;
    if (!existing) {
      return res.status(404).json({ error: 'Admin not found.' });
    }

    sqlite.prepare('UPDATE registrations SET assigned_admin_id = ? WHERE assigned_admin_id = ?').run(req.admin!.id, id);
    sqlite.prepare('DELETE FROM admins WHERE id = ?').run(id);
    writeAuditLog(req.admin!.id, 'DELETE_ADMIN', 'admins', id, { email: existing.email });
    res.json({ deleted: true, id });
  });

  // ==========================================================================
  // NOTIFICATION SETTINGS, LOGS & BACKUP RESTORE
  // ==========================================================================
  app.get('/api/settings/notifications', requireAdmin, requireSuperAdmin, (_req, res) => {
    const settings = sqlite
      .prepare('SELECT global_enabled, extra_whatsapp_numbers, updated_at FROM notification_settings WHERE id = 1')
      .get() as { global_enabled: number; extra_whatsapp_numbers: string; updated_at: string };

    const notificationLogs = sqlite
      .prepare(`
        SELECT nl.*, r.registration_code, r.full_name as registrant_name
        FROM notification_logs nl
        LEFT JOIN registrations r ON nl.registration_id = r.id
        ORDER BY nl.created_at DESC
        LIMIT 50
      `)
      .all();

    const syncLogs = sqlite
      .prepare(`
        SELECT sl.*, a.full_name as admin_name
        FROM sync_logs sl
        LEFT JOIN admins a ON sl.admin_id = a.id
        ORDER BY sl.created_at DESC
        LIMIT 30
      `)
      .all();

    const auditLogs = sqlite
      .prepare(`
        SELECT al.*, a.full_name as actor_name
        FROM audit_logs al
        LEFT JOIN admins a ON al.actor_admin_id = a.id
        ORDER BY al.created_at DESC
        LIMIT 40
      `)
      .all();

    res.json({
      global_enabled: settings.global_enabled === 1,
      extra_whatsapp_numbers: JSON.parse(settings.extra_whatsapp_numbers || '[]'),
      updated_at: settings.updated_at,
      whatsappCloudConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
      notificationLogs,
      syncLogs,
      auditLogs,
    });
  });

  app.put('/api/settings/notifications', requireAdmin, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const { global_enabled, extra_whatsapp_numbers } = req.body as {
      global_enabled?: boolean;
      extra_whatsapp_numbers?: string[];
    };

    const cleanNumbers = Array.isArray(extra_whatsapp_numbers)
      ? Array.from(
          new Set(
            extra_whatsapp_numbers
              .map((n) => normalizeWhatsAppNumber(String(n)))
              .filter((n) => n.length >= 10 && n.length <= 15)
          )
        )
      : [];

    const now = new Date().toISOString();
    sqlite.prepare(`
      UPDATE notification_settings
      SET global_enabled = ?, extra_whatsapp_numbers = ?, updated_by = ?, updated_at = ?
      WHERE id = 1
    `).run(global_enabled === false ? 0 : 1, JSON.stringify(cleanNumbers), req.admin!.id, now);

    writeAuditLog(req.admin!.id, 'UPDATE_NOTIFICATION_SETTINGS', 'notification_settings', '1', {
      global_enabled: global_enabled !== false,
      count: cleanNumbers.length,
    });

    res.json({
      global_enabled: global_enabled !== false,
      extra_whatsapp_numbers: cleanNumbers,
      updated_at: now,
    });
  });

  app.post('/api/notifications/:registrationId/resend', requireAdmin, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
    const reg = sqlite.prepare('SELECT * FROM registrations WHERE id = ?').get(req.params.registrationId) as RegistrationRecord | undefined;
    if (!reg) {
      return res.status(404).json({ error: 'Registration not found.' });
    }
    const dashboardUrl = `${getAppBaseUrl(req)}/?view=admin`;
    const results = await dispatchRegistrationNotifications(reg, dashboardUrl);
    res.json({ results });
  });

  app.post('/api/backup/restore', requireAdmin, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const { records } = req.body as { records?: Partial<RegistrationRecord>[] };
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: 'Invalid backup payload.' });
    }
    let restored = 0;
    const now = new Date().toISOString();

    for (const r of records) {
      if (!r.full_name || !r.mobile || !r.dob || !r.full_address || !r.occupation) continue;
      const cleanMobile = String(r.mobile).replace(/\D/g, '');
      const existing = sqlite.prepare('SELECT id FROM registrations WHERE mobile = ?').get(cleanMobile);
      if (existing) continue;

      const id = r.id || crypto.randomUUID();
      const code = r.registration_code || generateRegistrationCode();
      sqlite.prepare(`
        INSERT INTO registrations (
          id, registration_code, full_name, mobile, age, dob, full_address,
          occupation, status, assigned_admin_id, follow_up_notes,
          privacy_consent, whatsapp_consent, source, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `).run(
        String(id),
        String(code),
        String(r.full_name),
        cleanMobile,
        Number(r.age) >= 18 ? Number(r.age) : 18,
        String(r.dob),
        String(r.full_address),
        VALID_OCCUPATIONS.includes(r.occupation as OccupationType) ? String(r.occupation) : 'Other',
        VALID_STATUSES.includes(r.status as RegistrationStatus) ? String(r.status) : 'New',
        req.admin!.id,
        String(r.follow_up_notes || ''),
        r.whatsapp_consent ? 1 : 0,
        String(r.source || 'direct_link'),
        String(r.created_at || now),
        now
      );
      restored++;
    }

    writeAuditLog(req.admin!.id, 'BACKUP_RESTORED', 'registrations', 'batch', { restored });
    res.json({ restored });
  });

  // ==========================================================================
  // VITE DEV MIDDLEWARE OR PRODUCTION STATIC SERVING
  // ==========================================================================
  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });

    app.use((req, res, next) => {
      if (req.url === '/@vite/client' || req.url.startsWith('/@vite/client?')) {
        const origEnd = res.end.bind(res);
        const chunks: Buffer[] = [];

        res.write = ((chunk: unknown, encoding?: unknown, cb?: unknown) => {
          if (chunk) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? (encoding as BufferEncoding) : 'utf8'));
          }
          if (typeof encoding === 'function') {
            (encoding as () => void)();
          } else if (typeof cb === 'function') {
            (cb as () => void)();
          }
          return true;
        }) as typeof res.write;

        res.end = ((chunk?: unknown, encoding?: unknown, cb?: unknown) => {
          if (chunk && typeof chunk !== 'function') {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? (encoding as BufferEncoding) : 'utf8'));
          }
          let body = Buffer.concat(chunks).toString('utf8');
          body = body.replace(
            'transport.connect(createHMRHandler(handleMessage));',
            '/* HMR WebSocket disabled in preview */'
          );
          res.removeHeader('Content-Length');
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          const callback = typeof chunk === 'function' ? chunk : typeof encoding === 'function' ? encoding : cb;
          return origEnd(body, 'utf8', callback as (() => void) | undefined);
        }) as typeof res.end;
      }
      next();
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Join Bajrang Dal server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
