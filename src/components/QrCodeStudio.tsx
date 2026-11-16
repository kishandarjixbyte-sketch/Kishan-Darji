import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { Copy, Check, Download, FileText, Share2, ExternalLink } from 'lucide-react';
import type { Language } from '../types';
import { getTranslations } from '../lib/i18n';

interface Props {
  lang: Language;
  onOpenRegistration: () => void;
}

export const QrCodeStudio: React.FC<Props> = ({ lang, onOpenRegistration }) => {
  const t = getTranslations(lang);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const registrationUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/?source=qr_code` : '';
  const directUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/` : '';

  useEffect(() => {
    if (!registrationUrl) return;
    QRCode.toDataURL(registrationUrl, {
      width: 640,
      margin: 2,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    })
      .then(setQrDataUrl)
      .catch((err) => console.error('QR generation failed:', err));
  }, [registrationUrl]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(directUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1120;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FAF9F6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#EA580C';
    ctx.fillRect(0, 0, canvas.width, 18);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Join Bajrang Dal', canvas.width / 2, 118);

    ctx.fillStyle = '#475569';
    ctx.font = '24px sans-serif';
    ctx.fillText('Official Member Registration — Adults 18+ Only', canvas.width / 2, 168);

    const qrImg = new Image();
    qrImg.onload = () => {
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 3;
      ctx.fillRect(150, 220, 600, 600);
      ctx.strokeRect(150, 220, 600, 600);
      ctx.drawImage(qrImg, 180, 250, 540, 540);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('Scan QR Code to Open Registration Form', canvas.width / 2, 900);

      ctx.fillStyle = '#475569';
      ctx.font = '20px monospace';
      ctx.fillText(directUrl, canvas.width / 2, 960);

      ctx.fillStyle = '#EA580C';
      ctx.font = '20px sans-serif';
      ctx.fillText('English · ગુજરાતી', canvas.width / 2, 1020);

      const link = document.createElement('a');
      link.download = 'Join_Bajrang_Dal_QR_Poster.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    qrImg.src = qrDataUrl;
  };

  const handleDownloadPdf = () => {
    if (!qrDataUrl) return;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();

    pdf.setFillColor(234, 88, 12);
    pdf.rect(0, 0, pageW, 8, 'F');

    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(28);
    pdf.text('Join Bajrang Dal', pageW / 2, 34, { align: 'center' });

    pdf.setTextColor(71, 85, 105);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(13);
    pdf.text('Official Member Registration Portal (Adults 18+ Years)', pageW / 2, 44, { align: 'center' });

    pdf.setDrawColor(226, 232, 240);
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(35, 58, 140, 140, 4, 4, 'FD');
    pdf.addImage(qrDataUrl, 'PNG', 43, 66, 124, 124);

    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text('Scan QR Code with Phone Camera', pageW / 2, 218, { align: 'center' });

    pdf.setTextColor(71, 85, 105);
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(10);
    pdf.text(directUrl, pageW / 2, 230, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.text('Or type the URL above in any mobile browser to register.', pageW / 2, 244, { align: 'center' });

    pdf.save('Join_Bajrang_Dal_QR_Poster.pdf');
  };

  const shareText = encodeURIComponent(
    `Join Bajrang Dal – Official Registration\nRegister online using this direct link:\n${directUrl}`
  );
  const whatsappShareUrl = `https://wa.me/?text=${shareText}`;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* QR Card */}
          <div className="md:col-span-5 flex flex-col items-center">
            <div className="w-full max-w-[300px] rounded-2xl border border-slate-200 bg-[#FAF9F6] p-5 text-center">
              <p className="text-xs font-medium text-orange-700">Official Registration QR</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Join Bajrang Dal</h2>

              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-center aspect-square">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Join Bajrang Dal QR Code"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-100 animate-pulse rounded-lg" />
                )}
              </div>

              <p className="mt-3 text-xs text-slate-500 font-mono truncate">{directUrl}</p>
            </div>
          </div>

          {/* Controls & Actions */}
          <div className="md:col-span-7 space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t.qrTitle}</h2>
              <p className="mt-1.5 text-sm sm:text-base text-slate-600 leading-relaxed">
                {t.qrSubtitle}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-[#FAF9F6] p-4">
              <span className="block text-xs font-medium text-slate-500 mb-1.5">
                Permanent Direct Registration URL
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={directUrl}
                  aria-label="Permanent Registration URL"
                  className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono text-xs sm:text-sm text-slate-800"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="min-h-[40px] px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs sm:text-sm font-medium hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? t.linkCopied : t.copyLink}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleDownloadPng}
                className="min-h-[48px] rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-700 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{t.downloadPng}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-orange-600" />
                <span>{t.downloadPdf}</span>
              </button>

              <a
                href={whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[48px] rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 transition-colors inline-flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4 text-emerald-700" />
                <span>{t.shareWhatsApp}</span>
              </a>

              <button
                type="button"
                onClick={onOpenRegistration}
                className="min-h-[48px] rounded-xl border border-slate-200 bg-[#FAF9F6] px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4 text-slate-600" />
                <span>Open Form Directly</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
