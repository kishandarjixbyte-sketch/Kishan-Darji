export type Language = 'en' | 'gu';
export type WhatsAppLanguage = 'gu' | 'hi' | 'en';
export type WhatsAppTemplateType =
  | 'event_announcement'
  | 'registration_confirmation'
  | 'event_reminder'
  | 'membership_update'
  | 'custom';

export type AdminRole = 'super_admin' | 'sub_admin';
export type OrganizationWing = 'bajrang_dal' | 'durga_vahini';
export type EventWingScope = 'all' | 'bajrang_dal' | 'durga_vahini' | 'vhp';
export type OccupationType = 'Student' | 'Job' | 'Business' | 'Other';
export type RegistrationStatus = 'New' | 'Contacted' | 'Follow-up' | 'Completed';
export type MembershipStatus = 'Pending' | 'Approved' | 'Rejected';
export type IdentityVerificationStatus = 'Pending' | 'Verified' | 'Rejected';
export type EventApprovalStatus = 'Pending' | 'Approved' | 'Rejected';
export type BackupType = 'daily_auto' | 'weekly_auto' | 'manual';
export type FestivalThemeId =
  | 'normal'
  | 'diwali'
  | 'navratri'
  | 'ram_navami'
  | 'hanuman_jayanti'
  | 'janmashtami'
  | 'holi'
  | 'makar_sankranti';

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  mobile: string;
  whatsapp_number: string;
  role: AdminRole;
  is_primary: number;
  notifications_enabled: number;
  is_active: number;
  assigned_area?: string;
  assigned_district?: string;
  assigned_city?: string;
  created_at: string;
  updated_at: string;
}

export interface RegistrationItem {
  id: string;
  registration_code: string;
  organization_wing: OrganizationWing;
  full_name: string;
  father_or_guardian_name: string;
  mobile: string;
  whatsapp_number: string;
  email: string;
  age: number;
  dob: string;
  full_address: string;
  city_village: string;
  district: string;
  state: string;
  pincode: string;
  occupation: OccupationType;
  education: string;
  profile_photo_data: string;
  identity_doc_data?: string;
  identity_doc_name: string;
  has_identity_doc?: boolean;
  identity_verification_status: IdentityVerificationStatus;
  membership_status: MembershipStatus;
  registration_date: string;
  status: RegistrationStatus;
  assigned_admin_id: string | null;
  assigned_admin_name?: string | null;
  follow_up_notes: string;
  privacy_consent: number;
  whatsapp_consent: number;
  source: string;
  created_at: string;
  updated_at: string;
  localSyncStatus?: 'synced' | 'pending';
}

export interface DashboardStats {
  total: number;
  bajrangDalCount: number;
  durgaVahiniCount: number;
  totalEvents: number;
  upcomingEvents: number;
  totalEventRegistrations: number;
  pendingMembershipCount: number;
  approvedMembershipCount: number;
  rejectedMembershipCount: number;
  today: number;
  newCount: number;
  contactedCount: number;
  followUpCount: number;
  completedCount: number;
}

export interface EventItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  poster_data: string;
  event_date: string;
  event_time: string;
  venue: string;
  location_city: string;
  reg_start_date: string;
  reg_end_date: string;
  max_capacity: number;
  registration_enabled: number;
  category: string;
  organization_wing: EventWingScope;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  stats?: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    available_seats: number;
  };
}

export interface EventRegistrationItem {
  id: string;
  event_id: string;
  registration_code: string;
  full_name: string;
  mobile: string;
  whatsapp_number: string;
  email: string;
  city_village: string;
  district: string;
  age: number;
  organization_wing: string;
  notes: string;
  approval_status: EventApprovalStatus;
  whatsapp_consent: number;
  created_at: string;
  updated_at: string;
}

export interface OrganizationFaqItem {
  q: string;
  a: string;
}

export interface OrganizationPageItem {
  slug: 'bajrang_dal' | 'vhp' | 'durga_vahini';
  title: string;
  subtitle: string;
  introduction: string;
  history: string;
  objectives: string;
  activities: string;
  structure: string;
  faqs: OrganizationFaqItem[];
  new_joinee_guide: string;
  contact_info: string;
  updated_by: string | null;
  updated_at: string;
}

export interface ThemeScheduleRule {
  theme: FestivalThemeId;
  start_date: string;
  end_date: string;
  banner_text?: string;
}

export interface ThemeSettings {
  id: number;
  active_theme: FestivalThemeId;
  effective_theme?: FestivalThemeId;
  auto_schedule_enabled: boolean;
  custom_banner_text: string;
  custom_bg_style: string;
  animations_enabled: boolean;
  schedules: ThemeScheduleRule[];
  updated_by: string | null;
  updated_at: string;
}

export interface BackupItem {
  id: string;
  backup_type: BackupType;
  status: 'success' | 'failed';
  record_counts: Record<string, unknown>;
  checksum: string;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CaptchaChallenge {
  token: string;
  question: string;
}

export interface PublicMemberVerification {
  registration_code: string;
  full_name: string;
  organization_wing: OrganizationWing;
  membership_status: MembershipStatus;
  identity_verification_status: IdentityVerificationStatus;
  district: string;
  city_village: string;
  state: string;
  registration_date: string;
  profile_photo_data: string;
}

export interface NotificationLogItem {
  id: string;
  registration_id: string | null;
  registration_code?: string;
  registrant_name?: string;
  recipient_whatsapp: string;
  language?: string;
  message_type?: string;
  message_preview: string;
  provider_message_id: string | null;
  delivery_status: string;
  error_message: string | null;
  created_at: string;
}

export interface SyncLogItem {
  id: string;
  admin_id: string;
  admin_name?: string;
  device_id: string;
  records_pulled: number;
  records_pushed: number;
  sync_status: string;
  created_at: string;
}

export interface AuditLogItem {
  id: string;
  actor_admin_id: string | null;
  actor_name?: string;
  action: string;
  target_table: string;
  target_id: string;
  metadata: string;
  created_at: string;
}
