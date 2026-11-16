import React from 'react';
import { Database, MessageSquare, Smartphone, Server } from 'lucide-react';

export const SetupGuide: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Architecture, Supabase SQL & Deployment Guide
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
          Complete setup instructions for central Supabase PostgreSQL mirroring, WhatsApp Business Cloud API alerts, Android PWA mobile vault, and public HTTPS hosting.
        </p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 bg-[#FAF9F6] p-5 space-y-2.5">
            <div className="flex items-center gap-2 text-slate-900 font-semibold">
              <Database className="w-4 h-4 text-orange-600" />
              <span>1. Supabase PostgreSQL Setup</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Run <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-slate-200">supabase/schema.sql</code> in the Supabase SQL Editor to create all 7 tables (<code className="font-mono text-xs">registrations</code>, <code className="font-mono text-xs">admins</code>, <code className="font-mono text-xs">admin_assignments</code>, <code className="font-mono text-xs">notification_logs</code>, <code className="font-mono text-xs">sync_logs</code>, <code className="font-mono text-xs">audit_logs</code>, <code className="font-mono text-xs">notification_settings</code>) with Row Level Security (RLS). Add <code className="font-mono text-xs">SUPABASE_URL</code> and <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code> to your server environment variables (never expose service keys to frontend code).
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-[#FAF9F6] p-5 space-y-2.5">
            <div className="flex items-center gap-2 text-slate-900 font-semibold">
              <MessageSquare className="w-4 h-4 text-orange-600" />
              <span>2. WhatsApp Business Cloud API</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Create a Meta Developer App with WhatsApp Business Cloud API enabled. Configure <code className="font-mono text-xs">WHATSAPP_PHONE_NUMBER_ID</code> and <code className="font-mono text-xs">WHATSAPP_ACCESS_TOKEN</code> in your server environment. Notifications omit full residential address and complete date of birth for privacy compliance, and duplicate alerts are blocked automatically.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-[#FAF9F6] p-5 space-y-2.5">
            <div className="flex items-center gap-2 text-slate-900 font-semibold">
              <Smartphone className="w-4 h-4 text-orange-600" />
              <span>3. Admin Phone Encrypted Storage (PWA)</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Open the site in Android Chrome and tap <strong>Install Mobile App</strong>. When an Admin signs in, authorized records sync to an AES-GCM 256-bit encrypted IndexedDB vault on the phone for offline viewing and follow-up updates. Signing out wipes the local vault so public users never access admin data.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-[#FAF9F6] p-5 space-y-2.5">
            <div className="flex items-center gap-2 text-slate-900 font-semibold">
              <Server className="w-4 h-4 text-orange-600" />
              <span>4. Public HTTPS Deployment</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Build the frontend with <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-slate-200">npm run build</code> and start the production Node 22 Express server with <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-slate-200">NODE_ENV=production npm start</code> on port 3000 behind HTTPS (Cloud Run, Railway, Render, or Nginx + Let's Encrypt).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
