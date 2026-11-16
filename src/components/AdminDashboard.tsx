import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Search,
  Download,
  FileSpreadsheet,
  MessageCircle,
  Eye,
  Trash2,
  Shield,
  Users,
  Bell,
  HardDrive,
  Upload,
  Plus,
  X,
  Check,
  AlertCircle,
  Loader2,
  Edit3,
  Crown,
} from 'lucide-react';
import type {
  AdminRole,
  AdminUser,
  AuditLogItem,
  Language,
  NotificationLogItem,
  OccupationType,
  RegistrationItem,
  RegistrationStatus,
  SyncLogItem,
} from '../types';
import { getTranslations } from '../lib/i18n';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  clearPendingMutations,
  createEncryptedBackupBundle,
  decryptBackupBundle,
  getDeviceId,
  getPendingMutations,
  loadEncryptedRegistrations,
  queueOfflineMutation,
  saveAuthorizedRegistrationsEncrypted,
} from '../lib/encryptedDb';
import { exportRegistrationsToCsv, exportRegistrationsToExcel } from '../lib/exportUtils';
import { PWAInstallButton } from './PWAInstallButton';

interface Props {
  lang: Language;
  token: string;
  currentAdmin: AdminUser;
}

type DashboardTab = 'registrations' | 'admins' | 'notifications';

export const AdminDashboard: React.FC<Props> = ({ lang, token, currentAdmin }) => {
  const t = getTranslations(lang);
  const isOnline = useOnlineStatus();
  const isSuper = currentAdmin.role === 'super_admin';

  const [activeTab, setActiveTab] = useState<DashboardTab>('registrations');
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [bannerMsg, setBannerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Detail / Edit modal
  const [selectedReg, setSelectedReg] = useState<RegistrationItem | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    mobile: '',
    age: 18,
    dob: '',
    full_address: '',
    occupation: 'Student' as OccupationType,
    status: 'New' as RegistrationStatus,
    assigned_admin_id: '',
    follow_up_notes: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<RegistrationItem | null>(null);

  // Backup / Restore modal
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [restoreFileText, setRestoreFileText] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);

  // Admin Management state
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [adminForm, setAdminForm] = useState({
    full_name: '',
    email: '',
    mobile: '',
    whatsapp_number: '',
    role: 'sub_admin' as AdminRole,
    is_primary: false,
    notifications_enabled: true,
    password: '',
  });
  const [adminSaving, setAdminSaving] = useState(false);

  // Notification Settings & Logs state
  const [globalNotifyEnabled, setGlobalNotifyEnabled] = useState(true);
  const [extraNumbersText, setExtraNumbersText] = useState('');
  const [whatsappConfigured, setWhatsappConfigured] = useState(false);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLogItem[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLogItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [savingNotifySettings, setSavingNotifySettings] = useState(false);

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const loadLocalVault = useCallback(async () => {
    const cached = await loadEncryptedRegistrations(currentAdmin.id);
    if (cached.records.length > 0) {
      setRegistrations(cached.records);
    }
    setLastSyncTime(cached.lastSyncTime);
    setPendingSyncCount(cached.pendingCount);
  }, [currentAdmin.id]);

  const syncWithServer = useCallback(async () => {
    if (!navigator.onLine) {
      await loadLocalVault();
      setLoading(false);
      return;
    }

    setSyncing(true);
    try {
      const deviceId = await getDeviceId();
      const pending = await getPendingMutations(currentAdmin.id);

      const syncRes = await fetch('/api/registrations/sync', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          deviceId,
          pendingUpdates: pending.map((p) => ({
            id: p.id,
            status: p.status,
            follow_up_notes: p.follow_up_notes,
            updated_at: p.updated_at,
          })),
        }),
      });

      if (syncRes.ok) {
        const syncData = await syncRes.json();
        await clearPendingMutations(currentAdmin.id);
        await saveAuthorizedRegistrationsEncrypted(
          currentAdmin.id,
          syncData.registrations,
          syncData.syncedAt
        );
        setRegistrations(
          (syncData.registrations as RegistrationItem[]).map((r) => ({
            ...r,
            localSyncStatus: 'synced',
          }))
        );
        setLastSyncTime(syncData.syncedAt);
        setPendingSyncCount(0);
      } else {
        await loadLocalVault();
      }

      const adminsRes = await fetch('/api/admins', { headers: authHeaders });
      if (adminsRes.ok) {
        const adminsData = await adminsRes.json();
        setAdmins(adminsData.admins || []);
      }

      if (isSuper) {
        const notifRes = await fetch('/api/settings/notifications', { headers: authHeaders });
        if (notifRes.ok) {
          const nd = await notifRes.json();
          setGlobalNotifyEnabled(Boolean(nd.global_enabled));
          setExtraNumbersText((nd.extra_whatsapp_numbers || []).join(', '));
          setWhatsappConfigured(Boolean(nd.whatsappCloudConfigured));
          setNotificationLogs(nd.notificationLogs || []);
          setSyncLogs(nd.syncLogs || []);
          setAuditLogs(nd.auditLogs || []);
        }
      }
    } catch {
      await loadLocalVault();
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, [authHeaders, currentAdmin.id, isSuper, loadLocalVault]);

  useEffect(() => {
    void loadLocalVault().then(() => syncWithServer());
  }, [loadLocalVault, syncWithServer]);

  // Auto-sync when connectivity returns
  useEffect(() => {
    if (isOnline) {
      void syncWithServer();
    }
  }, [isOnline, syncWithServer]);

  const stats = useMemo(() => {
    const todayPrefix = new Date().toISOString().slice(0, 10);
    return {
      total: registrations.length,
      today: registrations.filter((r) => r.created_at.startsWith(todayPrefix)).length,
      newCount: registrations.filter((r) => r.status === 'New').length,
      contactedCount: registrations.filter((r) => r.status === 'Contacted').length,
      followUpCount: registrations.filter((r) => r.status === 'Follow-up').length,
    };
  }, [registrations]);

  const filteredRegistrations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return registrations.filter((r) => {
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      if (dateFrom && r.created_at.slice(0, 10) < dateFrom) return false;
      if (dateTo && r.created_at.slice(0, 10) > dateTo) return false;
      if (q) {
        const hay = `${r.full_name} ${r.mobile} ${r.registration_code} ${r.occupation}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [registrations, search, statusFilter, dateFrom, dateTo]);

  const openRegistrationModal = (reg: RegistrationItem, startInEdit = false) => {
    setSelectedReg(reg);
    setEditMode(startInEdit);
    setEditForm({
      full_name: reg.full_name,
      mobile: reg.mobile,
      age: reg.age,
      dob: reg.dob,
      full_address: reg.full_address,
      occupation: reg.occupation,
      status: reg.status,
      assigned_admin_id: reg.assigned_admin_id || '',
      follow_up_notes: reg.follow_up_notes || '',
    });
  };

  const handleSaveRegistrationUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReg) return;
    setSavingEdit(true);

    const now = new Date().toISOString();

    if (!navigator.onLine) {
      await queueOfflineMutation({
        id: selectedReg.id,
        adminId: currentAdmin.id,
        status: editForm.status,
        follow_up_notes: editForm.follow_up_notes,
        updated_at: now,
      });
      await loadLocalVault();
      setSelectedReg(null);
      setSavingEdit(false);
      setBannerMsg({
        type: 'success',
        text: 'Saved to encrypted phone vault (Pending Sync). Will upload automatically when internet returns.',
      });
      return;
    }

    try {
      const payload = isSuper
        ? {
            ...editForm,
            assigned_admin_id: editForm.assigned_admin_id || null,
          }
        : {
            status: editForm.status,
            follow_up_notes: editForm.follow_up_notes,
          };

      const res = await fetch(`/api/registrations/${selectedReg.id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerMsg({ type: 'error', text: data.error || 'Failed to update registration.' });
      } else {
        await syncWithServer();
        setSelectedReg(null);
        setBannerMsg({ type: 'success', text: 'Registration updated and synchronized.' });
      }
    } catch {
      await queueOfflineMutation({
        id: selectedReg.id,
        adminId: currentAdmin.id,
        status: editForm.status,
        follow_up_notes: editForm.follow_up_notes,
        updated_at: now,
      });
      await loadLocalVault();
      setSelectedReg(null);
      setBannerMsg({
        type: 'success',
        text: 'Saved offline in encrypted phone storage (Pending Sync).',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/registrations/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) {
        setDeleteTarget(null);
        await syncWithServer();
        setBannerMsg({ type: 'success', text: 'Registration deleted permanently.' });
      }
    } catch {
      setBannerMsg({ type: 'error', text: 'Deletion requires an active internet connection.' });
    }
  };

  const handleDownloadEncryptedBackup = async () => {
    if (backupPassphrase.length < 6) {
      setBannerMsg({ type: 'error', text: 'Backup passphrase must be at least 6 characters.' });
      return;
    }
    setBackupBusy(true);
    try {
      const json = await createEncryptedBackupBundle(backupPassphrase, registrations);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Join_Bajrang_Dal_Encrypted_Backup_${new Date().toISOString().slice(0, 10)}.jbdbackup`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupPassphrase('');
      setShowBackupModal(false);
      setBannerMsg({ type: 'success', text: 'Encrypted backup downloaded securely.' });
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRestoreEncryptedBackup = async () => {
    if (!restoreFileText || restorePassphrase.length < 6) {
      setBannerMsg({ type: 'error', text: 'Select a .jbdbackup file and enter its passphrase.' });
      return;
    }
    setBackupBusy(true);
    try {
      const decrypted = await decryptBackupBundle(restorePassphrase, restoreFileText);
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ records: decrypted.records }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerMsg({ type: 'error', text: data.error || 'Restore failed.' });
      } else {
        await syncWithServer();
        setShowBackupModal(false);
        setRestorePassphrase('');
        setRestoreFileText('');
        setBannerMsg({
          type: 'success',
          text: `Backup restored cleanly (${data.restored} new records recovered).`,
        });
      }
    } catch {
      setBannerMsg({ type: 'error', text: 'Decryption failed: incorrect passphrase or corrupted backup file.' });
    } finally {
      setBackupBusy(false);
    }
  };

  const openNewAdminModal = () => {
    setEditingAdmin(null);
    setAdminForm({
      full_name: '',
      email: '',
      mobile: '',
      whatsapp_number: '',
      role: 'sub_admin',
      is_primary: false,
      notifications_enabled: true,
      password: '',
    });
    setShowAdminModal(true);
  };

  const openEditAdminModal = (adm: AdminUser) => {
    setEditingAdmin(adm);
    setAdminForm({
      full_name: adm.full_name,
      email: adm.email,
      mobile: adm.mobile,
      whatsapp_number: adm.whatsapp_number,
      role: adm.role,
      is_primary: adm.is_primary === 1,
      notifications_enabled: adm.notifications_enabled === 1,
      password: '',
    });
    setShowAdminModal(true);
  };

  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminSaving(true);
    try {
      const url = editingAdmin ? `/api/admins/${editingAdmin.id}` : '/api/admins';
      const method = editingAdmin ? 'PATCH' : 'POST';
      const payload = {
        ...adminForm,
        password: adminForm.password || undefined,
      };
      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerMsg({ type: 'error', text: data.error || 'Failed to save admin.' });
      } else {
        setShowAdminModal(false);
        await syncWithServer();
        setBannerMsg({
          type: 'success',
          text: editingAdmin ? 'Administrator updated.' : 'New administrator added.',
        });
      }
    } finally {
      setAdminSaving(false);
    }
  };

  const handleDeleteAdmin = async (adm: AdminUser) => {
    const res = await fetch(`/api/admins/${adm.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    const data = await res.json();
    if (!res.ok) {
      setBannerMsg({ type: 'error', text: data.error || 'Unable to remove admin.' });
    } else {
      await syncWithServer();
      setBannerMsg({ type: 'success', text: 'Administrator removed.' });
    }
  };

  const handleSaveNotificationSettings = async () => {
    setSavingNotifySettings(true);
    try {
      const extra_whatsapp_numbers = extraNumbersText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          global_enabled: globalNotifyEnabled,
          extra_whatsapp_numbers,
        }),
      });
      if (res.ok) {
        await syncWithServer();
        setBannerMsg({ type: 'success', text: 'WhatsApp notification settings updated.' });
      }
    } finally {
      setSavingNotifySettings(false);
    }
  };

  const handleRetryNotification = async (registrationId: string) => {
    const res = await fetch(`/api/notifications/${registrationId}/resend`, {
      method: 'POST',
      headers: authHeaders,
    });
    if (res.ok) {
      await syncWithServer();
      setBannerMsg({ type: 'success', text: 'WhatsApp notification re-dispatched.' });
    }
  };

  const openWhatsAppContact = (reg: RegistrationItem) => {
    const msg = encodeURIComponent(
      `Namaste ${reg.full_name}, thank you for registering with Join Bajrang Dal (Registration ID: ${reg.registration_code}). Our team is reaching out for follow-up.`
    );
    window.open(`https://wa.me/91${reg.mobile}?text=${msg}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      {/* Header + Mobile Vault Sync Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-orange-700">
                {isSuper ? 'Super Admin' : 'Sub Admin'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{currentAdmin.full_name}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">
                {pendingSyncCount > 0
                  ? `${pendingSyncCount} ${t.pendingSyncStatus}`
                  : t.syncedStatus}
              </span>
              {lastSyncTime && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {t.lastSyncLabel}: {new Date(lastSyncTime).toLocaleTimeString('en-IN')}
                  </span>
                </>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{t.adminPortalTitle}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <PWAInstallButton compact />

            <button
              type="button"
              onClick={() => syncWithServer()}
              disabled={syncing || !isOnline}
              className="min-h-[40px] inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 text-orange-600 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : t.syncNow}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBackupModal(true)}
              className="min-h-[40px] inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <HardDrive className="w-4 h-4 text-slate-600" />
              <span>Backup / Restore</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('registrations')}
            className={`min-h-[40px] inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'registrations'
                ? 'bg-slate-900 text-white'
                : 'bg-[#FAF9F6] text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>{isSuper ? 'All Registrations' : 'My Assigned Registrations'}</span>
          </button>

          {isSuper && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('admins')}
                className={`min-h-[40px] inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'admins'
                    ? 'bg-slate-900 text-white'
                    : 'bg-[#FAF9F6] text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Admin Management</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('notifications')}
                className={`min-h-[40px] inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'notifications'
                    ? 'bg-slate-900 text-white'
                    : 'bg-[#FAF9F6] text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Bell className="w-4 h-4" />
                <span>WhatsApp & Logs</span>
              </button>
            </>
          )}
        </div>
      </div>

      {bannerMsg && (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-sm ${
            bannerMsg.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <span>{bannerMsg.text}</span>
          <button
            type="button"
            onClick={() => setBannerMsg(null)}
            className="p-1 hover:opacity-75 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: REGISTRATIONS */}
      {activeTab === 'registrations' && (
        <>
          {/* 5 Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {[
              { label: t.totalRegistrations, value: stats.total },
              { label: t.todaysRegistrations, value: stats.today },
              { label: t.newRegistrations, value: stats.newCount },
              { label: t.contactedRegistrations, value: stats.contactedCount },
              { label: t.followUpPending, value: stats.followUpCount },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
              >
                <p className="text-xs font-medium text-slate-500">{card.label}</p>
                <p className="mt-2 font-mono text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          {/* Search, Date & Status Filters + Exports */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2 text-sm text-slate-900 focus:border-orange-600 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  aria-label="Filter from date"
                  className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-800"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  aria-label="Filter to date"
                  className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-800"
                />
                {(dateFrom || dateTo || search || statusFilter !== 'All') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setDateFrom('');
                      setDateTo('');
                      setStatusFilter('All');
                    }}
                    className="min-h-[40px] px-3 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-1.5">
                {['All', 'New', 'Contacted', 'Follow-up', 'Completed'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      statusFilter === st
                        ? 'bg-orange-600 text-white'
                        : 'bg-[#FAF9F6] text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportRegistrationsToExcel(filteredRegistrations)}
                  disabled={filteredRegistrations.length === 0}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>{t.exportExcel}</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportRegistrationsToCsv(filteredRegistrations)}
                  disabled={filteredRegistrations.length === 0}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  <span>{t.exportCsv}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Registration Table (Desktop) & Touch Cards (Mobile) */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading encrypted registrations...</span>
              </div>
            ) : filteredRegistrations.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-base font-semibold text-slate-900">No registrations found</p>
                <p className="text-sm text-slate-500">
                  {registrations.length === 0
                    ? 'Submitted registrations will synchronize automatically to your device and appear here.'
                    : 'Try adjusting your search or status/date filters.'}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-[#FAF9F6] text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4">Registration ID</th>
                        <th className="py-3 px-4">Name</th>
                        <th className="py-3 px-4">Mobile</th>
                        <th className="py-3 px-4 text-right">Age</th>
                        <th className="py-3 px-4">Occupation</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Assigned Admin</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredRegistrations.map((reg) => (
                        <tr key={reg.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono text-xs font-semibold text-orange-700 tabular-nums whitespace-nowrap">
                            {reg.registration_code}
                            {reg.localSyncStatus === 'pending' && (
                              <span className="block text-[11px] font-sans text-amber-700">
                                Pending Sync
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900">{reg.full_name}</td>
                          <td className="py-3 px-4 font-mono text-slate-700 tabular-nums">{reg.mobile}</td>
                          <td className="py-3 px-4 font-mono text-right text-slate-700 tabular-nums">
                            {reg.age}
                          </td>
                          <td className="py-3 px-4 text-slate-700">{reg.occupation}</td>
                          <td className="py-3 px-4 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                            {reg.created_at.slice(0, 10)}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">
                            {reg.status}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600">
                            {reg.assigned_admin_name || 'Unassigned'}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openWhatsAppContact(reg)}
                                title="WhatsApp Contact"
                                className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openRegistrationModal(reg, false)}
                                title="View Details"
                                className="p-2 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openRegistrationModal(reg, true)}
                                title="Edit / Update Status"
                                className="p-2 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {isSuper && (
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(reg)}
                                  title="Delete Registration"
                                  className="p-2 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filteredRegistrations.map((reg) => (
                    <div key={reg.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-xs font-semibold text-orange-700 tabular-nums">
                            {reg.registration_code} · {reg.status}
                          </p>
                          <h3 className="text-base font-semibold text-slate-900 mt-0.5">
                            {reg.full_name}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                            {reg.mobile} · {reg.age} yrs · {reg.occupation}
                          </p>
                        </div>
                        <span className="font-mono text-xs text-slate-400 tabular-nums">
                          {reg.created_at.slice(0, 10)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openWhatsAppContact(reg)}
                          className="flex-1 min-h-[44px] rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>WhatsApp</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openRegistrationModal(reg, true)}
                          className="flex-1 min-h-[44px] rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>Manage</span>
                        </button>
                        {isSuper && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(reg)}
                            aria-label="Delete"
                            className="min-h-[44px] min-w-[44px] rounded-xl border border-red-200 bg-red-50 text-red-700 inline-flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* TAB 2: ADMIN MANAGEMENT (SUPER ADMIN ONLY) */}
      {activeTab === 'admins' && isSuper && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Multiple Admin Management</h2>
              <p className="text-sm text-slate-500">
                Manage Super Admins, Sub Admins, Primary Admin auto-assignment, and WhatsApp notification numbers.
              </p>
            </div>
            <button
              type="button"
              onClick={openNewAdminModal}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Admin</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {admins.map((adm) => (
              <div
                key={adm.id}
                className="p-4 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{adm.full_name}</span>
                    {adm.is_primary === 1 && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700">
                        <Crown className="w-3.5 h-3.5" /> Primary Admin
                      </span>
                    )}
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs font-medium text-slate-700">
                      {adm.role === 'super_admin' ? 'Super Admin' : 'Sub Admin'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    {adm.email} · Mobile: {adm.mobile} · WhatsApp: {adm.whatsapp_number}
                  </p>
                  <p className="text-xs text-slate-500">
                    WhatsApp Alerts: {adm.notifications_enabled === 1 ? 'Enabled' : 'Disabled'} · Account:{' '}
                    {adm.is_active === 1 ? 'Active' : 'Inactive'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditAdminModal(adm)}
                    className="min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                  >
                    Edit
                  </button>
                  {adm.id !== currentAdmin.id && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAdmin(adm)}
                      className="min-h-[40px] px-3.5 py-2 rounded-lg border border-red-200 bg-red-50 text-xs font-medium text-red-700 hover:bg-red-100 cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: WHATSAPP SETTINGS & LOGS (SUPER ADMIN ONLY) */}
      {activeTab === 'notifications' && isSuper && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">WhatsApp Business Cloud API Configuration</h2>
                <p className="text-sm text-slate-500">
                  Notifications omit residential address and date of birth per WhatsApp privacy policy.
                </p>
              </div>
              <span className="text-xs font-medium text-slate-700">
                Cloud API Status: {whatsappConfigured ? 'Live Credentials Connected' : 'Awaiting Meta API Tokens in .env'}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={globalNotifyEnabled}
                    onChange={(e) => setGlobalNotifyEnabled(e.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-orange-600"
                  />
                  <span className="text-sm font-medium text-slate-900">
                    Enable Automatic WhatsApp Alerts on New Registration
                  </span>
                </label>

                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1.5">
                    Additional Admin WhatsApp Numbers (comma-separated, e.g. 919876543210)
                  </label>
                  <input
                    type="text"
                    value={extraNumbersText}
                    onChange={(e) => setExtraNumbersText(e.target.value)}
                    placeholder="919876543210, 919825011223"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-sm text-slate-900"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveNotificationSettings}
                  disabled={savingNotifySettings}
                  className="min-h-[44px] rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 cursor-pointer"
                >
                  {savingNotifySettings ? 'Saving...' : 'Save Notification Settings'}
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-[#FAF9F6] p-4">
                <p className="text-xs font-semibold text-slate-500 mb-2">
                  Outgoing WhatsApp Message Template (PII-Safe)
                </p>
                <pre className="font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
{`NEW REGISTRATION – JOIN BAJRANG DAL

Name: [Full Name]
Mobile: [Mobile Number]
Age: [Age]
Occupation: [Occupation]
Registration ID: [Registration ID]
Submission Date: [Date & Time]
Admin Dashboard: [Secure Dashboard URL]`}
                </pre>
              </div>
            </div>
          </div>

          {/* Active Admin Recipients + Delivery Logs */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900">Active Admin WhatsApp Recipients</h3>
              <span className="text-xs text-slate-500">
                Manage numbers in Admin Management or Additional Numbers above
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {admins
                .filter((a) => a.notifications_enabled === 1 && a.is_active === 1)
                .map((a) => (
                  <div
                    key={a.id}
                    className="rounded-xl border border-slate-200 bg-[#FAF9F6] px-4 py-3 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{a.full_name}</p>
                      <p className="font-mono text-slate-600 mt-0.5">+{a.whatsapp_number}</p>
                    </div>
                    <span className="font-medium text-emerald-700">Alerts Active</span>
                  </div>
                ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Notification Delivery Logs</h3>
            {notificationLogs.length === 0 ? (
              <p className="text-sm text-slate-500">No WhatsApp notifications dispatched yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {notificationLogs.map((log) => (
                  <div key={log.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {log.registration_code || log.registration_id} · {log.registrant_name} →{' '}
                        <span className="font-mono">+{log.recipient_whatsapp}</span>
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        Status: <span className="font-semibold text-slate-800">{log.delivery_status}</span>
                        {log.error_message ? ` · ${log.error_message}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-slate-400 tabular-nums">
                        {new Date(log.created_at).toLocaleString('en-IN')}
                      </span>
                      <a
                        href={`https://wa.me/${log.recipient_whatsapp}?text=${encodeURIComponent(log.message_preview)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 font-medium hover:bg-emerald-100"
                      >
                        Send via WhatsApp
                      </a>
                      {log.delivery_status !== 'sent' && (
                        <button
                          type="button"
                          onClick={() => handleRetryNotification(log.registration_id)}
                          className="px-2.5 py-1 rounded-lg border border-slate-300 text-slate-800 hover:bg-slate-50 cursor-pointer"
                        >
                          Retry API
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sync & Audit Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <h3 className="text-base font-bold text-slate-900">Mobile Sync Logs</h3>
              <div className="divide-y divide-slate-100 text-xs max-h-64 overflow-y-auto">
                {syncLogs.map((s) => (
                  <div key={s.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{s.admin_name || s.admin_id}</p>
                      <p className="font-mono text-slate-500">
                        {s.device_id} · Pulled {s.records_pulled} / Pushed {s.records_pushed}
                      </p>
                    </div>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {new Date(s.created_at).toLocaleTimeString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <h3 className="text-base font-bold text-slate-900">Security Audit Trail</h3>
              <div className="divide-y divide-slate-100 text-xs max-h-64 overflow-y-auto">
                {auditLogs.map((a) => (
                  <div key={a.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{a.action}</p>
                      <p className="text-slate-500">
                        {a.actor_name || 'Public / System'} · {a.target_table}
                      </p>
                    </div>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {new Date(a.created_at).toLocaleTimeString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REGISTRATION DETAIL & EDIT MODAL */}
      {selectedReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl my-8">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="font-mono text-xs font-semibold text-orange-700">{selectedReg.registration_code}</p>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">{selectedReg.full_name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReg(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRegistrationUpdate} className="mt-5 space-y-4">
              {editMode && isSuper ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={editForm.full_name}
                      onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Mobile</label>
                    <input
                      type="text"
                      value={editForm.mobile}
                      onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">DOB</label>
                    <input
                      type="date"
                      value={editForm.dob}
                      onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Occupation</label>
                    <select
                      value={editForm.occupation}
                      onChange={(e) =>
                        setEditForm({ ...editForm, occupation: e.target.value as OccupationType })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                    >
                      <option value="Student">Student</option>
                      <option value="Job">Job</option>
                      <option value="Business">Business</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Full Address</label>
                    <textarea
                      rows={2}
                      value={editForm.full_address}
                      onChange={(e) => setEditForm({ ...editForm, full_address: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#FAF9F6] border border-slate-200 p-4 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 block">Mobile</span>
                    <span className="font-mono font-medium text-slate-900">{selectedReg.mobile}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Age · DOB</span>
                    <span className="font-mono text-slate-900">
                      {selectedReg.age} yrs · {selectedReg.dob}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Occupation</span>
                    <span className="text-slate-900">{selectedReg.occupation}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Source</span>
                    <span className="text-slate-900">{selectedReg.source}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-slate-500 block">Residential Address</span>
                    <span className="text-slate-900">{selectedReg.full_address}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Follow-up Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm({ ...editForm, status: e.target.value as RegistrationStatus })
                    }
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                {isSuper && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Assign to Admin</label>
                    <select
                      value={editForm.assigned_admin_id}
                      onChange={(e) => setEditForm({ ...editForm, assigned_admin_id: e.target.value })}
                      className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                    >
                      <option value="">Unassigned</option>
                      {admins.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Follow-up Notes</label>
                <textarea
                  rows={2}
                  value={editForm.follow_up_notes}
                  onChange={(e) => setEditForm({ ...editForm, follow_up_notes: e.target.value })}
                  placeholder="Add call outcome or next follow-up details..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => openWhatsAppContact(selectedReg)}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Message on WhatsApp</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedReg(null)}
                    className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="min-h-[42px] px-5 py-2 rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 cursor-pointer"
                  >
                    {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete Registration?</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Permanently remove <strong>{deleteTarget.full_name}</strong> ({deleteTarget.registration_code}) from the central database? This cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 cursor-pointer"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ENCRYPTED BACKUP & RESTORE MODAL */}
      {showBackupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Encrypted Backup & Recovery</h3>
                <p className="text-xs text-slate-500">AES-GCM 256-bit encrypted portable backup file</p>
              </div>
              <button
                type="button"
                onClick={() => setShowBackupModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-[#FAF9F6] p-4 space-y-3">
              <h4 className="text-sm font-semibold text-slate-900">Download Encrypted Backup</h4>
              <input
                type="password"
                value={backupPassphrase}
                onChange={(e) => setBackupPassphrase(e.target.value)}
                placeholder="Enter backup passphrase (min 6 chars)"
                className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleDownloadEncryptedBackup}
                disabled={backupBusy}
                className="w-full min-h-[42px] rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Create Encrypted .jbdbackup File</span>
              </button>
            </div>

            {isSuper && (
              <div className="rounded-xl border border-slate-200 bg-[#FAF9F6] p-4 space-y-3">
                <h4 className="text-sm font-semibold text-slate-900">Restore from Encrypted Backup</h4>
                <input
                  type="file"
                  accept=".jbdbackup,.json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      file.text().then(setRestoreFileText);
                    }
                  }}
                  className="block w-full text-xs text-slate-600"
                />
                <input
                  type="password"
                  value={restorePassphrase}
                  onChange={(e) => setRestorePassphrase(e.target.value)}
                  placeholder="Enter backup passphrase to decrypt"
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleRestoreEncryptedBackup}
                  disabled={backupBusy}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold hover:bg-slate-50 inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Decrypt & Restore to Database</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD / EDIT ADMIN MODAL */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editingAdmin ? 'Edit Administrator' : 'Add New Administrator'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdmin} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={adminForm.full_name}
                  onChange={(e) => setAdminForm({ ...adminForm, full_name: e.target.value })}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={adminForm.email}
                    onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Mobile (10 digits)</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={adminForm.mobile}
                    onChange={(e) =>
                      setAdminForm({
                        ...adminForm,
                        mobile: e.target.value.replace(/\D/g, '').slice(0, 10),
                      })
                    }
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    WhatsApp Number (with 91)
                  </label>
                  <input
                    type="text"
                    value={adminForm.whatsapp_number}
                    onChange={(e) => setAdminForm({ ...adminForm, whatsapp_number: e.target.value })}
                    placeholder="919876543210"
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                  <select
                    value={adminForm.role}
                    onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value as AdminRole })}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="sub_admin">Sub Admin (Assigned Only)</option>
                    <option value="super_admin">Super Admin (Full Access)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {editingAdmin ? 'New Password (leave blank to keep unchanged)' : 'Password (min 6 chars)'}
                </label>
                <input
                  type="password"
                  required={!editingAdmin}
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adminForm.is_primary}
                    onChange={(e) => setAdminForm({ ...adminForm, is_primary: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-orange-600"
                  />
                  <span>Set as Primary Admin (Auto-assigned new registrations)</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adminForm.notifications_enabled}
                    onChange={(e) =>
                      setAdminForm({ ...adminForm, notifications_enabled: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-orange-600"
                  />
                  <span>Receive WhatsApp Alerts</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminSaving}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-orange-600 text-sm font-semibold text-white hover:bg-orange-700 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{adminSaving ? 'Saving...' : 'Save Admin'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
