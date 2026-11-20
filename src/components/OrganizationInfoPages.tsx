import React, { useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  BookOpen,
  History,
  Target,
  Activity,
  Network,
  HelpCircle,
  Compass,
  Phone,
  ArrowRight,
} from 'lucide-react';
import type { OrganizationPageItem } from '../types';

interface Props {
  pages: OrganizationPageItem[];
  activeSlug: 'bajrang_dal' | 'vhp' | 'durga_vahini';
  onSelectSlug: (slug: 'bajrang_dal' | 'vhp' | 'durga_vahini') => void;
  onJoinWing: (wing: 'bajrang_dal' | 'durga_vahini') => void;
  onBackHome: () => void;
}

export const OrganizationInfoPages: React.FC<Props> = ({
  pages,
  activeSlug,
  onSelectSlug,
  onJoinWing,
  onBackHome,
}) => {
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const current = pages.find((p) => p.slug === activeSlug) || pages[0];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBackHome}
            className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Organization Information Center
          </h1>
        </div>

        <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1 sm:pb-0 sm:flex-wrap w-full sm:w-auto">
          {[
            { slug: 'bajrang_dal' as const, label: 'Bajrang Dal' },
            { slug: 'vhp' as const, label: 'VHP' },
            { slug: 'durga_vahini' as const, label: 'Durga Vahini' },
          ].map((tab) => (
            <button
              key={tab.slug}
              type="button"
              onClick={() => {
                onSelectSlug(tab.slug);
                setOpenFaqIdx(0);
              }}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeSlug === tab.slug
                  ? tab.slug === 'durga_vahini'
                    ? 'bg-rose-700 text-white'
                    : 'bg-orange-600 text-white'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {current ? (
        <div className="space-y-5">
          {/* Overview Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{current.title}</h2>
                <p className="text-sm text-orange-700 dark:text-orange-400 font-medium mt-0.5">
                  {current.subtitle}
                </p>
              </div>
              {current.slug !== 'vhp' && (
                <button
                  type="button"
                  onClick={() => onJoinWing(current.slug === 'durga_vahini' ? 'durga_vahini' : 'bajrang_dal')}
                  className={`min-h-[42px] px-5 py-2 rounded-xl text-sm font-semibold text-white inline-flex items-center gap-2 shrink-0 cursor-pointer ${
                    current.slug === 'durga_vahini' ? 'bg-rose-700 hover:bg-rose-800' : 'bg-orange-600 hover:bg-orange-700'
                  }`}
                >
                  <span>{current.slug === 'durga_vahini' ? 'Join Durga Vahini' : 'Join Bajrang Dal'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white inline-flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-orange-600" />
                <span>Introduction</span>
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {current.introduction}
              </p>
            </div>
          </div>

          {/* Grid of History, Objectives, Activities, Structure */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { icon: History, title: 'History & Foundation', text: current.history },
              { icon: Target, title: 'Core Objectives', text: current.objectives },
              { icon: Activity, title: 'Key Activities & Seva', text: current.activities },
              { icon: Network, title: 'Organizational Structure', text: current.structure },
            ].map((sec) => {
              const Icon = sec.icon;
              return (
                <div
                  key={sec.title}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-2.5"
                >
                  <h3 className="text-base font-bold text-slate-900 dark:text-white inline-flex items-center gap-2">
                    <Icon className="w-4 h-4 text-orange-600" />
                    <span>{sec.title}</span>
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {sec.text}
                  </p>
                </div>
              );
            })}
          </div>

          {/* New Joinee Guide & Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-2.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white inline-flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-600" />
                <span>New Joinee Guide</span>
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {current.new_joinee_guide}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-2.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white inline-flex items-center gap-2">
                <Phone className="w-4 h-4 text-orange-600" />
                <span>Contact & Coordination</span>
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {current.contact_info}
              </p>
            </div>
          </div>

          {/* FAQs Accordion */}
          {Array.isArray(current.faqs) && current.faqs.length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white inline-flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-orange-600" />
                <span>Frequently Asked Questions (FAQs)</span>
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {current.faqs.map((faq, idx) => (
                  <div key={idx} className="py-3">
                    <button
                      type="button"
                      onClick={() => setOpenFaqIdx(openFaqIdx === idx ? null : idx)}
                      className="w-full flex items-center justify-between gap-4 text-left text-sm font-semibold text-slate-900 dark:text-white cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      {openFaqIdx === idx ? (
                        <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </button>
                    {openFaqIdx === idx && (
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {faq.a}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
