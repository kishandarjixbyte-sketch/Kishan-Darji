import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Upload,
  RefreshCw,
  Lock,
  User,
  FileCheck2,
  ArrowLeft,
  MessageCircle,
} from 'lucide-react';
import type { CaptchaChallenge, Language, OccupationType, OrganizationWing } from '../types';
import { getTranslations } from '../lib/i18n';
import { apiJson, buildApiUrl } from '../lib/apiClient';
import emblemImg from '../assets/images/organization_emblem_1794820507112.jpg';

interface Props {
  wing: OrganizationWing;
  lang: Language;
  onChangeLang: (lang: Language) => void;
  source: 'qr_code' | 'direct_link';
  onBackHome: () => void;
  onSwitchWing: (wing: OrganizationWing) => void;
}

interface SubmissionReceipt {
  id: string;
  registration_code: string;
  organization_wing: OrganizationWing;
  full_name: string;
  mobile: string;
  age: number;
  occupation: OccupationType;
  city_village: string;
  district: string;
  membership_status: string;
  registration_date: string;
  created_at: string;
}

interface MemberConfirmationPayload {
  status: string;
  recipient: string;
  messageText: string;
  waMeUrl: string;
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

async function compressImageDataUrl(file: File, maxDim = 640, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read selected file.'));
    reader.onload = () => {
      const result = String(reader.result || '');
      if (!file.type.startsWith('image/')) {
        resolve(result);
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(result);
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(result);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

export const MembershipRegistrationForm: React.FC<Props> = ({
  wing,
  lang,
  onChangeLang,
  source,
  onBackHome,
  onSwitchWing,
}) => {
  const t = getTranslations(lang);
  const isDv = wing === 'durga_vahini';
  const minAge = isDv ? 15 : 18;
  const todayStr = new Date().toISOString().slice(0, 10);

  const [fullName, setFullName] = useState('');
  const [fatherOrGuardianName, setFatherOrGuardianName] = useState('');
  const [dob, setDob] = useState('');
  const [age, setAge] = useState('');
  const [mobile, setMobile] = useState('');
  const [sameWhatsapp, setSameWhatsapp] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [email, setEmail] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [cityVillage, setCityVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [stateName, setStateName] = useState('Gujarat');
  const [pincode, setPincode] = useState('');
  const [occupation, setOccupation] = useState<OccupationType>('Student');
  const [education, setEducation] = useState('');
  const [registrationDate, setRegistrationDate] = useState(todayStr);

  const [profilePhotoData, setProfilePhotoData] = useState('');
  const [identityDocData, setIdentityDocData] = useState('');
  const [identityDocName, setIdentityDocName] = useState('');

  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [whatsappConsent, setWhatsappConsent] = useState(true);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const [confirmationMsg, setConfirmationMsg] = useState<MemberConfirmationPayload | null>(null);

  const loadCaptcha = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl('/api/security/captcha'));
      if (res.ok) {
        const data = (await res.json()) as CaptchaChallenge;
        setCaptcha(data);
        setCaptchaAnswer('');
      }
    } catch {
      // ignore offline
    }
  }, []);

  useEffect(() => {
    void loadCaptcha();
  }, [loadCaptcha, wing]);

  const maxEligibleDob = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - minAge);
    return d.toISOString().slice(0, 10);
  })();

  const handleDobChange = (value: string) => {
    setDob(value);
    const calculated = computeAge(value);
    if (calculated > 0) setAge(String(calculated));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Profile photo must be an image (JPG, PNG, or WebP).');
      return;
    }
    const compressed = await compressImageDataUrl(file, 500, 0.8);
    setProfilePhotoData(compressed);
  };

  const handleIdentityDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isPdf = file.type === 'application/pdf';
    if (!isPdf && !file.type.startsWith('image/')) {
      setErrorMsg('Identity document must be JPG, PNG, WebP, or PDF.');
      return;
    }
    if (isPdf && file.size > 2_000_000) {
      setErrorMsg('PDF file size must be under 2 MB.');
      return;
    }
    const encoded = await compressImageDataUrl(file, 1024, 0.78);
    setIdentityDocData(encoded);
    setIdentityDocName(file.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanName = fullName.trim();
    const cleanGuardian = fatherOrGuardianName.trim();
    const cleanMobile = mobile.replace(/\D/g, '');
    const cleanWa = sameWhatsapp ? cleanMobile : whatsappNumber.replace(/\D/g, '');
    const numericAge = Number(age);
    const computedAge = computeAge(dob);

    if (cleanName.length < 2) {
      setErrorMsg(lang === 'gu' ? 'કૃપા કરીને તમારું પૂરું નામ લખો.' : 'Please enter your full name.');
      return;
    }
    if (cleanGuardian.length < 2) {
      setErrorMsg(
        isDv
          ? "Please enter your Father's or Guardian's name."
          : "Please enter your Father's name."
      );
      return;
    }
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      setErrorMsg(
        lang === 'gu'
          ? 'કૃપા કરીને માન્ય ૧૦ અંકનો મોબાઈલ નંબર લખો.'
          : 'Please enter a valid 10-digit Indian mobile number starting with 6-9.'
      );
      return;
    }
    if (!dob || computedAge < minAge || numericAge < minAge) {
      setErrorMsg(
        isDv
          ? 'Durga Vahini eligibility requires age 15 years or above.'
          : 'Bajrang Dal adult registration requires age 18 years or above.'
      );
      return;
    }
    if (Math.abs(computedAge - numericAge) > 1) {
      setErrorMsg('Entered age does not match your selected Date of Birth.');
      return;
    }
    if (fullAddress.trim().length < 5 || !cityVillage.trim() || !district.trim()) {
      setErrorMsg('Please complete Full Address, City/Village, and District.');
      return;
    }
    if (!privacyConsent) {
      setErrorMsg('Please accept the age eligibility, Privacy Policy, and verification consent.');
      return;
    }
    if (!captcha || !captchaAnswer.trim()) {
      setErrorMsg('Please solve the math security verification before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiJson<{
        registration: SubmissionReceipt;
        memberConfirmation?: MemberConfirmationPayload | null;
      }>('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_wing: wing,
          full_name: cleanName,
          father_or_guardian_name: cleanGuardian,
          mobile: cleanMobile,
          whatsapp_number: cleanWa,
          email: email.trim(),
          age: numericAge,
          dob,
          full_address: fullAddress.trim(),
          city_village: cityVillage.trim(),
          district: district.trim(),
          state: stateName.trim() || 'Gujarat',
          pincode: pincode.replace(/\D/g, '').slice(0, 6),
          occupation,
          education: education.trim(),
          profile_photo_data: profilePhotoData,
          identity_doc_data: identityDocData,
          identity_doc_name: identityDocName,
          registration_date: registrationDate,
          privacy_consent: privacyConsent,
          whatsapp_consent: whatsappConsent,
          captcha_token: captcha.token,
          captcha_answer: Number(captchaAnswer),
          source,
          lang,
        }),
      });
      setReceipt(data.registration);
      setConfirmationMsg(data.memberConfirmation || null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErrorMsg(
        err instanceof Error && err.message
          ? err.message
          : 'Submission failed. Please verify your fields and try again.'
      );
      void loadCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFullName('');
    setFatherOrGuardianName('');
    setDob('');
    setAge('');
    setMobile('');
    setWhatsappNumber('');
    setEmail('');
    setFullAddress('');
    setCityVillage('');
    setDistrict('');
    setPincode('');
    setEducation('');
    setProfilePhotoData('');
    setIdentityDocData('');
    setIdentityDocName('');
    setPrivacyConsent(false);
    setReceipt(null);
    setConfirmationMsg(null);
    setErrorMsg('');
    void loadCaptcha();
  };

  const accentText = isDv ? 'text-rose-700 dark:text-rose-400' : 'text-orange-700 dark:text-orange-400';
  const accentBtn = isDv ? 'bg-rose-700 hover:bg-rose-800' : 'bg-orange-600 hover:bg-orange-700';
  const headerBand = isDv ? 'bg-rose-700' : 'bg-orange-600';

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Top Breadcrumb + Wing Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        <button
          type="button"
          onClick={() => onSwitchWing(isDv ? 'bajrang_dal' : 'durga_vahini')}
          className="text-xs font-semibold text-slate-700 dark:text-slate-300 underline hover:text-orange-600 cursor-pointer"
        >
          {isDv ? 'Switch to Bajrang Dal Registration' : 'Switch to Durga Vahini (Women’s Wing)'}
        </button>
      </div>

      {/* Form Header Banner */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className={`h-2.5 ${headerBand}`} />
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-[#FAF9F6] dark:bg-slate-800 shrink-0 flex items-center justify-center">
                {isDv ? (
                  <ShieldCheck className="w-6 h-6 text-rose-700 dark:text-rose-400" />
                ) : (
                  <img src={emblemImg} alt="Bajrang Dal Emblem" className="w-full h-full object-cover" />
                )}
              </div>
              <div>
                <p className={`text-xs font-semibold ${accentText}`}>
                  {isDv ? 'Dedicated Women & Girls Membership Wing' : 'Official Youth & Men’s Wing Membership'}
                </p>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {isDv ? t.formTitleDv : t.formTitleBd}
                </h1>
              </div>
            </div>

            <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-[#FAF9F6] dark:bg-slate-800 p-1">
              <button
                type="button"
                onClick={() => onChangeLang('en')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  lang === 'en' ? 'bg-slate-900 text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => onChangeLang('gu')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  lang === 'gu' ? 'bg-slate-900 text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                ગુજરાતી
              </button>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3.5">
            {isDv ? t.formSubtitleDv : t.formSubtitleBd}
          </p>
        </div>
      </div>

      {receipt ? (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-5">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.successTitle}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t.successSubtitle}</p>
            </div>
          </div>

          <div className="rounded-xl bg-[#FAF9F6] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.regIdLabel}</span>
              <span className={`font-mono text-lg font-bold tabular-nums ${accentText}`}>
                {receipt.registration_code}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Organization Wing</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {receipt.organization_wing === 'durga_vahini' ? 'Durga Vahini (Women’s Wing)' : 'Bajrang Dal'}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Full Name</span>
                <span className="font-medium text-slate-900 dark:text-white">{receipt.full_name}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Mobile · Location</span>
                <span className="font-mono font-medium text-slate-900 dark:text-white">
                  {receipt.mobile} · {[receipt.city_village, receipt.district].filter(Boolean).join(', ')}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Status</span>
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  Confirmation Message Sent
                </span>
              </div>
            </div>
          </div>

          {confirmationMsg && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4" />
                  <span>
                    {lang === 'gu' ? 'સત્તાવાર પુષ્ટિ સંદેશ (Confirmation Message)' : 'Official Confirmation Message'}
                  </span>
                </span>
                <span className="text-[11px] font-mono text-emerald-800 dark:text-emerald-400">
                  {confirmationMsg.status === 'sent' ? 'WhatsApp Delivered' : 'Confirmation Ready'}
                </span>
              </div>
              <pre className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                {confirmationMsg.messageText}
              </pre>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={resetForm}
              className={`flex-1 min-h-[46px] rounded-xl px-5 py-3 text-sm font-semibold text-white transition-colors cursor-pointer ${accentBtn}`}
            >
              {t.registerAnotherBtn}
            </button>
            <button
              type="button"
              onClick={onBackHome}
              className="flex-1 min-h-[46px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
            >
              Return to Homepage
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-800 dark:text-red-200"
            >
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Personal Identity Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2.5">
              1. Personal Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                  {t.fullNameLabel}
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t.fullNamePlaceholder}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:border-orange-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                  {isDv ? t.guardianNameLabel : t.fatherNameLabel}
                </label>
                <input
                  type="text"
                  required
                  value={fatherOrGuardianName}
                  onChange={(e) => setFatherOrGuardianName(e.target.value)}
                  placeholder={isDv ? "Father's or Guardian's full name" : "Father's full name"}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:border-orange-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                  {t.dobLabel}
                </label>
                <input
                  type="date"
                  required
                  max={maxEligibleDob}
                  value={dob}
                  onChange={(e) => handleDobChange(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                  {t.ageLabel} ({minAge}+ yrs)
                </label>
                <input
                  type="number"
                  min={minAge}
                  max={110}
                  required
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder={`${minAge}+`}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2.5">
              2. Contact Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                  {t.mobileLabel}
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder={t.mobilePlaceholder}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {t.whatsappLabel}
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sameWhatsapp}
                      onChange={(e) => setSameWhatsapp(e.target.checked)}
                      className="rounded border-slate-300 text-orange-600"
                    />
                    <span>Same as mobile</span>
                  </label>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  disabled={sameWhatsapp}
                  value={sameWhatsapp ? mobile : whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit WhatsApp number"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 font-mono text-sm text-slate-900 dark:text-white disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                  {isDv ? t.emailOptionalLabel : t.emailLabel}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                  {t.regDateLabel}
                </label>
                <input
                  type="date"
                  value={registrationDate}
                  onChange={(e) => setRegistrationDate(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Address & Location */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2.5">
              3. Address & Location
            </h2>

            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                {t.addressLabel}
              </label>
              <textarea
                rows={2}
                required
                value={fullAddress}
                onChange={(e) => setFullAddress(e.target.value)}
                placeholder={t.addressPlaceholder}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.cityLabel}
                </label>
                <input
                  type="text"
                  required
                  value={cityVillage}
                  onChange={(e) => setCityVillage(e.target.value)}
                  placeholder="City or Village"
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.districtLabel}
                </label>
                <input
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="District"
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.stateLabel}
                </label>
                <input
                  type="text"
                  required
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  placeholder="Gujarat"
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isDv ? 'Pincode (Optional)' : t.pincodeLabel}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="380001"
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Education, Occupation & Document Uploads */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
            <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2.5">
              4. Education, Occupation & Verification Uploads
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                  {t.educationLabel}
                </label>
                <input
                  type="text"
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  placeholder="e.g. 12th Pass, B.Com, B.E., Graduate"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                  {t.occupationLabel}
                </label>
                <select
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value as OccupationType)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white"
                >
                  {(['Student', 'Job', 'Business', 'Other'] as OccupationType[]).map((occ) => (
                    <option key={occ} value={occ}>
                      {t.occupations[occ]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Profile Photo */}
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#FAF9F6] dark:bg-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                    {profilePhotoData ? (
                      <img src={profilePhotoData} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">{t.photoLabel}</p>
                    <label className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 dark:text-orange-400 cursor-pointer hover:underline">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{profilePhotoData ? 'Change Photo' : 'Upload Photo'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePhotoUpload}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Private Identity Verification Document */}
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 space-y-2">
                <div className="flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">{t.idDocLabel}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Encrypted & hidden from public profiles. Admin verification only.
                    </p>
                    <label className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 dark:text-orange-400 cursor-pointer hover:underline">
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span>{identityDocName ? `Attached: ${identityDocName}` : 'Upload ID Document'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={handleIdentityDocUpload}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Security CAPTCHA & Consent */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
            <div className="rounded-xl bg-[#FAF9F6] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Human Verification (CAPTCHA) *
                </p>
                <p className="font-mono text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {captcha ? captcha.question : 'Loading...'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  required
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  placeholder="Answer"
                  className="w-28 min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-sm text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => loadCaptcha()}
                  aria-label="Refresh CAPTCHA"
                  className="min-h-[42px] min-w-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={privacyConsent}
                onChange={(e) => setPrivacyConsent(e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-slate-300 text-orange-600 shrink-0"
              />
              <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {t.privacyConsentText}{' '}
                <button
                  type="button"
                  onClick={() => setShowPrivacyPolicy(!showPrivacyPolicy)}
                  className="underline font-semibold text-orange-700 dark:text-orange-400 cursor-pointer"
                >
                  {showPrivacyPolicy ? 'Hide Privacy & Terms' : 'Read Privacy Policy & Terms'}
                </button>
              </span>
            </label>

            {showPrivacyPolicy && (
              <div className="rounded-xl bg-[#FAF9F6] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                <p className="font-semibold text-slate-900 dark:text-white">Privacy Notice & Terms of Membership</p>
                <p>
                  1. Personal data, mobile numbers, residential addresses, and identity verification files are never sold or displayed on public directories.
                </p>
                <p>
                  2. Public QR member verification exposes only Member ID, Name, Wing, District, Membership Status, and approved Profile Photo.
                </p>
                <p>
                  3. You may opt out of WhatsApp communications at any time by contacting an authorized unit administrator.
                </p>
              </div>
            )}

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={whatsappConsent}
                onChange={(e) => setWhatsappConsent(e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-slate-300 text-orange-600 shrink-0"
              />
              <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {t.whatsappConsentText}
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full min-h-[52px] rounded-xl px-6 py-3.5 text-base font-semibold text-white disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs ${accentBtn}`}
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
  );
};
