import type { RegistrationItem, RegistrationStatus } from '../types';

const DB_NAME = 'join_bajrang_dal_admin_vault';
const DB_VERSION = 1;
const STORE_RECORDS = 'encrypted_registrations';
const STORE_OUTBOX = 'pending_mutations';
const STORE_META = 'vault_metadata';

export interface PendingMutation {
  id: string;
  adminId: string;
  status: RegistrationStatus;
  follow_up_notes: string;
  updated_at: string;
}

interface EncryptedEnvelope {
  id: string;
  adminId: string;
  iv: string;
  ciphertext: string;
  syncStatus: 'synced' | 'pending';
  updatedAt: string;
}

interface VaultMeta {
  key: string;
  value: string;
}

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        const store = db.createObjectStore(STORE_RECORDS, { keyPath: 'id' });
        store.createIndex('adminId', 'adminId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        const outbox = db.createObjectStore(STORE_OUTBOX, { keyPath: 'id' });
        outbox.createIndex('adminId', 'adminId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getOrCreateDeviceSalt(db: IDBDatabase): Promise<Uint8Array> {
  const existing = await new Promise<VaultMeta | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).get('device_salt');
    req.onsuccess = () => resolve(req.result as VaultMeta | undefined);
    req.onerror = () => reject(req.error);
  });

  if (existing?.value) {
    return fromBase64(existing.value);
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put({ key: 'device_salt', value: toBase64(salt) });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return salt;
}

async function deriveVaultKey(secretSeed: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretSeed),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 60000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptPayload(key: CryptoKey, data: unknown): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
  };
}

async function decryptPayload<T>(key: CryptoKey, ivB64: string, cipherB64: string): Promise<T> {
  const iv = fromBase64(ivB64);
  const cipher = fromBase64(cipherB64);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    cipher as BufferSource
  );
  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}

export async function getDeviceId(): Promise<string> {
  const db = await openVaultDb();
  const existing = await new Promise<VaultMeta | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).get('device_id');
    req.onsuccess = () => resolve(req.result as VaultMeta | undefined);
    req.onerror = () => reject(req.error);
  });
  if (existing?.value) return existing.value;
  const newId = `pwa-${crypto.randomUUID().slice(0, 8)}`;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put({ key: 'device_id', value: newId });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return newId;
}

export async function saveAuthorizedRegistrationsEncrypted(
  adminId: string,
  records: RegistrationItem[],
  syncedAt: string
): Promise<void> {
  const db = await openVaultDb();
  const salt = await getOrCreateDeviceSalt(db);
  const key = await deriveVaultKey(`jbd-vault-${adminId}`, salt);

  const envelopes: EncryptedEnvelope[] = [];
  for (const r of records) {
    const clean: RegistrationItem = { ...r, localSyncStatus: 'synced' };
    const { iv, ciphertext } = await encryptPayload(key, clean);
    envelopes.push({
      id: r.id,
      adminId,
      iv,
      ciphertext,
      syncStatus: 'synced',
      updatedAt: r.updated_at,
    });
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_RECORDS, STORE_META], 'readwrite');
    const recordStore = tx.objectStore(STORE_RECORDS);
    const metaStore = tx.objectStore(STORE_META);

    // Clear previous records for this admin to keep authorized set exact
    const idx = recordStore.index('adminId');
    const cursorReq = idx.openCursor(IDBKeyRange.only(adminId));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        for (const env of envelopes) {
          recordStore.put(env);
        }
      }
    };

    metaStore.put({ key: `last_sync_${adminId}`, value: syncedAt });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadEncryptedRegistrations(adminId: string): Promise<{
  records: RegistrationItem[];
  lastSyncTime: string | null;
  pendingCount: number;
}> {
  const db = await openVaultDb();
  const salt = await getOrCreateDeviceSalt(db);
  const key = await deriveVaultKey(`jbd-vault-${adminId}`, salt);

  const envelopes = await new Promise<EncryptedEnvelope[]>((resolve, reject) => {
    const tx = db.transaction(STORE_RECORDS, 'readonly');
    const idx = tx.objectStore(STORE_RECORDS).index('adminId');
    const req = idx.getAll(IDBKeyRange.only(adminId));
    req.onsuccess = () => resolve((req.result as EncryptedEnvelope[]) || []);
    req.onerror = () => reject(req.error);
  });

  const outbox = await getPendingMutations(adminId);
  const outboxMap = new Map(outbox.map((m) => [m.id, m]));

  const lastSyncMeta = await new Promise<VaultMeta | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).get(`last_sync_${adminId}`);
    req.onsuccess = () => resolve(req.result as VaultMeta | undefined);
    req.onerror = () => reject(req.error);
  });

  const records: RegistrationItem[] = [];
  for (const env of envelopes) {
    try {
      const item = await decryptPayload<RegistrationItem>(key, env.iv, env.ciphertext);
      const pending = outboxMap.get(item.id);
      if (pending) {
        item.status = pending.status;
        item.follow_up_notes = pending.follow_up_notes;
        item.localSyncStatus = 'pending';
      } else {
        item.localSyncStatus = 'synced';
      }
      records.push(item);
    } catch {
      // Skip corrupted or mismatched key records
    }
  }

  records.sort((a, b) => b.created_at.localeCompare(a.created_at));

  return {
    records,
    lastSyncTime: lastSyncMeta?.value ?? null,
    pendingCount: outbox.length,
  };
}

export async function queueOfflineMutation(mutation: PendingMutation): Promise<void> {
  const db = await openVaultDb();
  const salt = await getOrCreateDeviceSalt(db);
  const key = await deriveVaultKey(`jbd-vault-${mutation.adminId}`, salt);

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_OUTBOX, STORE_RECORDS], 'readwrite');
    tx.objectStore(STORE_OUTBOX).put(mutation);

    const req = tx.objectStore(STORE_RECORDS).get(mutation.id);
    req.onsuccess = async () => {
      const env = req.result as EncryptedEnvelope | undefined;
      if (env && env.adminId === mutation.adminId) {
        try {
          const item = await decryptPayload<RegistrationItem>(key, env.iv, env.ciphertext);
          item.status = mutation.status;
          item.follow_up_notes = mutation.follow_up_notes;
          item.updated_at = mutation.updated_at;
          item.localSyncStatus = 'pending';
          const reEncrypted = await encryptPayload(key, item);
          const writeTx = db.transaction(STORE_RECORDS, 'readwrite');
          writeTx.objectStore(STORE_RECORDS).put({
            ...env,
            iv: reEncrypted.iv,
            ciphertext: reEncrypted.ciphertext,
            syncStatus: 'pending',
            updatedAt: mutation.updated_at,
          });
        } catch {
          // ignore
        }
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingMutations(adminId: string): Promise<PendingMutation[]> {
  const db = await openVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_OUTBOX, 'readonly');
    const idx = tx.objectStore(STORE_OUTBOX).index('adminId');
    const req = idx.getAll(IDBKeyRange.only(adminId));
    req.onsuccess = () => resolve((req.result as PendingMutation[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function clearPendingMutations(adminId: string): Promise<void> {
  const db = await openVaultDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_OUTBOX, 'readwrite');
    const idx = tx.objectStore(STORE_OUTBOX).index('adminId');
    const cursorReq = idx.openCursor(IDBKeyRange.only(adminId));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function wipeLocalAdminVault(): Promise<void> {
  const db = await openVaultDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_RECORDS, STORE_OUTBOX, STORE_META], 'readwrite');
    tx.objectStore(STORE_RECORDS).clear();
    tx.objectStore(STORE_OUTBOX).clear();
    tx.objectStore(STORE_META).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function createEncryptedBackupBundle(
  passphrase: string,
  records: RegistrationItem[]
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveVaultKey(passphrase, salt);
  const { iv, ciphertext } = await encryptPayload(key, {
    app: 'Join Bajrang Dal',
    exportedAt: new Date().toISOString(),
    count: records.length,
    records,
  });
  return JSON.stringify(
    {
      format: 'JBD_ENCRYPTED_BACKUP_V1',
      salt: toBase64(salt),
      iv,
      ciphertext,
    },
    null,
    2
  );
}

export async function decryptBackupBundle(
  passphrase: string,
  rawJson: string
): Promise<{ exportedAt: string; records: RegistrationItem[] }> {
  const parsed = JSON.parse(rawJson) as {
    format?: string;
    salt?: string;
    iv?: string;
    ciphertext?: string;
  };
  if (parsed.format !== 'JBD_ENCRYPTED_BACKUP_V1' || !parsed.salt || !parsed.iv || !parsed.ciphertext) {
    throw new Error('Invalid backup file format.');
  }
  const salt = fromBase64(parsed.salt);
  const key = await deriveVaultKey(passphrase, salt);
  return decryptPayload<{ exportedAt: string; records: RegistrationItem[] }>(key, parsed.iv, parsed.ciphertext);
}
