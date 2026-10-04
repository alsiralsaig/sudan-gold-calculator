import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Share2,
  PlusSquare,
  CheckCircle2,
  X,
  Download,
  ShieldCheck,
  Sparkles,
  MoreVertical,
  Check,
  Info
} from 'lucide-react';

interface PwaInstallPromptProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PwaInstallPrompt: React.FC<PwaInstallPromptProps> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'android' | 'ios'>('android');
  const [isStandalone, setIsStandalone] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [showManualGuideMsg, setShowManualGuideMsg] = useState(false);

  useEffect(() => {
    // Detect OS
    if (typeof window !== 'undefined') {
      const ua = window.navigator.userAgent.toLowerCase();
      const isApple = /iphone|ipad|ipod/.test(ua);
      setActiveTab(isApple ? 'ios' : 'android');

      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(standalone);

      // Capture beforeinstallprompt event
      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstall);
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    }
  }, []);

  const handleNativeInstall = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
          setInstallSuccess(true);
          setTimeout(() => {
            onClose();
            setInstallSuccess(false);
          }, 2000);
        }
      } catch (err) {
        console.error('Install error:', err);
      }
    } else {
      setShowManualGuideMsg(true);
      setTimeout(() => setShowManualGuideMsg(false), 5000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in overflow-y-auto">
      <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl text-white relative animate-in zoom-in-95 my-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 transition-colors"
          title="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="text-center space-y-1.5 pt-1">
          <div className="w-14 h-14 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5 shadow-xl shadow-amber-500/20">
            <div className="w-full h-full bg-slate-950 rounded-3xl flex items-center justify-center">
              <Smartphone className="w-7 h-7 text-amber-400" />
            </div>
          </div>
          <h3 className="font-black text-lg text-amber-400">
            تثبيت حاسبة الذهب على هاتفك
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            تطبيق سريع ومستقل يعمل بدون متجر وبدون إنترنت دائم
          </p>
        </div>

        {/* Device Switcher Tabs: Android vs iOS */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('android')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'android'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>📱 أندرويد (Android)</span>
          </button>

          <button
            onClick={() => setActiveTab('ios')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'ios'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🍏 آيفون (iPhone / Safari)</span>
          </button>
        </div>

        {/* Tab 1: Android Instructions & Install Button */}
        {activeTab === 'android' && (
          <div className="space-y-3">
            
            {/* Primary Install Button */}
            <button
              onClick={handleNativeInstall}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95 animate-pulse"
            >
              <Download className="w-5 h-5 text-slate-950" />
              <span>{deferredPrompt ? 'تثبيت التطبيق بنقرة واحدة الآن' : 'تثبيت التطبيق على أندرويد'}</span>
            </button>

            {showManualGuideMsg && (
              <div className="p-3 bg-amber-500/20 border border-amber-500/50 rounded-2xl text-amber-300 text-xs font-bold text-center animate-in fade-in">
                اتبع الخطوات الموضحة أدناه لتثبيت التطبيق من قائمة المتصفح 👇
              </div>
            )}

            {/* Step-by-Step Android Guide */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5 text-xs text-slate-300">
              <div className="flex items-center gap-2 text-amber-400 font-bold border-b border-slate-800/80 pb-2">
                <Sparkles className="w-4 h-4" />
                <span>خطوات التثبيت في متصفح كروم / سامسونج (Android):</span>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                    1
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>اضغط على زر القائمة</span>
                    <span className="p-1 bg-slate-800 rounded text-amber-400 font-bold inline-flex items-center gap-0.5">
                      <MoreVertical className="w-3.5 h-3.5" /> (الثلاث نقاط ⋮)
                    </span>
                    <span>في أعلى زاوية المتصفح.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                    2
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>اختر من القائمة</span>
                    <span className="p-1 bg-amber-500/20 text-amber-300 font-bold rounded inline-flex items-center gap-0.5">
                      <Download className="w-3 h-3" /> «تثبيت التطبيق»
                    </span>
                    <span>(Install app).</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                    3
                  </span>
                  <p>
                    اضغط على <b className="text-white">تثبيت (Install)</b> وسيظهر التطبيق فوراً كبرنامج مستقل بأيقونة الذهب في قائمة تطبيقات هاتفك!
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: iOS Instructions */}
        {activeTab === 'ios' && (
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold border-b border-slate-800 pb-2">
              <Sparkles className="w-4 h-4" />
              <span>خطوات التثبيت على الآيفون (iPhone / Safari):</span>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                  1
                </span>
                <p>
                  افتح الرابط في متصفح <b className="text-white">سفاري (Safari)</b> على جهاز الآيفون.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
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
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
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
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                  4
                </span>
                <p>
                  اضغط على <b className="text-white">إضافة (Add)</b> في الزاوية العلوية، وسيظهر التطبيق فوراً على شاشتك الرئيسية!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success Feedback */}
        {installSuccess && (
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-2xl flex items-center justify-center gap-2 text-emerald-400 text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>تم تثبيت التطبيق بنجاح! تفقد شاشتك الرئيسية 📱</span>
          </div>
        )}

        {/* Close Button */}
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
