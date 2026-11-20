import React, { useState } from 'react';
import {
  HardDrive,
  Download,
  RotateCcw,
  ShieldCheck,
  Loader2,
  Upload,
} from 'lucide-react';
import type { BackupItem, RegistrationItem } from '../../types';
import { apiJson } from '../../lib/apiClient';
import {
  createEncryptedBackupBundle,
  decryptBackupBundle,
} from '../../lib/encryptedDb';

interface Props {
  token: string;
  backups: BackupItem[];
  registrations: RegistrationItem[];
  onRefresh: () => Promise<void>;
  onBanner: (type: 'success' | 'error', text: string) => void;
}

export const AdminBackupCenter: React.FC<Props> = ({
  token,
  backups,
  registrations,
  onRefresh,
  onBanner,
}) => {
  const [runningManual, setRunningManual] = useState(false);
  const [restoringId, setRestoringId] = useState('');

  // Client-side passphrase backup for offline device redundancy
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [restoreFileText, setRestoreFileText] = useState('');
  const [localBusy, setLocalBusy] = useState(false);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const handleRunCloudBackup = async () => {
    setRunningManual(true);
    try {
      await apiJson('/api/backups/run', { method: 'POST', headers: authHeaders });
      await onRefresh();
      onBanner('success', 'AES-256-GCM encrypted cloud backup created and archived.');
    } catch (err) {
      onBanner('error', err instanceof Error ? err.message : 'Backup execution failed.');
    } finally {
      setRunningManual(false);
    }
  };

  const handleDownloadVersion = async (b: BackupItem) => {
    try {
      const res = await fetch(`/api/backups/${encodeURIComponent(b.id)}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `JBD_Encrypted_Backup_${b.backup_type}_${b.created_at.slice(0, 10)}.jbdenc`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      onBanner('error', err instanceof Error ? err.message : 'Download failed.');
    }
  };

  const handleRestoreVersion = async (b: BackupItem) => {
    setRestoringId(b.id);
    try {
      const res = await apiJson<{
        summary: { membersRestored: number; eventsRestored: number; eventRegsRestored: number };
      }>(`/api/backups/${encodeURIComponent(b.id)}/restore`, {
        method: 'POST',
        headers: authHeaders,
      });
      await onRefresh();
      onBanner(
        'success',
        `Restored safely: ${res.summary.membersRestored} members, ${res.summary.eventsRestored} events, ${res.summary.eventRegsRestored} event passes recovered.`
      );
    } catch (err) {
      onBanner('error', err instanceof Error ? err.message : 'Backup restore failed.');
    } finally {
      setRestoringId('');
    }
  };

  const handleDownloadPassphraseFile = async () => {
    if (backupPassphrase.length < 6) {
      onBanner('error', 'Backup passphrase must be at least 6 characters.');
      return;
    }
    setLocalBusy(true);
    try {
      const json = await createEncryptedBackupBundle(backupPassphrase, registrations);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Join_Bajrang_Dal_Local_Backup_${new Date().toISOString().slice(0, 10)}.jbdbackup`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupPassphrase('');
      onBanner('success', 'Passphrase-encrypted backup file downloaded.');
    } finally {
      setLocalBusy(false);
    }
  };

  const handleRestorePassphraseFile = async () => {
    if (!restoreFileText || restorePassphrase.length < 6) {
      onBanner('error', 'Select a .jbdbackup file and enter its passphrase.');
      return;
    }
    setLocalBusy(true);
    try {
      const decrypted = await decryptBackupBundle(restorePassphrase, restoreFileText);
      const data = await apiJson<{ restored: number }>('/api/backup/restore', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ records: decrypted.records }),
      });
      await onRefresh();
      setRestorePassphrase('');
      setRestoreFileText('');
      onBanner('success', `Restored ${data.restored} missing records from .jbdbackup file.`);
    } catch (err) {
      onBanner('error', err instanceof Error ? err.message : 'Invalid passphrase or corrupted file.');
    } finally {
      setLocalBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Automatic & Cloud Backup Control */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>Automatic Encrypted Cloud Backup System</span>
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Automated Daily & Weekly AES-256-GCM encrypted full snapshots archived separately with versioned 1-click restore.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRunCloudBackup}
            disabled={runningManual}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shrink-0 cursor-pointer"
          >
            {runningManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
            <span>Create Cloud Backup Now</span>
          </button>
        </div>

        {/* Version History */}
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#FAF9F6] dark:bg-slate-800 text-xs text-slate-500">
                <th className="py-2.5 px-3">Date / Time</th>
                <th className="py-2.5 px-3">Schedule Type</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Snapshot Counts</th>
                <th className="py-2.5 px-3">Checksum</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-xs text-slate-500">
                    No backup snapshots created yet. Click "Create Cloud Backup Now" to generate the first encrypted version.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2.5 px-3 font-mono text-xs whitespace-nowrap">
                      {new Date(b.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {b.backup_type.replace('_', ' ')}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={b.status === 'success' ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-red-600 font-semibold'}>
                        {b.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {String((b.record_counts as { members?: number })?.members ?? 0)} members ·{' '}
                      {String((b.record_counts as { events?: number })?.events ?? 0)} events
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                      {b.checksum ? `${b.checksum.slice(0, 12)}...` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleDownloadVersion(b)}
                        className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                      <button
                        type="button"
                        disabled={restoringId === b.id || b.status !== 'success'}
                        onClick={() => handleRestoreVersion(b)}
                        className="px-2.5 py-1 rounded-lg bg-orange-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{restoringId === b.id ? 'Restoring...' : 'Restore'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Offline Device Passphrase File Export/Restore */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Download className="w-4 h-4 text-orange-600" />
            <span>Export Portable Encrypted File (.jbdbackup)</span>
          </h3>
          <input
            type="password"
            value={backupPassphrase}
            onChange={(e) => setBackupPassphrase(e.target.value)}
            placeholder="Encryption passphrase (min 6 chars)"
            className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={localBusy}
            onClick={handleDownloadPassphraseFile}
            className="w-full min-h-[42px] rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs sm:text-sm font-semibold cursor-pointer"
          >
            Download Local Encrypted Copy
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Restore from .jbdbackup File</span>
          </h3>
          <input
            type="file"
            accept=".jbdbackup,.json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              file.text().then(setRestoreFileText);
            }}
            className="block w-full text-xs text-slate-600 dark:text-slate-300"
          />
          <input
            type="password"
            value={restorePassphrase}
            onChange={(e) => setRestorePassphrase(e.target.value)}
            placeholder="Enter backup passphrase"
            className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={localBusy}
            onClick={handleRestorePassphraseFile}
            className="w-full min-h-[42px] rounded-xl bg-orange-600 text-white text-xs sm:text-sm font-semibold cursor-pointer"
          >
            Decrypt & Merge into Database
          </button>
        </div>
      </div>
    </div>
  );
};
