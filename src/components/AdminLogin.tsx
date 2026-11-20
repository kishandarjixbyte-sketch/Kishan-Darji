import React, { useState } from 'react';
import { Lock, Loader2, AlertCircle } from 'lucide-react';
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
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-900/60 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-orange-700 dark:text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Admin Portal Sign In</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Authorized Administrators Only</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3.5 text-sm text-red-800 dark:text-red-300">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="admin-id" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1.5">
              Email or Mobile Number
            </label>
            <input
              id="admin-id"
              type="text"
              required
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Enter registered email or 10-digit mobile"
              className="w-full min-h-[46px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-base text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-600/15"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1.5">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full min-h-[46px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-base text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-600/15"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] rounded-xl bg-slate-900 dark:bg-orange-600 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 dark:hover:bg-orange-500 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer"
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

        <p className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 text-center">
          Only active Admin accounts created by the Super Admin can sign in.
        </p>
      </div>
    </div>
  );
};
