import * as XLSX from 'xlsx';
import type { EventRegistrationItem, RegistrationItem } from '../types';

function formatMemberRows(records: RegistrationItem[]) {
  return records.map((r) => ({
    'Registration ID': r.registration_code,
    Wing: r.organization_wing === 'durga_vahini' ? 'Durga Vahini' : 'Bajrang Dal',
    'Full Name': r.full_name,
    'Father / Guardian Name': r.father_or_guardian_name || '',
    'Mobile Number': r.mobile,
    'WhatsApp Number': r.whatsapp_number || r.mobile,
    Email: r.email || '',
    Age: r.age,
    'Date of Birth': r.dob,
    'Full Address': r.full_address,
    'City / Village': r.city_village || '',
    District: r.district || '',
    State: r.state || '',
    Pincode: r.pincode || '',
    Occupation: r.occupation,
    Education: r.education || '',
    'Membership Status': r.membership_status,
    'ID Verification': r.identity_verification_status,
    'Follow-up Status': r.status,
    'Assigned Admin': r.assigned_admin_name || 'Unassigned',
    'Registration Date': r.registration_date || r.created_at.slice(0, 10),
    'Follow-up Notes': r.follow_up_notes || '',
  }));
}

export function exportRegistrationsToExcel(
  records: RegistrationItem[],
  filenamePrefix = 'Sangathan_Members'
) {
  const rows = formatMemberRows(records);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Members');
  const dateTag = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filenamePrefix}_${dateTag}.xlsx`);
}

export function exportRegistrationsToCsv(
  records: RegistrationItem[],
  filenamePrefix = 'Sangathan_Members'
) {
  const rows = formatMemberRows(records);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateTag = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `${filenamePrefix}_${dateTag}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatEventParticipantRows(records: EventRegistrationItem[]) {
  return records.map((r) => ({
    'Pass ID': r.registration_code,
    'Full Name': r.full_name,
    Mobile: r.mobile,
    WhatsApp: r.whatsapp_number,
    Email: r.email || '',
    Age: r.age,
    'City / Village': r.city_village,
    District: r.district,
    Wing: r.organization_wing,
    'Approval Status': r.approval_status,
    Notes: r.notes || '',
    'Registered At': new Date(r.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
  }));
}

export function exportEventRegistrationsToExcel(
  records: EventRegistrationItem[],
  eventSlug: string
) {
  const rows = formatEventParticipantRows(records);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Participants');
  XLSX.writeFile(workbook, `Event_${eventSlug}_Participants.xlsx`);
}

export function exportEventRegistrationsToCsv(
  records: EventRegistrationItem[],
  eventSlug: string
) {
  const rows = formatEventParticipantRows(records);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Event_${eventSlug}_Participants.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
