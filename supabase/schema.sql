-- ============================================================================
-- BAJRANG DAL, VHP & DURGA VAHINI MANAGEMENT PLATFORM - SUPABASE POSTGRESQL SCHEMA
-- Safe to run on fresh or existing databases (idempotent migrations included)
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
  assigned_area TEXT NOT NULL DEFAULT '',
  assigned_district TEXT NOT NULL DEFAULT '',
  assigned_city TEXT NOT NULL DEFAULT '',
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS assigned_area TEXT NOT NULL DEFAULT '';
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS assigned_district TEXT NOT NULL DEFAULT '';
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS assigned_city TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_single_primary_admin
  ON public.admins (is_primary) WHERE is_primary = TRUE;

-- 2. REGISTRATIONS TABLE (Bajrang Dal & Durga Vahini Memberships)
CREATE TABLE IF NOT EXISTS public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_code TEXT NOT NULL UNIQUE,
  organization_wing TEXT NOT NULL DEFAULT 'bajrang_dal' CHECK (organization_wing IN ('bajrang_dal', 'durga_vahini')),
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  father_or_guardian_name TEXT NOT NULL DEFAULT '',
  mobile TEXT NOT NULL UNIQUE CHECK (mobile ~ '^[6-9][0-9]{9}$'),
  whatsapp_number TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  age INTEGER NOT NULL CHECK (age >= 15 AND age <= 110),
  dob DATE NOT NULL,
  full_address TEXT NOT NULL CHECK (char_length(full_address) BETWEEN 5 AND 500),
  city_village TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'Gujarat',
  pincode TEXT NOT NULL DEFAULT '',
  occupation TEXT NOT NULL CHECK (occupation IN ('Student', 'Job', 'Business', 'Other')),
  education TEXT NOT NULL DEFAULT '',
  profile_photo_data TEXT NOT NULL DEFAULT '',
  identity_doc_data TEXT NOT NULL DEFAULT '',
  identity_doc_name TEXT NOT NULL DEFAULT '',
  identity_verification_status TEXT NOT NULL DEFAULT 'Pending' CHECK (identity_verification_status IN ('Pending', 'Verified', 'Rejected')),
  membership_status TEXT NOT NULL DEFAULT 'Pending' CHECK (membership_status IN ('Pending', 'Approved', 'Rejected')),
  registration_date TEXT NOT NULL DEFAULT '',
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

-- Idempotent column upgrades for existing registrations tables
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS organization_wing TEXT NOT NULL DEFAULT 'bajrang_dal';
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS father_or_guardian_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS whatsapp_number TEXT NOT NULL DEFAULT '';
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS city_village TEXT NOT NULL DEFAULT '';
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS district TEXT NOT NULL DEFAULT '';
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'Gujarat';
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS pincode TEXT NOT NULL DEFAULT '';
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS education TEXT NOT NULL DEFAULT '';
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS profile_photo_data TEXT NOT NULL DEFAULT '';
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS identity_doc_data TEXT NOT NULL DEFAULT '';
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS identity_doc_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS identity_verification_status TEXT NOT NULL DEFAULT 'Pending';
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS membership_status TEXT NOT NULL DEFAULT 'Pending';
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS registration_date TEXT NOT NULL DEFAULT '';

-- Backfill registration_date from original created_at for existing legacy registrations
UPDATE public.registrations
SET registration_date = to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')
WHERE registration_date = '' OR registration_date IS NULL;

-- Relax legacy age >= 18 constraint to age >= 15 on existing databases for Durga Vahini
DO $$
DECLARE
  c_name TEXT;
BEGIN
  FOR c_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.registrations'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%age%'
  LOOP
    EXECUTE format('ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS %I', c_name);
  END LOOP;
  ALTER TABLE public.registrations ADD CONSTRAINT registrations_age_check CHECK (age >= 15 AND age <= 110);
END $$;

CREATE INDEX IF NOT EXISTS idx_registrations_assigned_admin ON public.registrations(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON public.registrations(status);
CREATE INDEX IF NOT EXISTS idx_registrations_wing ON public.registrations(organization_wing);
CREATE INDEX IF NOT EXISTS idx_registrations_membership_status ON public.registrations(membership_status);
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

-- 4. NOTIFICATION LOGS TABLE
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID REFERENCES public.registrations(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  recipient_whatsapp TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  message_type TEXT NOT NULL DEFAULT 'registration_alert',
  message_preview TEXT NOT NULL,
  provider_message_id TEXT,
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('sent', 'delivered', 'failed', 'skipped_disabled', 'queued_unconfigured')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notification_logs ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';
ALTER TABLE public.notification_logs ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'registration_alert';

-- 5. SYNC LOGS TABLE
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

-- 8. EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  poster_data TEXT NOT NULL DEFAULT '',
  event_date TEXT NOT NULL,
  event_time TEXT NOT NULL DEFAULT '10:00',
  venue TEXT NOT NULL,
  location_city TEXT NOT NULL DEFAULT '',
  reg_start_date TEXT NOT NULL DEFAULT '',
  reg_end_date TEXT NOT NULL DEFAULT '',
  max_capacity INTEGER NOT NULL DEFAULT 200 CHECK (max_capacity >= 1),
  registration_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  category TEXT NOT NULL DEFAULT 'Seva',
  organization_wing TEXT NOT NULL DEFAULT 'all' CHECK (organization_wing IN ('all', 'bajrang_dal', 'durga_vahini', 'vhp')),
  created_by UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);

-- 9. EVENT REGISTRATIONS TABLE (Event-specific registrations independent of membership)
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  registration_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  mobile TEXT NOT NULL CHECK (mobile ~ '^[6-9][0-9]{9}$'),
  whatsapp_number TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  city_village TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT '',
  age INTEGER NOT NULL DEFAULT 18 CHECK (age >= 12 AND age <= 110),
  organization_wing TEXT NOT NULL DEFAULT 'general',
  notes TEXT NOT NULL DEFAULT '',
  approval_status TEXT NOT NULL DEFAULT 'Pending' CHECK (approval_status IN ('Pending', 'Approved', 'Rejected')),
  whatsapp_consent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, mobile)
);

CREATE INDEX IF NOT EXISTS idx_event_regs_event ON public.event_registrations(event_id);

-- 10. ORGANIZATION INFORMATION PAGES TABLE (Editable via Admin Dashboard)
CREATE TABLE IF NOT EXISTS public.organization_pages (
  slug TEXT PRIMARY KEY CHECK (slug IN ('bajrang_dal', 'vhp', 'durga_vahini')),
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  introduction TEXT NOT NULL DEFAULT '',
  history TEXT NOT NULL DEFAULT '',
  objectives TEXT NOT NULL DEFAULT '',
  activities TEXT NOT NULL DEFAULT '',
  structure TEXT NOT NULL DEFAULT '',
  faqs JSONB NOT NULL DEFAULT '[]'::jsonb,
  new_joinee_guide TEXT NOT NULL DEFAULT '',
  contact_info TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. FESTIVAL THEME SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.theme_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  active_theme TEXT NOT NULL DEFAULT 'normal',
  auto_schedule_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  custom_banner_text TEXT NOT NULL DEFAULT '',
  custom_bg_style TEXT NOT NULL DEFAULT '',
  animations_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  schedules JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.theme_settings (id, active_theme, auto_schedule_enabled, animations_enabled)
VALUES (1, 'normal', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 12. ENCRYPTED BACKUPS TABLE (Daily, Weekly, Manual versioned backups)
CREATE TABLE IF NOT EXISTS public.backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type TEXT NOT NULL CHECK (backup_type IN ('daily_auto', 'weekly_auto', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  record_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  encrypted_payload TEXT NOT NULL DEFAULT '',
  checksum TEXT NOT NULL DEFAULT '',
  error_message TEXT,
  created_by UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backups_created_at ON public.backups(created_at DESC);

-- ============================================================================
-- UPDATED_AT TRIGGERS
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

DROP TRIGGER IF EXISTS trg_events_updated_at ON public.events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_event_regs_updated_at ON public.event_registrations;
CREATE TRIGGER trg_event_regs_updated_at
  BEFORE UPDATE ON public.event_registrations
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
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

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

-- Registrations policies
DROP POLICY IF EXISTS "Public insert registration" ON public.registrations;
CREATE POLICY "Public insert registration" ON public.registrations
  FOR INSERT TO anon, authenticated
  WITH CHECK (age >= 15 AND privacy_consent = TRUE);

DROP POLICY IF EXISTS "Admins read authorized registrations" ON public.registrations;
CREATE POLICY "Admins read authorized registrations" ON public.registrations
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR assigned_admin_id = public.current_admin_id());

DROP POLICY IF EXISTS "Admins update authorized registrations" ON public.registrations;
CREATE POLICY "Admins update authorized registrations" ON public.registrations
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR assigned_admin_id = public.current_admin_id());

DROP POLICY IF EXISTS "Super Admin delete registrations" ON public.registrations;
CREATE POLICY "Super Admin delete registrations" ON public.registrations
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- Public read-only access for non-sensitive public tables (events, org pages, theme)
DROP POLICY IF EXISTS "Public read events" ON public.events;
CREATE POLICY "Public read events" ON public.events FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "Public insert event registrations" ON public.event_registrations;
CREATE POLICY "Public insert event registrations" ON public.event_registrations
  FOR INSERT TO anon, authenticated WITH CHECK (age >= 12);

DROP POLICY IF EXISTS "Public read org pages" ON public.organization_pages;
CREATE POLICY "Public read org pages" ON public.organization_pages FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "Public read theme settings" ON public.theme_settings;
CREATE POLICY "Public read theme settings" ON public.theme_settings FOR SELECT TO anon, authenticated USING (TRUE);

-- Admin-only tables
DROP POLICY IF EXISTS "Admins read self or super admin reads all" ON public.admins;
CREATE POLICY "Admins read self or super admin reads all" ON public.admins
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Super Admin manages admins" ON public.admins;
CREATE POLICY "Super Admin manages admins" ON public.admins
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super Admin manage backups" ON public.backups;
CREATE POLICY "Super Admin manage backups" ON public.backups
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
