import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshCw,
  Search,
  Download,
  FileSpreadsheet,
  MessageCircle,
  Trash2,
  Shield,
  Users,
  Bell,
  HardDrive,
  Plus,
  X,
  Check,
  Loader2,
  Edit3,
  Crown,
  Calendar,
  BookOpen,
  Sparkles,
  BadgeCheck,
  FileText,
  Upload,
  MapPin,
  Share2,
  UserPlus,
  Copy,
} from 'lucide-react';
import type {
  AdminRole,
  AdminUser,
  AuditLogItem,
  BackupItem,
  EventItem,
  IdentityVerificationStatus,
  Language,
  MembershipStatus,
  NotificationLogItem,
  OccupationType,
  OrganizationPageItem,
  OrganizationWing,
  RegistrationItem,
  RegistrationStatus,
  SyncLogItem,
  ThemeSettings,
} from '../types';
import { getTranslations } from '../lib/i18n';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  clearPendingMutations,
  getDeviceId,
  getPendingMutations,
  loadEncryptedRegistrations,
  queueOfflineMutation,
  saveAuthorizedRegistrationsEncrypted,
} from '../lib/encryptedDb';
import { exportRegistrationsToCsv, exportRegistrationsToExcel } from '../lib/exportUtils';
import { exportMembersReportPdf } from '../lib/pdfUtils';
import { apiJson, buildApiUrl } from '../lib/apiClient';
import { PWAInstallButton } from './PWAInstallButton';
import { MemberIdCardModal } from './MemberIdCardModal';
import { AdminEventsManager } from './admin/AdminEventsManager';
import { AdminWhatsAppCenter } from './admin/AdminWhatsAppCenter';
import { AdminOrgCms } from './admin/AdminOrgCms';
import { AdminThemeStudio } from './admin/AdminThemeStudio';
import { AdminBackupCenter } from './admin/AdminBackupCenter';

interface Props {
  lang: Language;
  token: string;
  currentAdmin: AdminUser;
  events: EventItem[];
  orgPages: OrganizationPageItem[];
  themeSettings: ThemeSettings | null;
  onRefreshPublicData: () => Promise<void>;
  initialTab?: DashboardTab;
}

export type DashboardTab =
  | 'registrations'
  | 'events'
  | 'whatsapp'
  | 'cms'
  | 'themes'
  | 'backups'
  | 'admins';

export const AdminDashboard: React.FC<Props> = ({
  lang,
  token,
  currentAdmin,
  events,
  orgPages,
  themeSettings,
  onRefreshPublicData,
  initialTab = 'registrations',
}) => {
  const t = getTranslations(lang);
  const isOnline = useOnlineStatus();
  const isSuper = currentAdmin.role === 'super_admin';

  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [serverStats, setServerStats] = useState<{
    totalEvents?: number;
    upcomingEvents?: number;
    totalEventRegistrations?: number;
  }>({});
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [bannerMsg, setBannerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [preselectedEventForWa, setPreselectedEventForWa] = useState<string>('');

  // Filters
  const [search, setSearch] = useState('');
  const [wingFilter, setWingFilter] = useState<'All' | 'bajrang_dal' | 'durga_vahini'>('All');
  const [membershipFilter, setMembershipFilter] = useState<'All' | MembershipStatus>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [areaScope, setAreaScope] = useState<'all' | 'my_area'>('all');
  const [adminAreaFilter, setAdminAreaFilter] = useState<string>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Member Profile / Digital ID / Private Doc modal
  const [idCardMember, setIdCardMember] = useState<RegistrationItem | null>(null);

  // Area Field Data Collection modal
  const defaultAreaCity = (currentAdmin.assigned_city || '').split(',')[0]?.trim() || '';
  const defaultAreaDistrict = currentAdmin.assigned_district || '';
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectSaving, setCollectSaving] = useState(false);
  const [collectForm, setCollectForm] = useState({
    organization_wing: 'bajrang_dal' as OrganizationWing,
    full_name: '',
    father_or_guardian_name: '',
    mobile: '',
    whatsapp_number: '',
    dob: '',
    full_address: '',
    city_village: defaultAreaCity,
    district: defaultAreaDistrict,
    state: 'Gujarat',
    pincode: '',
    occupation: 'Student' as OccupationType,
    education: '',
    profile_photo_data: '',
    whatsapp_consent: true,
  });

  // Edit Member modal
  const [selectedReg, setSelectedReg] = useState<RegistrationItem | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    father_or_guardian_name: '',
    mobile: '',
    whatsapp_number: '',
    email: '',
    age: 18,
    dob: '',
    full_address: '',
    city_village: '',
    district: '',
    state: 'Gujarat',
    pincode: '',
    occupation: 'Student' as OccupationType,
    education: '',
    profile_photo_data: '',
    membership_status: 'Pending' as MembershipStatus,
    identity_verification_status: 'Pending' as IdentityVerificationStatus,
    status: 'New' as RegistrationStatus,
    assigned_admin_id: '',
    follow_up_notes: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<RegistrationItem | null>(null);

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
    assigned_area: '',
    assigned_district: '',
    assigned_city: '',
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

  const setBanner = useCallback((type: 'success' | 'error', text: string) => {
    setBannerMsg({ type, text });
  }, []);

  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const lastSyncCompletedAtRef = useRef<number>(0);

  const loadLocalVault = useCallback(async () => {
    const cached = await loadEncryptedRegistrations(currentAdmin.id);
    if (cached.records.length > 0) {
      setRegistrations(cached.records);
      setLoading(false);
    }
    setLastSyncTime(cached.lastSyncTime);
    setPendingSyncCount(cached.pendingCount);
  }, [currentAdmin.id]);

  const syncWithServer = useCallback(
    (mode?: 'full' | 'quick' | unknown) => {
      if (syncInFlightRef.current) {
        return syncInFlightRef.current;
      }

      const isQuick = mode === 'quick';
      const nowMs = Date.now();
      if (isQuick && nowMs - lastSyncCompletedAtRef.current < 15_000) {
        return Promise.resolve();
      }

      const run = (async () => {
        if (!navigator.onLine) {
          await loadLocalVault();
          setLoading(false);
          return;
        }

        setSyncing(true);
        try {
          const [deviceId, pending] = await Promise.all([
            getDeviceId(),
            getPendingMutations(currentAdmin.id),
          ]);

          const syncReq = fetch(buildApiUrl('/api/registrations/sync'), {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              deviceId,
              manual: !isQuick,
              pendingUpdates: pending.map((p) => ({
                id: p.id,
                status: p.status,
                follow_up_notes: p.follow_up_notes,
                updated_at: p.updated_at,
              })),
            }),
          });

          const adminsReq = !isQuick
            ? fetch(buildApiUrl('/api/admins'), { headers: authHeaders })
            : Promise.resolve(null);
          const notifReq =
            !isQuick && isSuper
              ? fetch(buildApiUrl('/api/settings/notifications'), { headers: authHeaders })
              : Promise.resolve(null);
          const backupsReq =
            !isQuick && isSuper
              ? fetch(buildApiUrl('/api/backups'), { headers: authHeaders })
              : Promise.resolve(null);
          const publicReq = !isQuick ? onRefreshPublicData() : Promise.resolve();

          const [syncRes, adminsRes, notifRes, backupsRes] = await Promise.all([
            syncReq,
            adminsReq,
            notifReq,
            backupsReq,
            publicReq,
          ]);

          if (syncRes.ok) {
            const syncData = await syncRes.json();
            const syncedRecords = (syncData.registrations || []) as RegistrationItem[];

            setRegistrations(
              syncedRecords.map((r) => ({
                ...r,
                localSyncStatus: 'synced',
              }))
            );
            if (syncData.stats) setServerStats(syncData.stats);
            if (typeof syncData.whatsappCloudConfigured === 'boolean') {
              setWhatsappConfigured(syncData.whatsappCloudConfigured);
            }
            setLastSyncTime(syncData.syncedAt);
            setPendingSyncCount(0);
            lastSyncCompletedAtRef.current = Date.now();

            // Persist local offline vault incrementally without blocking UI responsiveness
            void (async () => {
              try {
                if (pending.length > 0) {
                  await clearPendingMutations(currentAdmin.id);
                }
                await saveAuthorizedRegistrationsEncrypted(
                  currentAdmin.id,
                  syncedRecords,
                  syncData.syncedAt
                );
              } catch {
                // non-fatal offline vault background write
              }
            })();
          } else {
            await loadLocalVault();
          }

          const parsePromises: Promise<void>[] = [];
          if (adminsRes?.ok) {
            parsePromises.push(
              adminsRes.json().then((adminsData) => {
                setAdmins(adminsData.admins || []);
              })
            );
          }
          if (notifRes?.ok) {
            parsePromises.push(
              notifRes.json().then((nd) => {
                setGlobalNotifyEnabled(Boolean(nd.global_enabled));
                setExtraNumbersText((nd.extra_whatsapp_numbers || []).join(', '));
                setWhatsappConfigured(Boolean(nd.whatsappCloudConfigured));
                setNotificationLogs(nd.notificationLogs || []);
                setSyncLogs(nd.syncLogs || []);
                setAuditLogs(nd.auditLogs || []);
              })
            );
          }
          if (backupsRes?.ok) {
            parsePromises.push(
              backupsRes.json().then((bd) => {
                setBackups(bd.backups || []);
              })
            );
          }
          if (parsePromises.length > 0) {
            await Promise.all(parsePromises);
          }
        } catch {
          await loadLocalVault();
        } finally {
          setSyncing(false);
          setLoading(false);
          syncInFlightRef.current = null;
        }
      })();

      syncInFlightRef.current = run;
      return run;
    },
    [authHeaders, currentAdmin.id, isSuper, loadLocalVault, onRefreshPublicData]
  );

  useEffect(() => {
    void loadLocalVault().finally(() => {
      if (!navigator.onLine) setLoading(false);
    });
  }, [loadLocalVault]);

  useEffect(() => {
    if (!isOnline) return;
    void syncWithServer('full');

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void syncWithServer('quick');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    const interval = window.setInterval(() => {
      if (navigator.onLine) void syncWithServer('quick');
    }, 60_000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
    };
  }, [isOnline, syncWithServer]);

  // 9 Dashboard KPI metrics
  const kpis = useMemo(() => {
    const todayPrefix = new Date().toISOString().slice(0, 10);
    const upcomingEv = events.filter((e) => e.event_date >= todayPrefix).length;
    const eventRegTotal =
      serverStats.totalEventRegistrations ??
      events.reduce((acc, e) => acc + (e.stats?.total ?? 0), 0);

    return [
      { label: 'Total Members', value: registrations.length },
      {
        label: 'Bajrang Dal Members',
        value: registrations.filter((r) => r.organization_wing !== 'durga_vahini').length,
      },
      {
        label: 'Durga Vahini Members',
        value: registrations.filter((r) => r.organization_wing === 'durga_vahini').length,
      },
      { label: 'Total Events', value: serverStats.totalEvents ?? events.length },
      { label: 'Upcoming Events', value: serverStats.upcomingEvents ?? upcomingEv },
      { label: 'Event Registrations', value: eventRegTotal },
      {
        label: 'Pending Applications',
        value: registrations.filter((r) => r.membership_status === 'Pending').length,
      },
      {
        label: 'Approved Members',
        value: registrations.filter((r) => r.membership_status === 'Approved').length,
      },
      {
        label: 'Rejected Applications',
        value: registrations.filter((r) => r.membership_status === 'Rejected').length,
      },
    ];
  }, [registrations, events, serverStats]);

  const isMyAreaRegistration = useCallback(
    (r: RegistrationItem) => {
      if (isSuper) return true;
      if (r.assigned_admin_id === currentAdmin.id) return true;
      const splitTokens = (raw?: string) =>
        (raw || '')
          .split(/[,;/|\n]+/)
          .map((s) => s.trim().toLowerCase())
          .filter((s) => s.length >= 2);
      const dTokens = splitTokens(currentAdmin.assigned_district);
      const cTokens = splitTokens(currentAdmin.assigned_city);
      const aTokens = splitTokens(currentAdmin.assigned_area);
      if (dTokens.length === 0 && cTokens.length === 0 && aTokens.length === 0) return false;
      const regD = (r.district || '').toLowerCase();
      const regC = (r.city_village || '').toLowerCase();
      const regPin = (r.pincode || '').toLowerCase();
      const regAddr = (r.full_address || '').toLowerCase();
      const fullHay = `${regD} ${regC} ${regPin} ${regAddr}`.trim();
      const dMatch = dTokens.some((tok) => regD === tok || regD.includes(tok) || fullHay.includes(tok));
      const cMatch = cTokens.some((tok) => regC === tok || regC.includes(tok) || regPin === tok || regAddr.includes(tok));
      if (dTokens.length > 0 && cTokens.length > 0) return dMatch && cMatch;
      if (dTokens.length > 0) return dMatch;
      if (cTokens.length > 0) return cMatch;
      return aTokens.some((tok) => fullHay.includes(tok));
    },
    [currentAdmin, isSuper]
  );

  const myAreaCount = useMemo(
    () => (isSuper ? registrations.length : registrations.filter((r) => isMyAreaRegistration(r)).length),
    [isSuper, registrations, isMyAreaRegistration]
  );

  const filteredRegistrations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return registrations.filter((r) => {
      if (!isSuper && areaScope === 'my_area' && !isMyAreaRegistration(r)) return false;
      if (wingFilter !== 'All' && r.organization_wing !== wingFilter) return false;
      if (membershipFilter !== 'All' && r.membership_status !== membershipFilter) return false;
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      if (adminAreaFilter !== 'All' && r.assigned_admin_id !== adminAreaFilter) return false;
      if (dateFrom && r.created_at.slice(0, 10) < dateFrom) return false;
      if (dateTo && r.created_at.slice(0, 10) > dateTo) return false;
      if (q) {
        const hay = `${r.full_name} ${r.mobile} ${r.registration_code} ${r.occupation} ${r.city_village} ${r.district} ${r.assigned_admin_name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [registrations, isSuper, areaScope, isMyAreaRegistration, search, wingFilter, membershipFilter, statusFilter, adminAreaFilter, dateFrom, dateTo]);

  const openEditModal = (reg: RegistrationItem) => {
    setSelectedReg(reg);
    setEditForm({
      full_name: reg.full_name,
      father_or_guardian_name: reg.father_or_guardian_name || '',
      mobile: reg.mobile,
      whatsapp_number: reg.whatsapp_number || reg.mobile,
      email: reg.email || '',
      age: reg.age,
      dob: reg.dob,
      full_address: reg.full_address,
      city_village: reg.city_village || '',
      district: reg.district || '',
      state: reg.state || 'Gujarat',
      pincode: reg.pincode || '',
      occupation: reg.occupation,
      education: reg.education || '',
      profile_photo_data: reg.profile_photo_data || '',
      membership_status: reg.membership_status,
      identity_verification_status: reg.identity_verification_status,
      status: reg.status,
      assigned_admin_id: reg.assigned_admin_id || '',
      follow_up_notes: reg.follow_up_notes || '',
    });
  };

  const handleQuickApproval = async (reg: RegistrationItem, nextMembershipStatus: MembershipStatus) => {
    try {
      await apiJson(`/api/registrations/${reg.id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          membership_status: nextMembershipStatus,
          identity_verification_status:
            nextMembershipStatus === 'Approved' ? 'Verified' : reg.identity_verification_status,
        }),
      });
      await syncWithServer();
      setBanner('success', `${reg.full_name} marked ${nextMembershipStatus}.`);
    } catch (err) {
      setBanner('error', err instanceof Error ? err.message : 'Status update failed.');
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = img.width > 480 ? 480 / img.width : 1;
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setEditForm((prev) => ({ ...prev, profile_photo_data: canvas.toDataURL('image/jpeg', 0.8) }));
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
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
      setBanner('success', 'Saved to encrypted phone vault (Pending Sync).');
      return;
    }

    try {
      const payload = isSuper
        ? { ...editForm, assigned_admin_id: editForm.assigned_admin_id || null }
        : {
            status: editForm.status,
            follow_up_notes: editForm.follow_up_notes,
            city_village: editForm.city_village,
            district: editForm.district,
            full_address: editForm.full_address,
            education: editForm.education,
          };

      await apiJson(`/api/registrations/${selectedReg.id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      await syncWithServer();
      setSelectedReg(null);
      setBanner('success', 'Member profile updated and synchronized.');
    } catch (err) {
      setBanner('error', err instanceof Error ? err.message : 'Failed to update registration.');
    } finally {
      setSavingEdit(false);
    }
  };

  const openCollectModal = () => {
    setCollectForm({
      organization_wing: 'bajrang_dal',
      full_name: '',
      father_or_guardian_name: '',
      mobile: '',
      whatsapp_number: '',
      dob: '',
      full_address: '',
      city_village: (currentAdmin.assigned_city || '').split(',')[0]?.trim() || '',
      district: currentAdmin.assigned_district || '',
      state: 'Gujarat',
      pincode: '',
      occupation: 'Student',
      education: '',
      profile_photo_data: '',
      whatsapp_consent: true,
    });
    setShowCollectModal(true);
  };

  const handleCollectPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = img.width > 480 ? 480 / img.width : 1;
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setCollectForm((prev) => ({ ...prev, profile_photo_data: canvas.toDataURL('image/jpeg', 0.8) }));
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCollectMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setCollectSaving(true);
    try {
      const res = await apiJson<{
        registration: RegistrationItem;
      }>('/api/admin/registrations/collect', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          ...collectForm,
          whatsapp_number: collectForm.whatsapp_number || collectForm.mobile,
          lang,
        }),
      });
      setShowCollectModal(false);
      await syncWithServer();
      setBanner(
        'success',
        `Member ${res.registration.full_name} (${res.registration.registration_code}) collected & saved to your area!`
      );
    } catch (err) {
      setBanner('error', err instanceof Error ? err.message : 'Unable to collect member record.');
    } finally {
      setCollectSaving(false);
    }
  };

  const formatAreaLabel = (adm: Partial<AdminUser>) => {
    const parts = [
      adm.assigned_area,
      adm.assigned_district,
      adm.assigned_city ? `(${adm.assigned_city})` : '',
    ].filter(Boolean);
    if (parts.length === 0) {
      return adm.role === 'super_admin' ? 'All Areas' : 'Unassigned Area';
    }
    return parts.join(' · ');
  };

  const buildAreaShareUrl = (adm: AdminUser, wing: OrganizationWing = 'bajrang_dal') => {
    const url = new URL(window.location.origin);
    url.searchParams.set('view', wing === 'durga_vahini' ? 'join-durga-vahini' : 'join-bajrang-dal');
    url.searchParams.set('area_admin', adm.id);
    if (adm.assigned_district) url.searchParams.set('district', adm.assigned_district);
    const firstCity = (adm.assigned_city || '').split(',')[0]?.trim();
    if (firstCity) url.searchParams.set('city', firstCity);
    return url.toString();
  };

  const handleCopyOrShareAreaLink = async (adm: AdminUser, wing: OrganizationWing = 'bajrang_dal') => {
    const link = buildAreaShareUrl(adm, wing);
    const wingLabel = wing === 'durga_vahini' ? 'Durga Vahini' : 'Bajrang Dal';
    try {
      if (navigator.share && window.innerWidth < 768) {
        await navigator.share({
          title: `Join ${wingLabel} — ${formatAreaLabel(adm)}`,
          text: `Register directly for ${wingLabel} (${formatAreaLabel(adm)}):`,
          url: link,
        });
        return;
      }
      await navigator.clipboard.writeText(link);
      setBanner('success', `${wingLabel} Area Link copied for ${adm.full_name}!`);
    } catch {
      setBanner('success', `Area Link: ${link}`);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiJson(`/api/registrations/${deleteTarget.id}`, { method: 'DELETE', headers: authHeaders });
      setDeleteTarget(null);
      await syncWithServer();
      setBanner('success', 'Registration deleted permanently.');
    } catch (err) {
      setBanner('error', err instanceof Error ? err.message : 'Deletion failed.');
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
      assigned_area: '',
      assigned_district: '',
      assigned_city: '',
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
      assigned_area: adm.assigned_area || '',
      assigned_district: adm.assigned_district || '',
      assigned_city: adm.assigned_city || '',
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
      await apiJson(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify({ ...adminForm, password: adminForm.password || undefined }),
      });
      setShowAdminModal(false);
      await syncWithServer();
      setBanner('success', editingAdmin ? 'Administrator updated.' : 'New Area Admin added.');
    } catch (err) {
      setBanner('error', err instanceof Error ? err.message : 'Failed to save admin.');
    } finally {
      setAdminSaving(false);
    }
  };

  const handleDeleteAdmin = async (adm: AdminUser) => {
    try {
      await apiJson(`/api/admins/${adm.id}`, { method: 'DELETE', headers: authHeaders });
      await syncWithServer();
      setBanner('success', 'Administrator removed.');
    } catch (err) {
      setBanner('error', err instanceof Error ? err.message : 'Unable to remove admin.');
    }
  };

  const handleSaveNotificationSettings = async () => {
    setSavingNotifySettings(true);
    try {
      const extra_whatsapp_numbers = extraNumbersText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await apiJson('/api/settings/notifications', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ global_enabled: globalNotifyEnabled, extra_whatsapp_numbers }),
      });
      await syncWithServer();
      setBanner('success', 'WhatsApp alert settings updated.');
    } catch (err) {
      setBanner('error', err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSavingNotifySettings(false);
    }
  };

  const handleRetryNotification = async (registrationId: string) => {
    try {
      await apiJson(`/api/notifications/${registrationId}/resend`, { method: 'POST', headers: authHeaders });
      await syncWithServer();
      setBanner('success', 'WhatsApp notification re-dispatched.');
    } catch (err) {
      setBanner('error', err instanceof Error ? err.message : 'Resend failed.');
    }
  };

  const getMemberWhatsAppHref = (reg: RegistrationItem): string => {
    const raw = (reg.whatsapp_number || reg.mobile || '').replace(/\D/g, '');
    const normalized =
      raw.length === 11 && raw.startsWith('0')
        ? `91${raw.slice(1)}`
        : raw.length === 10
          ? `91${raw}`
          : raw;
    const wing = reg.organization_wing === 'durga_vahini' ? 'Durga Vahini' : 'Bajrang Dal';
    const msg = encodeURIComponent(
      `Namaste ${reg.full_name}, regarding your ${wing} registration (ID: ${reg.registration_code}).`
    );
    return normalized.length >= 10 ? `https://wa.me/${normalized}?text=${msg}` : '#';
  };

  const navTabs: Array<{ id: DashboardTab; label: string; icon: React.ComponentType<{ className?: string }>; superOnly?: boolean }> = [
    { id: 'registrations', label: 'Members', icon: Shield },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'whatsapp', label: 'WhatsApp', icon: Bell },
    { id: 'cms', label: 'Org Info CMS', icon: BookOpen, superOnly: true },
    { id: 'themes', label: 'Festival Themes', icon: Sparkles, superOnly: true },
    { id: 'backups', label: 'Cloud Backups', icon: HardDrive, superOnly: true },
    { id: 'admins', label: 'Admin Roles', icon: Users, superOnly: true },
  ];

  return (
    <div className="space-y-6">
      {/* Header + Mobile Vault Sync Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-orange-700 dark:text-orange-400">
                {isSuper ? 'Super Admin' : 'Area Admin'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{currentAdmin.full_name}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
                <MapPin className="w-3.5 h-3.5 text-orange-600" />
                {formatAreaLabel(currentAdmin)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">
                {pendingSyncCount > 0 ? `${pendingSyncCount} ${t.pendingSyncStatus}` : t.syncedStatus}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-emerald-700 dark:text-emerald-400 font-medium">
                Phone Vault: {registrations.length} saved
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
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{t.adminPortalTitle}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openCollectModal}
              disabled={!isOnline}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white disabled:opacity-50 active:scale-[0.98] cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Collect Member</span>
            </button>
            <button
              type="button"
              onClick={() => handleCopyOrShareAreaLink(currentAdmin, 'bajrang_dal')}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/40 px-3 py-2 text-xs font-semibold text-orange-800 dark:text-orange-300 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Area Link</span>
            </button>
            <PWAInstallButton compact />
            <button
              type="button"
              onClick={() => syncWithServer()}
              disabled={syncing || !isOnline}
              className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 text-orange-600 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : t.syncNow}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Horizontal Scroll Strip on Mobile App, Wrapped on Desktop Web) */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-2">
          {navTabs
            .filter((tab) => !tab.superOnly || isSuper)
            .map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[38px] inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-slate-900 dark:bg-orange-600 text-white shadow-xs'
                      : 'bg-[#FAF9F6] dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
        </div>
      </div>

      {bannerMsg && (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-sm ${
            bannerMsg.type === 'success'
              ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
              : 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200'
          }`}
        >
          <span>{bannerMsg.text}</span>
          <button type="button" onClick={() => setBannerMsg(null)} className="p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: MEMBERS & REGISTRATIONS */}
      {activeTab === 'registrations' && (
        <>
          {/* 9 KPI Summary Cards (Snap strip on Mobile App, Grid on Web) */}
          <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-2.5 pb-1 sm:pb-0 sm:grid sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 sm:gap-3">
            {kpis.map((card) => (
              <div
                key={card.label}
                className="min-w-[128px] sm:min-w-0 shrink-0 snap-start rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4"
              >
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">{card.label}</p>
                <p className="mt-1 font-mono text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          {/* Search, Wing, Status & Exports */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
            {!isSuper && (
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAreaScope('all')}
                    className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                      areaScope === 'all'
                        ? 'bg-slate-900 dark:bg-orange-600 text-white'
                        : 'bg-[#FAF9F6] dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    All Data ({registrations.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAreaScope('my_area')}
                    className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                      areaScope === 'my_area'
                        ? 'bg-orange-600 text-white'
                        : 'bg-[#FAF9F6] dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>My Area ({myAreaCount})</span>
                  </button>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Viewing all records · Editing enabled for your assigned area
                </span>
              </div>
            )}

            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={wingFilter}
                  onChange={(e) => setWingFilter(e.target.value as 'All' | 'bajrang_dal' | 'durga_vahini')}
                  className="min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                >
                  <option value="All">All Wings</option>
                  <option value="bajrang_dal">Bajrang Dal</option>
                  <option value="durga_vahini">Durga Vahini</option>
                </select>

                <select
                  value={membershipFilter}
                  onChange={(e) => setMembershipFilter(e.target.value as 'All' | MembershipStatus)}
                  className="min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                >
                  <option value="All">Membership: All</option>
                  <option value="Pending">Pending Approval</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>

                {admins.length > 0 && (
                  <select
                    value={adminAreaFilter}
                    onChange={(e) => setAdminAreaFilter(e.target.value)}
                    className="min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                  >
                    <option value="All">All Area Admins</option>
                    {admins.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.full_name} ({a.assigned_district || a.assigned_area || (a.role === 'super_admin' ? 'All Areas' : 'Area Admin')})
                      </option>
                    ))}
                  </select>
                )}

                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 font-mono text-xs"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-1.5">
                {['All', 'New', 'Contacted', 'Follow-up', 'Completed'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                      statusFilter === st
                        ? 'bg-orange-600 text-white'
                        : 'bg-[#FAF9F6] dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportRegistrationsToExcel(filteredRegistrations)}
                  disabled={filteredRegistrations.length === 0}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium disabled:opacity-40 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>{t.exportExcel}</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportRegistrationsToCsv(filteredRegistrations)}
                  disabled={filteredRegistrations.length === 0}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium disabled:opacity-40 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  <span>{t.exportCsv}</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportMembersReportPdf(filteredRegistrations)}
                  disabled={filteredRegistrations.length === 0}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium disabled:opacity-40 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-orange-600" />
                  <span>PDF Report</span>
                </button>
              </div>
            </div>
          </div>

          {/* Member Table (Desktop) & Cards (Mobile) */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading encrypted registrations...</span>
              </div>
            ) : filteredRegistrations.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-base font-semibold text-slate-900 dark:text-white">No member records found</p>
                <p className="text-sm text-slate-500">Adjust search or filter criteria.</p>
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#FAF9F6] dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <th className="py-3 px-4">ID · Wing</th>
                        <th className="py-3 px-4">Member</th>
                        <th className="py-3 px-4">Mobile · District</th>
                        <th className="py-3 px-4">Membership</th>
                        <th className="py-3 px-4">ID Verify</th>
                        <th className="py-3 px-4">Follow-up</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                      {filteredRegistrations.map((reg) => {
                        const canManage = isMyAreaRegistration(reg);
                        return (
                          <tr key={reg.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-mono text-xs font-semibold text-orange-700 dark:text-orange-400 block">
                                {reg.registration_code}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {reg.organization_wing === 'durga_vahini' ? 'Durga Vahini' : 'Bajrang Dal'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-900 dark:text-white">{reg.full_name}</p>
                              <p className="text-xs text-slate-500">
                                {reg.age} yrs · {reg.occupation}
                              </p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-mono text-xs text-slate-800 dark:text-slate-200">{reg.mobile}</p>
                              <p className="text-xs text-slate-500">
                                {[reg.city_village, reg.district].filter(Boolean).join(', ') || '-'}
                              </p>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-xs font-semibold">
                              <span
                                className={
                                  reg.membership_status === 'Approved'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : reg.membership_status === 'Rejected'
                                    ? 'text-red-600'
                                    : 'text-amber-700 dark:text-amber-400'
                                }
                              >
                                {reg.membership_status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                              {reg.identity_verification_status}
                            </td>
                            <td className="py-3 px-4 text-xs font-medium">{reg.status}</td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                {isSuper && reg.membership_status !== 'Approved' && (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickApproval(reg, 'Approved')}
                                    title="Approve Membership"
                                    className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setIdCardMember(reg)}
                                  title={canManage ? 'View Member Profile & Private ID Doc' : 'View Member Profile'}
                                  className="p-2 rounded-lg text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 cursor-pointer"
                                >
                                  <BadgeCheck className="w-4 h-4" />
                                </button>
                                <a
                                  href={getMemberWhatsAppHref(reg)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Message on WhatsApp"
                                  className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 inline-flex items-center justify-center"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </a>
                                {canManage ? (
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(reg)}
                                    title="Edit Profile"
                                    className="p-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <span className="px-2 py-1 text-[10px] font-medium text-slate-400">
                                    View Only
                                  </span>
                                )}
                                {isSuper && (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteTarget(reg)}
                                    title="Delete"
                                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Touch Cards */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRegistrations.map((reg) => {
                    const canManage = isMyAreaRegistration(reg);
                    return (
                      <div key={reg.id} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-xs font-semibold text-orange-700 dark:text-orange-400">
                              {reg.registration_code} · {reg.organization_wing === 'durga_vahini' ? 'Durga Vahini' : 'Bajrang Dal'}
                            </p>
                            <h3 className="text-base font-semibold text-slate-900 dark:text-white mt-0.5">
                              {reg.full_name}
                            </h3>
                            <p className="text-xs text-slate-500 font-mono">
                              {reg.mobile} · {reg.membership_status} · {reg.district || reg.city_village || 'Gujarat'}
                            </p>
                          </div>
                          {!isSuper && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${canManage ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                              {canManage ? 'My Area' : 'Other Area'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIdCardMember(reg)}
                            className="flex-1 min-h-[40px] rounded-xl border border-orange-300 bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300 text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <BadgeCheck className="w-4 h-4" />
                            <span>{canManage ? 'Profile & Doc' : 'View Profile'}</span>
                          </button>
                          <a
                            href={getMemberWhatsAppHref(reg)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[40px] px-3 rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold inline-flex items-center justify-center gap-1"
                          >
                            <MessageCircle className="w-4 h-4" />
                            <span>WhatsApp</span>
                          </a>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => openEditModal(reg)}
                              className="flex-1 min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                              <span>Manage</span>
                            </button>
                          )}
                          {isSuper && reg.membership_status !== 'Approved' && (
                            <button
                              type="button"
                              onClick={() => handleQuickApproval(reg, 'Approved')}
                              className="min-h-[40px] px-3 rounded-xl bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* TAB 2: EVENTS */}
      {activeTab === 'events' && (
        <AdminEventsManager
          token={token}
          isSuper={isSuper}
          events={events}
          onRefresh={syncWithServer}
          onBanner={setBanner}
          onSendEventWhatsApp={(evId) => {
            setPreselectedEventForWa(evId);
            setActiveTab('whatsapp');
          }}
        />
      )}

      {/* TAB 3: WHATSAPP MULTILINGUAL MESSAGING & LOGS */}
      {activeTab === 'whatsapp' && (
        <AdminWhatsAppCenter
          token={token}
          isSuper={isSuper}
          registrations={registrations}
          events={events}
          preselectedEventId={preselectedEventForWa}
          globalNotifyEnabled={globalNotifyEnabled}
          setGlobalNotifyEnabled={setGlobalNotifyEnabled}
          extraNumbersText={extraNumbersText}
          setExtraNumbersText={setExtraNumbersText}
          whatsappConfigured={whatsappConfigured}
          notificationLogs={notificationLogs}
          syncLogs={syncLogs}
          auditLogs={auditLogs}
          onSaveSettings={handleSaveNotificationSettings}
          savingSettings={savingNotifySettings}
          onRetryNotification={handleRetryNotification}
          onBanner={setBanner}
          onRefresh={syncWithServer}
        />
      )}

      {/* TAB 4: ORG INFO CMS */}
      {activeTab === 'cms' && isSuper && (
        <AdminOrgCms
          token={token}
          pages={orgPages}
          onRefresh={syncWithServer}
          onBanner={setBanner}
        />
      )}

      {/* TAB 5: FESTIVAL THEMES */}
      {activeTab === 'themes' && isSuper && (
        <AdminThemeStudio
          token={token}
          themeSettings={themeSettings}
          onRefresh={syncWithServer}
          onBanner={setBanner}
        />
      )}

      {/* TAB 6: AUTOMATIC CLOUD BACKUPS */}
      {activeTab === 'backups' && isSuper && (
        <AdminBackupCenter
          token={token}
          backups={backups}
          registrations={registrations}
          onRefresh={syncWithServer}
          onBanner={setBanner}
        />
      )}

      {/* TAB 7: ADMIN ROLES MANAGEMENT */}
      {activeTab === 'admins' && isSuper && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Admin Role & Permission Management</h2>
              <p className="text-sm text-slate-500">
                Manage Super Admins, Sub Admins, Primary Admin routing, and WhatsApp alerts.
              </p>
            </div>
            <button
              type="button"
              onClick={openNewAdminModal}
              className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Admin</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {admins.map((adm) => (
              <div key={adm.id} className="p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">{adm.full_name}</span>
                    {adm.is_primary === 1 && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 dark:text-orange-400">
                        <Crown className="w-3.5 h-3.5" /> Primary Admin
                      </span>
                    )}
                    <span className="text-xs font-medium text-slate-500">
                      · {adm.role === 'super_admin' ? 'Super Admin' : 'Area Sub Admin'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    {adm.email} · {adm.mobile} · WA: {adm.whatsapp_number}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1 font-medium text-orange-700 dark:text-orange-400">
                      <MapPin className="w-3.5 h-3.5" />
                      {formatAreaLabel(adm)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyOrShareAreaLink(adm, 'bajrang_dal')}
                    className="px-3 py-2 rounded-lg border border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-950/30 text-xs font-medium text-orange-800 dark:text-orange-300 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>BD Area Link</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyOrShareAreaLink(adm, 'durga_vahini')}
                    className="px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-xs font-medium text-rose-800 dark:text-rose-300 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>DV Area Link</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditAdminModal(adm)}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium cursor-pointer"
                  >
                    Edit
                  </button>
                  {adm.id !== currentAdmin.id && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAdmin(adm)}
                      className="px-3.5 py-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-xs font-medium text-red-700 dark:text-red-300 cursor-pointer"
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

      {/* ADMIN MEMBER RECORD + PRIVATE DOC INSPECTOR */}
      {idCardMember && (
        <MemberIdCardModal
          member={idCardMember}
          adminToken={token}
          onClose={() => setIdCardMember(null)}
        />
      )}

      {/* EDIT MEMBER MODAL */}
      {selectedReg && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Edit Member Profile ({selectedReg.registration_code})
                </h3>
              </div>
              <button type="button" onClick={() => setSelectedReg(null)} className="p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRegistrationUpdate} className="space-y-4">
              {isSuper && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Full Name</label>
                    <input
                      type="text"
                      value={editForm.full_name}
                      onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                      className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Father / Guardian Name</label>
                    <input
                      type="text"
                      value={editForm.father_or_guardian_name}
                      onChange={(e) => setEditForm({ ...editForm, father_or_guardian_name: e.target.value })}
                      className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Membership Approval</label>
                    <select
                      value={editForm.membership_status}
                      onChange={(e) => setEditForm({ ...editForm, membership_status: e.target.value as MembershipStatus })}
                      className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">ID Document Verification</label>
                    <select
                      value={editForm.identity_verification_status}
                      onChange={(e) => setEditForm({ ...editForm, identity_verification_status: e.target.value as IdentityVerificationStatus })}
                      className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Verified">Verified</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">City / Village</label>
                    <input
                      type="text"
                      value={editForm.city_village}
                      onChange={(e) => setEditForm({ ...editForm, city_village: e.target.value })}
                      className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">District</label>
                    <input
                      type="text"
                      value={editForm.district}
                      onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}
                      className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold mb-1">Upload / Change Profile Photo</label>
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer">
                      <Upload className="w-4 h-4 text-orange-600" />
                      <span>Select New Photo</span>
                      <input type="file" accept="image/*" onChange={handlePhotoChange} className="sr-only" />
                    </label>
                  </div>
                </div>
              )}

              {!isSuper && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold mb-1">City / Village</label>
                    <input
                      type="text"
                      value={editForm.city_village}
                      onChange={(e) => setEditForm({ ...editForm, city_village: e.target.value })}
                      className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">District</label>
                    <input
                      type="text"
                      value={editForm.district}
                      onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}
                      className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold mb-1">Full Address</label>
                    <input
                      type="text"
                      value={editForm.full_address}
                      onChange={(e) => setEditForm({ ...editForm, full_address: e.target.value })}
                      className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold mb-1">Follow-up Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as RegistrationStatus })}
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm"
                  >
                    {(['New', 'Contacted', 'Follow-up', 'Completed'] as RegistrationStatus[]).map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                {isSuper && (
                  <div>
                    <label className="block text-xs font-semibold mb-1">Assigned Admin</label>
                    <select
                      value={editForm.assigned_admin_id}
                      onChange={(e) => setEditForm({ ...editForm, assigned_admin_id: e.target.value })}
                      className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm"
                    >
                      <option value="">Unassigned</option>
                      {admins.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.full_name} ({a.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Follow-up Notes</label>
                <textarea
                  rows={2}
                  value={editForm.follow_up_notes}
                  onChange={(e) => setEditForm({ ...editForm, follow_up_notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedReg(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold cursor-pointer"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Confirm Deletion</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Permanently remove registration <strong>{deleteTarget.registration_code}</strong> ({deleteTarget.full_name})?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT ADMIN MODAL */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingAdmin ? 'Edit Admin' : 'Add Admin'}
              </h3>
              <button type="button" onClick={() => setShowAdminModal(false)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveAdmin} className="space-y-3.5">
              <input
                type="text"
                required
                placeholder="Full Name"
                value={adminForm.full_name}
                onChange={(e) => setAdminForm({ ...adminForm, full_name: e.target.value })}
                className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <input
                type="email"
                required
                placeholder="Email"
                value={adminForm.email}
                onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="Mobile (10 digits)"
                  value={adminForm.mobile}
                  onChange={(e) => setAdminForm({ ...adminForm, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-sm"
                />
                <input
                  type="tel"
                  placeholder="WhatsApp (e.g. 9198...)"
                  value={adminForm.whatsapp_number}
                  onChange={(e) => setAdminForm({ ...adminForm, whatsapp_number: e.target.value })}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={adminForm.role}
                  onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value as AdminRole })}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                >
                  <option value="sub_admin">Area Sub Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                <input
                  type="password"
                  required={!editingAdmin}
                  placeholder={editingAdmin ? 'New password (optional)' : 'Password (min 6 chars)'}
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </div>

              {/* Area-Wise Assignment Fields */}
              <div className="rounded-xl border border-orange-200 dark:border-orange-900/40 bg-[#FAF9F6] dark:bg-slate-800/60 p-3.5 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-800 dark:text-orange-300">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Area-Wise Jurisdiction (Optional for Super Admin)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    placeholder="Area / Zone Name (e.g. Surat West)"
                    value={adminForm.assigned_area}
                    onChange={(e) => setAdminForm({ ...adminForm, assigned_area: e.target.value })}
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="District (e.g. Surat, Ahmedabad)"
                    value={adminForm.assigned_district}
                    onChange={(e) => setAdminForm({ ...adminForm, assigned_district: e.target.value })}
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Cities / Talukas / Wards / Pincodes (comma-separated, e.g. Adajan, Vesu, 395009)"
                  value={adminForm.assigned_city}
                  onChange={(e) => setAdminForm({ ...adminForm, assigned_city: e.target.value })}
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Matching public registrations auto-route to this admin, and this admin can directly collect and manage records in this area.
                </p>
              </div>

              <div className="flex flex-wrap gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adminForm.is_primary}
                    onChange={(e) => setAdminForm({ ...adminForm, is_primary: e.target.checked })}
                  />
                  <span>Primary Admin (default fallback)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adminForm.notifications_enabled}
                    onChange={(e) => setAdminForm({ ...adminForm, notifications_enabled: e.target.checked })}
                  />
                  <span>Receive WhatsApp Alerts</span>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminSaving}
                  className="px-5 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold cursor-pointer"
                >
                  {adminSaving ? 'Saving...' : 'Save Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AREA ADMIN DIRECT FIELD DATA COLLECTION MODAL */}
      {showCollectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-orange-600" />
                  <span>Collect Area Member Data</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Area: {formatAreaLabel(currentAdmin)} · Directly assigned & synced to your vault
                </p>
              </div>
              <button type="button" onClick={() => setShowCollectModal(false)} className="p-1.5 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCollectMember} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'bajrang_dal' as OrganizationWing, label: 'Bajrang Dal (18+)' },
                    { id: 'durga_vahini' as OrganizationWing, label: 'Durga Vahini (15+)' },
                  ] as const
                ).map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setCollectForm((prev) => ({ ...prev, organization_wing: w.id }))}
                    className={`min-h-[42px] rounded-xl border text-xs sm:text-sm font-semibold cursor-pointer ${
                      collectForm.organization_wing === w.id
                        ? w.id === 'durga_vahini'
                          ? 'bg-rose-700 text-white border-rose-700'
                          : 'bg-orange-600 text-white border-orange-600'
                        : 'border-slate-300 dark:border-slate-700 bg-[#FAF9F6] dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={collectForm.full_name}
                    onChange={(e) => setCollectForm({ ...collectForm, full_name: e.target.value })}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-base sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    {collectForm.organization_wing === 'durga_vahini' ? 'Father / Guardian Name' : "Father's Name"}
                  </label>
                  <input
                    type="text"
                    value={collectForm.father_or_guardian_name}
                    onChange={(e) => setCollectForm({ ...collectForm, father_or_guardian_name: e.target.value })}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-base sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Mobile Number (10 digits) *</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={collectForm.mobile}
                    onChange={(e) =>
                      setCollectForm({ ...collectForm, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })
                    }
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-base sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    required
                    value={collectForm.dob}
                    onChange={(e) => setCollectForm({ ...collectForm, dob: e.target.value })}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-base sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">City / Village *</label>
                  <input
                    type="text"
                    required
                    value={collectForm.city_village}
                    onChange={(e) => setCollectForm({ ...collectForm, city_village: e.target.value })}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-base sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">District *</label>
                  <input
                    type="text"
                    required
                    value={collectForm.district}
                    onChange={(e) => setCollectForm({ ...collectForm, district: e.target.value })}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-base sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Occupation</label>
                  <select
                    value={collectForm.occupation}
                    onChange={(e) => setCollectForm({ ...collectForm, occupation: e.target.value as OccupationType })}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-base sm:text-sm"
                  >
                    <option value="Student">Student</option>
                    <option value="Job">Job</option>
                    <option value="Business">Business</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Pincode</label>
                  <input
                    type="tel"
                    maxLength={6}
                    value={collectForm.pincode}
                    onChange={(e) =>
                      setCollectForm({ ...collectForm, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })
                    }
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-base sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Full Address *</label>
                <textarea
                  rows={2}
                  required
                  value={collectForm.full_address}
                  onChange={(e) => setCollectForm({ ...collectForm, full_address: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-base sm:text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer">
                  <Upload className="w-4 h-4 text-orange-600" />
                  <span>{collectForm.profile_photo_data ? 'Photo Attached ✓' : 'Optional Photo'}</span>
                  <input type="file" accept="image/*" onChange={handleCollectPhotoChange} className="sr-only" />
                </label>

                <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={collectForm.whatsapp_consent}
                    onChange={(e) => setCollectForm({ ...collectForm, whatsapp_consent: e.target.checked })}
                  />
                  <span>Member consents to WhatsApp confirmation</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCollectModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={collectSaving}
                  className="px-5 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-semibold cursor-pointer"
                >
                  {collectSaving ? 'Saving...' : 'Save Member Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
