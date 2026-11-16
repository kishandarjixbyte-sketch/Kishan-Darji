import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck, QrCode, ArrowRight } from 'lucide-react';
import type { Language, OccupationType } from '../types';
import { getTranslations } from '../lib/i18n';

interface Props {
  lang: Language;
  source: 'qr_code' | 'direct_link';
  onOpenQr: () => void;
}

interface SubmissionReceipt {
  id: string;
  registration_code: string;
  full_name: string;
  mobile: string;
  age: number;
  occupation: OccupationType;
  created_at: string;
}

function computeAge(dobStr: string): number {
  if (!dobStr) return 0;
  const dob = new Date(dobStr);
  if (Number.isNaN(dob.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export const PublicRegistrationForm: React.FC<Props> = ({ lang, source, onOpenQr }) => {
  const t = getTranslations(lang);

  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [dob, setDob] = useState('');
  const [age, setAge] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [occupation, setOccupation] = useState<OccupationType>('Student');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [whatsappConsent, setWhatsappConsent] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const [emblemError, setEmblemError] = useState(false);

  const maxAdultDob = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().slice(0, 10);
  })();

  const handleDobChange = (value: string) => {
    setDob(value);
    const calculated = computeAge(value);
    if (calculated > 0) {
      setAge(String(calculated));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanName = fullName.trim();
    const cleanMobile = mobile.replace(/\D/g, '');
    const numericAge = Number(age);
    const computedAge = computeAge(dob);

    if (cleanName.length < 2) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number starting with 6-9.');
      return;
    }
    if (!dob || computedAge < 18 || numericAge < 18) {
      setErrorMsg('Only adults aged 18 years or older are eligible to register.');
      return;
    }
    if (Math.abs(computedAge - numericAge) > 1) {
      setErrorMsg('Entered age must match your selected Date of Birth.');
      return;
    }
    if (fullAddress.trim().length < 5) {
      setErrorMsg('Please enter your complete residential address.');
      return;
    }
    if (!privacyConsent) {
      setErrorMsg('Please confirm your age (18+) and accept the privacy consent to proceed.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: cleanName,
          mobile: cleanMobile,
          age: numericAge,
          dob,
          full_address: fullAddress.trim(),
          occupation,
          privacy_consent: privacyConsent,
          whatsapp_consent: whatsappConsent,
          source,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setErrorMsg(data.error || 'Submission failed. Please check your details.');
        return;
      }

      setReceipt(data.registration);
    } catch {
      setErrorMsg('Network unavailable. Please ensure internet connection to submit a new registration.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFullName('');
    setMobile('');
    setDob('');
    setAge('');
    setFullAddress('');
    setOccupation('Student');
    setPrivacyConsent(false);
    setWhatsappConsent(true);
    setErrorMsg('');
    setReceipt(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Column: Editorial Identity & QR Shortcut */}
      <div className="lg:col-span-5 space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-[#FAF9F6] shrink-0 flex items-center justify-center">
              {!emblemError ? (
                <img
                  src="/src/assets/images/organization_emblem_1794820507112.jpg"
                  alt="Join Bajrang Dal Emblem"
                  referrerPolicy="no-referrer"
                  onError={() => setEmblemError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ShieldCheck className="w-8 h-8 text-orange-600" />
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-orange-700 tracking-wide">
                {t.heroKicker}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight text-balance mt-0.5">
                {t.brandTitle}
              </h1>
            </div>
          </div>

          <h2 className="mt-6 text-xl font-semibold text-slate-900 leading-snug text-balance">
            {t.heroTitle}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            {t.heroSubtitle}
          </p>

          <div className="mt-6 pt-6 border-t border-slate-100 space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Eligibility</span>
              <span className="font-medium text-slate-900">Adults 18+ Years Only</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Languages</span>
              <span className="font-medium text-slate-900">English · ગુજરાતી</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Duplicate Guard</span>
              <span className="font-medium text-slate-900">Unique Mobile Verified</span>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <button
              type="button"
              onClick={onOpenQr}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-[#FAF9F6] px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-orange-600" />
              <span>{t.openQrBtn}</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Registration Form or Receipt */}
      <div className="lg:col-span-7">
        {receipt ? (
          <div className="rounded-2xl border border-emerald-200 bg-white p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-700" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{t.successTitle}</h2>
                <p className="mt-1 text-sm text-slate-600">{t.successSubtitle}</p>
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-[#FAF9F6] border border-slate-200 p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <span className="text-xs font-medium text-slate-500">{t.regIdLabel}</span>
                <span className="font-mono text-lg font-bold text-orange-700 tabular-nums">
                  {receipt.registration_code}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-slate-500 block">Full Name</span>
                  <span className="font-medium text-slate-900">{receipt.full_name}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Mobile Number</span>
                  <span className="font-mono font-medium text-slate-900 tabular-nums">{receipt.mobile}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Age · Occupation</span>
                  <span className="font-medium text-slate-900">
                    {receipt.age} yrs · {t.occupations[receipt.occupation]}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Submitted On</span>
                  <span className="font-mono text-slate-800 tabular-nums">
                    {new Date(receipt.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 min-h-[48px] rounded-xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-700 transition-colors cursor-pointer"
              >
                {t.registerAnotherBtn}
              </button>
              <button
                type="button"
                onClick={onOpenQr}
                className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {t.openQrBtn}
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-5"
            noValidate
          >
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-900">{t.formTitle}</h2>
              <p className="mt-1 text-sm text-slate-500">{t.formSubtitle}</p>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
              >
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="reg-fullname" className="block text-sm font-medium text-slate-800 mb-1.5">
                  {t.fullNameLabel}
                </label>
                <input
                  id="reg-fullname"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t.fullNamePlaceholder}
                  className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-600/15"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="reg-mobile" className="block text-sm font-medium text-slate-800 mb-1.5">
                  {t.mobileLabel}
                </label>
                <input
                  id="reg-mobile"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder={t.mobilePlaceholder}
                  className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-base text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-600/15"
                />
              </div>

              <div>
                <label htmlFor="reg-dob" className="block text-sm font-medium text-slate-800 mb-1.5">
                  {t.dobLabel}
                </label>
                <input
                  id="reg-dob"
                  type="date"
                  required
                  max={maxAdultDob}
                  value={dob}
                  onChange={(e) => handleDobChange(e.target.value)}
                  className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-base text-slate-900 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-600/15"
                />
              </div>

              <div>
                <label htmlFor="reg-age" className="block text-sm font-medium text-slate-800 mb-1.5">
                  {t.ageLabel}
                </label>
                <input
                  id="reg-age"
                  type="number"
                  min={18}
                  max={110}
                  required
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="18+"
                  className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-base text-slate-900 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-600/15"
                />
                <p className="mt-1 text-xs text-slate-500">{t.ageHint}</p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-800 mb-1.5">
                  {t.occupationLabel}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {(['Student', 'Job', 'Business', 'Other'] as OccupationType[]).map((occ) => (
                    <button
                      key={occ}
                      type="button"
                      onClick={() => setOccupation(occ)}
                      className={`min-h-[46px] rounded-xl border px-3 py-2.5 text-sm font-medium text-left transition-colors cursor-pointer ${
                        occupation === occ
                          ? 'border-orange-600 bg-orange-50 text-orange-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {t.occupations[occ]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="reg-address" className="block text-sm font-medium text-slate-800 mb-1.5">
                  {t.addressLabel}
                </label>
                <textarea
                  id="reg-address"
                  rows={3}
                  required
                  value={fullAddress}
                  onChange={(e) => setFullAddress(e.target.value)}
                  placeholder={t.addressPlaceholder}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-600/15"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-100">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacyConsent}
                  onChange={(e) => setPrivacyConsent(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-orange-600 focus:ring-orange-600 shrink-0"
                />
                <span className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {t.privacyConsentText}
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={whatsappConsent}
                  onChange={(e) => setWhatsappConsent(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-orange-600 focus:ring-orange-600 shrink-0"
                />
                <span className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {t.whatsappConsentText}
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[52px] rounded-xl bg-orange-600 px-6 py-3.5 text-base font-semibold text-white hover:bg-orange-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t.submittingBtn}</span>
                </>
              ) : (
                <span>{t.submitBtn}</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
