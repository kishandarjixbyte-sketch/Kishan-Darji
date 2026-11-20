import React, { useEffect, useState } from 'react';
import { Sparkles, Check, Loader2, Calendar } from 'lucide-react';
import type { FestivalThemeId, ThemeScheduleRule, ThemeSettings } from '../../types';
import { FESTIVAL_THEME_LIST } from '../../lib/themes';
import { apiJson } from '../../lib/apiClient';

interface Props {
  token: string;
  themeSettings: ThemeSettings | null;
  onRefresh: () => Promise<void>;
  onBanner: (type: 'success' | 'error', text: string) => void;
}

export const AdminThemeStudio: React.FC<Props> = ({
  token,
  themeSettings,
  onRefresh,
  onBanner,
}) => {
  const [activeTheme, setActiveTheme] = useState<FestivalThemeId>(
    themeSettings?.active_theme || 'normal'
  );
  const [autoSchedule, setAutoSchedule] = useState(
    themeSettings?.auto_schedule_enabled ?? true
  );
  const [customBannerText, setCustomBannerText] = useState(
    themeSettings?.custom_banner_text || ''
  );
  const [animationsEnabled, setAnimationsEnabled] = useState(
    themeSettings?.animations_enabled ?? true
  );
  const [schedules, setSchedules] = useState<ThemeScheduleRule[]>(
    themeSettings?.schedules || []
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (themeSettings) {
      setActiveTheme(themeSettings.active_theme);
      setAutoSchedule(themeSettings.auto_schedule_enabled);
      setCustomBannerText(themeSettings.custom_banner_text || '');
      setAnimationsEnabled(themeSettings.animations_enabled);
      setSchedules(themeSettings.schedules || []);
    }
  }, [themeSettings]);

  const activateThemeImmediately = async (nextTheme: FestivalThemeId) => {
    setActiveTheme(nextTheme);
    setSaving(true);
    try {
      await apiJson('/api/theme', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          active_theme: nextTheme,
          auto_schedule_enabled: autoSchedule,
          custom_banner_text: customBannerText,
          animations_enabled: animationsEnabled,
          schedules,
        }),
      });
      await onRefresh();
      onBanner('success', `Theme activated: ${nextTheme.replace('_', ' ')}`);
    } catch (err) {
      onBanner('error', err instanceof Error ? err.message : 'Failed to activate theme.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-600" />
              <span>Festival-Based Dynamic Theme Studio</span>
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              One-click festival themes with date scheduling, manual override, custom banners, and light/dark harmony.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500">
            Effective Live Theme: {(themeSettings?.effective_theme || activeTheme).replace('_', ' ')}
          </span>
        </div>

        {/* 8 Festival Theme Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {FESTIVAL_THEME_LIST.map((theme) => {
            const isSelected = activeTheme === theme.id;
            return (
              <div
                key={theme.id}
                className={`rounded-2xl border p-4 flex flex-col justify-between space-y-3 transition-all ${
                  isSelected
                    ? 'border-orange-600 bg-orange-50/50 dark:bg-orange-950/20'
                    : 'border-slate-200 dark:border-slate-800 bg-[#FAF9F6] dark:bg-slate-800/50'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {theme.swatchColors.map((hex, i) => (
                        <span
                          key={i}
                          className="w-4 h-4 rounded-md border border-slate-300 dark:border-slate-700"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-orange-600" />}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{theme.name}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{theme.occasion}</p>
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => activateThemeImmediately(theme.id)}
                  className={`w-full min-h-[36px] rounded-xl text-xs font-semibold cursor-pointer ${
                    isSelected
                      ? 'bg-orange-600 text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {isSelected ? 'Active' : 'Activate Theme'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Custom Banner & Scheduling */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Custom Homepage Greeting Banner Override (Optional)
            </label>
            <input
              type="text"
              value={customBannerText}
              onChange={(e) => setCustomBannerText(e.target.value)}
              placeholder="e.g. Shubh Diwali · Annual Seva Camp Open"
              className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
            />
            <label className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSchedule}
                onChange={(e) => setAutoSchedule(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-orange-600"
              />
              <span>Enable Automatic Festival Date Scheduling (when set to Normal Theme)</span>
            </label>
            <label className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={animationsEnabled}
                onChange={(e) => setAnimationsEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-orange-600"
              />
              <span>Enable Subtle Festival Glow Accents</span>
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-orange-600" />
              <span>Automatic Festival Calendar (MM-DD)</span>
            </p>
            <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
              {schedules.map((rule, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center text-xs">
                  <span className="col-span-4 font-semibold truncate text-slate-700 dark:text-slate-300">
                    {rule.theme.replace('_', ' ')}
                  </span>
                  <input
                    type="text"
                    value={rule.start_date}
                    onChange={(e) => {
                      const next = [...schedules];
                      next[idx] = { ...next[idx], start_date: e.target.value };
                      setSchedules(next);
                    }}
                    className="col-span-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 font-mono"
                  />
                  <input
                    type="text"
                    value={rule.end_date}
                    onChange={(e) => {
                      const next = [...schedules];
                      next[idx] = { ...next[idx], end_date: e.target.value };
                      setSchedules(next);
                    }}
                    className="col-span-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 font-mono"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={() => activateThemeImmediately(activeTheme)}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-slate-900 dark:bg-orange-600 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>Save Theme & Schedule Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
