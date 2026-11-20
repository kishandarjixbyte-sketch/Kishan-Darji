import React, { useCallback, useEffect, useState } from 'react';
import {
  Home,
  UserPlus,
  Calendar,
  BookOpen,
  ShieldCheck,
  Sun,
  Moon,
  QrCode,
  AlertCircle,
} from 'lucide-react';
import type {
  AdminUser,
  EventItem,
  Language,
  OrganizationPageItem,
  PublicMemberVerification,
  ThemeSettings,
} from './types';
import { getTranslations } from './lib/i18n';
import { FESTIVAL_THEMES } from './lib/themes';
import { wipeLocalAdminVault } from './lib/encryptedDb';
import { buildApiUrl } from './lib/apiClient';
import { HomeView } from './components/HomeView';
import { MembershipRegistrationForm } from './components/MembershipRegistrationForm';
import { EventsPortal } from './components/EventsPortal';
import { OrganizationInfoPages } from './components/OrganizationInfoPages';
import { QrCodeStudio } from './components/QrCodeStudio';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard, type DashboardTab } from './components/AdminDashboard';
import { MemberIdCardModal } from './components/MemberIdCardModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

type ViewMode =
  | 'home'
  | 'join-bajrang-dal'
  | 'join-durga-vahini'
  | 'events'
  | 'about'
  | 'qr'
  | 'admin';

const TOKEN_KEY = 'jbd_admin_token';
const ADMIN_KEY = 'jbd_admin_profile';
const COLOR_MODE_KEY = 'jbd_color_mode';

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(COLOR_MODE_KEY) === 'dark';
  });
  const [view, setView] = useState<ViewMode>('home');
  const [source, setSource] = useState<'qr_code' | 'direct_link'>('direct_link');
  const [selectedEventSlug, setSelectedEventSlug] = useState<string | null>(null);
  const [selectedOrgSlug, setSelectedOrgSlug] = useState<'bajrang_dal' | 'vhp' | 'durga_vahini'>('bajrang_dal');
  const [adminInitialTab, setAdminInitialTab] = useState<DashboardTab>('registrations');

  const [events, setEvents] = useState<EventItem[]>([]);
  const [orgPages, setOrgPages] = useState<OrganizationPageItem[]>([]);
  const [themeSettings, setThemeSettings] = useState<ThemeSettings | null>(null);
  const [verifiedMember, setVerifiedMember] = useState<PublicMemberVerification | null>(null);
  const [verifyError, setVerifyError] = useState('');

  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(() => {
    const raw = localStorage.getItem(ADMIN_KEY);
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
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem(COLOR_MODE_KEY, 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem(COLOR_MODE_KEY, 'light');
    }
  }, [darkMode]);

  const loadPublicPlatformData = useCallback(async () => {
    try {
      const [evRes, orgRes, themeRes] = await Promise.all([
        fetch(buildApiUrl('/api/events')),
        fetch(buildApiUrl('/api/org-pages')),
        fetch(buildApiUrl('/api/theme')),
      ]);
      if (evRes.ok) {
        const d = await evRes.json();
        setEvents(d.events || []);
      }
      if (orgRes.ok) {
        const d = await orgRes.json();
        setOrgPages(d.pages || []);
      }
      if (themeRes.ok) {
        const d = await themeRes.json();
        setThemeSettings(d.settings || null);
      }
    } catch {
      // ignore offline
    }
  }, []);

  const lookupMemberVerification = useCallback(async (code: string) => {
    setVerifyError('');
    try {
      const res = await fetch(buildApiUrl(`/api/members/verify?code=${encodeURIComponent(code)}`));
      const data = await res.json();
      if (!res.ok) {
        setVerifyError(data.error || 'Member ID not found.');
        return;
      }
      setVerifiedMember(data.member);
    } catch {
      setVerifyError('Unable to verify Member ID right now.');
    }
  }, []);

  useEffect(() => {
    void loadPublicPlatformData();
  }, [loadPublicPlatformData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view');
    const src = params.get('source');
    const evSlug = params.get('event');
    const verifyCode = params.get('verify');
    const orgSlug = params.get('org');

    if (src === 'qr_code') setSource('qr_code');
    if (evSlug) {
      setSelectedEventSlug(evSlug);
      setView('events');
    } else if (verifyCode) {
      void lookupMemberVerification(verifyCode);
    } else if (orgSlug === 'bajrang_dal' || orgSlug === 'vhp' || orgSlug === 'durga_vahini') {
      setSelectedOrgSlug(orgSlug);
      setView('about');
    } else if (
      v === 'join-bajrang-dal' ||
      v === 'join-durga-vahini' ||
      v === 'events' ||
      v === 'about' ||
      v === 'qr' ||
      v === 'admin' ||
      v === 'home'
    ) {
      setView(v);
    } else if (v === 'register') {
      setView('join-bajrang-dal');
    }
  }, [lookupMemberVerification]);

  useEffect(() => {
    if (!token) return;
    fetch(buildApiUrl('/api/auth/me'), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.status === 401 || res.status === 403) throw new Error('Unauthorized');
        if (!res.ok) throw new Error('ServerError');
        return res.json();
      })
      .then((data) => {
        if (data.admin) {
          setCurrentAdmin(data.admin);
          localStorage.setItem(ADMIN_KEY, JSON.stringify(data.admin));
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.message === 'Unauthorized') {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(ADMIN_KEY);
          setToken(null);
          setCurrentAdmin(null);
        }
      });
  }, [token]);

  const navigate = (
    next: ViewMode,
    extra?: {
      orgSlug?: 'bajrang_dal' | 'vhp' | 'durga_vahini';
      eventSlug?: string | null;
      verifyCode?: string;
      adminTab?: DashboardTab;
    }
  ) => {
    if (extra?.verifyCode) {
      void lookupMemberVerification(extra.verifyCode);
      return;
    }
    if (extra?.orgSlug) setSelectedOrgSlug(extra.orgSlug);
    if (extra?.eventSlug !== undefined) setSelectedEventSlug(extra.eventSlug);
    else if (next !== 'events') setSelectedEventSlug(null);
    if (extra?.adminTab) setAdminInitialTab(extra.adminTab);

    setView(next);
    const url = new URL(window.location.href);
    url.searchParams.delete('event');
    url.searchParams.delete('verify');
    url.searchParams.delete('org');
    if (next === 'home') {
      url.searchParams.delete('view');
    } else {
      url.searchParams.set('view', next);
    }
    if (next === 'events' && extra?.eventSlug) {
      url.searchParams.set('event', extra.eventSlug);
    }
    if (next === 'about' && extra?.orgSlug) {
      url.searchParams.set('org', extra.orgSlug);
    }
    window.history.replaceState({}, '', url.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoginSuccess = (newToken: string, admin: AdminUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
    setToken(newToken);
    setCurrentAdmin(admin);
    navigate('admin');
  };

  const handleSignOut = async () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
    setToken(null);
    setCurrentAdmin(null);
    await wipeLocalAdminVault();
    navigate('home');
  };

  const effectiveThemeId =
    themeSettings?.effective_theme || themeSettings?.active_theme || 'normal';
  const themeConfig = FESTIVAL_THEMES[effectiveThemeId] || FESTIVAL_THEMES.normal;

  return (
    <div className={`min-h-screen flex flex-col text-slate-900 dark:text-slate-100 transition-colors ${themeConfig.pageBgTint}`}>
      {/* Sticky 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate('home')}
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
          >
            <span className="w-2.5 h-2.5 rounded-sm bg-orange-600 inline-block" />
            <span>{t.brandShort}</span>
          </button>

          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            {[
              { id: 'home' as const, label: t.navHome },
              { id: 'join-bajrang-dal' as const, label: t.navJoinBd },
              { id: 'join-durga-vahini' as const, label: t.navJoinDv },
              { id: 'events' as const, label: t.navEvents },
              { id: 'about' as const, label: t.navOrgInfo },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  view === item.id
                    ? 'text-orange-700 dark:text-orange-400 font-semibold'
                    : 'hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'gu' : 'en')}
              className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
              title="Switch Language"
            >
              {lang === 'en' ? 'ગુજ' : 'EN'}
            </button>

            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Toggle Light/Dark Mode"
              className="min-h-[36px] min-w-[36px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => navigate('qr')}
              aria-label="QR Code Studio"
              className="hidden sm:inline-flex min-h-[36px] min-w-[36px] rounded-lg border border-slate-200 dark:border-slate-700 items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
            </button>

            {isAdminSession ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('admin')}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 whitespace-nowrap cursor-pointer"
                >
                  Dashboard
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-700 rounded-lg hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                >
                  {t.signOutBtn}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigate('admin')}
                className="px-4 py-2 text-xs font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t.adminLoginBtn}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 lg:pb-12">
        {verifyError && (
          <div className="mb-5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{verifyError}</span>
            </span>
            <button type="button" onClick={() => setVerifyError('')} className="underline text-xs cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {view === 'home' && (
          <HomeView
            lang={lang}
            events={events}
            themeSettings={themeSettings}
            isAdminSession={isAdminSession}
            onNavigate={(next, extra) =>
              navigate(next, {
                orgSlug: extra?.orgSlug,
                eventSlug: extra?.eventSlug,
                verifyCode: extra?.verifyCode,
                adminTab: next === 'admin' ? 'events' : undefined,
              })
            }
          />
        )}

        {view === 'join-bajrang-dal' && (
          <MembershipRegistrationForm
            wing="bajrang_dal"
            lang={lang}
            onChangeLang={setLang}
            source={source}
            onBackHome={() => navigate('home')}
            onSwitchWing={(w) => navigate(w === 'durga_vahini' ? 'join-durga-vahini' : 'join-bajrang-dal')}
          />
        )}

        {view === 'join-durga-vahini' && (
          <MembershipRegistrationForm
            wing="durga_vahini"
            lang={lang}
            onChangeLang={setLang}
            source={source}
            onBackHome={() => navigate('home')}
            onSwitchWing={(w) => navigate(w === 'durga_vahini' ? 'join-durga-vahini' : 'join-bajrang-dal')}
          />
        )}

        {view === 'events' && (
          <EventsPortal
            lang={lang}
            events={events}
            selectedSlug={selectedEventSlug}
            onSelectSlug={(slug) => navigate('events', { eventSlug: slug })}
            onRefreshEvents={loadPublicPlatformData}
            onBackHome={() => navigate('home')}
            isAdminSession={isAdminSession}
            onOpenAdminEvents={() => navigate('admin', { adminTab: 'events' })}
          />
        )}

        {view === 'about' && (
          <OrganizationInfoPages
            pages={orgPages}
            activeSlug={selectedOrgSlug}
            onSelectSlug={(slug) => navigate('about', { orgSlug: slug })}
            onJoinWing={(w) => navigate(w === 'durga_vahini' ? 'join-durga-vahini' : 'join-bajrang-dal')}
            onBackHome={() => navigate('home')}
          />
        )}

        {view === 'qr' && (
          <QrCodeStudio
            lang={lang}
            onOpenRegistration={(w) => navigate(w === 'durga_vahini' ? 'join-durga-vahini' : 'join-bajrang-dal')}
          />
        )}

        {view === 'admin' &&
          (currentAdmin && token ? (
            <AdminDashboard
              lang={lang}
              token={token}
              currentAdmin={currentAdmin}
              events={events}
              orgPages={orgPages}
              themeSettings={themeSettings}
              onRefreshPublicData={loadPublicPlatformData}
              initialTab={adminInitialTab}
            />
          ) : (
            <AdminLogin onSuccess={handleLoginSuccess} />
          ))}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 py-6 mb-16 lg:mb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <p>Bajrang Dal · Vishva Hindu Parishad · Durga Vahini — Verified Organization & Seva Platform</p>
          <div className="flex items-center gap-4">
            <PWAInstallButton compact />
            <button type="button" onClick={() => navigate('about', { orgSlug: 'bajrang_dal' })} className="hover:underline cursor-pointer">
              Bajrang Dal
            </button>
            <button type="button" onClick={() => navigate('about', { orgSlug: 'vhp' })} className="hover:underline cursor-pointer">
              VHP
            </button>
            <button type="button" onClick={() => navigate('about', { orgSlug: 'durga_vahini' })} className="hover:underline cursor-pointer">
              Durga Vahini
            </button>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md"
      >
        <div className="grid grid-cols-5 h-15">
          {[
            { id: 'home' as const, label: 'Home', icon: Home },
            { id: 'join-bajrang-dal' as const, label: 'Bajrang', icon: UserPlus },
            { id: 'join-durga-vahini' as const, label: 'Durga', icon: UserPlus },
            { id: 'events' as const, label: 'Events', icon: Calendar },
            { id: 'about' as const, label: 'Info', icon: BookOpen },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={`flex flex-col items-center justify-center gap-1 cursor-pointer ${
                  view === item.id ? 'text-orange-600 dark:text-orange-400 font-semibold' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] leading-none">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Public Digital Member Verification Modal (?verify=CODE) */}
      {verifiedMember && (
        <MemberIdCardModal
          member={verifiedMember}
          onClose={() => {
            setVerifiedMember(null);
            const url = new URL(window.location.href);
            url.searchParams.delete('verify');
            window.history.replaceState({}, '', url.toString());
          }}
        />
      )}

      <OfflineIndicator />
    </div>
  );
}
