import React, { useEffect, useState } from 'react';
import { Save, Plus, Trash2, Loader2 } from 'lucide-react';
import type { OrganizationFaqItem, OrganizationPageItem } from '../../types';
import { apiJson } from '../../lib/apiClient';

interface Props {
  token: string;
  pages: OrganizationPageItem[];
  onRefresh: () => Promise<void>;
  onBanner: (type: 'success' | 'error', text: string) => void;
}

export const AdminOrgCms: React.FC<Props> = ({ token, pages, onRefresh, onBanner }) => {
  const [slug, setSlug] = useState<'bajrang_dal' | 'vhp' | 'durga_vahini'>('bajrang_dal');
  const [saving, setSaving] = useState(false);

  const current = pages.find((p) => p.slug === slug);

  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    introduction: '',
    history: '',
    objectives: '',
    activities: '',
    structure: '',
    new_joinee_guide: '',
    contact_info: '',
    faqs: [] as OrganizationFaqItem[],
  });

  useEffect(() => {
    if (current) {
      setForm({
        title: current.title,
        subtitle: current.subtitle,
        introduction: current.introduction,
        history: current.history,
        objectives: current.objectives,
        activities: current.activities,
        structure: current.structure,
        new_joinee_guide: current.new_joinee_guide,
        contact_info: current.contact_info,
        faqs: Array.isArray(current.faqs) ? current.faqs : [],
      });
    }
  }, [current, slug]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiJson(`/api/org-pages/${slug}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      await onRefresh();
      onBanner('success', `${form.title} information updated and published.`);
    } catch (err) {
      onBanner('error', err instanceof Error ? err.message : 'Failed to update page.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSave}
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Organization Information Content Manager
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Edit verified Bajrang Dal, VHP, and Durga Vahini details, FAQs, and new joinee guides.
          </p>
        </div>

        <div className="flex gap-2">
          {[
            { id: 'bajrang_dal' as const, label: 'Bajrang Dal' },
            { id: 'vhp' as const, label: 'VHP' },
            { id: 'durga_vahini' as const, label: 'Durga Vahini' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSlug(item.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                slug === item.id
                  ? 'bg-orange-600 text-white'
                  : 'bg-[#FAF9F6] dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Page Title
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Subtitle
          </label>
          <input
            type="text"
            value={form.subtitle}
            onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
            className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
          />
        </div>

        {[
          { key: 'introduction' as const, label: 'Organization Introduction' },
          { key: 'history' as const, label: 'History' },
          { key: 'objectives' as const, label: 'Objectives' },
          { key: 'activities' as const, label: 'Activities' },
          { key: 'structure' as const, label: 'Organizational Structure' },
          { key: 'new_joinee_guide' as const, label: 'New Joinee Guide' },
        ].map((field) => (
          <div key={field.key}>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {field.label}
            </label>
            <textarea
              rows={3}
              value={form[field.key]}
              onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
            />
          </div>
        ))}

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Contact Information
          </label>
          <input
            type="text"
            value={form.contact_info}
            onChange={(e) => setForm({ ...form, contact_info: e.target.value })}
            className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* FAQs Editor */}
      <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">FAQs</h3>
          <button
            type="button"
            onClick={() => setForm({ ...form, faqs: [...form.faqs, { q: '', a: '' }] })}
            className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 dark:text-orange-400 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add FAQ</span>
          </button>
        </div>
        {form.faqs.map((faq, idx) => (
          <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
            <input
              type="text"
              placeholder="Question"
              value={faq.q}
              onChange={(e) => {
                const next = [...form.faqs];
                next[idx] = { ...next[idx], q: e.target.value };
                setForm({ ...form, faqs: next });
              }}
              className="sm:col-span-5 min-h-[38px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs"
            />
            <input
              type="text"
              placeholder="Answer"
              value={faq.a}
              onChange={(e) => {
                const next = [...form.faqs];
                next[idx] = { ...next[idx], a: e.target.value };
                setForm({ ...form, faqs: next });
              }}
              className="sm:col-span-6 min-h-[38px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs"
            />
            <button
              type="button"
              onClick={() => setForm({ ...form, faqs: form.faqs.filter((_, i) => i !== idx) })}
              className="sm:col-span-1 min-h-[38px] rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 flex items-center justify-center cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Publish Content Changes</span>
        </button>
      </div>
    </form>
  );
};
