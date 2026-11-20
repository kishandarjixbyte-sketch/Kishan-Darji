import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { PublicMemberVerification, RegistrationItem } from '../types';

export async function downloadMemberIdCardPdf(
  member: Pick<
    RegistrationItem | PublicMemberVerification,
    | 'registration_code'
    | 'full_name'
    | 'organization_wing'
    | 'membership_status'
    | 'identity_verification_status'
    | 'district'
    | 'city_village'
    | 'state'
    | 'registration_date'
    | 'profile_photo_data'
  >
) {
  const isDv = member.organization_wing === 'durga_vahini';
  const wingName = isDv ? 'Durga Vahini (VHP Women’s Wing)' : 'Bajrang Dal (VHP Youth Wing)';
  const verifyUrl = `${window.location.origin}/?verify=${encodeURIComponent(member.registration_code)}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 320,
    margin: 1,
    color: { dark: '#0F172A', light: '#FFFFFF' },
  });

  // Standard landscape ID card format (85.6mm x 54mm scaled x2 for crisp print)
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [180, 114] });
  const w = 180;

  // Card background
  pdf.setFillColor(250, 249, 246);
  pdf.rect(0, 0, w, 114, 'F');

  // Header band
  if (isDv) {
    pdf.setFillColor(190, 18, 60); // Rose crimson for Durga Vahini
  } else {
    pdf.setFillColor(234, 88, 12); // Saffron orange for Bajrang Dal
  }
  pdf.rect(0, 0, w, 24, 'F');

  // Green tricolour bottom strip
  pdf.setFillColor(21, 128, 61);
  pdf.rect(0, 108, w, 6, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text(wingName, 10, 11);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('OFFICIAL DIGITAL MEMBERSHIP IDENTITY CARD', 10, 18);

  // Member Photo Box
  pdf.setDrawColor(203, 213, 225);
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(10, 32, 34, 42, 2, 2, 'FD');

  if (member.profile_photo_data && member.profile_photo_data.startsWith('data:image/')) {
    try {
      const fmt = member.profile_photo_data.includes('image/png') ? 'PNG' : 'JPEG';
      pdf.addImage(member.profile_photo_data, fmt, 11, 33, 32, 40);
    } catch {
      pdf.setTextColor(100, 116, 139);
      pdf.setFontSize(8);
      pdf.text('PHOTO', 27, 54, { align: 'center' });
    }
  } else {
    pdf.setTextColor(100, 116, 139);
    pdf.setFontSize(8);
    pdf.text('VERIFIED', 27, 51, { align: 'center' });
    pdf.text('MEMBER', 27, 56, { align: 'center' });
  }

  // Member Info
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text(member.full_name, 52, 39);

  pdf.setFont('courier', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(isDv ? 190 : 234, isDv ? 18 : 88, isDv ? 60 : 12);
  pdf.text(`ID: ${member.registration_code}`, 52, 47);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(51, 65, 85);
  const loc = [member.city_village, member.district, member.state].filter(Boolean).join(', ') || 'Gujarat, India';
  pdf.text(`Location: ${loc}`, 52, 57);
  pdf.text(`Membership: ${member.membership_status}`, 52, 64);
  pdf.text(`Identity Verification: ${member.identity_verification_status}`, 52, 71);
  pdf.text(`Registration Date: ${member.registration_date || 'Verified'}`, 52, 78);

  // QR Verification Box
  pdf.setDrawColor(226, 232, 240);
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(134, 32, 36, 36, 2, 2, 'FD');
  pdf.addImage(qrDataUrl, 'PNG', 136, 34, 32, 32);

  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text('Scan to Verify ID', 152, 74, { align: 'center' });

  // Footer disclaimer
  pdf.setFontSize(7.5);
  pdf.setTextColor(71, 85, 105);
  pdf.text(
    'This digital card confirms verified organization registration. Private documents remain confidential.',
    10,
    99
  );

  pdf.save(`${member.registration_code}_Member_ID_Card.pdf`);
}

export function exportMembersReportPdf(records: RegistrationItem[]) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();

  pdf.setFillColor(234, 88, 12);
  pdf.rect(0, 0, pageW, 12, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('Bajrang Dal, VHP & Durga Vahini — Official Member Directory Report', 10, 8);

  pdf.setTextColor(71, 85, 105);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(
    `Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} · Total Records: ${records.length}`,
    10,
    20
  );

  let y = 30;
  pdf.setFillColor(241, 245, 249);
  pdf.rect(10, y - 5, pageW - 20, 7, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('ID Code', 12, y);
  pdf.text('Wing', 42, y);
  pdf.text('Full Name', 72, y);
  pdf.text('Mobile', 124, y);
  pdf.text('City / District', 154, y);
  pdf.text('Membership', 208, y);
  pdf.text('ID Verify', 238, y);
  pdf.text('Follow-up', 265, y);

  y += 8;
  pdf.setFont('helvetica', 'normal');
  for (const r of records) {
    if (y > 192) {
      pdf.addPage();
      y = 20;
    }
    pdf.setTextColor(30, 41, 59);
    pdf.text(r.registration_code.slice(0, 15), 12, y);
    pdf.text(r.organization_wing === 'durga_vahini' ? 'Durga Vahini' : 'Bajrang Dal', 42, y);
    pdf.text(r.full_name.slice(0, 26), 72, y);
    pdf.text(r.mobile, 124, y);
    pdf.text(`${r.city_village || '-'}, ${r.district || '-'}`.slice(0, 26), 154, y);
    pdf.text(r.membership_status, 208, y);
    pdf.text(r.identity_verification_status, 238, y);
    pdf.text(r.status, 265, y);
    y += 7;
  }

  pdf.save(`Sangathan_Members_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
