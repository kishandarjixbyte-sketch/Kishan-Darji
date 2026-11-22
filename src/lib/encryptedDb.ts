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

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// Session-level caches so PBKDF2 key derivation & IDB open do not block every sync
let dbPromise: Promise<IDBDatabase> | null = null;
let deviceIdPromise: Promise<string> | null = null;
let deviceSaltPromise: Promise<Uint8Array> | null = null;
const vaultKeyCache = new Map<string, Promise<CryptoKey>>();

function openVaultDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
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
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function toBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.byteLength; i += CHUNK_SIZE) {
    const slice = bytes.subarray(i, i + CHUNK_SIZE);
    parts.push(String.fromCharCode(...slice));
  }
  return btoa(parts.join(''));
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getOrCreateDeviceSalt(db: IDBDatabase): Promise<Uint8Array> {
  if (deviceSaltPromise) return deviceSaltPromise;
  deviceSaltPromise = (async () => {
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
  })().catch((err) => {
    deviceSaltPromise = null;
    throw err;
  });
  return deviceSaltPromise;
}

async function deriveVaultKey(secretSeed: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secretSeed),
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

function getCachedAdminVaultKey(adminId: string, db: IDBDatabase): Promise<CryptoKey> {
  const cached = vaultKeyCache.get(adminId);
  if (cached) return cached;
  const promise = (async () => {
    const salt = await getOrCreateDeviceSalt(db);
    return deriveVaultKey(`jbd-vault-${adminId}`, salt);
  })().catch((err) => {
    vaultKeyCache.delete(adminId);
    throw err;
  });
  vaultKeyCache.set(adminId, promise);
  return promise;
}

async function encryptPayload(key: CryptoKey, data: unknown): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = textEncoder.encode(JSON.stringify(data));
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
  return JSON.parse(textDecoder.decode(decrypted)) as T;
}

export function getDeviceId(): Promise<string> {
  if (deviceIdPromise) return deviceIdPromise;
  deviceIdPromise = (async () => {
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
  })().catch((err) => {
    deviceIdPromise = null;
    throw err;
  });
  return deviceIdPromise;
}

export async function saveAuthorizedRegistrationsEncrypted(
  adminId: string,
  records: RegistrationItem[],
  syncedAt: string
): Promise<void> {
  const db = await openVaultDb();
  const key = await getCachedAdminVaultKey(adminId, db);

  // Read existing envelopes to skip re-encrypting unchanged records
  const existingEnvelopes = await new Promise<EncryptedEnvelope[]>((resolve, reject) => {
    const tx = db.transaction(STORE_RECORDS, 'readonly');
    const idx = tx.objectStore(STORE_RECORDS).index('adminId');
    const req = idx.getAll(IDBKeyRange.only(adminId));
    req.onsuccess = () => resolve((req.result as EncryptedEnvelope[]) || []);
    req.onerror = () => reject(req.error);
  });

  const existingMap = new Map(existingEnvelopes.map((e) => [e.id, e]));
  const incomingIds = new Set(records.map((r) => r.id));

  const recordsToEncrypt = records.filter((r) => {
    const prev = existingMap.get(r.id);
    if (!prev) return true;
    return prev.updatedAt !== r.updated_at || prev.syncStatus !== 'synced';
  });

  const idsToDelete = existingEnvelopes
    .filter((e) => !incomingIds.has(e.id))
    .map((e) => e.id);

  // Encrypt only new or modified records in parallel
  const newEnvelopes: EncryptedEnvelope[] = await Promise.all(
    recordsToEncrypt.map(async (r) => {
      const clean: RegistrationItem = { ...r, localSyncStatus: 'synced' };
      const { iv, ciphertext } = await encryptPayload(key, clean);
      return {
        id: r.id,
        adminId,
        iv,
        ciphertext,
        syncStatus: 'synced' as const,
        updatedAt: r.updated_at,
      };
    })
  );

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_RECORDS, STORE_META], 'readwrite');
    const recordStore = tx.objectStore(STORE_RECORDS);
    const metaStore = tx.objectStore(STORE_META);

    for (const staleId of idsToDelete) {
      recordStore.delete(staleId);
    }
    for (const env of newEnvelopes) {
      recordStore.put(env);
    }

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
  const key = await getCachedAdminVaultKey(adminId, db);

  const [envelopes, outbox, lastSyncMeta] = await Promise.all([
    new Promise<EncryptedEnvelope[]>((resolve, reject) => {
      const tx = db.transaction(STORE_RECORDS, 'readonly');
      const idx = tx.objectStore(STORE_RECORDS).index('adminId');
      const req = idx.getAll(IDBKeyRange.only(adminId));
      req.onsuccess = () => resolve((req.result as EncryptedEnvelope[]) || []);
      req.onerror = () => reject(req.error);
    }),
    getPendingMutations(adminId),
    new Promise<VaultMeta | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get(`last_sync_${adminId}`);
      req.onsuccess = () => resolve(req.result as VaultMeta | undefined);
      req.onerror = () => reject(req.error);
    }),
  ]);

  const outboxMap = new Map(outbox.map((m) => [m.id, m]));

  const decryptedList = await Promise.all(
    envelopes.map(async (env): Promise<RegistrationItem | null> => {
      try {
        const raw = await decryptPayload<Partial<RegistrationItem>>(key, env.iv, env.ciphertext);
        const item: RegistrationItem = {
          ...(raw as RegistrationItem),
          organization_wing: raw.organization_wing === 'durga_vahini' ? 'durga_vahini' : 'bajrang_dal',
          father_or_guardian_name: raw.father_or_guardian_name || '',
          whatsapp_number: raw.whatsapp_number || raw.mobile || '',
          email: raw.email || '',
          city_village: raw.city_village || '',
          district: raw.district || '',
          state: raw.state || 'Gujarat',
          pincode: raw.pincode || '',
          education: raw.education || '',
          profile_photo_data: raw.profile_photo_data || '',
          identity_doc_name: raw.identity_doc_name || '',
          has_identity_doc: Boolean(raw.has_identity_doc),
          identity_verification_status: raw.identity_verification_status || 'Pending',
          membership_status: raw.membership_status || 'Pending',
          registration_date: raw.registration_date || (raw.created_at ? raw.created_at.slice(0, 10) : ''),
        };
        const pending = outboxMap.get(item.id);
        if (pending) {
          item.status = pending.status;
          item.follow_up_notes = pending.follow_up_notes;
          item.localSyncStatus = 'pending';
        } else {
          item.localSyncStatus = 'synced';
        }
        return item;
      } catch {
        return null;
      }
    })
  );

  const records = decryptedList.filter((r): r is RegistrationItem => r !== null);
  records.sort((a, b) => b.created_at.localeCompare(a.created_at));

  return {
    records,
    lastSyncTime: lastSyncMeta?.value ?? null,
    pendingCount: outbox.length,
  };
}

export async function queueOfflineMutation(mutation: PendingMutation): Promise<void> {
  const db = await openVaultDb();
  const key = await getCachedAdminVaultKey(mutation.adminId, db);

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
  deviceIdPromise = null;
  deviceSaltPromise = null;
  vaultKeyCache.clear();
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
