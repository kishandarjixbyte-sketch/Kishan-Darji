import * as XLSX from 'xlsx';
import type { RegistrationItem } from '../types';

function formatRows(records: RegistrationItem[]) {
  return records.map((r) => ({
    'Registration ID': r.registration_code,
    'Full Name': r.full_name,
    'Mobile Number': r.mobile,
    Age: r.age,
    'Date of Birth': r.dob,
    'Full Address': r.full_address,
    Occupation: r.occupation,
    Status: r.status,
    'Assigned Admin': r.assigned_admin_name || 'Unassigned',
    'Follow-up Notes': r.follow_up_notes || '',
    Source: r.source,
    'Submitted At': new Date(r.created_at).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
    }),
  }));
}

export function exportRegistrationsToExcel(records: RegistrationItem[], filenamePrefix = 'Join_Bajrang_Dal_Registrations') {
  const rows = formatRows(records);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Registrations');
  const dateTag = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filenamePrefix}_${dateTag}.xlsx`);
}

export function exportRegistrationsToCsv(records: RegistrationItem[], filenamePrefix = 'Join_Bajrang_Dal_Registrations') {
  const rows = formatRows(records);
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
