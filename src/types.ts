export type Language = 'en' | 'gu';
export type AdminRole = 'super_admin' | 'sub_admin';
export type OccupationType = 'Student' | 'Job' | 'Business' | 'Other';
export type RegistrationStatus = 'New' | 'Contacted' | 'Follow-up' | 'Completed';

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
  created_at: string;
  updated_at: string;
}

export interface RegistrationItem {
  id: string;
  registration_code: string;
  full_name: string;
  mobile: string;
  age: number;
  dob: string;
  full_address: string;
  occupation: OccupationType;
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
  today: number;
  newCount: number;
  contactedCount: number;
  followUpCount: number;
  completedCount: number;
}

export interface NotificationLogItem {
  id: string;
  registration_id: string;
  registration_code?: string;
  registrant_name?: string;
  recipient_whatsapp: string;
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
