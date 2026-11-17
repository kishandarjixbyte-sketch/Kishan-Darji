import express from 'express';
import {
  checkDatabaseHealth,
  createAdmin,
  createRegistration,
  DatabaseError,
  deleteAdminAndReassign,
  deleteRegistrationById,
  findActiveAdminByIdentifier,
  findAdminByEmailOrMobile,
  findRegistrationByMobile,
  getAdminByIdRaw,
  getNotificationSettings,
  getRegistrationById,
  hashPassword,
  isSupabaseConfigured,
  listAdmins,
  listLogsForSuperAdmin,
  listRegistrationsForAdmin,
  recordSyncLog,
  restoreBackupRegistrations,
  updateAdmin,
  updateNotificationSettings,
  updateRegistrationById,
  verifyPassword,
  writeAuditLog,
  type OccupationType,
  type RegistrationRecord,
  type RegistrationStatus,
} from './db.ts';
import {
  requireAdmin,
  requireSuperAdmin,
  signSessionToken,
  type AuthenticatedRequest,
} from './auth.ts';
import {
  dispatchRegistrationNotifications,
  normalizeWhatsAppNumber,
} from './whatsapp.ts';

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
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader)
    ? protoHeader[0]
    : protoHeader || req.protocol || 'https';
  const hostHeader = req.headers['x-forwarded-host'] || req.headers.host;
  const host = Array.isArray(hostHeader)
    ? hostHeader[0]
    : hostHeader || process.env.VERCEL_URL || 'localhost:3000';
  return `${proto}://${host}`;
}

export function createApiApp() {
  const app = express();

  // CORS middleware for Vercel, mobile browsers, and cross-origin preview domains
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  app.use(express.json({ limit: '5mb' }));

  // Health endpoint (verifies actual database connectivity)
  app.get('/api/health', async (_req, res) => {
    const dbHealth = await checkDatabaseHealth();
    const statusCode = dbHealth.connected ? 200 : 503;
    res.status(statusCode).json({
      ok: dbHealth.connected,
      storageMode: dbHealth.mode,
      databaseError: dbHealth.error || null,
      whatsappConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
      supabaseMirrorConfigured: isSupabaseConfigured(),
    });
  });

  // ==========================================================================
  // PUBLIC REGISTRATION SUBMISSION
  // ==========================================================================
  app.post('/api/registrations', async (req, res, next) => {
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
      } = (req.body || {}) as Record<string, unknown>;

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

      const duplicate = await findRegistrationByMobile(cleanMobile);
      if (duplicate) {
        return res.status(409).json({
          error: `This mobile number is already registered (ID: ${duplicate.registration_code}). Duplicate submissions are not permitted.`,
          existingCode: duplicate.registration_code,
        });
      }

      const cleanSource =
        source === 'qr_code'
          ? 'qr_code'
          : source === 'admin_manual'
          ? 'admin_manual'
          : 'direct_link';

      const createdRecord = await createRegistration({
        full_name: cleanName,
        mobile: cleanMobile,
        age: computedAge,
        dob: cleanDob,
        full_address: cleanAddress,
        occupation: cleanOccupation as OccupationType,
        whatsapp_consent: Boolean(whatsapp_consent),
        source: cleanSource,
      });

      const dashboardUrl = `${getAppBaseUrl(req)}/?view=admin`;
      let notificationResults: unknown[] = [];
      try {
        notificationResults = await dispatchRegistrationNotifications(createdRecord, dashboardUrl);
      } catch (notifyErr) {
        console.error('WhatsApp notification dispatch warning:', notifyErr);
      }

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
      next(err);
    }
  });

  // ==========================================================================
  // ADMIN AUTHENTICATION
  // ==========================================================================
  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const { identifier, password } = (req.body || {}) as { identifier?: string; password?: string };
      const cleanId = (identifier || '').trim().toLowerCase();
      const cleanMobile = (identifier || '').replace(/\D/g, '');
      if (!cleanId || !password) {
        return res.status(400).json({ error: 'Email or mobile number and password are required.' });
      }

      const admin = await findActiveAdminByIdentifier(cleanId, cleanMobile);
      if (!admin || !verifyPassword(password, admin.password_hash)) {
        return res.status(401).json({ error: 'Invalid credentials or inactive admin account.' });
      }

      const token = signSessionToken(admin);
      await writeAuditLog(admin.id, 'ADMIN_LOGIN', 'admins', admin.id, { role: admin.role });

      const { password_hash: _ph, ...safeAdmin } = admin;
      res.json({ token, admin: safeAdmin });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/auth/me', requireAdmin, (req: AuthenticatedRequest, res) => {
    res.json({ admin: req.admin });
  });

  // ==========================================================================
  // PROTECTED REGISTRATIONS MANAGEMENT
  // ==========================================================================
  app.get('/api/registrations', requireAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const admin = req.admin!;
      const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
      const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim() : '';
      const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : '';
      const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : '';

      const rows = await listRegistrationsForAdmin(admin);

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
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/registrations/:id', requireAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const admin = req.admin!;
      const { id } = req.params;
      const existing = await getRegistrationById(id);

      if (!existing) {
        return res.status(404).json({ error: 'Registration not found.' });
      }
      if (admin.role !== 'super_admin' && existing.assigned_admin_id !== admin.id) {
        return res.status(403).json({ error: 'Access denied: this registration is not assigned to you.' });
      }

      const body = (req.body || {}) as Record<string, unknown>;
      let updated: RegistrationRecord;

      if (admin.role === 'sub_admin') {
        const nextStatus =
          typeof body.status === 'string' && VALID_STATUSES.includes(body.status as RegistrationStatus)
            ? (body.status as RegistrationStatus)
            : existing.status;
        const nextNotes =
          typeof body.follow_up_notes === 'string' ? body.follow_up_notes : existing.follow_up_notes;

        updated = await updateRegistrationById(
          id,
          { status: nextStatus, follow_up_notes: nextNotes },
          admin.id
        );
        await writeAuditLog(admin.id, 'SUB_ADMIN_UPDATE_STATUS', 'registrations', id, {
          status: nextStatus,
        });
      } else {
        const nextName =
          typeof body.full_name === 'string' && body.full_name.trim().length >= 2
            ? body.full_name.trim()
            : existing.full_name;
        const nextMobile =
          typeof body.mobile === 'string' && /^[6-9]\d{9}$/.test(body.mobile.replace(/\D/g, ''))
            ? body.mobile.replace(/\D/g, '')
            : existing.mobile;
        const nextDob = typeof body.dob === 'string' && body.dob.trim() ? body.dob.trim() : existing.dob;
        const nextAge = body.age !== undefined && Number(body.age) >= 18 ? Number(body.age) : existing.age;
        const nextAddress =
          typeof body.full_address === 'string' && body.full_address.trim().length >= 5
            ? body.full_address.trim()
            : existing.full_address;
        const nextOccupation =
          typeof body.occupation === 'string' && VALID_OCCUPATIONS.includes(body.occupation as OccupationType)
            ? (body.occupation as OccupationType)
            : existing.occupation;
        const nextStatus =
          typeof body.status === 'string' && VALID_STATUSES.includes(body.status as RegistrationStatus)
            ? (body.status as RegistrationStatus)
            : existing.status;
        const nextAssigned =
          body.assigned_admin_id === null
            ? null
            : typeof body.assigned_admin_id === 'string'
            ? body.assigned_admin_id
            : existing.assigned_admin_id;
        const nextNotes =
          typeof body.follow_up_notes === 'string' ? body.follow_up_notes : existing.follow_up_notes;

        updated = await updateRegistrationById(
          id,
          {
            full_name: nextName,
            mobile: nextMobile,
            age: nextAge,
            dob: nextDob,
            full_address: nextAddress,
            occupation: nextOccupation,
            status: nextStatus,
            assigned_admin_id: nextAssigned,
            follow_up_notes: nextNotes,
          },
          admin.id,
          existing.assigned_admin_id
        );

        await writeAuditLog(admin.id, 'SUPER_ADMIN_UPDATE_REGISTRATION', 'registrations', id, {
          status: nextStatus,
          assigned_admin_id: nextAssigned,
        });
      }

      res.json({ registration: updated });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/registrations/:id', requireAdmin, requireSuperAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;
      const existing = await getRegistrationById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Registration not found.' });
      }
      await deleteRegistrationById(id);
      await writeAuditLog(req.admin!.id, 'DELETE_REGISTRATION', 'registrations', id, {
        registration_code: existing.registration_code,
      });
      res.json({ deleted: true, id });
    } catch (err) {
      next(err);
    }
  });

  // ==========================================================================
  // ADMIN MOBILE STORAGE SYNCHRONIZATION (PWA IndexedDB <-> Central DB)
  // ==========================================================================
  app.post('/api/registrations/sync', requireAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const admin = req.admin!;
      const { deviceId, pendingUpdates } = (req.body || {}) as {
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
          const reg = await getRegistrationById(item.id);
          if (!reg) continue;
          if (admin.role !== 'super_admin' && reg.assigned_admin_id !== admin.id) continue;

          const nextStatus = item.status && VALID_STATUSES.includes(item.status) ? item.status : reg.status;
          const nextNotes = typeof item.follow_up_notes === 'string' ? item.follow_up_notes : reg.follow_up_notes;

          await updateRegistrationById(
            item.id,
            { status: nextStatus, follow_up_notes: nextNotes },
            admin.id
          );
          pushedCount++;
        }
      }

      const authorizedRecords = await listRegistrationsForAdmin(admin);
      await recordSyncLog(admin.id, deviceId || 'mobile-pwa', authorizedRecords.length, pushedCount);

      res.json({
        syncedAt: now,
        pushedCount,
        pulledCount: authorizedRecords.length,
        registrations: authorizedRecords,
      });
    } catch (err) {
      next(err);
    }
  });

  // ==========================================================================
  // ADMIN MANAGEMENT (SUPER ADMIN)
  // ==========================================================================
  app.get('/api/admins', requireAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const admins = await listAdmins();
      if (req.admin!.role !== 'super_admin') {
        return res.json({
          admins: admins.map((a) => ({
            id: a.id,
            full_name: a.full_name,
            role: a.role,
            is_primary: a.is_primary,
          })),
        });
      }
      res.json({ admins });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/admins', requireAdmin, requireSuperAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const {
        full_name,
        email,
        mobile,
        whatsapp_number,
        role,
        is_primary,
        notifications_enabled,
        password,
      } = (req.body || {}) as Record<string, unknown>;

      const cleanName = typeof full_name === 'string' ? full_name.trim() : '';
      const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      const cleanMobile = typeof mobile === 'string' ? mobile.replace(/\D/g, '') : '';
      const cleanWa =
        typeof whatsapp_number === 'string' && whatsapp_number.trim()
          ? normalizeWhatsAppNumber(whatsapp_number)
          : normalizeWhatsAppNumber(cleanMobile);
      const cleanRole = role === 'super_admin' ? 'super_admin' : 'sub_admin';
      const cleanPass = typeof password === 'string' && password.length >= 6 ? password : '';

      if (cleanName.length < 2 || !cleanEmail.includes('@') || !/^[6-9]\d{9}$/.test(cleanMobile) || !cleanPass) {
        return res.status(400).json({
          error: 'Valid name, email, 10-digit mobile, and password (6+ chars) are required.',
        });
      }

      const exists = await findAdminByEmailOrMobile(cleanEmail, cleanMobile);
      if (exists) {
        return res.status(409).json({ error: 'An admin with this email or mobile number already exists.' });
      }

      const created = await createAdmin({
        full_name: cleanName,
        email: cleanEmail,
        mobile: cleanMobile,
        whatsapp_number: cleanWa,
        role: cleanRole,
        is_primary: is_primary === true,
        notifications_enabled: notifications_enabled !== false,
        password: cleanPass,
      });

      await writeAuditLog(req.admin!.id, 'CREATE_ADMIN', 'admins', created.id, {
        email: cleanEmail,
        role: cleanRole,
      });
      res.status(201).json({ admin: created });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/admins/:id', requireAdmin, requireSuperAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;
      const existing = await getAdminByIdRaw(id);
      if (!existing) {
        return res.status(404).json({ error: 'Admin not found.' });
      }

      const body = (req.body || {}) as Record<string, unknown>;
      const nextName = typeof body.full_name === 'string' && body.full_name.trim() ? body.full_name.trim() : existing.full_name;
      const nextEmail = typeof body.email === 'string' && body.email.includes('@') ? body.email.trim().toLowerCase() : existing.email;
      const nextMobile =
        typeof body.mobile === 'string' && /^[6-9]\d{9}$/.test(body.mobile.replace(/\D/g, ''))
          ? body.mobile.replace(/\D/g, '')
          : existing.mobile;
      const nextWa =
        typeof body.whatsapp_number === 'string' && body.whatsapp_number.trim()
          ? normalizeWhatsAppNumber(body.whatsapp_number)
          : existing.whatsapp_number;
      const nextRole = body.role === 'super_admin' || body.role === 'sub_admin' ? body.role : existing.role;
      const nextPrimary = typeof body.is_primary === 'boolean' ? body.is_primary : existing.is_primary === 1;
      const nextNotify =
        typeof body.notifications_enabled === 'boolean'
          ? body.notifications_enabled
          : existing.notifications_enabled === 1;
      const nextActive = typeof body.is_active === 'boolean' ? body.is_active : existing.is_active === 1;
      const nextPassHash =
        typeof body.password === 'string' && body.password.length >= 6
          ? hashPassword(body.password)
          : existing.password_hash;

      const updated = await updateAdmin(id, existing, {
        full_name: nextName,
        email: nextEmail,
        mobile: nextMobile,
        whatsapp_number: nextWa,
        role: nextRole,
        is_primary: nextPrimary,
        notifications_enabled: nextNotify,
        is_active: nextActive,
        password_hash: nextPassHash,
      });

      await writeAuditLog(req.admin!.id, 'UPDATE_ADMIN', 'admins', id, {
        role: nextRole,
        is_primary: nextPrimary,
      });
      res.json({ admin: updated });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/admins/:id', requireAdmin, requireSuperAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;
      if (id === req.admin!.id) {
        return res.status(400).json({ error: 'You cannot delete your own active Super Admin account.' });
      }
      const existing = await getAdminByIdRaw(id);
      if (!existing) {
        return res.status(404).json({ error: 'Admin not found.' });
      }

      await deleteAdminAndReassign(id, req.admin!.id);
      await writeAuditLog(req.admin!.id, 'DELETE_ADMIN', 'admins', id, { email: existing.email });
      res.json({ deleted: true, id });
    } catch (err) {
      next(err);
    }
  });

  // ==========================================================================
  // NOTIFICATION SETTINGS, LOGS & BACKUP RESTORE
  // ==========================================================================
  app.get('/api/settings/notifications', requireAdmin, requireSuperAdmin, async (_req, res, next) => {
    try {
      const [settings, logs] = await Promise.all([getNotificationSettings(), listLogsForSuperAdmin()]);
      res.json({
        global_enabled: settings.global_enabled,
        extra_whatsapp_numbers: settings.extra_whatsapp_numbers,
        updated_at: settings.updated_at,
        whatsappCloudConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
        notificationLogs: logs.notificationLogs,
        syncLogs: logs.syncLogs,
        auditLogs: logs.auditLogs,
      });
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/settings/notifications', requireAdmin, requireSuperAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const { global_enabled, extra_whatsapp_numbers } = (req.body || {}) as {
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

      const updated = await updateNotificationSettings(
        global_enabled !== false,
        cleanNumbers,
        req.admin!.id
      );

      await writeAuditLog(req.admin!.id, 'UPDATE_NOTIFICATION_SETTINGS', 'notification_settings', '1', {
        global_enabled: updated.global_enabled,
        count: cleanNumbers.length,
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/notifications/:registrationId/resend', requireAdmin, requireSuperAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const reg = await getRegistrationById(req.params.registrationId);
      if (!reg) {
        return res.status(404).json({ error: 'Registration not found.' });
      }
      const dashboardUrl = `${getAppBaseUrl(req)}/?view=admin`;
      const results = await dispatchRegistrationNotifications(reg, dashboardUrl);
      res.json({ results });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/backup/restore', requireAdmin, requireSuperAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const { records } = (req.body || {}) as { records?: Partial<RegistrationRecord>[] };
      if (!Array.isArray(records)) {
        return res.status(400).json({ error: 'Invalid backup payload.' });
      }
      const restored = await restoreBackupRegistrations(records, req.admin!.id);
      res.json({ restored });
    } catch (err) {
      next(err);
    }
  });

  // Always return JSON errors for /api/* routes (never HTML stack traces)
  app.use('/api', (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof DatabaseError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    const message = err instanceof Error ? err.message : 'Internal server error.';
    console.error('API Error:', err);
    res.status(500).json({ error: message });
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  return app;
}
