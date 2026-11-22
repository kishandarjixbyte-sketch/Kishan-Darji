import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  History,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type {
  AuditLogItem,
  EventItem,
  NotificationLogItem,
  RegistrationItem,
  SyncLogItem,
  WhatsAppLanguage,
  WhatsAppTemplateType,
} from '../../types';
import { apiJson } from '../../lib/apiClient';

interface Props {
  token: string;
  isSuper: boolean;
  registrations: RegistrationItem[];
  events: EventItem[];
  preselectedEventId?: string;
  globalNotifyEnabled: boolean;
  setGlobalNotifyEnabled: (v: boolean) => void;
  extraNumbersText: string;
  setExtraNumbersText: (v: string) => void;
  whatsappConfigured: boolean;
  notificationLogs: NotificationLogItem[];
  syncLogs: SyncLogItem[];
  auditLogs: AuditLogItem[];
  onSaveSettings: () => Promise<void>;
  savingSettings: boolean;
  onRetryNotification: (regId: string) => Promise<void>;
  onBanner: (type: 'success' | 'error', text: string) => void;
  onRefresh: () => Promise<void>;
}

interface ManualContact {
  id: string;
  name: string;
  rawInput: string;
  normalized: string;
  valid: boolean;
}

interface DispatchResultItem {
  fullName: string;
  recipient: string;
  status: string;
  messageText?: string;
  waMeUrl: string;
  providerMessageId?: string;
  error?: string;
}

interface DispatchSummary {
  totalRequested: number;
  processed: number;
  sentCount: number;
  directReadyCount: number;
  failedCount: number;
  skippedDuplicateCount: number;
  skippedInvalidCount: number;
  skippedNoConsentCount: number;
}

function normalizePhoneClient(input: string): string {
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

function isValidPhoneClient(input: string): boolean {
  const normalized = normalizePhoneClient(input);
  if (!/^[1-9]\d{9,14}$/.test(normalized)) return false;
  if (normalized.length === 12 && normalized.startsWith('91')) {
    return /^91[6-9]\d{9}$/.test(normalized);
  }
  return true;
}

function formatReadablePhone(normalized: string): string {
  if (normalized.length === 12 && normalized.startsWith('91')) {
    return `+91 ${normalized.slice(2, 7)} ${normalized.slice(7)}`;
  }
  return normalized ? `+${normalized}` : '';
}

function renderMultilingualPreview(params: {
  language: WhatsAppLanguage;
  templateType: WhatsAppTemplateType;
  customMessage: string;
  name: string;
  code: string;
  wing: string;
  eventTitle: string;
  eventDate: string;
  eventVenue: string;
  membershipStatus: string;
}): string {
  const applyPlaceholders = (raw: string) =>
    raw
      .replace(/\{name\}/gi, params.name || 'Member')
      .replace(/\{code\}/gi, params.code || 'N/A')
      .replace(/\{wing\}/gi, params.wing || 'Bajrang Dal')
      .replace(/\{event_title\}/gi, params.eventTitle || 'Upcoming Program')
      .replace(/\{event_date\}/gi, params.eventDate || 'TBA')
      .replace(/\{venue\}/gi, params.eventVenue || 'District Office')
      .replace(/\{status\}/gi, params.membershipStatus || 'Updated');

  const customNote = params.customMessage.trim()
    ? applyPlaceholders(params.customMessage.trim())
    : '';

  if (params.templateType === 'custom') {
    return (
      customNote ||
      'Type your custom Gujarati, Hindi, or English message in the message box above...'
    );
  }

  const map: Record<WhatsAppLanguage, Record<Exclude<WhatsAppTemplateType, 'custom'>, string>> = {
    gu: {
      event_announcement: [
        `જય શ્રી રામ ${params.name},`,
        `${params.wing} દ્વારા નવો કાર્યક્રમ જાહેર કરવામાં આવ્યો છે:`,
        `કાર્યક્રમ: ${params.eventTitle}`,
        params.eventDate ? `તારીખ: ${params.eventDate}` : '',
        params.eventVenue ? `સ્થળ: ${params.eventVenue}` : '',
        customNote ? `\n${customNote}` : '',
        `\nસંપર્ક અને રજીસ્ટ્રેશન માટે સત્તાવાર પોર્ટલની મુલાકાત લો.`,
      ]
        .filter(Boolean)
        .join('\n'),
      registration_confirmation: [
        `નમસ્તે ${params.name},`,
        `${params.wing} માં તમારી નોંધણી સફળતાપૂર્વક પ્રાપ્ત થઈ છે.`,
        params.code ? `રજીસ્ટ્રેશન નંબર: ${params.code}` : '',
        customNote ? `\n${customNote}` : '',
        `તમારા સભ્યપદ અંગેની આગળની પુષ્ટિ અને સૂચના તમને WhatsApp સંદેશ દ્વારા મળશે.`,
      ]
        .filter(Boolean)
        .join('\n'),
      event_reminder: [
        `સ્મૃતિ સંદેશ – ${params.name},`,
        `આગામી કાર્યક્રમ "${params.eventTitle}" માં તમારી હાજરી અપેક્ષિત છે.`,
        params.eventDate ? `તારીખ: ${params.eventDate}` : '',
        params.eventVenue ? `સ્થળ: ${params.eventVenue}` : '',
        params.code ? `તમારો પાસ નંબર: ${params.code}` : '',
        customNote ? `\n${customNote}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      membership_update: [
        `જય શ્રી રામ ${params.name},`,
        `${params.wing} સભ્યપદ અરજી (${params.code || 'Ref'}) ની વર્તમાન સ્થિતિ: ${params.membershipStatus}.`,
        customNote || 'વધુ સૂચનાઓ તમને આ નંબર પર સંદેશ દ્વારા મોકલવામાં આવશે.',
      ]
        .filter(Boolean)
        .join('\n'),
    },
    hi: {
      event_announcement: [
        `जय श्री राम ${params.name},`,
        `${params.wing} द्वारा आगामी कार्यक्रम की सूचना:`,
        `कार्यक्रम: ${params.eventTitle}`,
        params.eventDate ? `दिनांक: ${params.eventDate}` : '',
        params.eventVenue ? `स्थान: ${params.eventVenue}` : '',
        customNote ? `\n${customNote}` : '',
        `\nअधिक जानकारी एवं पंजीकरण के लिए आधिकारिक पोर्टल देखें।`,
      ]
        .filter(Boolean)
        .join('\n'),
      registration_confirmation: [
        `नमस्ते ${params.name},`,
        `${params.wing} में आपका पंजीकरण सफलतापूर्वक दर्ज कर लिया गया है।`,
        params.code ? `पंजीकरण क्रमांक: ${params.code}` : '',
        customNote ? `\n${customNote}` : '',
        `आपके पंजीकरण की आगे की पुष्टि और सूचना WhatsApp संदेश द्वारा भेजी जाएगी।`,
      ]
        .filter(Boolean)
        .join('\n'),
      event_reminder: [
        `स्मरण सूचना – ${params.name},`,
        `आगामी कार्यक्रम "${params.eventTitle}" के लिए अनुस्मारक:`,
        params.eventDate ? `दिनांक: ${params.eventDate}` : '',
        params.eventVenue ? `स्थान: ${params.eventVenue}` : '',
        params.code ? `पास क्रमांक: ${params.code}` : '',
        customNote ? `\n${customNote}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      membership_update: [
        `जय श्री राम ${params.name},`,
        `${params.wing} सदस्यता आवेदन (${params.code || 'Ref'}) की अद्यतन स्थिति: ${params.membershipStatus}.`,
        customNote || 'अन्य आवश्यक जानकारी संदेश द्वारा भेजी जाएगी।',
      ]
        .filter(Boolean)
        .join('\n'),
    },
    en: {
      event_announcement: [
        `Namaste ${params.name},`,
        `${params.wing} invites you to an upcoming program:`,
        `Event: ${params.eventTitle}`,
        params.eventDate ? `Date: ${params.eventDate}` : '',
        params.eventVenue ? `Venue: ${params.eventVenue}` : '',
        customNote ? `\n${customNote}` : '',
        `\nPlease check the official portal for registration and details.`,
      ]
        .filter(Boolean)
        .join('\n'),
      registration_confirmation: [
        `Namaste ${params.name},`,
        `Your registration with ${params.wing} has been received successfully.`,
        params.code ? `Reference ID: ${params.code}` : '',
        customNote ? `\n${customNote}` : '',
        `You will receive further membership confirmation updates directly via message.`,
      ]
        .filter(Boolean)
        .join('\n'),
      event_reminder: [
        `Event Reminder – ${params.name},`,
        `This is a reminder for "${params.eventTitle}".`,
        params.eventDate ? `Date: ${params.eventDate}` : '',
        params.eventVenue ? `Venue: ${params.eventVenue}` : '',
        params.code ? `Pass Ref: ${params.code}` : '',
        customNote ? `\n${customNote}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      membership_update: [
        `Namaste ${params.name},`,
        `Your ${params.wing} membership application (${params.code || 'Ref'}) status is now: ${params.membershipStatus}.`,
        customNote || 'Thank you for registering with our organization.',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  };

  return map[params.language][params.templateType];
}

function getStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case 'sent':
    case 'delivered':
      return {
        label: 'Sent via API',
        className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
      };
    case 'queued_unconfigured':
      return {
        label: 'Direct WA Ready',
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
      };
    case 'failed':
      return {
        label: 'Failed',
        className: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
      };
    case 'skipped_duplicate':
      return {
        label: 'Duplicate Skipped',
        className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      };
    case 'skipped_invalid':
      return {
        label: 'Invalid Number',
        className: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
      };
    case 'skipped_disabled':
    case 'skipped_no_consent':
      return {
        label: 'Skipped (No Consent)',
        className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
      };
    default:
      return {
        label: status,
        className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      };
  }
}

export const AdminWhatsAppCenter: React.FC<Props> = ({
  token,
  isSuper,
  registrations,
  events,
  preselectedEventId,
  globalNotifyEnabled,
  setGlobalNotifyEnabled,
  extraNumbersText,
  setExtraNumbersText,
  whatsappConfigured,
  notificationLogs,
  syncLogs,
  auditLogs,
  onSaveSettings,
  savingSettings,
  onBanner,
  onRefresh,
}) => {
  const [waLang, setWaLang] = useState<WhatsAppLanguage>('gu');
  const [templateType, setTemplateType] = useState<WhatsAppTemplateType>(
    preselectedEventId ? 'event_announcement' : 'registration_confirmation'
  );
  const [selectedEventId, setSelectedEventId] = useState(preselectedEventId || '');
  const [customMessage, setCustomMessage] = useState('');

  // Recipient Picker State
  const [recipientTab, setRecipientTab] = useState<'members' | 'manual'>('members');
  const [memberSearch, setMemberSearch] = useState('');
  const [wingFilter, setWingFilter] = useState<'all' | 'bajrang_dal' | 'durga_vahini'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Manual Number Entry State
  const [manualNameInput, setManualNameInput] = useState('');
  const [manualPhoneInput, setManualPhoneInput] = useState('');
  const [bulkPhonesInput, setBulkPhonesInput] = useState('');
  const [showBulkBox, setShowBulkBox] = useState(false);
  const [manualContacts, setManualContacts] = useState<ManualContact[]>([]);
  const [manualConsentConfirmed, setManualConsentConfirmed] = useState(false);

  // Sending / Modal / Result State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [dispatchResults, setDispatchResults] = useState<DispatchResultItem[]>([]);
  const [dispatchSummary, setDispatchSummary] = useState<DispatchSummary | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // History State
  const [historyFilter, setHistoryFilter] = useState<'all' | 'sent' | 'queued_unconfigured' | 'failed'>('all');
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);

  // Sync event pre-selection when navigated from Events tab
  useEffect(() => {
    if (preselectedEventId) {
      setSelectedEventId(preselectedEventId);
      setTemplateType('event_announcement');
    }
  }, [preselectedEventId]);

  const allConsentedMembers = useMemo(
    () => registrations.filter((r) => r.whatsapp_consent === 1),
    [registrations]
  );

  const filteredConsentedMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return allConsentedMembers.filter((r) => {
      if (wingFilter !== 'all' && r.organization_wing !== wingFilter) return false;
      if (q) {
        const hay = `${r.full_name} ${r.mobile} ${r.whatsapp_number} ${r.registration_code} ${r.district} ${r.city_village}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allConsentedMembers, wingFilter, memberSearch]);

  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;

  const sampleMember = useMemo(() => {
    const firstSelected = allConsentedMembers.find((m) => selectedIds.includes(m.id));
    return firstSelected || filteredConsentedMembers[0] || allConsentedMembers[0] || registrations[0] || null;
  }, [allConsentedMembers, filteredConsentedMembers, registrations, selectedIds]);

  const previewText = useMemo(() => {
    return renderMultilingualPreview({
      language: waLang,
      templateType,
      customMessage,
      name: sampleMember?.full_name || manualContacts[0]?.name || 'Member Name',
      code: sampleMember?.registration_code || 'JBD-2026-1001',
      wing:
        sampleMember?.organization_wing === 'durga_vahini'
          ? 'Durga Vahini'
          : 'Bajrang Dal',
      eventTitle: selectedEvent?.title || 'Upcoming Seva Program',
      eventDate: selectedEvent ? `${selectedEvent.event_date} ${selectedEvent.event_time}` : '',
      eventVenue: selectedEvent
        ? `${selectedEvent.venue}${selectedEvent.location_city ? `, ${selectedEvent.location_city}` : ''}`
        : '',
      membershipStatus: sampleMember?.membership_status || 'Approved',
    });
  }, [waLang, templateType, customMessage, sampleMember, manualContacts, selectedEvent]);

  // Unified deduplicated recipient summary
  const validManualContacts = useMemo(
    () => manualContacts.filter((c) => c.valid),
    [manualContacts]
  );

  const unifiedRecipients = useMemo(() => {
    const chosenMembers = allConsentedMembers.filter((m) => selectedIds.includes(m.id));
    const seenPhones = new Set<string>();
    const list: Array<{
      registrationId: string | null;
      registrationCode?: string;
      fullName: string;
      whatsappNumber: string;
      wingLabel?: string;
      membershipStatus?: string;
      whatsappConsent: boolean;
      source: 'member' | 'manual';
    }> = [];

    for (const m of chosenMembers) {
      const normalized = normalizePhoneClient(m.whatsapp_number || m.mobile);
      if (!isValidPhoneClient(normalized) || seenPhones.has(normalized)) continue;
      seenPhones.add(normalized);
      list.push({
        registrationId: m.id,
        registrationCode: m.registration_code,
        fullName: m.full_name,
        whatsappNumber: normalized,
        wingLabel: m.organization_wing === 'durga_vahini' ? 'Durga Vahini' : 'Bajrang Dal',
        membershipStatus: m.membership_status,
        whatsappConsent: m.whatsapp_consent === 1,
        source: 'member',
      });
    }

    if (manualConsentConfirmed) {
      for (const c of validManualContacts) {
        if (seenPhones.has(c.normalized)) continue;
        seenPhones.add(c.normalized);
        list.push({
          registrationId: null,
          fullName: c.name || 'Member',
          whatsappNumber: c.normalized,
          wingLabel: 'Bajrang Dal / VHP',
          whatsappConsent: true,
          source: 'manual',
        });
      }
    }

    return list;
  }, [allConsentedMembers, selectedIds, validManualContacts, manualConsentConfirmed]);

  const toggleRecipient = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const allFilteredSelected =
    filteredConsentedMembers.length > 0 &&
    filteredConsentedMembers.every((m) => selectedIds.includes(m.id));

  const toggleSelectFiltered = () => {
    const filteredIds = filteredConsentedMembers.map((m) => m.id);
    if (allFilteredSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const addSingleManualNumber = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = manualPhoneInput.trim();
    if (!raw) {
      onBanner('error', 'Enter a mobile or WhatsApp number first.');
      return;
    }
    const normalized = normalizePhoneClient(raw);
    const valid = isValidPhoneClient(normalized);
    if (!valid) {
      onBanner('error', 'Please enter a valid 10-digit Indian mobile number (e.g. 9876543210) or include country code.');
      return;
    }
    if (manualContacts.some((c) => c.normalized === normalized)) {
      onBanner('error', `${formatReadablePhone(normalized)} is already added.`);
      return;
    }
    setManualContacts((prev) => [
      ...prev,
      {
        id: `${normalized}-${Date.now()}`,
        name: manualNameInput.trim() || 'Direct Contact',
        rawInput: raw,
        normalized,
        valid: true,
      },
    ]);
    setManualPhoneInput('');
    setManualNameInput('');
  };

  const handleParseBulkNumbers = () => {
    const entries = bulkPhonesInput
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (entries.length === 0) {
      onBanner('error', 'Paste one or more phone numbers separated by commas or new lines.');
      return;
    }
    const existingSet = new Set(manualContacts.map((c) => c.normalized));
    const added: ManualContact[] = [];
    let invalidCount = 0;
    let duplicateCount = 0;

    entries.forEach((entry, idx) => {
      const normalized = normalizePhoneClient(entry);
      const valid = isValidPhoneClient(normalized);
      if (!valid) {
        invalidCount++;
        return;
      }
      if (existingSet.has(normalized)) {
        duplicateCount++;
        return;
      }
      existingSet.add(normalized);
      added.push({
        id: `${normalized}-${Date.now()}-${idx}`,
        name: 'Direct Contact',
        rawInput: entry,
        normalized,
        valid: true,
      });
    });

    if (added.length > 0) {
      setManualContacts((prev) => [...prev, ...added]);
      setBulkPhonesInput('');
      setShowBulkBox(false);
    }

    if (added.length === 0) {
      onBanner(
        'error',
        invalidCount > 0
          ? `Could not add numbers: ${invalidCount} invalid format(s), ${duplicateCount} duplicate(s).`
          : 'All entered numbers are already in the list.'
      );
    } else {
      onBanner(
        'success',
        `Added ${added.length} valid number(s)${invalidCount ? `, skipped ${invalidCount} invalid` : ''}${duplicateCount ? `, ${duplicateCount} duplicate` : ''}.`
      );
    }
  };

  const insertPlaceholder = (tokenStr: string) => {
    setCustomMessage((prev) => (prev ? `${prev}${prev.endsWith(' ') || prev.endsWith('\n') ? '' : ' '}${tokenStr}` : tokenStr));
  };

  const handleCopyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 2000);
    } catch {
      onBanner('error', 'Unable to copy to clipboard on this browser.');
    }
  };

  const openConfirmCheck = () => {
    if (templateType === 'custom' && !customMessage.trim()) {
      onBanner('error', 'Please write your custom WhatsApp message before sending.');
      return;
    }
    if (validManualContacts.length > 0 && !manualConsentConfirmed) {
      onBanner('error', 'Please confirm WhatsApp opt-in consent for manually added phone numbers.');
      setRecipientTab('manual');
      return;
    }
    if (unifiedRecipients.length === 0) {
      onBanner('error', 'Select at least one opted-in member or add a valid WhatsApp phone number.');
      return;
    }
    setShowConfirmModal(true);
  };

  const handleDispatch = async (allowDuplicate = false) => {
    if (sending) return;
    setSending(true);
    try {
      const res = await apiJson<{
        results: DispatchResultItem[];
        summary?: DispatchSummary;
      }>('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          language: waLang,
          templateType,
          customMessage: customMessage.trim(),
          eventId: selectedEventId || undefined,
          allowDuplicate,
          recipients: unifiedRecipients.map(({ source: _source, ...r }) => r),
        }),
      });
      setShowConfirmModal(false);
      setDispatchResults(res.results || []);
      setDispatchSummary(res.summary || null);
      await onRefresh();

      const s = res.summary;
      if (s) {
        if (s.sentCount > 0) {
          onBanner('success', `Sent ${s.sentCount} WhatsApp message(s) via Cloud API${s.failedCount ? ` (${s.failedCount} failed)` : ''}.`);
        } else if (s.directReadyCount > 0) {
          onBanner('success', `Prepared ${s.directReadyCount} Direct WhatsApp message(s). Tap "Open WA" below to send immediately.`);
        } else if (s.skippedDuplicateCount > 0) {
          onBanner('error', `Skipped ${s.skippedDuplicateCount} duplicate message(s) sent within the last 60 seconds.`);
        } else if (s.failedCount > 0) {
          onBanner('error', `${s.failedCount} message(s) failed to deliver. Check the error details below.`);
        }
      } else {
        onBanner('success', `Processed WhatsApp messages for ${res.results.length} recipient(s).`);
      }
    } catch (err) {
      setShowConfirmModal(false);
      onBanner('error', err instanceof Error ? err.message : 'Failed to process WhatsApp messages.');
    } finally {
      setSending(false);
    }
  };

  const handleRetrySingleLog = async (logId: string) => {
    setRetryingLogId(logId);
    try {
      const outcome = await apiJson<{
        status: string;
        error?: string;
        waMeUrl: string;
      }>(`/api/whatsapp/logs/${logId}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await onRefresh();
      if (outcome.status === 'sent') {
        onBanner('success', 'WhatsApp message delivered via Cloud API.');
      } else if (outcome.status === 'queued_unconfigured') {
        onBanner('success', 'Cloud API is not active; use the Open WA link to send directly via WhatsApp.');
      } else {
        onBanner('error', outcome.error || 'Retry failed. Please check the number or network.');
      }
    } catch (err) {
      onBanner('error', err instanceof Error ? err.message : 'Retry failed.');
    } finally {
      setRetryingLogId(null);
    }
  };

  const filteredLogs = useMemo(() => {
    if (historyFilter === 'all') return notificationLogs;
    return notificationLogs.filter((nl) => nl.delivery_status === historyFilter);
  }, [notificationLogs, historyFilter]);

  return (
    <div className="space-y-6">
      {/* Mode Info Banner */}
      <div
        className={`rounded-2xl border px-4 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${
          whatsappConfigured
            ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20'
            : 'border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20'
        }`}
      >
        <div className="flex items-start sm:items-center gap-2.5">
          <MessageCircle
            className={`w-5 h-5 shrink-0 mt-0.5 sm:mt-0 ${
              whatsappConfigured ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
            }`}
          />
          <div className="text-xs sm:text-sm">
            <span className="font-bold text-slate-900 dark:text-white">
              {whatsappConfigured ? 'Meta WhatsApp Cloud API Connected' : 'Direct WhatsApp Mode (Instant One-Tap Send)'}
            </span>
            <p className="text-slate-600 dark:text-slate-300 mt-0.5">
              {whatsappConfigured
                ? 'Messages dispatch automatically in the background and log delivery IDs.'
                : 'Cloud API tokens are optional. Compose below to generate ready-to-send 1-tap WhatsApp links & keep full audit logs.'}
            </p>
          </div>
        </div>
        <span
          className={`self-start sm:self-auto px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 ${
            whatsappConfigured
              ? 'bg-emerald-700 text-white'
              : 'bg-amber-700 text-white'
          }`}
        >
          {whatsappConfigured ? 'Automated API' : 'Direct wa.me Ready'}
        </span>
      </div>

      {/* Main Composer & Recipient Workspace */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Compose + Live Preview */}
          <div className="lg:col-span-7 space-y-5">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                1. Compose Message
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose language, pick a ready template or custom text, and review the live preview.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Language
                </label>
                <div className="grid grid-cols-3 rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-[#FAF9F6] dark:bg-slate-800">
                  {[
                    { id: 'gu' as const, label: 'ગુજરાતી' },
                    { id: 'hi' as const, label: 'हिन्दी' },
                    { id: 'en' as const, label: 'English' },
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setWaLang(l.id)}
                      className={`min-h-[34px] text-xs font-semibold rounded-lg cursor-pointer transition ${
                        waLang === l.id
                          ? 'bg-orange-600 text-white shadow-sm'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Message Template
                </label>
                <select
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value as WhatsAppTemplateType)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-base sm:text-xs font-medium text-slate-900 dark:text-white"
                >
                  <option value="event_announcement">Event Announcement</option>
                  <option value="registration_confirmation">Registration Confirmation</option>
                  <option value="event_reminder">Event Reminder</option>
                  <option value="membership_update">Membership Update</option>
                  <option value="custom">Custom Message Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Link Event (Optional)
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-base sm:text-xs font-medium text-slate-900 dark:text-white"
                >
                  <option value="">None selected</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {templateType === 'custom'
                    ? 'Custom Message (Required)'
                    : 'Additional Note (Optional — appended to template)'}
                </label>
                <div className="flex flex-wrap items-center gap-1">
                  {[
                    { token: '{name}', label: '+ Name' },
                    { token: '{code}', label: '+ ID' },
                    { token: '{wing}', label: '+ Wing' },
                    { token: '{event_title}', label: '+ Event' },
                  ].map((chip) => (
                    <button
                      key={chip.token}
                      type="button"
                      onClick={() => insertPlaceholder(chip.token)}
                      className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:border-orange-400 cursor-pointer"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={4}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder={
                  templateType === 'custom'
                    ? 'Write your message in Gujarati, Hindi, or English...'
                    : 'Optional note or venue instructions to include in the template...'
                }
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white focus:border-orange-500 focus:outline-none"
              />
            </div>

            {/* Live WhatsApp Bubble Preview */}
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-[#ECE5DD] dark:bg-emerald-950/30 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Live Preview ({waLang.toUpperCase()})</span>
                </p>
                <button
                  type="button"
                  onClick={() => handleCopyText(previewText, 'preview')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/90 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  {copiedId === 'preview' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Preview</span>
                    </>
                  )}
                </button>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-3.5 shadow-sm">
                <pre className="text-xs sm:text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap font-sans leading-relaxed">
                  {previewText}
                </pre>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Select Members OR Add Direct Phone Numbers */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  2. Select Recipients
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pick registered members or enter phone numbers directly.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold shrink-0">
                {unifiedRecipients.length} Ready
              </span>
            </div>

            {/* Recipient Source Switch */}
            <div className="grid grid-cols-2 rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-[#FAF9F6] dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setRecipientTab('members')}
                className={`min-h-[38px] rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition ${
                  recipientTab === 'members'
                    ? 'bg-slate-900 dark:bg-orange-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Members ({selectedIds.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setRecipientTab('manual')}
                className={`min-h-[38px] rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition ${
                  recipientTab === 'manual'
                    ? 'bg-slate-900 dark:bg-orange-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Direct Numbers ({validManualContacts.length})</span>
              </button>
            </div>

            {recipientTab === 'members' ? (
              <div className="space-y-3 flex-1 flex flex-col">
                {/* Search & Wing Filter */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search name, phone, city..."
                      className="w-full min-h-[40px] pl-9 pr-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <select
                    value={wingFilter}
                    onChange={(e) =>
                      setWingFilter(e.target.value as 'all' | 'bajrang_dal' | 'durga_vahini')
                    }
                    className="min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-base sm:text-xs text-slate-900 dark:text-white"
                  >
                    <option value="all">All Wings</option>
                    <option value="bajrang_dal">Bajrang Dal</option>
                    <option value="durga_vahini">Durga Vahini</option>
                  </select>
                </div>

                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-slate-500 inline-flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{filteredConsentedMembers.length} opted-in shown</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={toggleSelectFiltered}
                      disabled={filteredConsentedMembers.length === 0}
                      className="font-semibold text-orange-700 dark:text-orange-400 hover:underline disabled:opacity-40 cursor-pointer"
                    >
                      {allFilteredSelected ? 'Deselect Shown' : 'Select All Shown'}
                    </button>
                    {selectedIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedIds([])}
                        className="font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                      >
                        Clear ({selectedIds.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {filteredConsentedMembers.length === 0 ? (
                    <p className="p-6 text-xs text-slate-500 text-center">
                      No WhatsApp-consented members match your search.
                    </p>
                  ) : (
                    filteredConsentedMembers.map((m) => {
                      const checked = selectedIds.includes(m.id);
                      const norm = normalizePhoneClient(m.whatsapp_number || m.mobile);
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs cursor-pointer transition ${
                            checked
                              ? 'bg-orange-50/70 dark:bg-orange-950/25'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRecipient(m.id)}
                              className="h-4 w-4 rounded border-slate-300 text-orange-600 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white truncate">
                                {m.full_name}
                              </p>
                              <p className="font-mono text-[11px] text-slate-500 truncate">
                                {formatReadablePhone(norm)} ·{' '}
                                {m.organization_wing === 'durga_vahini' ? 'Durga Vahini' : 'Bajrang Dal'}
                                {m.district ? ` · ${m.district}` : ''}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {m.registration_code}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3 flex-1 flex flex-col">
                <form onSubmit={addSingleManualNumber} className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={manualNameInput}
                      onChange={(e) => setManualNameInput(e.target.value)}
                      placeholder="Name (optional)"
                      className="min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-base sm:text-xs text-slate-900 dark:text-white"
                    />
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        value={manualPhoneInput}
                        onChange={(e) => setManualPhoneInput(e.target.value)}
                        placeholder="10-digit WhatsApp no."
                        className="flex-1 min-w-0 min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-mono text-base sm:text-xs text-slate-900 dark:text-white"
                      />
                      <button
                        type="submit"
                        className="min-h-[40px] px-3.5 rounded-xl bg-slate-900 dark:bg-orange-600 text-white text-xs font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                </form>

                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setShowBulkBox((v) => !v)}
                    className="font-semibold text-orange-700 dark:text-orange-400 hover:underline cursor-pointer"
                  >
                    {showBulkBox ? 'Hide bulk paste box' : '+ Paste multiple numbers at once'}
                  </button>
                  {manualContacts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setManualContacts([])}
                      className="font-semibold text-slate-500 hover:text-red-600 cursor-pointer"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {showBulkBox && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 space-y-2">
                    <textarea
                      rows={3}
                      value={bulkPhonesInput}
                      onChange={(e) => setBulkPhonesInput(e.target.value)}
                      placeholder="Paste numbers separated by commas or new lines (e.g. 9876543210, +919825012345)"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-xs text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleParseBulkNumbers}
                      className="min-h-[36px] px-3.5 rounded-lg bg-slate-900 dark:bg-orange-600 text-white text-xs font-semibold cursor-pointer"
                    >
                      Validate & Add Numbers
                    </button>
                  </div>
                )}

                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {manualContacts.length === 0 ? (
                    <p className="p-5 text-xs text-slate-500 text-center">
                      No direct phone numbers added yet. Enter a 10-digit number above.
                    </p>
                  ) : (
                    manualContacts.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-2 px-3.5 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">
                            {c.name}
                          </p>
                          <p className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                            {formatReadablePhone(c.normalized)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setManualContacts((prev) => prev.filter((item) => item.id !== c.id))
                          }
                          title="Remove number"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {manualContacts.length > 0 && (
                  <label className="flex items-start gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={manualConsentConfirmed}
                      onChange={(e) => setManualConsentConfirmed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 shrink-0"
                    />
                    <span>
                      I confirm these manually added recipients have consented to receive WhatsApp updates from the organization.
                    </span>
                  </label>
                )}
              </div>
            )}

            {/* Primary Send Action */}
            <div className="pt-2">
              <button
                type="button"
                onClick={openConfirmCheck}
                disabled={sending || unifiedRecipients.length === 0}
                className="w-full min-h-[46px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer transition"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>
                  Review & Send ({unifiedRecipients.length} Recipient{unifiedRecipients.length === 1 ? '' : 's'})
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Dispatch Results & Action Cards */}
        {dispatchResults.length > 0 && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-[#FAF9F6] dark:bg-slate-800/60 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Delivery Status & Direct WhatsApp Links
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Duplicates are automatically prevented. Tap &ldquo;Open WA&rdquo; to launch any message directly in WhatsApp.
                </p>
              </div>
              {dispatchSummary && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                  {dispatchSummary.sentCount > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      {dispatchSummary.sentCount} Sent
                    </span>
                  )}
                  {dispatchSummary.directReadyCount > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                      {dispatchSummary.directReadyCount} Ready for Direct WA
                    </span>
                  )}
                  {dispatchSummary.failedCount > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
                      {dispatchSummary.failedCount} Failed
                    </span>
                  )}
                  {dispatchSummary.skippedDuplicateCount > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      {dispatchSummary.skippedDuplicateCount} Duplicate Skipped
                    </span>
                  )}
                </div>
              )}
            </div>

            {dispatchSummary && dispatchSummary.skippedDuplicateCount > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs">
                <span className="text-slate-600 dark:text-slate-300">
                  Duplicate protection prevented sending the exact same message twice within 60 seconds.
                </span>
                <button
                  type="button"
                  onClick={() => handleDispatch(true)}
                  disabled={sending}
                  className="self-start sm:self-auto px-3 py-1.5 rounded-lg border border-orange-300 text-orange-700 dark:text-orange-300 font-semibold hover:bg-orange-50 dark:hover:bg-orange-950/30 cursor-pointer"
                >
                  Send Again Anyway
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {dispatchResults.map((r, i) => {
                const badge = getStatusBadge(r.status);
                return (
                  <div
                    key={`${r.recipient}-${i}`}
                    className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                          {r.fullName}
                        </p>
                        <p className="font-mono text-[11px] text-slate-500">
                          {formatReadablePhone(r.recipient)}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>

                    {r.status === 'failed' && r.error && (
                      <p className="text-[11px] text-red-600 dark:text-red-400 flex items-start gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{r.error}</span>
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                      {r.messageText && (
                        <button
                          type="button"
                          onClick={() => handleCopyText(r.messageText!, `res-${i}`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          {copiedId === `res-${i}` ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      )}
                      {r.waMeUrl && (
                        <a
                          href={r.waMeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                        >
                          <span>Open WA</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Super Admin Alert Settings & Filterable Message History */}
      {isSuper && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Automated Admin Alert Settings & Delivery History
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure instant registration alerts and track or retry previously sent messages.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-8 space-y-3">
              <label className="flex items-center gap-2.5 text-sm text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={globalNotifyEnabled}
                  onChange={(e) => setGlobalNotifyEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-orange-600"
                />
                <span>Enable Instant WhatsApp Admin Alerts on New Registrations</span>
              </label>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Extra Admin WhatsApp Numbers (comma-separated, e.g. 9638236795 or 919638236795)
                </label>
                <input
                  type="text"
                  value={extraNumbersText}
                  onChange={(e) => setExtraNumbersText(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-base sm:text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="md:col-span-4 flex md:justify-end">
              <button
                type="button"
                onClick={onSaveSettings}
                disabled={savingSettings}
                className="w-full md:w-auto min-h-[42px] px-5 py-2 rounded-xl bg-slate-900 dark:bg-orange-600 text-white text-xs sm:text-sm font-semibold cursor-pointer"
              >
                {savingSettings ? 'Saving...' : 'Save Alert Settings'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            {/* Message History */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5">
                  <History className="w-4 h-4 text-orange-600" />
                  <span>WhatsApp Message History ({filteredLogs.length})</span>
                </h4>
                <div className="flex items-center gap-1">
                  {[
                    { id: 'all' as const, label: 'All' },
                    { id: 'sent' as const, label: 'Sent' },
                    { id: 'queued_unconfigured' as const, label: 'Direct WA' },
                    { id: 'failed' as const, label: 'Failed' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setHistoryFilter(f.id)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                        historyFilter === f.id
                          ? 'bg-slate-900 dark:bg-orange-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                {filteredLogs.length === 0 ? (
                  <p className="p-5 text-xs text-slate-500 text-center">
                    No messages found in this filter.
                  </p>
                ) : (
                  filteredLogs.map((nl) => {
                    const badge = getStatusBadge(nl.delivery_status);
                    const normalizedRecipient = normalizePhoneClient(nl.recipient_whatsapp);
                    const waUrl = isValidPhoneClient(normalizedRecipient)
                      ? `https://wa.me/${normalizedRecipient}?text=${encodeURIComponent(nl.message_preview)}`
                      : '';
                    return (
                      <div key={nl.id} className="p-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-mono font-semibold text-slate-900 dark:text-white">
                              {formatReadablePhone(normalizedRecipient) || nl.recipient_whatsapp}
                            </span>
                            <span className="text-slate-400">
                              {' '}
                              · {(nl.language || 'en').toUpperCase()}
                              {nl.registrant_name ? ` · ${nl.registrant_name}` : ''}
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ${badge.className}`}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 line-clamp-2">
                          {nl.message_preview}
                        </p>
                        {nl.delivery_status === 'failed' && nl.error_message && (
                          <p className="text-[11px] text-red-600 dark:text-red-400">
                            {nl.error_message}
                          </p>
                        )}
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span className="font-mono text-[10px] text-slate-400">
                            {new Date(nl.created_at).toLocaleString('en-IN', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                          <div className="flex items-center gap-3">
                            {waUrl && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold hover:underline"
                              >
                                <span>Open WA</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            {nl.delivery_status !== 'sent' && (
                              <button
                                type="button"
                                onClick={() => handleRetrySingleLog(nl.id)}
                                disabled={retryingLogId === nl.id}
                                className="inline-flex items-center gap-1 text-orange-700 dark:text-orange-400 font-semibold disabled:opacity-50 cursor-pointer"
                              >
                                {retryingLogId === nl.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RotateCcw className="w-3 h-3" />
                                )}
                                <span>Retry</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Admin Activity & Device Sync Logs */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Admin Activity & Sync Logs ({auditLogs.length + syncLogs.length})
              </h4>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                {auditLogs.length === 0 ? (
                  <p className="p-5 text-xs text-slate-500 text-center">No activity logs yet.</p>
                ) : (
                  auditLogs.slice(0, 25).map((al) => (
                    <div key={al.id} className="p-3 text-xs flex items-center justify-between gap-2">
                      <div className="min-w-0 truncate">
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">
                          {al.action}
                        </span>
                        <span className="text-slate-500"> · {al.actor_name || 'Public'}</span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400 shrink-0">
                        {new Date(al.created_at).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Before Sending */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Confirm WhatsApp Dispatch
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Review recipients and message text before sending.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={sending}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 rounded-xl bg-[#FAF9F6] dark:bg-slate-800 p-3 text-xs">
              <div>
                <span className="text-slate-500 block">Total Unique Recipients</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {unifiedRecipients.length} Recipient(s)
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Language / Template</span>
                <span className="font-bold text-slate-900 dark:text-white uppercase">
                  {waLang} · {templateType.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Sample Message Preview:
              </p>
              <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3">
                <pre className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                  {previewText}
                </pre>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={sending}
                className="min-h-[42px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={() => handleDispatch(false)}
                disabled={sending}
                className="min-h-[42px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{sending ? 'Sending...' : 'Confirm & Send Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
