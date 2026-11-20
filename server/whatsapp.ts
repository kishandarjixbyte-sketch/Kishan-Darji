import {
  getAdminByIdRaw,
  getEnabledAlertSuperAdmins,
  getNotificationLogEntry,
  getNotificationSettings,
  saveNotificationLogEntry,
  type DeliveryStatus,
  type RegistrationRecord,
} from './db.ts';

export type WhatsAppLanguage = 'gu' | 'hi' | 'en';
export type WhatsAppTemplateType =
  | 'event_announcement'
  | 'registration_confirmation'
  | 'event_reminder'
  | 'membership_update'
  | 'custom';

export function normalizeWhatsAppNumber(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
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
  const name = params.recipientName || 'Member';
  const code = params.registrationCode || '';
  const wing = params.wingLabel || 'Bajrang Dal / VHP';
  const evTitle = params.eventTitle || 'Upcoming Organization Program';
  const evDate = params.eventDate || '';
  const evVenue = params.eventVenue || '';
  const status = params.membershipStatus || 'Updated';

  if (params.templateType === 'custom' && params.customMessage?.trim()) {
    return params.customMessage
      .replace(/\{name\}/gi, name)
      .replace(/\{code\}/gi, code)
      .replace(/\{wing\}/gi, wing)
      .replace(/\{event_title\}/gi, evTitle)
      .replace(/\{event_date\}/gi, evDate)
      .replace(/\{venue\}/gi, evVenue)
      .trim();
  }

  const templates: Record<WhatsAppLanguage, Record<Exclude<WhatsAppTemplateType, 'custom'>, string>> = {
    gu: {
      event_announcement: [
        `જય શ્રી રામ ${name},`,
        `${wing} દ્વારા નવો કાર્યક્રમ જાહેર કરવામાં આવ્યો છે:`,
        `કાર્યક્રમ: ${evTitle}`,
        evDate ? `તારીખ: ${evDate}` : '',
        evVenue ? `સ્થળ: ${evVenue}` : '',
        params.customMessage ? `\n${params.customMessage}` : '',
        `\nસંપર્ક અને રજીસ્ટ્રેશન માટે સત્તાવાર પોર્ટલની મુલાકાત લો.`,
      ]
        .filter(Boolean)
        .join('\n'),
      registration_confirmation: [
        `નમસ્તે ${name},`,
        `${wing} માં તમારી નોંધણી સફળતાપૂર્વક પ્રાપ્ત થઈ છે.`,
        code ? `રજીસ્ટ્રેશન નંબર: ${code}` : '',
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
      ]
        .filter(Boolean)
        .join('\n'),
      membership_update: [
        `જય શ્રી રામ ${name},`,
        `${wing} સભ્યપદ અરજી (${code || 'Ref'}) ની વર્તમાન સ્થિતિ: ${status}.`,
        params.customMessage ? params.customMessage : 'વધુ સૂચનાઓ તમને આ નંબર પર સંદેશ દ્વારા મોકલવામાં આવશે.',
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
        params.customMessage ? `\n${params.customMessage}` : '',
        `\nअधिक जानकारी एवं पंजीकरण के लिए आधिकारिक पोर्टल देखें।`,
      ]
        .filter(Boolean)
        .join('\n'),
      registration_confirmation: [
        `नमस्ते ${name},`,
        `${wing} में आपका पंजीकरण सफलतापूर्वक दर्ज कर लिया गया है।`,
        code ? `पंजीकरण क्रमांक: ${code}` : '',
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
      ]
        .filter(Boolean)
        .join('\n'),
      membership_update: [
        `जय श्री राम ${name},`,
        `${wing} सदस्यता आवेदन (${code || 'Ref'}) की अद्यतन स्थिति: ${status}.`,
        params.customMessage ? params.customMessage : 'अन्य आवश्यक जानकारी संदेश द्वारा भेजी जाएगी।',
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
        params.customMessage ? `\n${params.customMessage}` : '',
        `\nPlease check the official portal for registration and details.`,
      ]
        .filter(Boolean)
        .join('\n'),
      registration_confirmation: [
        `Namaste ${name},`,
        `Your registration with ${wing} has been received successfully.`,
        code ? `Reference ID: ${code}` : '',
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
      ]
        .filter(Boolean)
        .join('\n'),
      membership_update: [
        `Namaste ${name},`,
        `Your ${wing} membership application (${code || 'Ref'}) status is now: ${status}.`,
        params.customMessage ? params.customMessage : 'Thank you for registering with our organization.',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  };

  const langSet = templates[params.language] || templates.en;
  const tplKey = params.templateType === 'custom' ? 'membership_update' : params.templateType;
  return langSet[tplKey] || params.customMessage || '';
}

interface NotificationDispatchResult {
  recipient: string;
  status: DeliveryStatus;
  providerMessageId?: string;
  error?: string;
  waMeUrl?: string;
}

async function sendSingleWhatsAppMessage(
  recipient: string,
  messageText: string
): Promise<{
  status: DeliveryStatus;
  providerMessageId?: string;
  errorMessage?: string;
}> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const apiVersion = process.env.WHATSAPP_API_VERSION?.trim() || 'v21.0';

  if (!accessToken || !phoneNumberId) {
    return {
      status: 'queued_unconfigured',
      errorMessage: 'WhatsApp Cloud API credentials not configured; use direct WhatsApp link or configure Meta API tokens.',
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
          to: recipient,
          type: 'text',
          text: { preview_url: false, body: messageText },
        }),
      }
    );

    const data = (await res.json()) as {
      messages?: Array<{ id: string }>;
      error?: { message: string };
    };

    if (res.ok && data.messages?.[0]?.id) {
      return { status: 'sent', providerMessageId: data.messages[0].id };
    }
    return { status: 'failed', errorMessage: data.error?.message || `HTTP ${res.status}` };
  } catch (err) {
    return { status: 'failed', errorMessage: err instanceof Error ? err.message : 'Network error' };
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
      recipients.set(normalizeWhatsAppNumber(assigned.whatsapp_number), assigned.id);
    }
  }

  const enabledAdmins = await getEnabledAlertSuperAdmins();
  for (const adm of enabledAdmins) {
    if (adm.whatsapp_number) {
      const normalized = normalizeWhatsAppNumber(adm.whatsapp_number);
      if (!recipients.has(normalized)) {
        recipients.set(normalized, adm.id);
      }
    }
  }

  for (const num of extraNumbers) {
    const normalized = normalizeWhatsAppNumber(num);
    if (normalized.length >= 10 && !recipients.has(normalized)) {
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
  const waMeUrl = normalized.length >= 10
    ? `https://wa.me/${normalized}?text=${encodeURIComponent(messageText)}`
    : '';

  if (reg.whatsapp_consent !== 1 || normalized.length < 10) {
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

export async function dispatchConsentBasedCampaignMessages(params: {
  actorAdminId: string;
  language: WhatsAppLanguage;
  templateType: WhatsAppTemplateType;
  customMessage: string;
  eventTitle?: string;
  eventDate?: string;
  eventVenue?: string;
  recipients: Array<{
    registrationId?: string | null;
    registrationCode?: string;
    fullName: string;
    whatsappNumber: string;
    wingLabel?: string;
    membershipStatus?: string;
    whatsappConsent: boolean;
  }>;
}): Promise<
  Array<{
    fullName: string;
    recipient: string;
    status: DeliveryStatus;
    messageText: string;
    waMeUrl: string;
    error?: string;
  }>
> {
  const results: Array<{
    fullName: string;
    recipient: string;
    status: DeliveryStatus;
    messageText: string;
    waMeUrl: string;
    error?: string;
  }> = [];

  for (const r of params.recipients) {
    // Enforce opt-in consent and opt-out protection
    if (!r.whatsappConsent) {
      continue;
    }
    const normalized = normalizeWhatsAppNumber(r.whatsappNumber);
    if (normalized.length < 10) continue;

    const messageText = buildMultilingualWhatsAppMessage({
      language: params.language,
      templateType: params.templateType,
      customMessage: params.customMessage,
      recipientName: r.fullName,
      registrationCode: r.registrationCode,
      wingLabel: r.wingLabel,
      eventTitle: params.eventTitle,
      eventDate: params.eventDate,
      eventVenue: params.eventVenue,
      membershipStatus: r.membershipStatus,
    });

    const dispatched = await sendSingleWhatsAppMessage(normalized, messageText);

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

    results.push({
      fullName: r.fullName,
      recipient: normalized,
      status: dispatched.status,
      messageText,
      waMeUrl: `https://wa.me/${normalized}?text=${encodeURIComponent(messageText)}`,
      error: dispatched.errorMessage,
    });
  }

  return results;
}
