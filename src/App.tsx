import React, { useCallback, useEffect, useState } from 'react';
import {
  Home,
  Shield,
  Calendar,
  BookOpen,
  Sun,
  Moon,
  QrCode,
  ChevronLeft,
  Menu,
  X,
  ShieldCheck,
  LogOut,
  Languages,
  Sparkles,
} from 'lucide-react';
import type {
  AdminUser,
  EventItem,
  Language,
  OrganizationPageItem,
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
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import emblemImg from './assets/images/organization_emblem_1794820507112.jpg';

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

const LotusNavIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M12 3c2.4 3.4 3.6 6.2 3.6 9.1 0 2.9-1.6 5.4-3.6 6.9-2-1.5-3.6-4-3.6-6.9C8.4 9.2 9.6 6.4 12 3Z" />
    <path d="M5.5 7.5c2.2 1.2 4 3.5 4.4 6.2.3 2-.4 4-1.9 5.3-2.5-.6-4.5-2.9-4.5-6 0-2 .8-4 2-5.5Z" />
    <path d="M18.5 7.5c-2.2 1.2-4 3.5-4.4 6.2-.3 2 .4 4 1.9 5.3 2.5-.6 4.5-2.9 4.5-6 0-2-.8-4-2-5.5Z" />
    <path d="M4 20h16" />
  </svg>
);

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [prefillAreaAdminId, setPrefillAreaAdminId] = useState<string>('');
  const [prefillDistrict, setPrefillDistrict] = useState<string>('');
  const [prefillCity, setPrefillCity] = useState<string>('');

  const [events, setEvents] = useState<EventItem[]>([]);
  const [orgPages, setOrgPages] = useState<OrganizationPageItem[]>([]);
  const [themeSettings, setThemeSettings] = useState<ThemeSettings | null>(null);

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

  useEffect(() => {
    void loadPublicPlatformData();
  }, [loadPublicPlatformData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view');
    const src = params.get('source');
    const evSlug = params.get('event');
    const orgSlug = params.get('org');
    const areaAdmin = params.get('area_admin');
    const areaDistrict = params.get('district');
    const areaCity = params.get('city');

    if (areaAdmin) setPrefillAreaAdminId(areaAdmin.trim());
    if (areaDistrict) setPrefillDistrict(areaDistrict.trim());
    if (areaCity) setPrefillCity(areaCity.trim());

    if (src === 'qr_code') setSource('qr_code');
    if (evSlug) {
      setSelectedEventSlug(evSlug);
      setView('events');
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
  }, []);

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
      adminTab?: DashboardTab;
    }
  ) => {
    setMobileMenuOpen(false);
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

  const mobileScreenTitle: Record<ViewMode, string> = {
    home: t.brandShort,
    'join-bajrang-dal': t.navJoinBd,
    'join-durga-vahini': t.navJoinDv,
    events: t.navEvents,
    about: t.navOrgInfo,
    qr: t.navQr,
    admin: isAdminSession ? 'Admin Dashboard' : t.adminLoginBtn,
  };

  return (
    <div className={`min-h-screen flex flex-col text-slate-900 dark:text-slate-100 transition-colors ${themeConfig.pageBgTint}`}>
      {/* ====================================================================
          MOBILE APP TOP BAR (< 768px): Native App Header
      ==================================================================== */}
      <header className="md:hidden sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="px-3.5 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {view === 'home' ? (
              <img
                src={emblemImg}
                alt="App Icon"
                className="w-8 h-8 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
            ) : (
              <button
                type="button"
                onClick={() => navigate('home')}
                aria-label="Back to Home"
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-95 shrink-0 cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0">
              <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white truncate block">
                {mobileScreenTitle[view]}
              </span>
              {view === 'home' && (
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block leading-none">
                  Bajrang Dal · VHP · Durga Vahini
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'gu' : 'en')}
              className="h-9 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 active:scale-95 cursor-pointer"
            >
              {lang === 'en' ? 'ગુજ' : 'EN'}
            </button>
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Toggle Theme"
              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-95 cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => navigate('admin')}
              aria-label="Admin Portal"
              className={`h-9 px-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1 active:scale-95 cursor-pointer ${
                isAdminSession
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-900 dark:bg-orange-600 text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isAdminSession ? 'Admin' : 'Login'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ====================================================================
          DESKTOP / WEB NAVBAR (>= 768px): Full Web Navigation
      ==================================================================== */}
      <header className="hidden md:block sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-15 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate('home')}
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
          >
            <span className="w-2.5 h-2.5 rounded-sm bg-orange-600 inline-block" />
            <span>{t.brandShort}</span>
          </button>

          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
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
              className="inline-flex min-h-[36px] min-w-[36px] rounded-lg border border-slate-200 dark:border-slate-700 items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 py-4 md:py-6 pb-24 md:pb-12">
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
            prefillAreaAdminId={prefillAreaAdminId}
            prefillDistrict={prefillDistrict}
            prefillCity={prefillCity}
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
            prefillAreaAdminId={prefillAreaAdminId}
            prefillDistrict={prefillDistrict}
            prefillCity={prefillCity}
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

      {/* Desktop / Web Footer (Hidden on Mobile App View) */}
      <footer className="hidden md:block border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 py-6">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
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

      {/* ====================================================================
          MOBILE APP BOTTOM TAB BAR (< 768px): Native 5-Tab App Navigation
      ==================================================================== */}
      <nav
        aria-label="Mobile App Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5 h-16 px-1">
          {[
            { id: 'home' as const, label: 'Home', icon: Home },
            { id: 'join-bajrang-dal' as const, label: 'Bajrang', icon: Shield },
            { id: 'join-durga-vahini' as const, label: 'Durga', icon: LotusNavIcon },
            { id: 'events' as const, label: 'Events', icon: Calendar },
          ].map((item) => {
            const Icon = item.icon;
            const active = view === item.id && !mobileMenuOpen;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className="flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform cursor-pointer"
              >
                <span
                  className={`px-3 py-1 rounded-full transition-colors ${
                    active
                      ? item.id === 'join-durga-vahini'
                        ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300'
                        : 'bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <span
                  className={`text-[10px] leading-none ${
                    active
                      ? 'font-bold text-slate-900 dark:text-white'
                      : 'font-medium text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform cursor-pointer"
          >
            <span
              className={`px-3 py-1 rounded-full transition-colors ${
                mobileMenuOpen || view === 'about' || view === 'qr' || view === 'admin'
                  ? 'bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Menu className="w-4 h-4" />
            </span>
            <span
              className={`text-[10px] leading-none ${
                mobileMenuOpen || view === 'about' || view === 'qr' || view === 'admin'
                  ? 'font-bold text-slate-900 dark:text-white'
                  : 'font-medium text-slate-600 dark:text-slate-400'
              }`}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      {/* ====================================================================
          MOBILE APP "MORE" BOTTOM SHEET DRAWER (< 768px)
      ==================================================================== */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/50 backdrop-blur-xs">
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
          <div className="rounded-t-3xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-4 shadow-2xl">
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-orange-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">App Menu</h3>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => navigate('about', { orgSlug: 'bajrang_dal' })}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#FAF9F6] dark:bg-slate-800/70 text-left space-y-1 active:scale-95 cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-orange-600" />
                <p className="text-xs font-bold text-slate-900 dark:text-white">Organization Info</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">BD · VHP · Durga Vahini</p>
              </button>

              <button
                type="button"
                onClick={() => navigate('qr')}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#FAF9F6] dark:bg-slate-800/70 text-left space-y-1 active:scale-95 cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-orange-600" />
                <p className="text-xs font-bold text-slate-900 dark:text-white">QR & Share Links</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Posters & Posters PDF</p>
              </button>

              <button
                type="button"
                onClick={() => navigate('admin')}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#FAF9F6] dark:bg-slate-800/70 text-left space-y-1 active:scale-95 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {isAdminSession ? 'Admin Dashboard' : 'Admin Login'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isAdminSession ? currentAdmin?.full_name : 'Authorized Staff Only'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setLang(lang === 'en' ? 'gu' : 'en')}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#FAF9F6] dark:bg-slate-800/70 text-left space-y-1 active:scale-95 cursor-pointer"
              >
                <Languages className="w-4 h-4 text-orange-600" />
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {lang === 'en' ? 'ગુજરાતી ભાષા' : 'English Language'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Tap to switch</p>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <PWAInstallButton compact />
              {isAdminSession && (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t.signOutBtn}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <OfflineIndicator />
    </div>
  );
}
