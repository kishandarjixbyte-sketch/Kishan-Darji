import React, { useMemo, useState } from 'react';
import {
  Send,
  MessageCircle,
  Loader2,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
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

const PREVIEW_TEMPLATES: Record<WhatsAppLanguage, Record<WhatsAppTemplateType, string>> = {
  gu: {
    event_announcement:
      'જય શ્રી રામ {name},\n{wing} દ્વારા નવો કાર્યક્રમ જાહેર કરવામાં આવ્યો છે:\nકાર્યક્રમ: {event_title}\nતારીખ: {event_date}\nસ્થળ: {venue}\n\nવધુ વિગતો માટે સત્તાવાર પોર્ટલની મુલાકાત લો.',
    registration_confirmation:
      'નમસ્તે {name},\n{wing} માં તમારી નોંધણી સફળતાપૂર્વક પ્રાપ્ત થઈ છે.\nરજીસ્ટ્રેશન ID: {code}\nચકાસણી પછી તમારું ડિજિટલ મેમ્બરશિપ કાર્ડ સક્રિય થશે.',
    event_reminder:
      'સ્મૃતિ સંદેશ – {name},\nઆગામી કાર્યક્રમ "{event_title}" માં તમારી હાજરી અપેક્ષિત છે.\nતારીખ: {event_date}\nસ્થળ: {venue}',
    membership_update:
      'જય શ્રી રામ {name},\n{wing} સભ્યપદ અરજી ({code}) ની વર્તમાન સ્થિતિ અપડેટ કરવામાં આવી છે.',
    custom: '',
  },
  hi: {
    event_announcement:
      'जय श्री राम {name},\n{wing} द्वारा आगामी कार्यक्रम की सूचना:\nकार्यक्रम: {event_title}\nदिनांक: {event_date}\nस्थान: {venue}\n\nअधिक जानकारी के लिए आधिकारिक पोर्टल देखें।',
    registration_confirmation:
      'नमस्ते {name},\n{wing} में आपका पंजीकरण सफलतापूर्वक दर्ज कर लिया गया है।\nपंजीकरण ID: {code}\nसत्यापन पूर्ण होने पर आपका डिजिटल सदस्यता कार्ड सक्रिय हो जाएगा।',
    event_reminder:
      'स्मरण सूचना – {name},\nआगामी कार्यक्रम "{event_title}" के लिए अनुस्मारक:\nदिनांक: {event_date}\nस्थान: {venue}',
    membership_update:
      'जय श्री राम {name},\n{wing} सदस्यता आवेदन ({code}) की अद्यतन स्थिति पोर्टल पर उपलब्ध है।',
    custom: '',
  },
  en: {
    event_announcement:
      'Namaste {name},\n{wing} invites you to an upcoming program:\nEvent: {event_title}\nDate: {event_date}\nVenue: {venue}\n\nPlease visit the official portal for details.',
    registration_confirmation:
      'Namaste {name},\nYour registration with {wing} has been received successfully.\nRegistration ID: {code}\nYour Digital Identity Card activates upon verification.',
    event_reminder:
      'Event Reminder – {name},\nThis is a reminder for "{event_title}".\nDate: {event_date}\nVenue: {venue}',
    membership_update:
      'Namaste {name},\nYour {wing} membership application ({code}) status has been updated.',
    custom: '',
  },
};

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
  onRetryNotification,
  onBanner,
  onRefresh,
}) => {
  const [waLang, setWaLang] = useState<WhatsAppLanguage>('gu');
  const [templateType, setTemplateType] = useState<WhatsAppTemplateType>(
    preselectedEventId ? 'event_announcement' : 'registration_confirmation'
  );
  const [selectedEventId, setSelectedEventId] = useState(preselectedEventId || '');
  const [customMessage, setCustomMessage] = useState('');
  const [wingFilter, setWingFilter] = useState<'all' | 'bajrang_dal' | 'durga_vahini'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [dispatchResults, setDispatchResults] = useState<
    Array<{ fullName: string; recipient: string; status: string; waMeUrl: string; error?: string }>
  >([]);

  const consentedMembers = useMemo(
    () =>
      registrations.filter((r) => {
        if (r.whatsapp_consent !== 1) return false;
        if (wingFilter !== 'all' && r.organization_wing !== wingFilter) return false;
        return true;
      }),
    [registrations, wingFilter]
  );

  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;

  const previewText = useMemo(() => {
    const sample = consentedMembers[0] || registrations[0];
    const name = sample?.full_name || 'Member Name';
    const code = sample?.registration_code || 'JBD-2026-1001';
    const wing = sample?.organization_wing === 'durga_vahini' ? 'Durga Vahini' : 'Bajrang Dal';
    const evTitle = selectedEvent?.title || 'Upcoming Seva Program';
    const evDate = selectedEvent ? `${selectedEvent.event_date} ${selectedEvent.event_time}` : 'TBA';
    const evVenue = selectedEvent ? `${selectedEvent.venue} ${selectedEvent.location_city}` : 'District Office';

    const raw =
      templateType === 'custom'
        ? customMessage || 'Type your custom Gujarati, Hindi, or English message above...'
        : PREVIEW_TEMPLATES[waLang][templateType];

    return raw
      .replace(/\{name\}/gi, name)
      .replace(/\{code\}/gi, code)
      .replace(/\{wing\}/gi, wing)
      .replace(/\{event_title\}/gi, evTitle)
      .replace(/\{event_date\}/gi, evDate)
      .replace(/\{venue\}/gi, evVenue);
  }, [waLang, templateType, customMessage, selectedEvent, consentedMembers, registrations]);

  const toggleRecipient = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllConsented = () => {
    if (selectedIds.length === consentedMembers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(consentedMembers.map((m) => m.id));
    }
  };

  const handleDispatch = async () => {
    const chosen = consentedMembers.filter((m) => selectedIds.includes(m.id));
    if (chosen.length === 0) {
      onBanner('error', 'Select at least one WhatsApp-consented recipient.');
      return;
    }
    setSending(true);
    try {
      const res = await apiJson<{
        results: Array<{ fullName: string; recipient: string; status: string; waMeUrl: string; error?: string }>;
      }>('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          language: waLang,
          templateType,
          customMessage,
          eventId: selectedEventId || undefined,
          recipients: chosen.map((m) => ({
            registrationId: m.id,
            registrationCode: m.registration_code,
            fullName: m.full_name,
            whatsappNumber: m.whatsapp_number || m.mobile,
            wingLabel: m.organization_wing === 'durga_vahini' ? 'Durga Vahini' : 'Bajrang Dal',
            membershipStatus: m.membership_status,
            whatsappConsent: m.whatsapp_consent === 1,
          })),
        }),
      });
      setDispatchResults(res.results || []);
      await onRefresh();
      onBanner('success', `Processed WhatsApp messages for ${res.results.length} consented recipients.`);
    } catch (err) {
      onBanner('error', err instanceof Error ? err.message : 'Failed to send WhatsApp campaign.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Multilingual Campaign Composer */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Multilingual WhatsApp Messaging Center
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Send messages in Gujarati, Hindi, or English strictly to opted-in members who gave WhatsApp consent.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
            API Status: {whatsappConfigured ? 'Meta Cloud API Active' : 'Direct wa.me + Queued Mode'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Language, Template & Message Composer */}
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  1. Select Language
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
                      className={`py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                        waLang === l.id ? 'bg-orange-600 text-white' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  2. Template Type
                </label>
                <select
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value as WhatsAppTemplateType)}
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-white"
                >
                  <option value="event_announcement">Event Announcement</option>
                  <option value="registration_confirmation">Registration Confirmation</option>
                  <option value="event_reminder">Event Reminder</option>
                  <option value="membership_update">Membership Update</option>
                  <option value="custom">Custom Message</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  3. Link Event (Optional)
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-white"
                >
                  <option value="">None</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Custom Message / Additional Note (supports {'{name}'}, {'{code}'}, {'{wing}'}, {'{event_title}'})
              </label>
              <textarea
                rows={4}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Write a custom message or note to append..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white"
              />
            </div>

            {/* Live Preview */}
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 space-y-1.5">
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Live Preview ({waLang.toUpperCase()})</span>
              </p>
              <pre className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                {previewText}
              </pre>
            </div>
          </div>

          {/* Right: Consented Recipient Picker */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Opted-In Recipients ({consentedMembers.length})</span>
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={wingFilter}
                  onChange={(e) => setWingFilter(e.target.value as 'all' | 'bajrang_dal' | 'durga_vahini')}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs"
                >
                  <option value="all">All Wings</option>
                  <option value="bajrang_dal">Bajrang Dal</option>
                  <option value="durga_vahini">Durga Vahini</option>
                </select>
                <button
                  type="button"
                  onClick={selectAllConsented}
                  className="text-xs font-semibold text-orange-700 dark:text-orange-400 underline cursor-pointer"
                >
                  {selectedIds.length === consentedMembers.length ? 'Clear' : 'Select All'}
                </button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {consentedMembers.length === 0 ? (
                <p className="p-4 text-xs text-slate-500 text-center">
                  No members with active WhatsApp consent found in this filter.
                </p>
              ) : (
                consentedMembers.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(m.id)}
                        onChange={() => toggleRecipient(m.id)}
                        className="rounded border-slate-300 text-orange-600"
                      />
                      <div className="truncate">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">{m.full_name}</p>
                        <p className="font-mono text-[11px] text-slate-500">
                          {m.whatsapp_number || m.mobile} · {m.organization_wing === 'durga_vahini' ? 'DV' : 'BD'}
                        </p>
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={handleDispatch}
              disabled={sending || selectedIds.length === 0}
              className="w-full min-h-[44px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Send to {selectedIds.length} Opted-In Member(s)</span>
            </button>
          </div>
        </div>

        {dispatchResults.length > 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-[#FAF9F6] dark:bg-slate-800 p-4 space-y-2">
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              Dispatch Results & Direct WhatsApp Links
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {dispatchResults.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{r.fullName}</p>
                    <p className="font-mono text-[11px] text-slate-500">
                      {r.recipient} · {r.status}
                    </p>
                  </div>
                  <a
                    href={r.waMeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold shrink-0 hover:underline"
                  >
                    <span>Open WA</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Super Admin Alert Settings & Logs */}
      {isSuper && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Automated Admin Alert Routing & Delivery Logs
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div className="space-y-3">
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
                  Extra Admin WhatsApp Numbers (comma-separated, e.g. 919638236795)
                </label>
                <input
                  type="text"
                  value={extraNumbersText}
                  onChange={(e) => setExtraNumbersText(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div>
              <button
                type="button"
                onClick={onSaveSettings}
                disabled={savingSettings}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-slate-900 dark:bg-orange-600 text-white text-xs sm:text-sm font-semibold cursor-pointer"
              >
                {savingSettings ? 'Saving...' : 'Save Alert Configuration'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                WhatsApp Message History ({notificationLogs.length})
              </h4>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                {notificationLogs.length === 0 ? (
                  <p className="p-4 text-xs text-slate-500">No message logs recorded yet.</p>
                ) : (
                  notificationLogs.map((nl) => (
                    <div key={nl.id} className="p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">
                          {nl.recipient_whatsapp} · {(nl.language || 'en').toUpperCase()}
                        </span>
                        <span className="font-mono text-slate-500">{nl.delivery_status}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 line-clamp-2">{nl.message_preview}</p>
                      {nl.registration_id && nl.delivery_status !== 'sent' && (
                        <button
                          type="button"
                          onClick={() => onRetryNotification(nl.registration_id!)}
                          className="inline-flex items-center gap-1 text-orange-700 dark:text-orange-400 font-semibold cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Resend</span>
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Admin Activity & Device Sync Logs ({auditLogs.length + syncLogs.length})
              </h4>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                {auditLogs.slice(0, 20).map((al) => (
                  <div key={al.id} className="p-3 text-xs flex items-center justify-between gap-2">
                    <div>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">{al.action}</span>
                      <span className="text-slate-500"> · {al.actor_name || 'Public'}</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400">
                      {new Date(al.created_at).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
