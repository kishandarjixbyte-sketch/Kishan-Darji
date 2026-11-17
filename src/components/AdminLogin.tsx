import React, { useState } from 'react';
import { Lock, Loader2, AlertCircle, KeyRound, ChevronDown, ChevronUp } from 'lucide-react';
import type { AdminUser } from '../types';
import { apiJson } from '../lib/apiClient';

interface Props {
  onSuccess: (token: string, admin: AdminUser) => void;
}

export const AdminLogin: React.FC<Props> = ({ onSuccess }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDemo, setShowDemo] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim() || !password) {
      setError('Please enter your email or mobile number and password.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiJson<{ token: string; admin: AdminUser }>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      onSuccess(data.token, data.admin);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Authentication failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-orange-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Admin Portal Sign In</h1>
            <p className="text-xs text-slate-500">Super Admin & Sub Admin Access</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="admin-id" className="block text-sm font-medium text-slate-800 mb-1.5">
              Email or Mobile Number
            </label>
            <input
              id="admin-id"
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="superadmin@bajrangdal.org"
              className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-600/15"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium text-slate-800 mb-1.5">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-600/15"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <span>Sign In to Admin Dashboard</span>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowDemo(!showDemo)}
            className="w-full flex items-center justify-between text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <span className="inline-flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-orange-600" />
              Seeded Admin Test Accounts
            </span>
            {showDemo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showDemo && (
            <div className="mt-3 space-y-2.5 text-xs">
              <div className="rounded-xl border border-slate-200 bg-[#FAF9F6] p-3 flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">Kishan Darji (Primary Super Admin)</p>
                  <p className="font-mono text-slate-600">9638236795 · Admin@2026</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIdentifier('9638236795');
                    setPassword('Admin@2026');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 font-medium hover:bg-slate-50 cursor-pointer shrink-0"
                >
                  Fill
                </button>
              </div>
              <div className="rounded-xl border border-slate-200 bg-[#FAF9F6] p-3 flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">Ronakisinh Parmar (Super Admin)</p>
                  <p className="font-mono text-slate-600">9016877373 · Admin@2026</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIdentifier('9016877373');
                    setPassword('Admin@2026');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 font-medium hover:bg-slate-50 cursor-pointer shrink-0"
                >
                  Fill
                </button>
              </div>
              <div className="rounded-xl border border-slate-200 bg-[#FAF9F6] p-3 flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">Sub Admin</p>
                  <p className="font-mono text-slate-600">subadmin@bajrangdal.org · SubAdmin@2026</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIdentifier('subadmin@bajrangdal.org');
                    setPassword('SubAdmin@2026');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 font-medium hover:bg-slate-50 cursor-pointer shrink-0"
                >
                  Fill
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
