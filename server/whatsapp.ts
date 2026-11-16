import crypto from 'node:crypto';
import { sqlite, type AdminRecord, type RegistrationRecord, mirrorToSupabase } from './db.ts';

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
  status: 'sent' | 'failed' | 'skipped_disabled' | 'queued_unconfigured';
  providerMessageId?: string;
  error?: string;
}

export async function dispatchRegistrationNotifications(
  reg: RegistrationRecord,
  dashboardUrl: string
): Promise<NotificationDispatchResult[]> {
  const settings = sqlite
    .prepare('SELECT global_enabled, extra_whatsapp_numbers FROM notification_settings WHERE id = 1')
    .get() as { global_enabled: number; extra_whatsapp_numbers: string } | undefined;

  const globalEnabled = settings ? settings.global_enabled === 1 : true;
  const extraNumbers: string[] = settings ? JSON.parse(settings.extra_whatsapp_numbers || '[]') : [];

  const recipients = new Map<string, string | null>();

  if (reg.assigned_admin_id) {
    const assigned = sqlite
      .prepare('SELECT * FROM admins WHERE id = ? AND is_active = 1')
      .get(reg.assigned_admin_id) as AdminRecord | undefined;
    if (assigned && assigned.notifications_enabled === 1 && assigned.whatsapp_number) {
      recipients.set(normalizeWhatsAppNumber(assigned.whatsapp_number), assigned.id);
    }
  }

  const enabledAdmins = sqlite
    .prepare('SELECT * FROM admins WHERE is_active = 1 AND notifications_enabled = 1 AND (role = ? OR is_primary = 1)')
    .all('super_admin') as unknown as AdminRecord[];

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
    // Prevent duplicate notification for same registration & recipient
    const existing = sqlite
      .prepare('SELECT id, delivery_status FROM notification_logs WHERE registration_id = ? AND recipient_whatsapp = ?')
      .get(reg.id, recipient) as { id: string; delivery_status: string } | undefined;

    if (existing && existing.delivery_status === 'sent') {
      continue;
    }

    let status: NotificationDispatchResult['status'] = 'queued_unconfigured';
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

    const logId = existing?.id || crypto.randomUUID();
    if (existing) {
      sqlite.prepare(`
        UPDATE notification_logs
        SET delivery_status = ?, provider_message_id = ?, error_message = ?, message_preview = ?, created_at = ?
        WHERE id = ?
      `).run(status, providerMessageId ?? null, errorMessage ?? null, messageText, new Date().toISOString(), logId);
    } else {
      sqlite.prepare(`
        INSERT INTO notification_logs (id, registration_id, admin_id, recipient_whatsapp, message_preview, provider_message_id, delivery_status, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(logId, reg.id, adminId, recipient, messageText, providerMessageId ?? null, status, errorMessage ?? null);
    }

    void mirrorToSupabase('notification_logs', {
      id: logId,
      registration_id: reg.id,
      admin_id: adminId,
      recipient_whatsapp: recipient,
      message_preview: messageText,
      provider_message_id: providerMessageId ?? null,
      delivery_status: status,
      error_message: errorMessage ?? null,
    });

    results.push({ recipient, status, providerMessageId, error: errorMessage });
  }

  return results;
}
