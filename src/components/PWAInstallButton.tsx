import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 dark:bg-orange-600 text-white font-medium hover:bg-slate-800 dark:hover:bg-orange-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          compact ? 'px-3 py-2 text-xs min-h-[40px]' : 'px-4 py-2.5 text-sm min-h-[44px]'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Install Mobile App</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          compact ? 'px-3 py-2 text-xs min-h-[40px]' : 'px-4 py-2.5 text-sm min-h-[44px]'
        }`}
      >
        <Smartphone className="w-4 h-4 shrink-0 text-orange-600 dark:text-orange-400" />
        <span>{isIOS ? 'Install on iPhone' : 'Install PWA'}</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Install Join Bajrang Dal on Mobile
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Add the app to your mobile home screen for offline encrypted Admin storage and instant access.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3 text-sm text-slate-700 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-4">
              {isIOS ? (
                <>
                  <p>1. Tap the <strong>Share</strong> icon in your Safari toolbar.</p>
                  <p>2. Scroll down and select <strong>Add to Home Screen</strong>.</p>
                  <p>3. Tap <strong>Add</strong> to install as a standalone app.</p>
                </>
              ) : (
                <>
                  <p>1. Open this site in <strong>Chrome</strong> on Android (or Edge/Chrome on Desktop).</p>
                  <p>2. Tap the browser menu (three dots) in the top corner.</p>
                  <p>3. Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-6 w-full min-h-[44px] rounded-xl bg-slate-900 dark:bg-orange-600 text-white text-sm font-medium hover:bg-slate-800 dark:hover:bg-orange-500 transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
