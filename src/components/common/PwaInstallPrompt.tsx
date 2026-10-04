import React, { useState, useEffect } from 'react';
import { Smartphone, Share2, PlusSquare, CheckCircle2, X, Download, ShieldCheck, Sparkles } from 'lucide-react';

interface PwaInstallPromptProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PwaInstallPrompt: React.FC<PwaInstallPromptProps> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running on iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(ios);

    // Check if already installed
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Capture install prompt for Android/Chrome
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl text-white relative animate-in zoom-in-95">
        
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="text-center space-y-2 pt-2">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5 shadow-xl shadow-amber-500/20">
            <div className="w-full h-full bg-slate-950 rounded-3xl flex items-center justify-center">
              <Smartphone className="w-8 h-8 text-amber-400" />
            </div>
          </div>
          <h3 className="font-black text-lg text-amber-400">
            تثبيت حاسبة الذهب على جهازك
          </h3>
          <p className="text-xs text-slate-300">
            احصل على تجربة التطبيق الأصلي السريع بدون متجر وبدون الحاجة لإنترنت دائم
          </p>
        </div>

        {/* iOS Step by Step Instructions */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold border-b border-slate-800 pb-2">
            <Sparkles className="w-4 h-4" />
            <span>خطوات التثبيت على الآيفون (iPhone / Safari):</span>
          </div>

          <div className="space-y-2.5 text-xs text-slate-300">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                1
              </span>
              <p>
                افتح الرابط في متصفح <b className="text-white">سفاري (Safari)</b> على جهاز الآيفون.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                2
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span>اضغط على زر المشاركة</span>
                <span className="p-1 bg-slate-800 rounded text-cyan-400 inline-flex items-center gap-0.5">
                  <Share2 className="w-3.5 h-3.5" /> (Share)
                </span>
                <span>في أسفل الشاشة.</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                3
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span>اختر</span>
                <span className="p-1 bg-slate-800 rounded text-amber-400 font-bold inline-flex items-center gap-0.5">
                  <PlusSquare className="w-3.5 h-3.5" /> إضافة إلى الشاشة الرئيسية
                </span>
                <span>(Add to Home Screen).</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                4
              </span>
              <p>
                اضغط على <b className="text-white">إضافة (Add)</b> في الزاوية العلوية، وسيظهر التطبيق فوراً على شاشتك الرئيسية!
              </p>
            </div>
          </div>
        </div>

        {/* Android Native Install Button if Available */}
        {deferredPrompt && (
          <button
            onClick={handleInstallClick}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-black text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            <Download className="w-5 h-5" />
            <span>تثبيت التطبيق بنقرة واحدة الآن</span>
          </button>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors"
        >
          فهمت ذلك، إغلاق
        </button>

      </div>
    </div>
  );
};
