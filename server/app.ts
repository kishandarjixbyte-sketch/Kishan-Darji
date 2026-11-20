import crypto from 'node:crypto';
import express from 'express';
import {
  checkDatabaseHealth,
  createAdmin,
  createEvent,
  createEventRegistration,
  createRegistration,
  DatabaseError,
  deleteAdminAndReassign,
  deleteEvent,
  deleteRegistrationById,
  findActiveAdminByIdentifier,
  findAdminByEmailOrMobile,
  findRegistrationByMobile,
  getAdminByIdRaw,
  getBackupById,
  getEventByIdOrSlug,
  getNotificationSettings,
  getRegistrationById,
  getThemeSettings,
  hashPassword,
  isSupabaseConfigured,
  listAdmins,
  listAllEventRegistrationsCount,
  listBackups,
  listEventRegistrations,
  listEventsWithStats,
  listLogsForSuperAdmin,
  listOrganizationPages,
  listRegistrationsForAdmin,
  recordSyncLog,
  restoreBackupRegistrations,
  restoreFullDatabaseSnapshot,
  updateAdmin,
  updateEvent,
  updateEventRegistrationStatus,
  updateNotificationSettings,
  updateOrganizationPage,
  updateRegistrationById,
  updateThemeSettings,
  verifyMemberPublicByCode,
  verifyPassword,
  writeAuditLog,
  type EventApprovalStatus,
  type EventWingScope,
  type FestivalThemeId,
  type IdentityVerificationStatus,
  type MembershipStatus,
  type OccupationType,
  type OrganizationWing,
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
  dispatchConsentBasedCampaignMessages,
  dispatchRegistrationNotifications,
  normalizeWhatsAppNumber,
  type WhatsAppLanguage,
  type WhatsAppTemplateType,
} from './whatsapp.ts';
import {
  restoreFromBackupVersion,
  runDueScheduledBackupsIfNeeded,
  runEncryptedBackup,
} from './backup.ts';

const VALID_OCCUPATIONS: OccupationType[] = ['Student', 'Job', 'Business', 'Other'];
const VALID_STATUSES: RegistrationStatus[] = ['New', 'Contacted', 'Follow-up', 'Completed'];
const VALID_MEMBERSHIP_STATUSES: MembershipStatus[] = ['Pending', 'Approved', 'Rejected'];
const VALID_ID_VERIFICATION_STATUSES: IdentityVerificationStatus[] = ['Pending', 'Verified', 'Rejected'];
const VALID_EVENT_APPROVAL: EventApprovalStatus[] = ['Pending', 'Approved', 'Rejected'];
const VALID_THEMES: FestivalThemeId[] = [
  'normal',
  'diwali',
  'navratri',
  'ram_navami',
  'hanuman_jayanti',
  'janmashtami',
  'holi',
  'makar_sankranti',
];

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

// ============================================================================
// SLIDING-WINDOW RATE LIMITER & STATELESS HMAC CAPTCHA
// ============================================================================
const rateBuckets = new Map<string, number[]>();

function rateLimit(maxHits: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ipHeader = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const ip = Array.isArray(ipHeader) ? ipHeader[0] : String(ipHeader).split(',')[0].trim();
    const key = `${req.path}:${ip}`;
    const now = Date.now();
    const hits = (rateBuckets.get(key) || []).filter((ts) => now - ts < windowMs);
    if (hits.length >= maxHits) {
      return res.status(429).json({
        error: 'Too many requests from your connection. Please wait a minute and try again.',
      });
    }
    hits.push(now);
    rateBuckets.set(key, hits);
    next();
  };
}

function getCaptchaSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    'jbd-captcha-hmac-key-2026'
  );
}

function createCaptchaChallenge(): { token: string; question: string } {
  const a = crypto.randomInt(2, 16);
  const b = crypto.randomInt(1, 12);
  const answer = a + b;
  const exp = Date.now() + 1000 * 60 * 15;
  const payload = Buffer.from(JSON.stringify({ answer, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', getCaptchaSecret()).update(payload).digest('base64url');
  return {
    token: `${payload}.${sig}`,
    question: `${a} + ${b} = ?`,
  };
}

function verifyCaptchaToken(token: unknown, userAnswer: unknown): boolean {
  if (typeof token !== 'string' || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', getCaptchaSecret()).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      answer: number;
      exp: number;
    };
    if (!decoded.exp || decoded.exp < Date.now()) return false;
    return Number(userAnswer) === decoded.answer;
  } catch {
    return false;
  }
}

function validateDataUriUpload(data: unknown, maxBytes: number, allowedPrefixes: string[]): string {
  if (typeof data !== 'string' || !data.trim()) return '';
  const trimmed = data.trim();
  const validPrefix = allowedPrefixes.some((p) => trimmed.startsWith(p));
  if (!validPrefix) {
    throw new DatabaseError('Invalid uploaded file format. Please upload a valid JPG, PNG, WebP, or PDF file.', 400);
  }
  if (trimmed.length > maxBytes) {
    throw new DatabaseError('Uploaded file size exceeds the allowed limit. Please compress or choose a smaller file.', 400);
  }
  return trimmed;
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

  app.use(express.json({ limit: '10mb' }));

  // Health endpoint + serverless daily/weekly backup trigger
  app.get('/api/health', async (_req, res) => {
    const dbHealth = await checkDatabaseHealth();
    if (dbHealth.connected) {
      void runDueScheduledBackupsIfNeeded();
    }
    const statusCode = dbHealth.connected ? 200 : 503;
    res.status(statusCode).json({
      ok: dbHealth.connected,
      storageMode: dbHealth.mode,
      databaseError: dbHealth.error || null,
      whatsappConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
      supabaseMirrorConfigured: isSupabaseConfigured(),
    });
  });

  // Security Math CAPTCHA Challenge
  app.get('/api/security/captcha', (_req, res) => {
    res.json(createCaptchaChallenge());
  });

  // ==========================================================================
  // PUBLIC ORGANIZATION INFO PAGES & FESTIVAL THEME
  // ==========================================================================
  app.get('/api/org-pages', async (_req, res, next) => {
    try {
      const pages = await listOrganizationPages();
      res.json({ pages });
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/org-pages/:slug', requireAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const slug = req.params.slug;
      if (slug !== 'bajrang_dal' && slug !== 'vhp' && slug !== 'durga_vahini') {
        return res.status(400).json({ error: 'Invalid organization page slug.' });
      }
      const updated = await updateOrganizationPage(slug, req.body || {}, req.admin!.id);
      await writeAuditLog(req.admin!.id, 'UPDATE_ORG_PAGE', 'organization_pages', slug, {
        title: updated.title,
      });
      res.json({ page: updated });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/theme', async (_req, res, next) => {
    try {
      const settings = await getThemeSettings();
      res.json({ settings });
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/theme', requireAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      if (body.active_theme !== undefined && !VALID_THEMES.includes(body.active_theme as FestivalThemeId)) {
        return res.status(400).json({ error: 'Invalid festival theme identifier.' });
      }
      const updated = await updateThemeSettings(
        {
          active_theme: body.active_theme as FestivalThemeId | undefined,
          auto_schedule_enabled:
            typeof body.auto_schedule_enabled === 'boolean' ? body.auto_schedule_enabled : undefined,
          custom_banner_text:
            typeof body.custom_banner_text === 'string' ? body.custom_banner_text : undefined,
          custom_bg_style: typeof body.custom_bg_style === 'string' ? body.custom_bg_style : undefined,
          animations_enabled:
            typeof body.animations_enabled === 'boolean' ? body.animations_enabled : undefined,
          schedules: Array.isArray(body.schedules) ? body.schedules : undefined,
        },
        req.admin!.id
      );
      await writeAuditLog(req.admin!.id, 'UPDATE_FESTIVAL_THEME', 'theme_settings', '1', {
        active_theme: updated.active_theme,
        effective_theme: updated.effective_theme,
      });
      res.json({ settings: updated });
    } catch (err) {
      next(err);
    }
  });

  // ==========================================================================
  // PUBLIC MEMBER PROFILE VERIFICATION (PRIVACY-SAFE)
  // ==========================================================================
  app.get('/api/members/verify', async (req, res, next) => {
    try {
      const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
      if (!code) {
        return res.status(400).json({ error: 'Member Registration ID is required.' });
      }
      const member = await verifyMemberPublicByCode(code);
      if (!member) {
        return res.status(404).json({ error: 'No member record found for this Registration ID.' });
      }
      res.json({ member });
    } catch (err) {
      next(err);
    }
  });

  // ==========================================================================
  // PUBLIC REGISTRATION SUBMISSION (BAJRANG DAL & DURGA VAHINI)
  // ==========================================================================
  app.post('/api/registrations', rateLimit(20, 60_000), async (req, res, next) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const wing: OrganizationWing =
        body.organization_wing === 'durga_vahini' ? 'durga_vahini' : 'bajrang_dal';

      // Verify CAPTCHA if provided (always required from public web forms)
      if (!verifyCaptchaToken(body.captcha_token, body.captcha_answer)) {
        return res.status(400).json({
          error: 'Security verification (CAPTCHA) is incorrect or expired. Please solve the math question again.',
        });
      }

      const cleanName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
      const cleanFatherOrGuardian =
        typeof body.father_or_guardian_name === 'string' ? body.father_or_guardian_name.trim() : '';
      const cleanMobile = typeof body.mobile === 'string' ? body.mobile.replace(/\D/g, '') : '';
      const cleanWhatsappRaw =
        typeof body.whatsapp_number === 'string' ? body.whatsapp_number.replace(/\D/g, '') : '';
      const cleanWhatsapp = cleanWhatsappRaw.length >= 10 ? cleanWhatsappRaw : cleanMobile;
      const cleanEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const cleanDob = typeof body.dob === 'string' ? body.dob.trim() : '';
      const cleanAddress = typeof body.full_address === 'string' ? body.full_address.trim() : '';
      const cleanCity = typeof body.city_village === 'string' ? body.city_village.trim() : '';
      const cleanDistrict = typeof body.district === 'string' ? body.district.trim() : '';
      const cleanState = typeof body.state === 'string' && body.state.trim() ? body.state.trim() : 'Gujarat';
      const cleanPincode = typeof body.pincode === 'string' ? body.pincode.replace(/\D/g, '').slice(0, 6) : '';
      const cleanOccupation = typeof body.occupation === 'string' ? body.occupation.trim() : 'Other';
      const cleanEducation = typeof body.education === 'string' ? body.education.trim() : '';
      const cleanRegDate =
        typeof body.registration_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.registration_date)
          ? body.registration_date
          : new Date().toISOString().slice(0, 10);
      const numericAge = Number(body.age);

      if (cleanName.length < 2 || cleanName.length > 120) {
        return res.status(400).json({ error: 'Please enter a valid full name (2-120 characters).' });
      }
      if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
      }
      if (!cleanDob) {
        return res.status(400).json({ error: 'Date of Birth is required.' });
      }

      const minAge = wing === 'durga_vahini' ? 15 : 18;
      const computedAge = calculateAgeFromDob(cleanDob);
      if (computedAge < minAge || Number.isNaN(numericAge) || numericAge < minAge || numericAge > 110) {
        return res.status(400).json({
          error:
            wing === 'durga_vahini'
              ? 'Durga Vahini membership requires participants to be aged 15 years or older.'
              : 'Bajrang Dal registrations are strictly limited to adults aged 18 and above.',
        });
      }
      if (Math.abs(computedAge - numericAge) > 1) {
        return res.status(400).json({ error: 'Entered age does not match the selected Date of Birth.' });
      }
      if (cleanAddress.length < 5 || cleanAddress.length > 500) {
        return res.status(400).json({ error: 'Please enter your complete residential address.' });
      }

      const resolvedOccupation: OccupationType = VALID_OCCUPATIONS.includes(cleanOccupation as OccupationType)
        ? (cleanOccupation as OccupationType)
        : 'Other';

      if (body.privacy_consent !== true) {
        return res.status(400).json({ error: 'Privacy policy consent is required to register.' });
      }

      const profilePhotoData = validateDataUriUpload(body.profile_photo_data, 2_500_000, [
        'data:image/jpeg',
        'data:image/jpg',
        'data:image/png',
        'data:image/webp',
      ]);
      const identityDocData = validateDataUriUpload(body.identity_doc_data, 3_500_000, [
        'data:image/jpeg',
        'data:image/jpg',
        'data:image/png',
        'data:image/webp',
        'data:application/pdf',
      ]);
      const identityDocName =
        typeof body.identity_doc_name === 'string' ? body.identity_doc_name.slice(0, 120) : '';

      const duplicate = await findRegistrationByMobile(cleanMobile);
      if (duplicate) {
        return res.status(409).json({
          error: `This mobile number is already registered (ID: ${duplicate.registration_code}). Duplicate submissions are not permitted.`,
          existingCode: duplicate.registration_code,
        });
      }

      const cleanSource =
        body.source === 'qr_code'
          ? 'qr_code'
          : body.source === 'admin_manual'
          ? 'admin_manual'
          : 'direct_link';

      const createdRecord = await createRegistration({
        organization_wing: wing,
        full_name: cleanName,
        father_or_guardian_name: cleanFatherOrGuardian,
        mobile: cleanMobile,
        whatsapp_number: cleanWhatsapp,
        email: cleanEmail,
        age: computedAge,
        dob: cleanDob,
        full_address: cleanAddress,
        city_village: cleanCity,
        district: cleanDistrict,
        state: cleanState,
        pincode: cleanPincode,
        occupation: resolvedOccupation,
        education: cleanEducation,
        profile_photo_data: profilePhotoData,
        identity_doc_data: identityDocData,
        identity_doc_name: identityDocName,
        registration_date: cleanRegDate,
        whatsapp_consent: Boolean(body.whatsapp_consent),
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
          organization_wing: createdRecord.organization_wing,
          full_name: createdRecord.full_name,
          mobile: createdRecord.mobile,
          age: createdRecord.age,
          occupation: createdRecord.occupation,
          city_village: createdRecord.city_village,
          district: createdRecord.district,
          membership_status: createdRecord.membership_status,
          registration_date: createdRecord.registration_date,
          created_at: createdRecord.created_at,
        },
        notifications: notificationResults,
      });
    } catch (err) {
      next(err);
    }
  });

  // ==========================================================================
  // EVENTS & EVENT-SPECIFIC REGISTRATION ROUTES
  // ==========================================================================
  app.get('/api/events', async (_req, res, next) => {
    try {
      const events = await listEventsWithStats();
      res.json({ events });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/events/:idOrSlug', async (req, res, next) => {
    try {
      const ev = await getEventByIdOrSlug(req.params.idOrSlug);
      if (!ev) return res.status(404).json({ error: 'Event not found.' });
      res.json({ event: ev });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/events', requireAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const description = typeof body.description === 'string' ? body.description.trim() : '';
      const eventDate = typeof body.event_date === 'string' ? body.event_date.trim() : '';
      const eventTime = typeof body.event_time === 'string' ? body.event_time.trim() : '10:00';
      const venue = typeof body.venue === 'string' ? body.venue.trim() : '';
      const locationCity = typeof body.location_city === 'string' ? body.location_city.trim() : '';
      const regStartDate = typeof body.reg_start_date === 'string' ? body.reg_start_date.trim() : '';
      const regEndDate = typeof body.reg_end_date === 'string' ? body.reg_end_date.trim() : '';
      const maxCapacity = Math.max(1, Number(body.max_capacity) || 200);
      const registrationEnabled = body.registration_enabled !== false;
      const category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'Seva';
      const wing: EventWingScope =
        body.organization_wing === 'bajrang_dal' ||
        body.organization_wing === 'durga_vahini' ||
        body.organization_wing === 'vhp'
          ? body.organization_wing
          : 'all';

      if (title.length < 3 || !eventDate || venue.length < 3) {
        return res.status(400).json({ error: 'Event title, date, and venue are required.' });
      }

      const posterData = validateDataUriUpload(body.poster_data, 3_000_000, [
        'data:image/jpeg',
        'data:image/jpg',
        'data:image/png',
        'data:image/webp',
      ]);

      const created = await createEvent({
        title,
        description,
        poster_data: posterData,
        event_date: eventDate,
        event_time: eventTime,
        venue,
        location_city: locationCity,
        reg_start_date: regStartDate,
        reg_end_date: regEndDate,
        max_capacity: maxCapacity,
        registration_enabled: registrationEnabled,
        category,
        organization_wing: wing,
        created_by: req.admin!.id,
      });

      await writeAuditLog(req.admin!.id, 'CREATE_EVENT', 'events', created.id, {
        title: created.title,
        slug: created.slug,
      });
      res.status(201).json({ event: created });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/events/:id', requireAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const posterData =
        body.poster_data !== undefined
          ? validateDataUriUpload(body.poster_data, 3_000_000, [
              'data:image/jpeg',
              'data:image/jpg',
              'data:image/png',
              'data:image/webp',
            ])
          : undefined;

      const updated = await updateEvent(req.params.id, {
        title: typeof body.title === 'string' ? body.title.trim() : undefined,
        description: typeof body.description === 'string' ? body.description.trim() : undefined,
        poster_data: posterData,
        event_date: typeof body.event_date === 'string' ? body.event_date.trim() : undefined,
        event_time: typeof body.event_time === 'string' ? body.event_time.trim() : undefined,
        venue: typeof body.venue === 'string' ? body.venue.trim() : undefined,
        location_city: typeof body.location_city === 'string' ? body.location_city.trim() : undefined,
        reg_start_date: typeof body.reg_start_date === 'string' ? body.reg_start_date.trim() : undefined,
        reg_end_date: typeof body.reg_end_date === 'string' ? body.reg_end_date.trim() : undefined,
        max_capacity: body.max_capacity !== undefined ? Math.max(1, Number(body.max_capacity)) : undefined,
        registration_enabled:
          typeof body.registration_enabled === 'boolean' ? body.registration_enabled : undefined,
        category: typeof body.category === 'string' ? body.category.trim() : undefined,
        organization_wing:
          body.organization_wing === 'all' ||
          body.organization_wing === 'bajrang_dal' ||
          body.organization_wing === 'durga_vahini' ||
          body.organization_wing === 'vhp'
            ? body.organization_wing
            : undefined,
      });

      await writeAuditLog(req.admin!.id, 'UPDATE_EVENT', 'events', updated.id, { title: updated.title });
      res.json({ event: updated });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/events/:id', requireAdmin, requireSuperAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      await deleteEvent(req.params.id);
      await writeAuditLog(req.admin!.id, 'DELETE_EVENT', 'events', req.params.id, {});
      res.json({ deleted: true, id: req.params.id });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/events/:idOrSlug/register', rateLimit(25, 60_000), async (req, res, next) => {
    try {
      const ev = await getEventByIdOrSlug(req.params.idOrSlug);
      if (!ev) return res.status(404).json({ error: 'Event not found.' });

      if (ev.registration_enabled !== 1) {
        return res.status(400).json({ error: 'Registration for this event is currently closed.' });
      }
      const today = new Date().toISOString().slice(0, 10);
      if (ev.reg_start_date && today < ev.reg_start_date) {
        return res.status(400).json({ error: `Registration opens on ${ev.reg_start_date}.` });
      }
      if (ev.reg_end_date && today > ev.reg_end_date) {
        return res.status(400).json({ error: `Registration closed on ${ev.reg_end_date}.` });
      }
      if ((ev.stats?.available_seats ?? 1) <= 0) {
        return res.status(400).json({ error: 'Maximum participant capacity has been reached for this event.' });
      }

      const body = (req.body || {}) as Record<string, unknown>;
      if (!verifyCaptchaToken(body.captcha_token, body.captcha_answer)) {
        return res.status(400).json({
          error: 'Security verification (CAPTCHA) is incorrect or expired. Please try again.',
        });
      }

      const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
      const mobile = typeof body.mobile === 'string' ? body.mobile.replace(/\D/g, '') : '';
      const whatsapp =
        typeof body.whatsapp_number === 'string' && body.whatsapp_number.replace(/\D/g, '').length >= 10
          ? body.whatsapp_number.replace(/\D/g, '')
          : mobile;
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const cityVillage = typeof body.city_village === 'string' ? body.city_village.trim() : '';
      const district = typeof body.district === 'string' ? body.district.trim() : '';
      const age = Math.max(12, Math.min(110, Number(body.age) || 18));
      const wing = typeof body.organization_wing === 'string' ? body.organization_wing.trim() : 'general';
      const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 300) : '';

      if (fullName.length < 2) {
        return res.status(400).json({ error: 'Please enter your full name.' });
      }
      if (!/^[6-9]\d{9}$/.test(mobile)) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
      }
      if (body.privacy_consent !== true) {
        return res.status(400).json({ error: 'Consent is required to register for this event.' });
      }

      const registration = await createEventRegistration({
        event_id: ev.id,
        full_name: fullName,
        mobile,
        whatsapp_number: whatsapp,
        email,
        city_village: cityVillage,
        district,
        age,
        organization_wing: wing,
        notes,
        whatsapp_consent: Boolean(body.whatsapp_consent),
      });

      res.status(201).json({ success: true, registration, event: ev });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/events/:id/registrations', requireAdmin, async (req, res, next) => {
    try {
      const registrations = await listEventRegistrations(req.params.id);
      res.json({ registrations });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/event-registrations/:regId', requireAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const status = (req.body as { approval_status?: string })?.approval_status;
      if (!status || !VALID_EVENT_APPROVAL.includes(status as EventApprovalStatus)) {
        return res.status(400).json({ error: 'Invalid approval status.' });
      }
      const updated = await updateEventRegistrationStatus(req.params.regId, status as EventApprovalStatus);
      await writeAuditLog(req.admin!.id, 'UPDATE_EVENT_REGISTRATION', 'event_registrations', req.params.regId, {
        approval_status: status,
      });
      res.json({ registration: updated });
    } catch (err) {
      next(err);
    }
  });

  // ==========================================================================
  // ADMIN AUTHENTICATION
  // ==========================================================================
  app.post('/api/auth/login', rateLimit(15, 60_000), async (req, res, next) => {
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
  // PROTECTED REGISTRATIONS MANAGEMENT & PRIVATE IDENTITY DOCUMENTS
  // ==========================================================================
  app.get('/api/registrations', requireAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const admin = req.admin!;
      const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
      const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim() : '';
      const wingFilter = typeof req.query.wing === 'string' ? req.query.wing.trim() : '';
      const membershipFilter = typeof req.query.membershipStatus === 'string' ? req.query.membershipStatus.trim() : '';
      const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : '';
      const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : '';

      const [rows, events, totalEventRegistrations] = await Promise.all([
        listRegistrationsForAdmin(admin),
        listEventsWithStats(),
        listAllEventRegistrationsCount(),
      ]);

      const todayPrefix = new Date().toISOString().slice(0, 10);
      const upcomingEventsCount = events.filter((e) => e.event_date >= todayPrefix).length;

      const stats = {
        total: rows.length,
        bajrangDalCount: rows.filter((r) => r.organization_wing === 'bajrang_dal').length,
        durgaVahiniCount: rows.filter((r) => r.organization_wing === 'durga_vahini').length,
        totalEvents: events.length,
        upcomingEvents: upcomingEventsCount,
        totalEventRegistrations,
        pendingMembershipCount: rows.filter((r) => r.membership_status === 'Pending').length,
        approvedMembershipCount: rows.filter((r) => r.membership_status === 'Approved').length,
        rejectedMembershipCount: rows.filter((r) => r.membership_status === 'Rejected').length,
        today: rows.filter((r) => r.created_at.startsWith(todayPrefix)).length,
        newCount: rows.filter((r) => r.status === 'New').length,
        contactedCount: rows.filter((r) => r.status === 'Contacted').length,
        followUpCount: rows.filter((r) => r.status === 'Follow-up').length,
        completedCount: rows.filter((r) => r.status === 'Completed').length,
      };

      const filtered = rows.filter((r) => {
        if (wingFilter && wingFilter !== 'All' && r.organization_wing !== wingFilter) return false;
        if (membershipFilter && membershipFilter !== 'All' && r.membership_status !== membershipFilter) return false;
        if (statusFilter && statusFilter !== 'All' && r.status !== statusFilter) return false;
        if (dateFrom && r.created_at.slice(0, 10) < dateFrom) return false;
        if (dateTo && r.created_at.slice(0, 10) > dateTo) return false;
        if (search) {
          const hay = `${r.full_name} ${r.mobile} ${r.registration_code} ${r.occupation} ${r.city_village} ${r.district}`.toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      });

      res.json({ registrations: filtered, stats, serverTime: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  });

  // Admin-only endpoint to inspect private Identity Verification Document
  app.get('/api/registrations/:id/document', requireAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const admin = req.admin!;
      const reg = await getRegistrationById(req.params.id, true);
      if (!reg) return res.status(404).json({ error: 'Registration not found.' });
      if (admin.role !== 'super_admin' && reg.assigned_admin_id !== admin.id) {
        return res.status(403).json({ error: 'Access denied: identity documents are restricted to authorized admins.' });
      }
      await writeAuditLog(admin.id, 'VIEW_PRIVATE_IDENTITY_DOC', 'registrations', reg.id, {
        registration_code: reg.registration_code,
      });
      res.json({
        id: reg.id,
        registration_code: reg.registration_code,
        identity_doc_name: reg.identity_doc_name,
        identity_doc_data: reg.identity_doc_data || '',
        identity_verification_status: reg.identity_verification_status,
      });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/registrations/:id', requireAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const admin = req.admin!;
      const { id } = req.params;
      const existing = await getRegistrationById(id, false);

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
        const nextAge = body.age !== undefined && Number(body.age) >= 15 ? Number(body.age) : existing.age;
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
        const nextMembershipStatus =
          typeof body.membership_status === 'string' &&
          VALID_MEMBERSHIP_STATUSES.includes(body.membership_status as MembershipStatus)
            ? (body.membership_status as MembershipStatus)
            : existing.membership_status;
        const nextIdVerifyStatus =
          typeof body.identity_verification_status === 'string' &&
          VALID_ID_VERIFICATION_STATUSES.includes(body.identity_verification_status as IdentityVerificationStatus)
            ? (body.identity_verification_status as IdentityVerificationStatus)
            : existing.identity_verification_status;
        const nextAssigned =
          body.assigned_admin_id === null
            ? null
            : typeof body.assigned_admin_id === 'string'
            ? body.assigned_admin_id
            : existing.assigned_admin_id;
        const nextNotes =
          typeof body.follow_up_notes === 'string' ? body.follow_up_notes : existing.follow_up_notes;
        const nextPhoto =
          body.profile_photo_data !== undefined
            ? validateDataUriUpload(body.profile_photo_data, 2_500_000, [
                'data:image/jpeg',
                'data:image/jpg',
                'data:image/png',
                'data:image/webp',
              ])
            : existing.profile_photo_data;

        updated = await updateRegistrationById(
          id,
          {
            full_name: nextName,
            father_or_guardian_name:
              typeof body.father_or_guardian_name === 'string'
                ? body.father_or_guardian_name.trim()
                : existing.father_or_guardian_name,
            mobile: nextMobile,
            whatsapp_number:
              typeof body.whatsapp_number === 'string'
                ? body.whatsapp_number.replace(/\D/g, '') || nextMobile
                : existing.whatsapp_number,
            email: typeof body.email === 'string' ? body.email.trim().toLowerCase() : existing.email,
            age: nextAge,
            dob: nextDob,
            full_address: nextAddress,
            city_village:
              typeof body.city_village === 'string' ? body.city_village.trim() : existing.city_village,
            district: typeof body.district === 'string' ? body.district.trim() : existing.district,
            state: typeof body.state === 'string' ? body.state.trim() : existing.state,
            pincode: typeof body.pincode === 'string' ? body.pincode.replace(/\D/g, '').slice(0, 6) : existing.pincode,
            occupation: nextOccupation,
            education: typeof body.education === 'string' ? body.education.trim() : existing.education,
            profile_photo_data: nextPhoto,
            identity_verification_status: nextIdVerifyStatus,
            membership_status: nextMembershipStatus,
            status: nextStatus,
            assigned_admin_id: nextAssigned,
            follow_up_notes: nextNotes,
          },
          admin.id,
          existing.assigned_admin_id
        );

        await writeAuditLog(admin.id, 'SUPER_ADMIN_UPDATE_REGISTRATION', 'registrations', id, {
          status: nextStatus,
          membership_status: nextMembershipStatus,
          identity_verification_status: nextIdVerifyStatus,
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
  // WHATSAPP MULTILINGUAL CAMPAIGN DISPATCH
  // ==========================================================================
  app.post('/api/whatsapp/send', requireAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const body = (req.body || {}) as {
        language?: WhatsAppLanguage;
        templateType?: WhatsAppTemplateType;
        customMessage?: string;
        eventId?: string;
        recipients?: Array<{
          registrationId?: string | null;
          registrationCode?: string;
          fullName: string;
          whatsappNumber: string;
          wingLabel?: string;
          membershipStatus?: string;
          whatsappConsent: boolean;
        }>;
      };

      const language: WhatsAppLanguage =
        body.language === 'gu' || body.language === 'hi' ? body.language : 'en';
      const templateType: WhatsAppTemplateType =
        body.templateType === 'event_announcement' ||
        body.templateType === 'registration_confirmation' ||
        body.templateType === 'event_reminder' ||
        body.templateType === 'membership_update'
          ? body.templateType
          : 'custom';

      const recipientsList = Array.isArray(body.recipients) ? body.recipients : [];
      if (recipientsList.length === 0) {
        return res.status(400).json({ error: 'Please select at least one opted-in recipient.' });
      }

      const ev = body.eventId ? await getEventByIdOrSlug(body.eventId) : null;
      const results = await dispatchConsentBasedCampaignMessages({
        actorAdminId: req.admin!.id,
        language,
        templateType,
        customMessage: body.customMessage || '',
        eventTitle: ev?.title,
        eventDate: ev ? `${ev.event_date} ${ev.event_time}` : undefined,
        eventVenue: ev ? `${ev.venue}${ev.location_city ? `, ${ev.location_city}` : ''}` : undefined,
        recipients: recipientsList,
      });

      await writeAuditLog(req.admin!.id, 'WHATSAPP_CAMPAIGN_SEND', 'notification_logs', templateType, {
        language,
        sent_or_queued: results.length,
      });

      res.json({ results });
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
  // NOTIFICATION SETTINGS, LOGS & AUTOMATIC ENCRYPTED BACKUPS
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

  app.get('/api/backups', requireAdmin, requireSuperAdmin, async (_req, res, next) => {
    try {
      await runDueScheduledBackupsIfNeeded();
      const backups = await listBackups(30);
      res.json({ backups });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/backups/run', requireAdmin, requireSuperAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const backup = await runEncryptedBackup('manual', req.admin!.id);
      res.status(201).json({ backup });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/backups/:id/download', requireAdmin, requireSuperAdmin, async (req, res, next) => {
    try {
      const backup = await getBackupById(req.params.id);
      if (!backup || !backup.encrypted_payload) {
        return res.status(404).json({ error: 'Encrypted backup version not found.' });
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="JBD_Cloud_Backup_${backup.backup_type}_${backup.created_at.slice(0, 10)}.jbdenc"`
      );
      res.send(backup.encrypted_payload);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/backups/:id/restore', requireAdmin, requireSuperAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const summary = await restoreFromBackupVersion(req.params.id, req.admin!.id);
      res.json({ summary });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/backup/restore', requireAdmin, requireSuperAdmin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const body = (req.body || {}) as {
        records?: Partial<RegistrationRecord>[];
        events?: Array<Record<string, unknown>>;
        event_registrations?: Array<Record<string, unknown>>;
      };
      if (Array.isArray(body.events) || Array.isArray(body.event_registrations)) {
        const summary = await restoreFullDatabaseSnapshot(
          {
            registrations: (body.records || []) as Array<Record<string, unknown>>,
            events: body.events,
            event_registrations: body.event_registrations,
          },
          req.admin!.id
        );
        return res.json({ restored: summary.membersRestored, summary });
      }
      if (!Array.isArray(body.records)) {
        return res.status(400).json({ error: 'Invalid backup payload.' });
      }
      const restored = await restoreBackupRegistrations(body.records, req.admin!.id);
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
