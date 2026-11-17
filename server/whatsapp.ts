import {
  getAdminByIdRaw,
  getEnabledAlertSuperAdmins,
  getNotificationLogEntry,
  getNotificationSettings,
  saveNotificationLogEntry,
  type DeliveryStatus,
  type RegistrationRecord,
} from './db.ts';

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

  return [
    'NEW REGISTRATION – JOIN BAJRANG DAL',
    '',
    `Name: ${reg.full_name}`,
    `Mobile: ${reg.mobile}`,
    `Age: ${reg.age}`,
    `Occupation: ${reg.occupation}`,
    `Registration ID: ${reg.registration_code}`,
    `Submission Date: ${submittedAt}`,
    `Admin Dashboard: ${dashboardUrl}`,
  ].join('\n');
}

interface NotificationDispatchResult {
  recipient: string;
  status: DeliveryStatus;
  providerMessageId?: string;
  error?: string;
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
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const apiVersion = process.env.WHATSAPP_API_VERSION?.trim() || 'v21.0';
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
    } else if (accessToken && phoneNumberId) {
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
          status = 'sent';
          providerMessageId = data.messages[0].id;
        } else {
          status = 'failed';
          errorMessage = data.error?.message || `HTTP ${res.status}`;
        }
      } catch (err) {
        status = 'failed';
        errorMessage = err instanceof Error ? err.message : 'Network error';
      }
    } else {
      status = 'queued_unconfigured';
      errorMessage = 'WhatsApp Cloud API credentials not configured in environment';
    }

    await saveNotificationLogEntry({
      existingId: existing?.id,
      registrationId: reg.id,
      adminId,
      recipientWhatsapp: recipient,
      messagePreview: messageText,
      providerMessageId,
      deliveryStatus: status,
      errorMessage,
    });

    results.push({ recipient, status, providerMessageId, error: errorMessage });
  }

  return results;
}
