import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Download,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
} from 'lucide-react';
import type { PublicMemberVerification, RegistrationItem } from '../types';
import { downloadMemberIdCardPdf } from '../lib/pdfUtils';
import { apiJson } from '../lib/apiClient';

interface ModalProps {
  member: RegistrationItem | PublicMemberVerification;
  adminToken?: string;
  onClose: () => void;
}

export const MemberIdCardModal: React.FC<ModalProps> = ({ member, adminToken, onClose }) => {
  const [qrUrl, setQrUrl] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [privateDocLoading, setPrivateDocLoading] = useState(false);
  const [privateDoc, setPrivateDoc] = useState<{ name: string; data: string } | null>(null);
  const [privateDocErr, setPrivateDocErr] = useState('');

  const isDv = member.organization_wing === 'durga_vahini';
  const fullRecord = 'id' in member ? member : null;

  useEffect(() => {
    const verifyLink = `${window.location.origin}/?verify=${encodeURIComponent(member.registration_code)}`;
    QRCode.toDataURL(verifyLink, {
      width: 240,
      margin: 1,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
      .then(setQrUrl)
      .catch(() => {});
  }, [member.registration_code]);

  const handleLoadPrivateDoc = async () => {
    if (!fullRecord || !adminToken) return;
    setPrivateDocLoading(true);
    setPrivateDocErr('');
    try {
      const res = await apiJson<{
        identity_doc_name: string;
        identity_doc_data: string;
      }>(`/api/registrations/${fullRecord.id}/document`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.identity_doc_data) {
        setPrivateDocErr('No identity document was uploaded for this application.');
      } else {
        setPrivateDoc({ name: res.identity_doc_name || 'Identity Document', data: res.identity_doc_data });
      }
    } catch (err) {
      setPrivateDocErr(err instanceof Error ? err.message : 'Unable to fetch private document.');
    } finally {
      setPrivateDocLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await downloadMemberIdCardPdf(member);
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden my-8">
        <div className={`px-6 py-4 text-white flex items-center justify-between ${isDv ? 'bg-rose-700' : 'bg-orange-600'}`}>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5" />
            <div>
              <h2 className="text-base font-bold">
                {isDv ? 'Durga Vahini Digital Identity Card' : 'Bajrang Dal Digital Identity Card'}
              </h2>
              <p className="text-xs opacity-90 font-mono">{member.registration_code}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Card Visual */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-[#FAF9F6] dark:bg-slate-800 p-5 flex flex-col sm:flex-row gap-5 items-center sm:items-start">
            <div className="w-24 h-28 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden flex items-center justify-center shrink-0">
              {member.profile_photo_data ? (
                <img src={member.profile_photo_data} alt={member.full_name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-slate-400" />
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-1.5 text-center sm:text-left">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{member.full_name}</h3>
              <p className="font-mono text-xs font-semibold text-orange-700 dark:text-orange-400">
                {member.registration_code} · {isDv ? 'Durga Vahini' : 'Bajrang Dal'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Location: {[member.city_village, member.district, member.state].filter(Boolean).join(', ') || 'Gujarat'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Membership: <strong className={member.membership_status === 'Approved' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>{member.membership_status}</strong> · ID Verification: <strong>{member.identity_verification_status}</strong>
              </p>
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                Registered: {member.registration_date}
              </p>
            </div>

            {qrUrl && (
              <div className="w-24 h-24 rounded-lg border border-slate-200 dark:border-slate-700 bg-white p-1.5 shrink-0">
                <img src={qrUrl} alt="Verification QR" className="w-full h-full object-contain" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf || member.membership_status !== 'Approved'}
              className="flex-1 min-h-[44px] rounded-xl bg-slate-900 dark:bg-orange-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>
                {member.membership_status === 'Approved'
                  ? 'Download Official PDF ID Card'
                  : 'PDF Active After Admin Approval'}
              </span>
            </button>
          </div>

          {/* Admin-Only Private Identity Verification Document Inspector */}
          {fullRecord && adminToken && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Private Identity Verification Document (Admin Only)
                  </span>
                </div>
                {!privateDoc && (
                  <button
                    type="button"
                    onClick={handleLoadPrivateDoc}
                    disabled={privateDocLoading}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {privateDocLoading ? 'Decrypting...' : 'Inspect Uploaded Document'}
                  </button>
                )}
              </div>

              {privateDocErr && (
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{privateDocErr}</span>
                </p>
              )}

              {privateDoc && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    File: {privateDoc.name}
                  </p>
                  {privateDoc.data.startsWith('data:application/pdf') ? (
                    <a
                      href={privateDoc.data}
                      download={privateDoc.name || 'identity-document.pdf'}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 dark:text-orange-400 underline"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Download Submitted PDF Document</span>
                    </a>
                  ) : (
                    <img
                      src={privateDoc.data}
                      alt="Private Verification Document"
                      className="max-h-64 rounded-lg border border-slate-200 dark:border-slate-700 object-contain"
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
