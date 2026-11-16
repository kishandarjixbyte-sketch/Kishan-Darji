-- ============================================================================
-- JOIN BAJRANG DAL - SUPABASE POSTGRESQL PRODUCTION SCHEMA & RLS POLICIES
-- Tables: registrations, admins, admin_assignments, notification_logs,
--         sync_logs, audit_logs, notification_settings
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ADMINS TABLE
CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  mobile TEXT NOT NULL UNIQUE,
  whatsapp_number TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'sub_admin')) DEFAULT 'sub_admin',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure at most one primary admin
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_primary_admin
  ON public.admins (is_primary) WHERE is_primary = TRUE;

-- 2. REGISTRATIONS TABLE
CREATE TABLE IF NOT EXISTS public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_code TEXT NOT NULL UNIQUE, -- e.g. JBD-2026-1001
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  mobile TEXT NOT NULL UNIQUE CHECK (mobile ~ '^[6-9][0-9]{9}$'),
  age INTEGER NOT NULL CHECK (age >= 18 AND age <= 110),
  dob DATE NOT NULL,
  full_address TEXT NOT NULL CHECK (char_length(full_address) BETWEEN 5 AND 500),
  occupation TEXT NOT NULL CHECK (occupation IN ('Student', 'Job', 'Business', 'Other')),
  status TEXT NOT NULL CHECK (status IN ('New', 'Contacted', 'Follow-up', 'Completed')) DEFAULT 'New',
  assigned_admin_id UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  follow_up_notes TEXT DEFAULT '',
  privacy_consent BOOLEAN NOT NULL DEFAULT FALSE CHECK (privacy_consent = TRUE),
  whatsapp_consent BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'direct_link' CHECK (source IN ('qr_code', 'direct_link', 'admin_manual')),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registrations_assigned_admin ON public.registrations(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON public.registrations(status);
CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON public.registrations(created_at DESC);

-- 3. ADMIN ASSIGNMENTS TABLE
CREATE TABLE IF NOT EXISTS public.admin_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_assignments_reg ON public.admin_assignments(registration_id);
CREATE INDEX IF NOT EXISTS idx_admin_assignments_admin ON public.admin_assignments(admin_id);

-- 4. NOTIFICATION LOGS TABLE (with duplicate prevention constraint)
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  recipient_whatsapp TEXT NOT NULL,
  message_preview TEXT NOT NULL,
  provider_message_id TEXT,
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('sent', 'delivered', 'failed', 'skipped_disabled', 'queued_unconfigured')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (registration_id, recipient_whatsapp)
);

-- 5. SYNC LOGS TABLE (Admin Mobile PWA Synchronization Tracking)
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  records_pulled INTEGER NOT NULL DEFAULT 0,
  records_pushed INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL CHECK (sync_status IN ('synced', 'partial', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_admin_id UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. NOTIFICATION SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  global_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  extra_whatsapp_numbers TEXT[] NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.notification_settings (id, global_enabled, extra_whatsapp_numbers)
VALUES (1, TRUE, '{}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_admins_updated_at ON public.admins;
CREATE TRIGGER trg_admins_updated_at
  BEFORE UPDATE ON public.admins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_registrations_updated_at ON public.registrations;
CREATE TRIGGER trg_registrations_updated_at
  BEFORE UPDATE ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION public.current_admin_id()
RETURNS UUID AS $$
  SELECT id FROM public.admins
  WHERE auth_user_id = auth.uid() AND is_active = TRUE
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins
    WHERE auth_user_id = auth.uid() AND role = 'super_admin' AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Public can submit a registration (INSERT only), never read/update/delete
CREATE POLICY "Public insert registration" ON public.registrations
  FOR INSERT TO anon, authenticated
  WITH CHECK (age >= 18 AND privacy_consent = TRUE);

-- Super Admin has full read/update/delete on registrations; Sub Admin sees assigned only
CREATE POLICY "Admins read authorized registrations" ON public.registrations
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin() OR assigned_admin_id = public.current_admin_id()
  );

CREATE POLICY "Admins update authorized registrations" ON public.registrations
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin() OR assigned_admin_id = public.current_admin_id()
  );

CREATE POLICY "Super Admin delete registrations" ON public.registrations
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- Admins table policies
CREATE POLICY "Admins read self or super admin reads all" ON public.admins
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR auth_user_id = auth.uid());

CREATE POLICY "Super Admin manages admins" ON public.admins
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Assignments, Notification Logs, Sync Logs, Audit Logs
CREATE POLICY "Authorized read assignments" ON public.admin_assignments
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR admin_id = public.current_admin_id());

CREATE POLICY "Super Admin manage assignments" ON public.admin_assignments
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Authorized read notification logs" ON public.notification_logs
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR admin_id = public.current_admin_id());

CREATE POLICY "Admin read/insert own sync logs" ON public.sync_logs
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR admin_id = public.current_admin_id())
  WITH CHECK (admin_id = public.current_admin_id());

CREATE POLICY "Super Admin read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Super Admin manage notification settings" ON public.notification_settings
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
