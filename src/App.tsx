import React, { useEffect, useState } from 'react';
import { QrCode, UserPlus, ShieldCheck, BookOpen, Globe } from 'lucide-react';
import type { AdminUser, Language } from './types';
import { getTranslations } from './lib/i18n';
import { PublicRegistrationForm } from './components/PublicRegistrationForm';
import { QrCodeStudio } from './components/QrCodeStudio';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { SetupGuide } from './components/SetupGuide';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { wipeLocalAdminVault } from './lib/encryptedDb';

type ViewMode = 'register' | 'qr' | 'admin' | 'guide';

const TOKEN_KEY = 'jbd_admin_token';
const ADMIN_KEY = 'jbd_admin_profile';

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const [view, setView] = useState<ViewMode>('register');
  const [source, setSource] = useState<'qr_code' | 'direct_link'>('direct_link');
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(() => {
    const raw = sessionStorage.getItem(ADMIN_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AdminUser;
    } catch {
      return null;
    }
  });

  const t = getTranslations(lang);
  const isAdminSession = Boolean(currentAdmin && token);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view');
    const src = params.get('source');
    if (src === 'qr_code') setSource('qr_code');
    if (v === 'qr' || v === 'admin' || v === 'guide') {
      setView(v);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Expired');
        return res.json();
      })
      .then((data) => {
        if (data.admin) {
          setCurrentAdmin(data.admin);
          sessionStorage.setItem(ADMIN_KEY, JSON.stringify(data.admin));
        }
      })
      .catch(() => {
        if (navigator.onLine) {
          sessionStorage.removeItem(TOKEN_KEY);
          sessionStorage.removeItem(ADMIN_KEY);
          setToken(null);
          setCurrentAdmin(null);
        }
      });
  }, [token]);

  const handleLoginSuccess = (newToken: string, admin: AdminUser) => {
    sessionStorage.setItem(TOKEN_KEY, newToken);
    sessionStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
    setToken(newToken);
    setCurrentAdmin(admin);
    setView('admin');
  };

  const handleSignOut = async () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_KEY);
    setToken(null);
    setCurrentAdmin(null);
    await wipeLocalAdminVault();
    navigate('register');
  };

  const navigate = (next: ViewMode) => {
    setView(next);
    const url = new URL(window.location.href);
    if (next === 'register') {
      url.searchParams.delete('view');
    } else {
      url.searchParams.set('view', next);
    }
    window.history.replaceState({}, '', url.toString());
  };

  // Public Google-Form-first mode: when not logged in as Admin and viewing registration form,
  // hide Admin/QR/Setup navigation bars so QR & link visitors get a pure Google-Form experience.
  const showAdminShell = isAdminSession || view !== 'register';

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-slate-900">
      {showAdminShell ? (
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
            <button
              type="button"
              onClick={() => navigate('register')}
              className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t.brandTitle}
            </button>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <button
                type="button"
                onClick={() => navigate('register')}
                className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  view === 'register' ? 'text-orange-700 font-semibold' : 'hover:text-slate-900'
                }`}
              >
                {t.navRegister}
              </button>
              <button
                type="button"
                onClick={() => navigate('qr')}
                className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  view === 'qr' ? 'text-orange-700 font-semibold' : 'hover:text-slate-900'
                }`}
              >
                {t.navQr}
              </button>
              <button
                type="button"
                onClick={() => navigate('admin')}
                className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  view === 'admin' ? 'text-orange-700 font-semibold' : 'hover:text-slate-900'
                }`}
              >
                {t.navAdmin}
              </button>
              <button
                type="button"
                onClick={() => navigate('guide')}
                className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  view === 'guide' ? 'text-orange-700 font-semibold' : 'hover:text-slate-900'
                }`}
              >
                {t.navGuide}
              </button>
            </nav>

            <div className="flex items-center shrink-0">
              {currentAdmin ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {t.signOutBtn}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('admin')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {t.adminLoginBtn}
                </button>
              )}
            </div>
          </div>
        </header>
      ) : (
        <header className="border-b border-slate-200/80 bg-white/80">
          <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">
              {t.brandTitle}
            </span>
            <button
              type="button"
              onClick={() => navigate('admin')}
              className="text-xs font-medium text-slate-600 hover:text-orange-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t.adminLoginBtn}
            </button>
          </div>
        </header>
      )}

      {/* Admin Utility Strip (shown inside Admin shell, hidden on clean public form) */}
      {showAdminShell && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            <Globe className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                lang === 'en' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLang('gu')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                lang === 'gu' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ગુજરાતી
            </button>
          </div>

          <PWAInstallButton compact />
        </div>
      )}

      {/* Main Content */}
      <main className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 ${showAdminShell ? 'pb-24 md:pb-12' : 'pb-10'}`}>
        {view === 'register' && (
          <PublicRegistrationForm
            lang={lang}
            onChangeLang={setLang}
            source={source}
          />
        )}

        {view === 'qr' && (
          <QrCodeStudio
            lang={lang}
            onOpenRegistration={() => navigate('register')}
          />
        )}

        {view === 'admin' && (
          currentAdmin && token ? (
            <AdminDashboard
              lang={lang}
              token={token}
              currentAdmin={currentAdmin}
            />
          ) : (
            <AdminLogin onSuccess={handleLoginSuccess} />
          )
        )}

        {view === 'guide' && <SetupGuide />}
      </main>

      {/* Quiet Footer on Public Form */}
      {!showAdminShell && (
        <footer className="py-5 text-center text-xs text-slate-500">
          <span>Join Bajrang Dal · </span>
          <button
            type="button"
            onClick={() => navigate('admin')}
            className="underline hover:text-slate-800 cursor-pointer"
          >
            {t.adminLoginBtn}
          </button>
        </footer>
      )}

      {/* Mobile Bottom Navigation Bar (Admin Shell only) */}
      {showAdminShell && (
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md"
        >
          <div className="grid grid-cols-4 h-16">
            <button
              type="button"
              onClick={() => navigate('register')}
              className={`flex flex-col items-center justify-center gap-1 cursor-pointer ${
                view === 'register' ? 'text-orange-600 font-semibold' : 'text-slate-600'
              }`}
            >
              <UserPlus className="w-5 h-5" />
              <span className="text-[11px] leading-none">{t.navRegister}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('qr')}
              className={`flex flex-col items-center justify-center gap-1 cursor-pointer ${
                view === 'qr' ? 'text-orange-600 font-semibold' : 'text-slate-600'
              }`}
            >
              <QrCode className="w-5 h-5" />
              <span className="text-[11px] leading-none">{t.navQr}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('admin')}
              className={`flex flex-col items-center justify-center gap-1 cursor-pointer ${
                view === 'admin' ? 'text-orange-600 font-semibold' : 'text-slate-600'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
              <span className="text-[11px] leading-none">{t.navAdmin}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('guide')}
              className={`flex flex-col items-center justify-center gap-1 cursor-pointer ${
                view === 'guide' ? 'text-orange-600 font-semibold' : 'text-slate-600'
              }`}
            >
              <BookOpen className="w-5 h-5" />
              <span className="text-[11px] leading-none">{t.navGuide}</span>
            </button>
          </div>
        </nav>
      )}

      <OfflineIndicator />
    </div>
  );
}
