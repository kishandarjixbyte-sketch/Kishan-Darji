import crypto from 'node:crypto';
import {
  getAdminByIdRaw,
  getEnabledAlertSuperAdmins,
  getNotificationLogEntry,
  getNotificationSettings,
  saveNotificationLogEntry,
  type DeliveryStatus,
  type NotificationLogRecord,
  type RegistrationRecord,
} from './db.ts';

export type WhatsAppLanguage = 'gu' | 'hi' | 'en';
export type WhatsAppTemplateType =
  | 'event_announcement'
  | 'registration_confirmation'
  | 'event_reminder'
  | 'membership_update'
  | 'custom';

export type CampaignRecipientStatus =
  | DeliveryStatus
  | 'skipped_duplicate'
  | 'skipped_invalid'
  | 'skipped_no_consent';

const DUPLICATE_GUARD_TTL_MS = 60_000;
const recentCampaignDispatches = new Map<string, number>();

function pruneRecentDispatchCache(now: number): void {
  if (recentCampaignDispatches.size < 200) return;
  for (const [key, expiresAt] of recentCampaignDispatches.entries()) {
    if (expiresAt <= now) {
      recentCampaignDispatches.delete(key);
    }
  }
}

export function normalizeWhatsAppNumber(input: string): string {
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

export function isValidWhatsAppNumber(input: string): boolean {
  const normalized = normalizeWhatsAppNumber(input);
  if (!/^[1-9]\d{9,14}$/.test(normalized)) return false;
  if (normalized.length === 12 && normalized.startsWith('91')) {
    return /^91[6-9]\d{9}$/.test(normalized);
  }
  return true;
}

export function buildRegistrationWhatsAppMessage(
  reg: RegistrationRecord,
  dashboardUrl: string
): string {
  // Strictly exclude full residential address and complete date of birth
  const submittedAt = new Date(reg.created_at).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const wingLabel = reg.organization_wing === 'durga_vahini' ? 'Durga Vahini' : 'Bajrang Dal';

  return [
    `NEW REGISTRATION – ${wingLabel.toUpperCase()}`,
    '',
    `Name: ${reg.full_name}`,
    `Wing: ${wingLabel}`,
    `Mobile: ${reg.mobile}`,
    `District/City: ${[reg.city_village, reg.district].filter(Boolean).join(', ') || 'Gujarat'}`,
    `Occupation: ${reg.occupation}`,
    `Registration ID: ${reg.registration_code}`,
    `Submission Date: ${submittedAt}`,
    `Admin Dashboard: ${dashboardUrl}`,
  ].join('\n');
}

export function buildMultilingualWhatsAppMessage(params: {
  language: WhatsAppLanguage;
  templateType: WhatsAppTemplateType;
  customMessage?: string;
  recipientName?: string;
  registrationCode?: string;
  wingLabel?: string;
  eventTitle?: string;
  eventDate?: string;
  eventVenue?: string;
  membershipStatus?: string;
}): string {
  const name = params.recipientName?.trim() || 'Member';
  const code = params.registrationCode?.trim() || '';
  const wing = params.wingLabel?.trim() || 'Bajrang Dal / VHP';
  const evTitle = params.eventTitle?.trim() || 'Upcoming Organization Program';
  const evDate = params.eventDate?.trim() || '';
  const evVenue = params.eventVenue?.trim() || '';
  const status = params.membershipStatus?.trim() || 'Updated';

  const applyPlaceholders = (raw: string): string =>
    raw
      .replace(/\{name\}/gi, name)
      .replace(/\{code\}/gi, code || 'N/A')
      .replace(/\{wing\}/gi, wing)
      .replace(/\{event_title\}/gi, evTitle)
      .replace(/\{event_date\}/gi, evDate || 'TBA')
      .replace(/\{venue\}/gi, evVenue || 'District Office')
      .replace(/\{status\}/gi, status);

  const customNote = params.customMessage?.trim()
    ? applyPlaceholders(params.customMessage.trim())
    : '';

  if (params.templateType === 'custom') {
    return customNote;
  }

  const templates: Record<WhatsAppLanguage, Record<Exclude<WhatsAppTemplateType, 'custom'>, string>> = {
    gu: {
      event_announcement: [
        `જય શ્રી રામ ${name},`,
        `${wing} દ્વારા નવો કાર્યક્રમ જાહેર કરવામાં આવ્યો છે:`,
        `કાર્યક્રમ: ${evTitle}`,
        evDate ? `તારીખ: ${evDate}` : '',
        evVenue ? `સ્થળ: ${evVenue}` : '',
        customNote ? `\n${customNote}` : '',
        `\nસંપર્ક અને રજીસ્ટ્રેશન માટે સત્તાવાર પોર્ટલની મુલાકાત લો.`,
      ]
        .filter(Boolean)
        .join('\n'),
      registration_confirmation: [
        `નમસ્તે ${name},`,
        `${wing} માં તમારી નોંધણી સફળતાપૂર્વક પ્રાપ્ત થઈ છે.`,
        code ? `રજીસ્ટ્રેશન નંબર: ${code}` : '',
        customNote ? `\n${customNote}` : '',
        `તમારા સભ્યપદ અંગેની આગળની પુષ્ટિ અને સૂચના તમને WhatsApp સંદેશ દ્વારા મળશે.`,
      ]
        .filter(Boolean)
        .join('\n'),
      event_reminder: [
        `સ્મૃતિ સંદેશ – ${name},`,
        `આગામી કાર્યક્રમ "${evTitle}" માં તમારી હાજરી અપેક્ષિત છે.`,
        evDate ? `તારીખ: ${evDate}` : '',
        evVenue ? `સ્થળ: ${evVenue}` : '',
        code ? `તમારો પાસ નંબર: ${code}` : '',
        customNote ? `\n${customNote}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      membership_update: [
        `જય શ્રી રામ ${name},`,
        `${wing} સભ્યપદ અરજી (${code || 'Ref'}) ની વર્તમાન સ્થિતિ: ${status}.`,
        customNote || 'વધુ સૂચનાઓ તમને આ નંબર પર સંદેશ દ્વારા મોકલવામાં આવશે.',
      ]
        .filter(Boolean)
        .join('\n'),
    },
    hi: {
      event_announcement: [
        `जय श्री राम ${name},`,
        `${wing} द्वारा आगामी कार्यक्रम की सूचना:`,
        `कार्यक्रम: ${evTitle}`,
        evDate ? `दिनांक: ${evDate}` : '',
        evVenue ? `स्थान: ${evVenue}` : '',
        customNote ? `\n${customNote}` : '',
        `\nअधिक जानकारी एवं पंजीकरण के लिए आधिकारिक पोर्टल देखें।`,
      ]
        .filter(Boolean)
        .join('\n'),
      registration_confirmation: [
        `नमस्ते ${name},`,
        `${wing} में आपका पंजीकरण सफलतापूर्वक दर्ज कर लिया गया है।`,
        code ? `पंजीकरण क्रमांक: ${code}` : '',
        customNote ? `\n${customNote}` : '',
        `आपके पंजीकरण की आगे की पुष्टि और सूचना WhatsApp संदेश द्वारा भेजी जाएगी।`,
      ]
        .filter(Boolean)
        .join('\n'),
      event_reminder: [
        `स्मरण सूचना – ${name},`,
        `आगामी कार्यक्रम "${evTitle}" के लिए अनुस्मारक:`,
        evDate ? `दिनांक: ${evDate}` : '',
        evVenue ? `स्थान: ${evVenue}` : '',
        code ? `पास क्रमांक: ${code}` : '',
        customNote ? `\n${customNote}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      membership_update: [
        `जय श्री राम ${name},`,
        `${wing} सदस्यता आवेदन (${code || 'Ref'}) की अद्यतन स्थिति: ${status}.`,
        customNote || 'अन्य आवश्यक जानकारी संदेश द्वारा भेजी जाएगी।',
      ]
        .filter(Boolean)
        .join('\n'),
    },
    en: {
      event_announcement: [
        `Namaste ${name},`,
        `${wing} invites you to an upcoming program:`,
        `Event: ${evTitle}`,
        evDate ? `Date: ${evDate}` : '',
        evVenue ? `Venue: ${evVenue}` : '',
        customNote ? `\n${customNote}` : '',
        `\nPlease check the official portal for registration and details.`,
      ]
        .filter(Boolean)
        .join('\n'),
      registration_confirmation: [
        `Namaste ${name},`,
        `Your registration with ${wing} has been received successfully.`,
        code ? `Reference ID: ${code}` : '',
        customNote ? `\n${customNote}` : '',
        `You will receive further membership confirmation updates directly via message.`,
      ]
        .filter(Boolean)
        .join('\n'),
      event_reminder: [
        `Event Reminder – ${name},`,
        `This is a reminder for "${evTitle}".`,
        evDate ? `Date: ${evDate}` : '',
        evVenue ? `Venue: ${evVenue}` : '',
        code ? `Pass Ref: ${code}` : '',
        customNote ? `\n${customNote}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      membership_update: [
        `Namaste ${name},`,
        `Your ${wing} membership application (${code || 'Ref'}) status is now: ${status}.`,
        customNote || 'Thank you for registering with our organization.',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  };

  const langSet = templates[params.language] || templates.en;
  return langSet[params.templateType] || customNote;
}

interface NotificationDispatchResult {
  recipient: string;
  status: DeliveryStatus;
  providerMessageId?: string;
  error?: string;
  waMeUrl?: string;
}

export async function sendSingleWhatsAppMessage(
  recipient: string,
  messageText: string
): Promise<{
  status: DeliveryStatus;
  providerMessageId?: string;
  errorMessage?: string;
}> {
  const normalized = normalizeWhatsAppNumber(recipient);
  if (!isValidWhatsAppNumber(normalized)) {
    return {
      status: 'failed',
      errorMessage: 'Invalid WhatsApp phone number. Enter a valid 10-digit Indian mobile or international number with country code.',
    };
  }

  if (!messageText.trim()) {
    return {
      status: 'failed',
      errorMessage: 'Cannot send an empty WhatsApp message.',
    };
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const apiVersion = process.env.WHATSAPP_API_VERSION?.trim() || 'v21.0';

  if (!accessToken || !phoneNumberId) {
    return {
      status: 'queued_unconfigured',
      errorMessage:
        'WhatsApp Cloud API credentials are not configured on the server; use the Direct Open WA button to send via WhatsApp App/Web.',
    };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: normalized,
          type: 'text',
          text: { preview_url: false, body: messageText },
        }),
        signal: AbortSignal.timeout(12_000),
      }
    );

    const rawText = await res.text();
    let data: {
      messages?: Array<{ id: string }>;
      error?: { message?: string; error_user_msg?: string; code?: number };
    } = {};
    try {
      data = JSON.parse(rawText) as typeof data;
    } catch {
      // keep empty data if non-JSON response
    }

    if (res.ok && data.messages?.[0]?.id) {
      return { status: 'sent', providerMessageId: data.messages[0].id };
    }

    if (res.status === 401 || res.status === 403) {
      return {
        status: 'failed',
        errorMessage:
          data.error?.error_user_msg ||
          data.error?.message ||
          'WhatsApp Cloud API token is invalid or expired. Renew WHATSAPP_ACCESS_TOKEN or use Direct Open WA.',
      };
    }

    if (res.status === 429) {
      return {
        status: 'failed',
        errorMessage: 'WhatsApp rate limit reached. Wait a few seconds and retry failed messages.',
      };
    }

    return {
      status: 'failed',
      errorMessage:
        data.error?.error_user_msg ||
        data.error?.message ||
        `Meta Cloud API returned HTTP ${res.status}. Check number format and template policy.`,
    };
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      return {
        status: 'failed',
        errorMessage: 'WhatsApp Cloud API request timed out after 12 seconds. Check internet connection and retry.',
      };
    }
    return {
      status: 'failed',
      errorMessage: err instanceof Error ? `Network error: ${err.message}` : 'Network error reaching WhatsApp Cloud API.',
    };
  }
}

export async function dispatchRegistrationNotifications(
  reg: RegistrationRecord,
  dashboardUrl: string
): Promise<NotificationDispatchResult[]> {
  const settings = await getNotificationSettings();
  const globalEnabled = settings.global_enabled;
  const extraNumbers = settings.extra_whatsapp_numbers;

  const recipients = new Map<string, string | null>();

  if (reg.assigned_admin_id) {
    const assigned = await getAdminByIdRaw(reg.assigned_admin_id);
    if (assigned && assigned.is_active === 1 && assigned.notifications_enabled === 1 && assigned.whatsapp_number) {
      const normalized = normalizeWhatsAppNumber(assigned.whatsapp_number);
      if (isValidWhatsAppNumber(normalized)) {
        recipients.set(normalized, assigned.id);
      }
    }
  }

  const enabledAdmins = await getEnabledAlertSuperAdmins();
  for (const adm of enabledAdmins) {
    if (adm.whatsapp_number) {
      const normalized = normalizeWhatsAppNumber(adm.whatsapp_number);
      if (isValidWhatsAppNumber(normalized) && !recipients.has(normalized)) {
        recipients.set(normalized, adm.id);
      }
    }
  }

  for (const num of extraNumbers) {
    const normalized = normalizeWhatsAppNumber(num);
    if (isValidWhatsAppNumber(normalized) && !recipients.has(normalized)) {
      recipients.set(normalized, null);
    }
  }

  const messageText = buildRegistrationWhatsAppMessage(reg, dashboardUrl);
  const results: NotificationDispatchResult[] = [];

  for (const [recipient, adminId] of recipients.entries()) {
    const existing = await getNotificationLogEntry(reg.id, recipient);
    if (existing && existing.delivery_status === 'sent') {
      continue;
    }

    let status: DeliveryStatus = 'queued_unconfigured';
    let providerMessageId: string | undefined;
    let errorMessage: string | undefined;

    if (!globalEnabled) {
      status = 'skipped_disabled';
    } else {
      const dispatched = await sendSingleWhatsAppMessage(recipient, messageText);
      status = dispatched.status;
      providerMessageId = dispatched.providerMessageId;
      errorMessage = dispatched.errorMessage;
    }

    await saveNotificationLogEntry({
      existingId: existing?.id,
      registrationId: reg.id,
      adminId,
      recipientWhatsapp: recipient,
      language: 'en',
      messageType: 'registration_alert',
      messagePreview: messageText,
      providerMessageId,
      deliveryStatus: status,
      errorMessage,
    });

    results.push({ recipient, status, providerMessageId, error: errorMessage });
  }

  return results;
}

export async function dispatchMemberConfirmationMessage(
  reg: RegistrationRecord,
  type: 'registration_confirmation' | 'membership_update' = 'registration_confirmation',
  language: WhatsAppLanguage = 'gu',
  actorAdminId: string | null = null
): Promise<{
  status: DeliveryStatus;
  recipient: string;
  messageText: string;
  waMeUrl: string;
  error?: string;
}> {
  const wingLabel = reg.organization_wing === 'durga_vahini' ? 'Durga Vahini' : 'Bajrang Dal';
  const messageText = buildMultilingualWhatsAppMessage({
    language,
    templateType: type,
    recipientName: reg.full_name,
    registrationCode: reg.registration_code,
    wingLabel,
    membershipStatus: reg.membership_status,
  });
  const normalized = normalizeWhatsAppNumber(reg.whatsapp_number || reg.mobile);
  const validPhone = isValidWhatsAppNumber(normalized);
  const waMeUrl = validPhone
    ? `https://wa.me/${normalized}?text=${encodeURIComponent(messageText)}`
    : '';

  if (reg.whatsapp_consent !== 1 || !validPhone) {
    return {
      status: 'skipped_disabled',
      recipient: normalized,
      messageText,
      waMeUrl,
    };
  }

  const dispatched = await sendSingleWhatsAppMessage(normalized, messageText);
  await saveNotificationLogEntry({
    registrationId: reg.id,
    adminId: actorAdminId,
    recipientWhatsapp: normalized,
    language,
    messageType: type,
    messagePreview: messageText,
    providerMessageId: dispatched.providerMessageId,
    deliveryStatus: dispatched.status,
    errorMessage: dispatched.errorMessage,
  });

  return {
    status: dispatched.status,
    recipient: normalized,
    messageText,
    waMeUrl,
    error: dispatched.errorMessage,
  };
}

export interface CampaignRecipientResult {
  fullName: string;
  recipient: string;
  status: CampaignRecipientStatus;
  messageText: string;
  waMeUrl: string;
  providerMessageId?: string;
  error?: string;
}

export interface CampaignDispatchSummary {
  totalRequested: number;
  processed: number;
  sentCount: number;
  directReadyCount: number;
  failedCount: number;
  skippedDuplicateCount: number;
  skippedInvalidCount: number;
  skippedNoConsentCount: number;
}

export async function dispatchConsentBasedCampaignMessages(params: {
  actorAdminId: string;
  language: WhatsAppLanguage;
  templateType: WhatsAppTemplateType;
  customMessage: string;
  eventTitle?: string;
  eventDate?: string;
  eventVenue?: string;
  allowDuplicate?: boolean;
  recipients: Array<{
    registrationId?: string | null;
    registrationCode?: string;
    fullName: string;
    whatsappNumber: string;
    wingLabel?: string;
    membershipStatus?: string;
    whatsappConsent: boolean;
  }>;
}): Promise<{
  results: CampaignRecipientResult[];
  summary: CampaignDispatchSummary;
}> {
  const results: CampaignRecipientResult[] = [];
  const seenNumbersInBatch = new Set<string>();
  const now = Date.now();
  pruneRecentDispatchCache(now);

  const summary: CampaignDispatchSummary = {
    totalRequested: params.recipients.length,
    processed: 0,
    sentCount: 0,
    directReadyCount: 0,
    failedCount: 0,
    skippedDuplicateCount: 0,
    skippedInvalidCount: 0,
    skippedNoConsentCount: 0,
  };

  for (const r of params.recipients) {
    const cleanName = r.fullName?.trim() || 'Recipient';
    const normalized = normalizeWhatsAppNumber(r.whatsappNumber);

    // Enforce opt-in consent and opt-out protection
    if (!r.whatsappConsent) {
      summary.skippedNoConsentCount++;
      results.push({
        fullName: cleanName,
        recipient: normalized || r.whatsappNumber,
        status: 'skipped_no_consent',
        messageText: '',
        waMeUrl: '',
        error: 'WhatsApp consent not granted.',
      });
      continue;
    }

    if (!isValidWhatsAppNumber(normalized)) {
      summary.skippedInvalidCount++;
      results.push({
        fullName: cleanName,
        recipient: r.whatsappNumber,
        status: 'skipped_invalid',
        messageText: '',
        waMeUrl: '',
        error: 'Invalid phone number format (must be a valid 10-digit Indian mobile or international number).',
      });
      continue;
    }

    const messageText = buildMultilingualWhatsAppMessage({
      language: params.language,
      templateType: params.templateType,
      customMessage: params.customMessage,
      recipientName: cleanName,
      registrationCode: r.registrationCode,
      wingLabel: r.wingLabel,
      eventTitle: params.eventTitle,
      eventDate: params.eventDate,
      eventVenue: params.eventVenue,
      membershipStatus: r.membershipStatus,
    });

    const waMeUrl = `https://wa.me/${normalized}?text=${encodeURIComponent(messageText)}`;

    // 1. Within-batch deduplication so the same phone is never messaged twice in one send
    if (seenNumbersInBatch.has(normalized)) {
      summary.skippedDuplicateCount++;
      results.push({
        fullName: cleanName,
        recipient: normalized,
        status: 'skipped_duplicate',
        messageText,
        waMeUrl,
        error: 'Duplicate phone number in this recipient list was automatically skipped.',
      });
      continue;
    }
    seenNumbersInBatch.add(normalized);

    // 2. Short-window duplicate protection across rapid double-submits
    const msgHash = crypto.createHash('sha256').update(messageText).digest('hex').slice(0, 16);
    const cacheKey = `${params.actorAdminId}:${normalized}:${msgHash}`;
    const recentExpiresAt = recentCampaignDispatches.get(cacheKey);
    if (!params.allowDuplicate && recentExpiresAt && recentExpiresAt > now) {
      summary.skippedDuplicateCount++;
      results.push({
        fullName: cleanName,
        recipient: normalized,
        status: 'skipped_duplicate',
        messageText,
        waMeUrl,
        error: 'Identical message was already sent to this number in the last 60 seconds.',
      });
      continue;
    }

    const dispatched = await sendSingleWhatsAppMessage(normalized, messageText);

    if (dispatched.status !== 'failed') {
      recentCampaignDispatches.set(cacheKey, now + DUPLICATE_GUARD_TTL_MS);
    }

    await saveNotificationLogEntry({
      registrationId: r.registrationId || null,
      adminId: params.actorAdminId,
      recipientWhatsapp: normalized,
      language: params.language,
      messageType: params.templateType,
      messagePreview: messageText,
      providerMessageId: dispatched.providerMessageId,
      deliveryStatus: dispatched.status,
      errorMessage: dispatched.errorMessage,
    });

    summary.processed++;
    if (dispatched.status === 'sent') summary.sentCount++;
    else if (dispatched.status === 'queued_unconfigured') summary.directReadyCount++;
    else if (dispatched.status === 'failed') summary.failedCount++;

    results.push({
      fullName: cleanName,
      recipient: normalized,
      status: dispatched.status,
      messageText,
      waMeUrl,
      providerMessageId: dispatched.providerMessageId,
      error: dispatched.errorMessage,
    });
  }

  return { results, summary };
}

export async function retryWhatsAppNotificationLog(
  log: NotificationLogRecord
): Promise<{
  status: DeliveryStatus;
  providerMessageId?: string;
  error?: string;
  waMeUrl: string;
}> {
  const normalized = normalizeWhatsAppNumber(log.recipient_whatsapp);
  const dispatched = await sendSingleWhatsAppMessage(normalized, log.message_preview);

  await saveNotificationLogEntry({
    existingId: log.id,
    registrationId: log.registration_id,
    adminId: log.admin_id,
    recipientWhatsapp: normalized || log.recipient_whatsapp,
    language: log.language || 'en',
    messageType: log.message_type || 'custom',
    messagePreview: log.message_preview,
    providerMessageId: dispatched.providerMessageId,
    deliveryStatus: dispatched.status,
    errorMessage: dispatched.errorMessage,
  });

  const waMeUrl = isValidWhatsAppNumber(normalized)
    ? `https://wa.me/${normalized}?text=${encodeURIComponent(log.message_preview)}`
    : '';

  return {
    status: dispatched.status,
    providerMessageId: dispatched.providerMessageId,
    error: dispatched.errorMessage,
    waMeUrl,
  };
}
