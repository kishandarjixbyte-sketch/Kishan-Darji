import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { Copy, Check, Download, FileText, Share2, ExternalLink } from 'lucide-react';
import type { Language } from '../types';
import { getTranslations } from '../lib/i18n';

interface Props {
  lang: Language;
  onOpenRegistration: (wing: 'bajrang_dal' | 'durga_vahini') => void;
}

export const QrCodeStudio: React.FC<Props> = ({ lang, onOpenRegistration }) => {
  const t = getTranslations(lang);
  const [targetPortal, setTargetPortal] = useState<'bajrang_dal' | 'durga_vahini' | 'events'>('bajrang_dal');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const directUrl =
    targetPortal === 'durga_vahini'
      ? `${origin}/?view=join-durga-vahini`
      : targetPortal === 'events'
      ? `${origin}/?view=events`
      : `${origin}/?view=join-bajrang-dal`;

  const qrUrl = `${directUrl}&source=qr_code`;
  const portalLabel =
    targetPortal === 'durga_vahini'
      ? 'Join Durga Vahini'
      : targetPortal === 'events'
      ? 'Events & Registration Portal'
      : 'Join Bajrang Dal';

  useEffect(() => {
    if (!origin) return;
    QRCode.toDataURL(qrUrl, {
      width: 640,
      margin: 2,
      color: { dark: '#0F172A', light: '#FFFFFF' },
      errorCorrectionLevel: 'H',
    })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [qrUrl, origin]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(directUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
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

    ctx.fillStyle = targetPortal === 'durga_vahini' ? '#BE123C' : targetPortal === 'events' ? '#047857' : '#EA580C';
    ctx.fillRect(0, 0, canvas.width, 18);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(portalLabel, canvas.width / 2, 118);

    ctx.fillStyle = '#475569';
    ctx.font = '24px sans-serif';
    ctx.fillText('Official Organization & Event Registration Portal', canvas.width / 2, 168);

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
      ctx.fillText('Scan QR Code with Mobile Camera', canvas.width / 2, 900);

      ctx.fillStyle = '#475569';
      ctx.font = '18px monospace';
      ctx.fillText(directUrl, canvas.width / 2, 960);

      const link = document.createElement('a');
      link.download = `${portalLabel.replace(/\s+/g, '_')}_QR_Poster.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    qrImg.src = qrDataUrl;
  };

  const handleDownloadPdf = () => {
    if (!qrDataUrl) return;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();

    pdf.setFillColor(targetPortal === 'durga_vahini' ? 190 : 234, targetPortal === 'durga_vahini' ? 18 : 88, targetPortal === 'durga_vahini' ? 60 : 12);
    pdf.rect(0, 0, pageW, 8, 'F');

    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(26);
    pdf.text(portalLabel, pageW / 2, 34, { align: 'center' });

    pdf.setTextColor(71, 85, 105);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.text('Official Registration & Verification Portal', pageW / 2, 44, { align: 'center' });

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
    pdf.setFontSize(9);
    pdf.text(directUrl, pageW / 2, 230, { align: 'center' });

    pdf.save(`${portalLabel.replace(/\s+/g, '_')}_QR_Poster.pdf`);
  };

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
    `${portalLabel} — Official Registration\nOpen link:\n${directUrl}`
  )}`;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'bajrang_dal' as const, label: 'Join Bajrang Dal QR' },
          { id: 'durga_vahini' as const, label: 'Join Durga Vahini QR' },
          { id: 'events' as const, label: 'Events Portal QR' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTargetPortal(item.id)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer ${
              targetPortal === item.id
                ? 'bg-slate-900 dark:bg-orange-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-5 flex flex-col items-center">
            <div className="w-full max-w-[300px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-[#FAF9F6] dark:bg-slate-800 p-5 text-center">
              <p className="text-xs font-medium text-orange-700 dark:text-orange-400">Official QR Code</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{portalLabel}</h2>
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-center aspect-square">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt={portalLabel} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full bg-slate-100 animate-pulse rounded-lg" />
                )}
              </div>
              <p className="mt-3 text-[11px] text-slate-500 font-mono truncate">{directUrl}</p>
            </div>
          </div>

          <div className="md:col-span-7 space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t.qrTitle}</h2>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{t.qrSubtitle}</p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-[#FAF9F6] dark:bg-slate-800 p-4">
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Direct Portal URL
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={directUrl}
                  className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono text-xs text-slate-800 dark:text-slate-200"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="min-h-[40px] px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-orange-600 text-white text-xs font-medium inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
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
                className="min-h-[46px] rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{t.downloadPng}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                className="min-h-[46px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-orange-600" />
                <span>{t.downloadPdf}</span>
              </button>

              <a
                href={whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[46px] rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5 text-sm font-semibold text-emerald-900 dark:text-emerald-300 inline-flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                <span>{t.shareWhatsApp}</span>
              </a>

              <button
                type="button"
                onClick={() => onOpenRegistration(targetPortal === 'durga_vahini' ? 'durga_vahini' : 'bajrang_dal')}
                className="min-h-[46px] rounded-xl border border-slate-200 dark:border-slate-700 bg-[#FAF9F6] dark:bg-slate-800 px-4 py-2.5 text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Form</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
