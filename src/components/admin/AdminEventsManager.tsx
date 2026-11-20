import React, { useState } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  Copy,
  Check,
  Users,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  X,
} from 'lucide-react';
import type { EventItem, EventRegistrationItem, EventWingScope } from '../../types';
import { apiJson } from '../../lib/apiClient';
import {
  exportEventRegistrationsToCsv,
  exportEventRegistrationsToExcel,
} from '../../lib/exportUtils';

interface Props {
  token: string;
  isSuper: boolean;
  events: EventItem[];
  onRefresh: () => Promise<void>;
  onBanner: (type: 'success' | 'error', text: string) => void;
  onSendEventWhatsApp: (eventId: string) => void;
}

export const AdminEventsManager: React.FC<Props> = ({
  token,
  isSuper,
  events,
  onRefresh,
  onBanner,
  onSendEventWhatsApp,
}) => {
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState('');

  const [participantsEvent, setParticipantsEvent] = useState<EventItem | null>(null);
  const [participants, setParticipants] = useState<EventRegistrationItem[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    poster_data: '',
    event_date: new Date().toISOString().slice(0, 10),
    event_time: '10:00',
    venue: '',
    location_city: '',
    reg_start_date: '',
    reg_end_date: '',
    max_capacity: 200,
    registration_enabled: true,
    category: 'Seva',
    organization_wing: 'all' as EventWingScope,
  });

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const openNew = () => {
    setEditingEvent(null);
    setForm({
      title: '',
      description: '',
      poster_data: '',
      event_date: new Date().toISOString().slice(0, 10),
      event_time: '10:00',
      venue: '',
      location_city: '',
      reg_start_date: '',
      reg_end_date: '',
      max_capacity: 200,
      registration_enabled: true,
      category: 'Seva',
      organization_wing: 'all',
    });
    setShowFormModal(true);
  };

  const openEdit = (ev: EventItem) => {
    setEditingEvent(ev);
    setForm({
      title: ev.title,
      description: ev.description,
      poster_data: ev.poster_data,
      event_date: ev.event_date,
      event_time: ev.event_time,
      venue: ev.venue,
      location_city: ev.location_city,
      reg_start_date: ev.reg_start_date,
      reg_end_date: ev.reg_end_date,
      max_capacity: ev.max_capacity,
      registration_enabled: ev.registration_enabled === 1,
      category: ev.category,
      organization_wing: ev.organization_wing,
    });
    setShowFormModal(true);
  };

  const handlePosterFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 960;
        const scale = img.width > maxW ? maxW / img.width : 1;
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setForm((prev) => ({ ...prev, poster_data: canvas.toDataURL('image/jpeg', 0.8) }));
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingEvent ? `/api/events/${editingEvent.id}` : '/api/events';
      const method = editingEvent ? 'PATCH' : 'POST';
      await apiJson(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(form),
      });
      setShowFormModal(false);
      await onRefresh();
      onBanner('success', editingEvent ? 'Event updated successfully.' : 'New event created with unique registration link.');
    } catch (err) {
      onBanner('error', err instanceof Error ? err.message : 'Failed to save event.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ev: EventItem) => {
    try {
      await apiJson(`/api/events/${ev.id}`, { method: 'DELETE', headers: authHeaders });
      await onRefresh();
      onBanner('success', 'Event deleted.');
    } catch (err) {
      onBanner('error', err instanceof Error ? err.message : 'Failed to delete event.');
    }
  };

  const loadParticipants = async (ev: EventItem) => {
    setParticipantsEvent(ev);
    setLoadingParticipants(true);
    try {
      const data = await apiJson<{ registrations: EventRegistrationItem[] }>(
        `/api/events/${ev.id}/registrations`,
        { headers: authHeaders }
      );
      setParticipants(data.registrations || []);
    } catch (err) {
      onBanner('error', err instanceof Error ? err.message : 'Failed to load participants.');
    } finally {
      setLoadingParticipants(false);
    }
  };

  const handleParticipantStatus = async (regId: string, approval_status: 'Approved' | 'Rejected') => {
    try {
      await apiJson(`/api/event-registrations/${regId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ approval_status }),
      });
      if (participantsEvent) await loadParticipants(participantsEvent);
      await onRefresh();
      onBanner('success', `Participant marked ${approval_status}.`);
    } catch (err) {
      onBanner('error', err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const copyLink = async (ev: EventItem) => {
    const url = `${window.location.origin}/?event=${encodeURIComponent(ev.slug)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(ev.id);
      setTimeout(() => setCopiedId(''), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Event Management & Unique Registration Portals
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Create events with capacity limits, manage participant approvals, export CSV/Excel, and share dedicated event links.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Event</span>
        </button>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-2">
          <Calendar className="w-8 h-8 text-orange-600 mx-auto" />
          <p className="text-base font-semibold text-slate-900 dark:text-white">No Events Created Yet</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Click "Create New Event" to publish your first event and generate its unique registration link.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-mono text-orange-700 dark:text-orange-400">
                    {ev.category} · {ev.organization_wing.replace('_', ' ').toUpperCase()} ·{' '}
                    {ev.registration_enabled === 1 ? 'Registration Open' : 'Closed'}
                  </p>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{ev.title}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-1">
                    {ev.event_date} {ev.event_time} · {ev.venue} {ev.location_city ? `(${ev.location_city})` : ''}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 rounded-xl bg-[#FAF9F6] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 text-center">
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Total</p>
                  <p className="font-mono font-bold text-slate-900 dark:text-white">{ev.stats?.total ?? 0}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Approved</p>
                  <p className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{ev.stats?.approved ?? 0}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Pending</p>
                  <p className="font-mono font-bold text-amber-700 dark:text-amber-400">{ev.stats?.pending ?? 0}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Seats Left</p>
                  <p className="font-mono font-bold text-slate-900 dark:text-white">{ev.stats?.available_seats ?? ev.max_capacity}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyLink(ev)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedId === ev.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === ev.id ? 'Copied!' : 'Copy Event Link'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => loadParticipants(ev)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Participants</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSendEventWhatsApp(ev.id)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold cursor-pointer"
                >
                  WhatsApp Update
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(ev)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                {isSuper && (
                  <button
                    type="button"
                    onClick={() => handleDelete(ev)}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Event Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingEvent ? 'Edit Event' : 'Create New Event'}
              </h3>
              <button type="button" onClick={() => setShowFormModal(false)} className="p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Event Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Event Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.event_date}
                    onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Event Time
                  </label>
                  <input
                    type="time"
                    value={form.event_time}
                    onChange={(e) => setForm({ ...form, event_time: e.target.value })}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Venue *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.venue}
                    onChange={(e) => setForm({ ...form, venue: e.target.value })}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    City / Location
                  </label>
                  <input
                    type="text"
                    value={form.location_city}
                    onChange={(e) => setForm({ ...form, location_city: e.target.value })}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Registration Start Date
                  </label>
                  <input
                    type="date"
                    value={form.reg_start_date}
                    onChange={(e) => setForm({ ...form, reg_start_date: e.target.value })}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Registration End Date
                  </label>
                  <input
                    type="date"
                    value={form.reg_end_date}
                    onChange={(e) => setForm({ ...form, reg_end_date: e.target.value })}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Max Participant Capacity
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.max_capacity}
                    onChange={(e) => setForm({ ...form, max_capacity: Number(e.target.value) || 100 })}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Seva / Training / Festival / Blood Camp"
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Wing Scope
                  </label>
                  <select
                    value={form.organization_wing}
                    onChange={(e) => setForm({ ...form, organization_wing: e.target.value as EventWingScope })}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="all">All Wings & Community</option>
                    <option value="bajrang_dal">Bajrang Dal</option>
                    <option value="durga_vahini">Durga Vahini</option>
                    <option value="vhp">VHP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Event Poster Image
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePosterFile}
                    className="text-xs text-slate-600 dark:text-slate-300"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-sm text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.registration_enabled}
                  onChange={(e) => setForm({ ...form, registration_enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-orange-600"
                />
                <span>Enable public online registration</span>
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-emerald-700 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>{editingEvent ? 'Save Changes' : 'Publish Event'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event Participants Modal */}
      {participantsEvent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 my-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Participants: {participantsEvent.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {participants.length} total registered · Approve/Reject or export list
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportEventRegistrationsToExcel(participants, participantsEvent.slug)}
                  disabled={participants.length === 0}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportEventRegistrationsToCsv(participants, participantsEvent.slug)}
                  disabled={participants.length === 0}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
                <button type="button" onClick={() => setParticipantsEvent(null)} className="p-1.5 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {loadingParticipants ? (
              <div className="py-10 text-center text-sm text-slate-500">Loading event participants...</div>
            ) : participants.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">No participants have registered for this event yet.</div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                      <th className="py-2 px-3">Pass ID</th>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Mobile</th>
                      <th className="py-2 px-3">City / District</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {participants.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 px-3 font-mono text-xs text-orange-700 dark:text-orange-400">
                          {p.registration_code}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">{p.full_name}</td>
                        <td className="py-2.5 px-3 font-mono">{p.mobile}</td>
                        <td className="py-2.5 px-3">{[p.city_village, p.district].filter(Boolean).join(', ') || '-'}</td>
                        <td className="py-2.5 px-3 font-semibold">{p.approval_status}</td>
                        <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleParticipantStatus(p.id, 'Approved')}
                            className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                            title="Approve"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleParticipantStatus(p.id, 'Rejected')}
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
