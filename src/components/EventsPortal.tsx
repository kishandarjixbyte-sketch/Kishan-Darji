import React, { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  MapPin,
  Users,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  CalendarPlus,
} from 'lucide-react';
import type { CaptchaChallenge, EventItem, EventRegistrationItem, Language } from '../types';
import { apiJson, buildApiUrl } from '../lib/apiClient';
import eventGatheringImg from '../assets/images/event_cultural_gathering_1795154369841.jpg';

interface Props {
  lang: Language;
  events: EventItem[];
  selectedSlug: string | null;
  onSelectSlug: (slug: string | null) => void;
  onRefreshEvents: () => void;
  onBackHome: () => void;
  isAdminSession: boolean;
  onOpenAdminEvents: () => void;
}

export const EventsPortal: React.FC<Props> = ({
  events,
  selectedSlug,
  onSelectSlug,
  onRefreshEvents,
  onBackHome,
  isAdminSession,
  onOpenAdminEvents,
}) => {
  const [wingFilter, setWingFilter] = useState<string>('all');
  const [copiedSlug, setCopiedSlug] = useState('');

  // Single event registration form state
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [cityVillage, setCityVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [age, setAge] = useState('22');
  const [wing, setWing] = useState('general');
  const [notes, setNotes] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [whatsappConsent, setWhatsappConsent] = useState(true);
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [receipt, setReceipt] = useState<EventRegistrationItem | null>(null);

  const selectedEvent = selectedSlug
    ? events.find((e) => e.slug === selectedSlug || e.id === selectedSlug) || null
    : null;

  const loadCaptcha = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl('/api/security/captcha'));
      if (res.ok) {
        setCaptcha((await res.json()) as CaptchaChallenge);
        setCaptchaAnswer('');
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      void loadCaptcha();
      setErrorMsg('');
      setReceipt(null);
    }
  }, [selectedEvent, loadCaptcha]);

  const copyEventUrl = async (slug: string) => {
    const url = `${window.location.origin}/?event=${encodeURIComponent(slug)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(''), 2000);
    } catch {
      // ignore
    }
  };

  const handleEventRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    setErrorMsg('');

    const cleanMobile = mobile.replace(/\D/g, '');
    if (fullName.trim().length < 2) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!privacyConsent) {
      setErrorMsg('Please confirm event participation consent.');
      return;
    }
    if (!captcha || !captchaAnswer.trim()) {
      setErrorMsg('Please answer the security math question.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiJson<{ registration: EventRegistrationItem }>(
        `/api/events/${encodeURIComponent(selectedEvent.slug)}/register`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: fullName.trim(),
            mobile: cleanMobile,
            whatsapp_number: whatsapp.replace(/\D/g, '') || cleanMobile,
            email: email.trim(),
            city_village: cityVillage.trim(),
            district: district.trim(),
            age: Number(age) || 18,
            organization_wing: wing,
            notes: notes.trim(),
            privacy_consent: privacyConsent,
            whatsapp_consent: whatsappConsent,
            captcha_token: captcha.token,
            captcha_answer: Number(captchaAnswer),
          }),
        }
      );
      setReceipt(res.registration);
      onRefreshEvents();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to complete event registration.');
      void loadCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEvents = events.filter((ev) =>
    wingFilter === 'all' ? true : ev.organization_wing === wingFilter
  );

  // Single Dedicated Event Registration Page (?event=<slug>)
  if (selectedEvent) {
    const seatsAvailable = selectedEvent.stats?.available_seats ?? selectedEvent.max_capacity;
    const isClosed = selectedEvent.registration_enabled !== 1 || seatsAvailable <= 0;

    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onSelectSlug(null)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Events</span>
          </button>

          <button
            type="button"
            onClick={() => copyEventUrl(selectedEvent.slug)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            {copiedSlug === selectedEvent.slug ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Event Link Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Unique Event Link</span>
              </>
            )}
          </button>
        </div>

        {/* Event Poster & Details */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="aspect-[16/7] bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <img
              src={selectedEvent.poster_data || eventGatheringImg}
              alt={selectedEvent.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-mono text-orange-700 dark:text-orange-400">
                {selectedEvent.category} · {selectedEvent.organization_wing.replace('_', ' ').toUpperCase()}
              </p>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedEvent.title}</h1>
              {selectedEvent.description && (
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {selectedEvent.description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Date & Time</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  {selectedEvent.event_date} · {selectedEvent.event_time}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Venue</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {selectedEvent.venue}{selectedEvent.location_city ? `, ${selectedEvent.location_city}` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Registered / Approved</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  {selectedEvent.stats?.total ?? 0} total ({selectedEvent.stats?.approved ?? 0} approved)
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Available Seats</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  {seatsAvailable} / {selectedEvent.max_capacity}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Registration Receipt OR Event Form */}
        {receipt ? (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Event Registration Confirmed
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Your seat pass has been recorded. Save your Pass ID below.
                </p>
              </div>
            </div>
            <div className="rounded-xl bg-[#FAF9F6] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Event Pass ID</span>
                <span className="font-mono text-lg font-bold text-orange-700 dark:text-orange-400">
                  {receipt.registration_code}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Participant Name</span>
                <span className="font-semibold text-slate-900 dark:text-white">{receipt.full_name}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReceipt(null)}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-sm font-semibold cursor-pointer"
            >
              Register Another Participant
            </button>
          </div>
        ) : isClosed ? (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-6 text-center space-y-2">
            <h2 className="text-lg font-bold text-amber-950 dark:text-amber-200">
              Registration Closed or Event Full
            </h2>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              This event is not currently accepting online registrations.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleEventRegister}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
            noValidate
          >
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Register for {selectedEvent.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Direct event entry — existing organization members do not need to re-apply for membership.
              </p>
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 p-3.5 text-sm text-red-800 dark:text-red-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Optional (defaults to mobile)"
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  City / Village
                </label>
                <input
                  type="text"
                  value={cityVillage}
                  onChange={(e) => setCityVillage(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  District
                </label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Age
                </label>
                <input
                  type="number"
                  min={12}
                  max={110}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Wing Affiliation
                </label>
                <select
                  value={wing}
                  onChange={(e) => setWing(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  <option value="general">Community Participant</option>
                  <option value="bajrang_dal">Bajrang Dal</option>
                  <option value="durga_vahini">Durga Vahini</option>
                  <option value="vhp">VHP</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notes / Seva Preference (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="rounded-xl bg-[#FAF9F6] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
                  Security Verification *
                </span>
                <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                  {captcha ? captcha.question : 'Loading...'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  required
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  placeholder="Answer"
                  className="w-24 min-h-[40px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 font-mono text-sm text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => loadCaptcha()}
                  className="min-h-[40px] min-w-[40px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacyConsent}
                  onChange={(e) => setPrivacyConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-600"
                />
                <span>I confirm my participation details and consent to event coordination storage.</span>
              </label>
              <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={whatsappConsent}
                  onChange={(e) => setWhatsappConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-600"
                />
                <span>Send me event reminders and updates via WhatsApp.</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>{submitting ? 'Registering...' : 'Complete Event Registration'}</span>
            </button>
          </form>
        )}
      </div>
    );
  }

  // Events Directory View
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onBackHome}
            className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
          <h1 className="mt-1 text-xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Organization Events & Program Portals
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Every event has its own dedicated registration form and seat availability counter.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAdminEvents}
          className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white cursor-pointer"
        >
          <CalendarPlus className="w-4 h-4" />
          <span>{isAdminSession ? 'Manage / Create Events' : 'Admin: Create Event'}</span>
        </button>
      </div>

      {/* Wing filter tabs */}
      <div className="flex overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-2 pb-1 sm:pb-0">
        {[
          { id: 'all', label: 'All Events' },
          { id: 'bajrang_dal', label: 'Bajrang Dal' },
          { id: 'durga_vahini', label: 'Durga Vahini' },
          { id: 'vhp', label: 'VHP' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setWingFilter(tab.id)}
            className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              wingFilter === tab.id
                ? 'bg-slate-900 dark:bg-orange-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredEvents.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-3">
          <Calendar className="w-10 h-10 text-orange-600 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">No Events Published Yet</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Authorized administrators can create events with posters, schedules, and capacity limits in the Admin Dashboard.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEvents.map((ev) => (
            <div
              key={ev.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="aspect-[16/9] bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <img
                    src={ev.poster_data || eventGatheringImg}
                    alt={ev.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5 space-y-2.5">
                  <p className="text-xs font-mono text-orange-700 dark:text-orange-400">
                    {ev.category} · {ev.organization_wing.replace('_', ' ').toUpperCase()}
                  </p>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{ev.title}</h2>
                  {ev.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                      {ev.description}
                    </p>
                  )}
                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400 pt-1">
                    <p className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono">{ev.event_date} · {ev.event_time}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{ev.venue}{ev.location_city ? `, ${ev.location_city}` : ''}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono">
                        {ev.stats?.total ?? 0} total · {ev.stats?.approved ?? 0} approved ·{' '}
                        {ev.stats?.available_seats ?? ev.max_capacity} seats left
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-5 pb-5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectSlug(ev.slug)}
                  className="flex-1 min-h-[42px] rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm font-semibold cursor-pointer"
                >
                  {ev.registration_enabled === 1 ? 'Open Registration' : 'View Event'}
                </button>
                <button
                  type="button"
                  onClick={() => copyEventUrl(ev.slug)}
                  title="Copy Direct Event Link"
                  className="min-h-[42px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  {copiedSlug === ev.slug ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
