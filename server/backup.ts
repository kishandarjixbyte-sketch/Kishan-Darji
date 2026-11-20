import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  createBackupRecord,
  exportFullDatabaseSnapshot,
  getBackupById,
  isVercelRuntime,
  listBackups,
  restoreFullDatabaseSnapshot,
  writeAuditLog,
  type BackupType,
} from './db.ts';

function getBackupEncryptionKey(): Buffer {
  const raw =
    process.env.BACKUP_ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    'jbd-default-local-backup-key-change-in-production';
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptSnapshotPayload(snapshot: unknown): {
  encrypted: string;
  checksum: string;
} {
  const json = JSON.stringify(snapshot);
  const checksum = crypto.createHash('sha256').update(json).digest('hex');
  const key = getBackupEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const bundle = JSON.stringify({
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: ciphertext.toString('base64'),
  });
  return { encrypted: bundle, checksum };
}

export function decryptSnapshotPayload<T = unknown>(encryptedBundle: string): T {
  const parsed = JSON.parse(encryptedBundle) as {
    v?: number;
    iv?: string;
    tag?: string;
    data?: string;
  };
  if (!parsed.iv || !parsed.tag || !parsed.data) {
    throw new Error('Invalid encrypted backup envelope.');
  }
  const key = getBackupEncryptionKey();
  const iv = Buffer.from(parsed.iv, 'base64');
  const tag = Buffer.from(parsed.tag, 'base64');
  const ciphertext = Buffer.from(parsed.data, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return JSON.parse(decrypted) as T;
}

async function replicateToOffsiteStorage(
  backupId: string,
  backupType: BackupType,
  encryptedPayload: string,
  checksum: string
): Promise<{ mirroredLocation: string }> {
  // 1. Optional remote webhook (e.g. Cloudflare R2 / S3 / Google Drive Apps Script / Secondary Cloud)
  const webhookUrl = process.env.BACKUP_WEBHOOK_URL?.trim();
  if (webhookUrl && webhookUrl.startsWith('http')) {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.BACKUP_WEBHOOK_SECRET
          ? { Authorization: `Bearer ${process.env.BACKUP_WEBHOOK_SECRET}` }
          : {}),
      },
      body: JSON.stringify({
        backupId,
        backupType,
        checksum,
        createdAt: new Date().toISOString(),
        encryptedPayload,
      }),
    });
    if (!res.ok) {
      throw new Error(`Remote backup webhook returned HTTP ${res.status}`);
    }
    return { mirroredLocation: 'remote_webhook' };
  }

  // 2. Separate backup vault directory outside live DB path (when filesystem is writable)
  if (!isVercelRuntime()) {
    const vaultDir = path.resolve(process.cwd(), 'backup_vault');
    if (!fs.existsSync(vaultDir)) {
      fs.mkdirSync(vaultDir, { recursive: true });
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(vaultDir, `jbd_${backupType}_${stamp}_${backupId.slice(0, 8)}.jbdenc`);
    fs.writeFileSync(filePath, encryptedPayload, 'utf8');
    return { mirroredLocation: filePath };
  }

  return { mirroredLocation: 'cloud_database_vault' };
}

export async function runEncryptedBackup(
  backupType: BackupType,
  actorAdminId: string | null = null
) {
  const backupId = crypto.randomUUID();
  try {
    const snapshot = await exportFullDatabaseSnapshot();
    const { encrypted, checksum } = encryptSnapshotPayload(snapshot);
    const { mirroredLocation } = await replicateToOffsiteStorage(
      backupId,
      backupType,
      encrypted,
      checksum
    );

    const recordCounts = {
      members: snapshot.registrations.length,
      events: snapshot.events.length,
      event_registrations: snapshot.event_registrations.length,
      org_pages: snapshot.organization_pages.length,
      mirrored_to: mirroredLocation,
    };

    const record = await createBackupRecord({
      id: backupId,
      backup_type: backupType,
      status: 'success',
      record_counts: recordCounts,
      encrypted_payload: encrypted,
      checksum,
      created_by: actorAdminId,
    });

    await writeAuditLog(actorAdminId, 'BACKUP_CREATED', 'backups', record.id, {
      backup_type: backupType,
      record_counts: recordCounts,
      checksum,
    });

    return record;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Backup execution failed';
    try {
      await createBackupRecord({
        id: backupId,
        backup_type: backupType,
        status: 'failed',
        record_counts: {},
        encrypted_payload: '',
        checksum: '',
        error_message: msg,
        created_by: actorAdminId,
      });
    } catch {
      // Ignore secondary logging error
    }
    throw err;
  }
}

export async function restoreFromBackupVersion(backupId: string, actorAdminId: string) {
  const backup = await getBackupById(backupId);
  if (!backup) {
    throw new Error('Backup version not found.');
  }
  if (!backup.encrypted_payload) {
    throw new Error('Selected backup has no encrypted payload.');
  }

  const snapshot = decryptSnapshotPayload<{
    registrations: Array<Record<string, unknown>>;
    events?: Array<Record<string, unknown>>;
    event_registrations?: Array<Record<string, unknown>>;
    organization_pages?: Array<Record<string, unknown>>;
    theme_settings?: Record<string, unknown> | null;
  }>(backup.encrypted_payload);

  const summary = await restoreFullDatabaseSnapshot(snapshot, actorAdminId);
  await writeAuditLog(actorAdminId, 'BACKUP_VERSION_RESTORED', 'backups', backupId, summary);
  return summary;
}

let schedulerRunning = false;
let lastCheckTimestamp = 0;

export async function runDueScheduledBackupsIfNeeded(): Promise<void> {
  const now = Date.now();
  // Check at most once per 30 minutes per process
  if (schedulerRunning || now - lastCheckTimestamp < 1000 * 60 * 30) {
    return;
  }
  schedulerRunning = true;
  lastCheckTimestamp = now;

  try {
    const existing = await listBackups(30);
    const todayPrefix = new Date().toISOString().slice(0, 10);

    const hasDailyToday = existing.some(
      (b) => b.backup_type === 'daily_auto' && b.status === 'success' && b.created_at.startsWith(todayPrefix)
    );
    if (!hasDailyToday) {
      await runEncryptedBackup('daily_auto', null);
    }

    const latestWeekly = existing.find(
      (b) => b.backup_type === 'weekly_auto' && b.status === 'success'
    );
    const sevenDaysMs = 1000 * 60 * 60 * 24 * 7;
    const weeklyDue =
      !latestWeekly || now - new Date(latestWeekly.created_at).getTime() >= sevenDaysMs;
    if (weeklyDue) {
      await runEncryptedBackup('weekly_auto', null);
    }
  } catch (err) {
    console.error('Scheduled backup check warning:', err);
  } finally {
    schedulerRunning = false;
  }
}

export function startAutomaticBackupScheduler() {
  // Run initial check shortly after server boot, then every 6 hours
  setTimeout(() => {
    void runDueScheduledBackupsIfNeeded();
  }, 5000);

  setInterval(() => {
    void runDueScheduledBackupsIfNeeded();
  }, 1000 * 60 * 60 * 6);
}
