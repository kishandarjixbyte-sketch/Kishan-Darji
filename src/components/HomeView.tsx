import React from 'react';
import {
  Shield,
  CalendarPlus,
  Calendar,
  MapPin,
  Users,
  ArrowRight,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import type { EventItem, FestivalThemeId, Language, ThemeSettings } from '../types';
import { getTranslations } from '../lib/i18n';
import { FESTIVAL_THEMES } from '../lib/themes';
import heroBannerImg from '../assets/images/hero_organization_banner_1795154370618.jpg';
import eventGatheringImg from '../assets/images/event_cultural_gathering_1795154369841.jpg';
import emblemImg from '../assets/images/organization_emblem_1794820507112.jpg';

interface Props {
  lang: Language;
  events: EventItem[];
  themeSettings: ThemeSettings | null;
  onNavigate: (
    view: 'join-bajrang-dal' | 'join-durga-vahini' | 'events' | 'about' | 'admin' | 'qr',
    extra?: { orgSlug?: 'bajrang_dal' | 'vhp' | 'durga_vahini'; eventSlug?: string }
  ) => void;
  isAdminSession: boolean;
}

const LotusEmblemIcon: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M12 3c2.4 3.4 3.6 6.2 3.6 9.1 0 2.9-1.6 5.4-3.6 6.9-2-1.5-3.6-4-3.6-6.9C8.4 9.2 9.6 6.4 12 3Z" />
    <path d="M5.5 7.5c2.2 1.2 4 3.5 4.4 6.2.3 2-.4 4-1.9 5.3-2.5-.6-4.5-2.9-4.5-6 0-2 .8-4 2-5.5Z" />
    <path d="M18.5 7.5c-2.2 1.2-4 3.5-4.4 6.2-.3 2 .4 4 1.9 5.3 2.5-.6 4.5-2.9 4.5-6 0-2-.8-4-2-5.5Z" />
    <path d="M4 20h16" />
  </svg>
);

const ORG_CARDS = [
  {
    slug: 'bajrang_dal' as const,
    title: 'Bajrang Dal Details',
    shortTitle: 'Bajrang Dal',
    desc: 'Youth wing dedicated to Seva, Suraksha, Sanskar, disaster relief, and character building.',
    meta: 'Est. 1984 · Youth Wing',
  },
  {
    slug: 'vhp' as const,
    title: 'Vishva Hindu Parishad (VHP)',
    shortTitle: 'VHP',
    desc: 'Global social, charitable, and cultural organization uniting communities since 1964.',
    meta: 'Est. 1964 · Parent Organization',
  },
  {
    slug: 'durga_vahini' as const,
    title: 'Durga Vahini Details',
    shortTitle: 'Durga Vahini',
    desc: 'Dedicated women & young women’s wing promoting confidence, self-defense, and leadership.',
    meta: 'Est. 1991 · Women’s Wing',
  },
];

export const HomeView: React.FC<Props> = ({
  lang,
  events,
  themeSettings,
  onNavigate,
  isAdminSession,
}) => {
  const t = getTranslations(lang);

  const effectiveThemeId: FestivalThemeId =
    themeSettings?.effective_theme || themeSettings?.active_theme || 'normal';
  const themeConfig = FESTIVAL_THEMES[effectiveThemeId] || FESTIVAL_THEMES.normal;
  const activeBannerText = themeSettings?.custom_banner_text?.trim() || themeConfig.bannerText;

  const upcomingEvents = events.slice(0, 3);

  return (
    <div className="space-y-6 md:space-y-10">
      {/* ====================================================================
          MOBILE APP VIEW (< 768px): Native App Dashboard, Stacked Touch Cards,
          Horizontal Swipe Carousels
      ==================================================================== */}
      <div className="md:hidden space-y-5">
        {/* Compact App Greeting Header Card */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
          <div className={`h-1 bg-gradient-to-r ${themeConfig.topStripGradient}`} />
          <div className="p-4 flex items-center gap-3.5">
            <img
              src={emblemImg}
              alt="Organization Emblem"
              className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className={`text-[11px] font-bold tracking-wide truncate ${themeConfig.accentTextClass}`}>
                {themeConfig.name !== 'Normal Theme' ? `${themeConfig.name} · ` : ''}Seva · Suraksha · Sanskar
              </p>
              <h1 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                {t.brandShort}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {activeBannerText || 'Bajrang Dal · VHP · Durga Vahini'}
              </p>
            </div>
          </div>
        </section>

        {/* Three Primary App Action List Cards */}
        <section aria-label="Quick Actions" className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {lang === 'gu' ? 'મુખ્ય વિભાગો' : 'Quick Portals'}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('join-bajrang-dal')}
            className="w-full text-left rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 p-4 text-white shadow-sm active:scale-[0.98] transition-transform flex items-center gap-3.5 cursor-pointer"
          >
            <div className="w-11 h-11 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold leading-tight">{t.ctaJoinBajrangDal}</h3>
              <p className="text-xs text-orange-50/90 truncate mt-0.5">{t.ctaJoinBajrangDalSub}</p>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0 opacity-90" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('join-durga-vahini')}
            className="w-full text-left rounded-2xl bg-gradient-to-r from-rose-700 to-orange-600 p-4 text-white shadow-sm active:scale-[0.98] transition-transform flex items-center gap-3.5 cursor-pointer"
          >
            <div className="w-11 h-11 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center shrink-0">
              <LotusEmblemIcon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold leading-tight">{t.ctaJoinDurgaVahini}</h3>
              <p className="text-xs text-rose-50/90 truncate mt-0.5">{t.ctaJoinDurgaVahiniSub}</p>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0 opacity-90" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate(isAdminSession ? 'admin' : 'events')}
            className="w-full text-left rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-700 p-4 text-white shadow-sm active:scale-[0.98] transition-transform flex items-center gap-3.5 cursor-pointer"
          >
            <div className="w-11 h-11 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center shrink-0">
              <CalendarPlus className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold leading-tight">{t.ctaCreateEvent}</h3>
              <p className="text-xs text-emerald-50/90 truncate mt-0.5">{t.ctaCreateEventSub}</p>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0 opacity-90" />
          </button>
        </section>

        {/* Horizontal Swipeable Events Carousel */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {lang === 'gu' ? 'આગામી કાર્યક્રમો' : `Upcoming Events (${events.length})`}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('events')}
              className="text-xs font-semibold text-orange-700 dark:text-orange-400 inline-flex items-center gap-0.5 cursor-pointer"
            >
              <span>All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {upcomingEvents.length === 0 ? (
            <button
              type="button"
              onClick={() => onNavigate(isAdminSession ? 'admin' : 'events')}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center gap-3 text-left cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-orange-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Events Portal Ready</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  Tap to view or create Seva & cultural events
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          ) : (
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-1 no-scrollbar -mx-1 px-1">
              {upcomingEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="w-[78vw] max-w-[290px] shrink-0 snap-start rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="h-28 bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
                      <img
                        src={ev.poster_data || eventGatheringImg}
                        alt={ev.title}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-slate-950/75 text-white text-[10px] font-mono">
                        {ev.event_date}
                      </span>
                    </div>
                    <div className="p-3.5 space-y-1">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{ev.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span>{ev.venue}</span>
                      </p>
                      <p className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                        {ev.stats?.available_seats ?? ev.max_capacity} seats left
                      </p>
                    </div>
                  </div>
                  <div className="px-3.5 pb-3.5">
                    <button
                      type="button"
                      onClick={() => onNavigate('events', { eventSlug: ev.slug })}
                      className="w-full min-h-[38px] rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold active:scale-[0.98] cursor-pointer"
                    >
                      Register
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Horizontal Swipeable Organization Info Cards */}
        <section className="space-y-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-0.5">
            {lang === 'gu' ? 'સંગઠન પરિચય' : 'Organizations'}
          </h2>
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-1 no-scrollbar -mx-1 px-1">
            {ORG_CARDS.map((org) => (
              <button
                key={org.slug}
                type="button"
                onClick={() => onNavigate('about', { orgSlug: org.slug })}
                className="w-[68vw] max-w-[250px] shrink-0 snap-start text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2 active:scale-[0.98] transition-transform cursor-pointer"
              >
                <p className="text-[10px] font-mono text-orange-700 dark:text-orange-400">{org.meta}</p>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{org.shortTitle}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{org.desc}</p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 dark:text-orange-400 pt-0.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Details & FAQ</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Compact Mobile Trust Notice */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Private ID documents remain encrypted for Admins only. Members receive instant official confirmation messages.
          </p>
        </section>
      </div>

      {/* ====================================================================
          DESKTOP / WEB VIEW (>= 768px): Full Web Hero & Multi-Column Grids
      ==================================================================== */}
      <div className="hidden md:block space-y-10">
        {/* Festival Banner Strip */}
        {activeBannerText && (
          <div
            className={`rounded-2xl border px-5 py-3.5 flex items-center justify-between gap-4 ${themeConfig.bannerClasses} ${
              themeSettings?.animations_enabled ? 'festival-gentle-accent' : ''
            }`}
          >
            <div className="flex items-center gap-3 text-sm font-medium">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{activeBannerText}</span>
            </div>
            <span className="text-xs font-mono opacity-80 whitespace-nowrap">
              {themeConfig.name}
            </span>
          </div>
        )}

        {/* Hero Section */}
        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
          <div className={`h-1.5 bg-gradient-to-r ${themeConfig.topStripGradient}`} />
          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <img
                    src={emblemImg}
                    alt="Organization Emblem"
                    className="w-11 h-11 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                  />
                  <span className={`text-xs sm:text-sm font-semibold tracking-wide ${themeConfig.accentTextClass}`}>
                    {t.heroKicker}
                  </span>
                </div>

                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white text-balance leading-tight">
                  {t.heroTitle}
                </h1>

                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                  {t.heroSubtitle}
                </p>
              </div>
            </div>

            <div className="lg:col-span-5 relative min-h-[240px] lg:min-h-full bg-slate-100 dark:bg-slate-800">
              <img
                src={heroBannerImg}
                alt="Cultural & Community Seva Pavilion"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent lg:bg-gradient-to-r lg:from-white/10" />
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <p className="text-xs font-mono opacity-90">Seva · Suraksha · Sanskar</p>
                <p className="text-sm font-semibold">Dedicated Youth, Women & Cultural Wings</p>
              </div>
            </div>
          </div>
        </section>

        {/* THREE PROMINENT PRIMARY ACTION BUTTONS / CARDS */}
        <section aria-label="Primary Organization Actions" className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                Membership & Event Portals
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Select your dedicated wing registration or open the community events portal.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Button 1: Join Bajrang Dal */}
            <button
              type="button"
              onClick={() => onNavigate('join-bajrang-dal')}
              className="group text-left rounded-2xl border border-orange-200 dark:border-orange-900/50 bg-gradient-to-br from-orange-600 to-amber-600 p-6 text-white shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between min-h-[200px]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-xs border border-white/25 flex items-center justify-center shrink-0">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-mono text-orange-100">Youth & Men’s Wing</span>
              </div>
              <div className="mt-6 space-y-1.5">
                <h3 className="text-xl font-bold tracking-tight flex items-center justify-between gap-2">
                  <span>{t.ctaJoinBajrangDal}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </h3>
                <p className="text-sm text-orange-50/90 leading-relaxed">
                  {t.ctaJoinBajrangDalSub}
                </p>
              </div>
            </button>

            {/* Button 2: Join Durga Vahini */}
            <button
              type="button"
              onClick={() => onNavigate('join-durga-vahini')}
              className="group text-left rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-gradient-to-br from-rose-700 to-orange-600 p-6 text-white shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between min-h-[200px]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-xs border border-white/25 flex items-center justify-center shrink-0">
                  <LotusEmblemIcon className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-mono text-rose-100">Women & Girls Wing</span>
              </div>
              <div className="mt-6 space-y-1.5">
                <h3 className="text-xl font-bold tracking-tight flex items-center justify-between gap-2">
                  <span>{t.ctaJoinDurgaVahini}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </h3>
                <p className="text-sm text-rose-50/90 leading-relaxed">
                  {t.ctaJoinDurgaVahiniSub}
                </p>
              </div>
            </button>

            {/* Button 3: Create Event / Events Management */}
            <button
              type="button"
              onClick={() => onNavigate(isAdminSession ? 'admin' : 'events')}
              className="group text-left rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-700 to-teal-700 p-6 text-white shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between min-h-[200px]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-xs border border-white/25 flex items-center justify-center shrink-0">
                  <CalendarPlus className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-mono text-emerald-100">
                  {isAdminSession ? 'Admin Event Builder' : 'Events & Registration'}
                </span>
              </div>
              <div className="mt-6 space-y-1.5">
                <h3 className="text-xl font-bold tracking-tight flex items-center justify-between gap-2">
                  <span>{t.ctaCreateEvent}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </h3>
                <p className="text-sm text-emerald-50/90 leading-relaxed">
                  {t.ctaCreateEventSub}
                </p>
              </div>
            </button>
          </div>
        </section>

        {/* Upcoming Events Preview */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Community & Cultural Events
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Register directly for individual programs with unique event links — no duplicate membership form needed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('events')}
              className="text-sm font-semibold text-orange-700 dark:text-orange-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>View All Events ({events.length})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
              <Calendar className="w-8 h-8 text-orange-600 mx-auto" />
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Upcoming Events Portal Ready
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                Authorized admins can create upcoming Seva, blood donation, or cultural events from the Admin Event Manager, each receiving its own unique registration link.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {upcomingEvents.map((ev) => (
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
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                        {ev.title}
                      </h3>
                      <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                        <p className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono">{ev.event_date} · {ev.event_time}</span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate">{ev.venue}{ev.location_city ? `, ${ev.location_city}` : ''}</span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono">
                            {ev.stats?.available_seats ?? ev.max_capacity} seats available · {ev.stats?.total ?? 0} registered
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="px-5 pb-5">
                    <button
                      type="button"
                      onClick={() => onNavigate('events', { eventSlug: ev.slug })}
                      className="w-full min-h-[42px] rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-sm font-semibold hover:bg-orange-600 transition-colors cursor-pointer"
                    >
                      Register for Event
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Organization Information Quick Cards */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              About the Organizations
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Explore verified history, objectives, activities, structure, and FAQs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {ORG_CARDS.map((org) => (
              <div
                key={org.slug}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <p className="text-xs font-mono text-orange-700 dark:text-orange-400">{org.meta}</p>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{org.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{org.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('about', { orgSlug: org.slug })}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-200 hover:text-orange-600 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Read Full Details & FAQs</span>
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Trust & Security Highlights */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Private Document Vault</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Uploaded ID proofs are never displayed publicly and are accessible strictly to authorized administrators.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Confirmation Message Only</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Members receive an official registration reference and confirmation message—no Digital ID cards are issued.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Consent-First WhatsApp Updates</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Receive verified announcements in Gujarati, Hindi, or English only with explicit consent.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
