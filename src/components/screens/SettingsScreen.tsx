import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  ChevronLeft,
  Cloud,
  CloudLightning,
  Download,
  Eye,
  EyeOff,
  Info,
  Laptop,
  Lock,
  LogIn,
  LogOut,
  Moon,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Sun,
  Timer,
  Trash2,
  UserPlus,
  Store,
  History,
} from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { BranchesSection } from '../settings/BranchesSection';
import { NotificationsSection } from '../settings/NotificationsSection';
import { fmtNum } from '../../core/format';
import { DEFAULT_STORE_NAME, normalizeStoreName } from '../../core/branding';
import { describeSnapshot, isAccountSwitch } from '../../core/session';
import { APP_VERSION_LABEL } from '../../core/version';

interface SettingsScreenProps {
  onOpenInstallModal?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = () => {
  const {
    pinCode,
    setPinCode,
    verifyPin,
    userEmail,
    themeMode,
    setThemeMode,
    lastSyncTime,
    isCloudSignedIn,
    signInCloud,
    signUpCloud,
    signOutCloud,
    syncWithCloud,
    refreshFromCloud,
    inspectCloud,
    pendingSync,
    syncError,
    allPurchases,
    allSales,
    allExpenses,
    allLoans,
    branches,
    activeBranchId,
    setActiveBranchId,
    purchases,
    sales,
    expenses,
    partners,
    exportData,
    exportCsv,
    importData,
    resetAllData,
    rates,
    setLocalPremium,
    deletedCount,
    storeName,
    setStoreName,
    lastAccountEmail,
    snapshotMeta,
    hasLocalRecords,
    restoreSnapshot,
    discardSnapshot,
  } = useGoldStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security / PIN Dialog State
  const [showPinModal, setShowPinModal] = useState(false);
  const [oldPinInput, setOldPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');

  // Auto Lock Timeout
  const [autoLockSeconds, setAutoLockSeconds] = useState<number>(60);
  const [showAutoLockModal, setShowAutoLockModal] = useState(false);

  // Cloud Auth & Sync Form State
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [inputEmail, setInputEmail] = useState(userEmail || '');
  const [inputPassword, setInputPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudInfo, setCloudInfo] = useState<string>('');
  const [checkingCloud, setCheckingCloud] = useState(false);
  const [syncToast, setSyncToast] = useState('');

  // اسم المحل — مسودة محلية تُحفظ بضغطة
  const [storeNameDraft, setStoreNameDraft] = useState(storeName);
  useEffect(() => {
    setStoreNameDraft(storeName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeName]);

  const storeNameDirty = normalizeStoreName(storeNameDraft) !== storeName;

  /** إجمالي السجلات المحلية على الجهاز */
  const localRecordCount =
    allPurchases.length + allSales.length + allExpenses.length + partners.length + allLoans.length;

  const saveStoreName = () => {
    const clean = normalizeStoreName(storeNameDraft);
    setStoreName(clean);
    setStoreNameDraft(clean);
    setSyncToast(`تم حفظ اسم المحل: ${clean}`);
    setTimeout(() => setSyncToast(''), 2500);
  };

  // تعديل سعر السوق المحلي
  const [premiumInput, setPremiumInput] = useState(String(rates.localPremiumPercent ?? 0));

  // Load auto lock timeout from storage
  useEffect(() => {
    try {
      const savedLockTime = localStorage.getItem('gold_auto_lock_time');
      if (savedLockTime) setAutoLockSeconds(parseInt(savedLockTime, 10));
    } catch (_) {}
  }, []);

  const getAutoLockLabel = (s: number) => {
    switch (s) {
      case 0:
        return 'فوراً';
      case 30:
        return 'بعد 30 ثانية';
      case 60:
        return 'بعد دقيقة';
      case 300:
        return 'بعد 5 دقائق';
      case 1800:
        return 'بعد 30 دقيقة';
      default:
        return `بعد ${s} ثانية`;
    }
  };

  // PIN Save Handler
  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    if (pinCode) {
      const ok = await verifyPin(oldPinInput);
      if (!ok) {
        setPinError('كلمة السر الحالية غير صحيحة');
        return;
      }
    }
    if (newPinInput.length !== 4) {
      setPinError('يجب أن يتكون الرقم السري من 4 أرقام بالضبط');
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setPinError('الرقم الجديد غير مطابق للتأكيد');
      return;
    }

    await setPinCode(newPinInput);
    setShowPinModal(false);
    setOldPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setPinSuccess('تم تغيير كلمة السر بنجاح ✅');
    setTimeout(() => setPinSuccess(''), 3000);
  };

  const handleRemovePin = async () => {
    if (confirm('هل تريد إلغاء كلمة السر ورمز القفل تماماً؟')) {
      await setPinCode('');
      setShowPinModal(false);
      setPinSuccess('تم إلغاء قفل التطبيق');
      setTimeout(() => setPinSuccess(''), 3000);
    }
  };

  // Cloud Authentication (Password-Protected to isolate merchants)
  const handleCloudAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    // تبديل حساب: الجهاز فيه بيانات حساب آخر — نحفظ نسخة ونبدأ نظيفاً
    const targetEmail = inputEmail.trim().toLowerCase();
    const switching = isAccountSwitch(lastAccountEmail, targetEmail) && hasLocalRecords;
    let clearLocal = false;
    if (switching) {
      const okSwitch = confirm(
        `تنبيه: هذا الجهاز مسجّل عليه حساب آخر (${lastAccountEmail}).\n\n` +
          `الدخول بحساب مختلف هيبدأ بحساب نظيف، وبيانات الجهاز (${fmtNum(localRecordCount)} سجل) لن تُرفع للحساب الجديد.\n\n` +
          `سنحفظ نسخة داخلية كاملة تقدر ترجّعها بضغطة من «الإعدادات ← البيانات»، وهيتم تنزيل ملف نسخة احتياطية كمان.\n\nمتابعة؟`
      );
      if (!okSwitch) return;
      exportData();
      clearLocal = true;
    }

    setIsSyncing(true);

    if (authMode === 'login') {
      const res = await signInCloud(inputEmail, inputPassword, { clearLocal });
      setIsSyncing(false);
      if (res.success) {
        setSyncToast(res.message);
        setTimeout(() => setSyncToast(''), 3000);
      } else {
        setAuthError(res.message);
      }
    } else {
      const res = await signUpCloud(inputEmail, inputPassword, { clearLocal });
      setIsSyncing(false);
      if (res.success) {
        setSyncToast(res.message);
        setTimeout(() => setSyncToast(''), 3000);
      } else {
        setAuthError(res.message);
      }
    }
  };

  // مزامنة الآن: نتيجة حقيقية (لا رسالة نجاح وهمية)
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncToast('جاري المزامنة مع سحابة المتجر...');
    const ok = await syncWithCloud();
    // syncError يُحدَّث من المتجر عند فشل الإعداد/الجلسة — نتركه ظاهراً
    setIsSyncing(false);
    setSyncToast(
      ok
        ? 'تمت المزامنة بنجاح وحفظ كافة السجلات ⚡'
        : 'تعذر إكمال المزامنة — تأكد من الاتصال بالإنترنت وحاول مرة أخرى'
    );
    setTimeout(() => setSyncToast(''), ok ? 2500 : 5000);
  };

  // سحب تحديثات الأجهزة الأخرى فوراً
  const handlePullNow = async () => {
    setIsSyncing(true);
    setSyncToast('جاري جلب تحديثات الأجهزة الأخرى...');
    const result = await refreshFromCloud(false);
    setIsSyncing(false);
    setSyncToast(
      result.changed
        ? 'تم جلب أحدث البيانات من الأجهزة الأخرى ✅'
        : result.ok
        ? 'بياناتك محدّثة — لا يوجد جديد من الأجهزة الأخرى'
        : 'تعذر الاتصال بالسحابة — تحقق من الإنترنت'
    );
    setTimeout(() => setSyncToast(''), 3000);
  };

  /**
   * تحديث التطبيق فوراً: يحدّث Service Worker ويمسح الكاش القديم ثم يعيد التحميل.
   * مفيد عندما يبقى الجوال يعرض نسخة قديمة بعد النشر.
   */
  const handleForceUpdate = async () => {
    setSyncToast('جاري تحديث التطبيق لأحدث نسخة...');
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update().catch(() => undefined)));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* نتجاهل ونعيد التحميل على أي حال */
    }
    setTimeout(() => window.location.reload(), 700);
  };

  /** فحص السحابة: يعرض عدد السجلات على السيرفر مقابل هذا الجهاز */
  const result_failed = (info: { ok: boolean }) => !info.ok;

  const handleInspectCloud = async () => {
    setCheckingCloud(true);
    setCloudInfo('جاري الفحص...');
    const info = await inspectCloud();
    setCheckingCloud(false);
    if (result_failed(info)) {
      setCloudInfo(
        info.serverNotConfigured
          ? '❌ الخادم غير مهيّأ: مفتاح AUTH_SECRET ناقص في Vercel'
          : info.sessionExpired
          ? '❌ انتهت جلسة الدخول — سجّل الدخول من جديد'
          : '❌ تعذر الوصول للسحابة — تحقق من الإنترنت'
      );
      return;
    }
    const c = info.counts!;
    setCloudInfo(
      `☁️ على السيرفر: ${c.purchases} مشتريات • ${c.sales} مبيعات • ${c.expenses} مصروفات • ${c.loans} سلف` +
        (info.updatedAt ? ` — آخر تحديث: ${new Date(info.updatedAt).toLocaleString('ar-EG')}` : '')
    );
  };

  /**
   * تسجيل الخروج: بيانات الحساب تختفي من الجهاز (زي أي تطبيق محترم)،
   * لكن قبلها نسخة كاملة تلقائياً: لقطة داخلية + ملف نسخة احتياطية.
   */
  const handleSignOut = () => {
    const msg = hasLocalRecords
      ? `تسجيل الخروج: بيانات هذا الجهاز (${fmtNum(localRecordCount)} سجل) هتختفي من الجهاز — لأن نسختك الأصلية محفوظة في حسابك السحابي (${userEmail || 'حسابك'}).\n\n` +
        'قبل الخروج: نسحفظ نسخة داخلية تقدر ترجّعها بضغطة، وهيتم تنزيل ملف نسخة احتياطية كمان.\n\nمتابعة؟'
      : 'تسجيل الخروج من الحساب السحابي على هذا الجهاز؟';
    if (!confirm(msg)) return;
    if (hasLocalRecords) exportData();
    const meta = signOutCloud();
    setSyncToast(
      meta
        ? `تم الخروج — نُسخت ${fmtNum(localRecordCount)} سجل إلى نسخة الاسترجاع`
        : 'تم تسجيل الخروج بنجاح'
    );
    setTimeout(() => setSyncToast(''), 3500);
  };

  // Clipboard Actions
  const handleCopyToClipboard = async () => {
    const data = {
      purchases,
      sales,
      expenses,
      partners,
      exportedAt: new Date().toISOString(),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      alert('تم نسخ البيانات إلى الحافظة — يمكنك مشاركتها عبر الواتساب أو حفظها في الملاحظات!');
    } catch (_) {
      alert('تعذر النسخ إلى الحافظة');
    }
  };

  const handleRestoreFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        alert('الحافظة فارغة، انسخ البيانات أولاً');
        return;
      }
      if (confirm('سيتم استبدال كافة البيانات الحالية بالبيانات الملصوقة. هل تريد المتابعة؟')) {
        const ok = importData(text);
        if (ok) {
          alert('تمت استعادة البيانات بنجاح!');
        } else {
          alert('البيانات غير صالحة أو تالفة');
        }
      }
    } catch (_) {
      alert('يرجى منح إذن قراءة الحافظة للمتصفح');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        if (confirm('هل أنت متأكد من استعادة هذه النسخة الاحتياطية؟')) {
          const ok = importData(content);
          if (ok) {
            alert('تمت استعادة ملف النسخة الاحتياطية بنجاح!');
          } else {
            alert('الملف غير صالح');
          }
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-6 animate-in fade-in duration-200">
      
      {/* 0. SECTION: اسم المحل — يظهر في كل الرسائل والفواتير */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3 shadow-md">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-500/15 border border-amber-500/30 rounded-xl">
            <Store className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-sm text-white">اسم المحل</h3>
            <p className="text-[11px] text-slate-400">يظهر في ترويسة رسائل الواتساب، الفواتير، التقارير، والتذكيرات</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={storeNameDraft}
            onChange={(e) => setStoreNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveStoreName();
            }}
            placeholder={DEFAULT_STORE_NAME}
            className="flex-1 min-w-0 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
          />
          <button
            onClick={saveStoreName}
            disabled={!storeNameDirty}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-black transition-colors ${
              storeNameDirty
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            حفظ
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-slate-400">هكذا تظهر الترويسة في الرسالة:</span>
          <span className="font-black text-amber-300 truncate">{'*' + normalizeStoreName(storeNameDraft) + '*'}</span>
        </div>

        {normalizeStoreName(storeNameDraft) !== DEFAULT_STORE_NAME && (
          <button
            onClick={() => {
              setStoreNameDraft(DEFAULT_STORE_NAME);
              setStoreName(DEFAULT_STORE_NAME);
              setSyncToast(`تمت استعادة الاسم الافتراضي: ${DEFAULT_STORE_NAME}`);
              setTimeout(() => setSyncToast(''), 2500);
            }}
            className="text-[11px] font-bold text-slate-400 hover:text-amber-300 transition-colors"
          >
            استعادة الاسم الافتراضي ({DEFAULT_STORE_NAME})
          </button>
        )}
      </div>

      {/* 1. SECTION: الأمان وقفل التطبيق */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden divide-y divide-slate-800/80 shadow-md">
        
        {/* تغيير كلمة السر */}
        <div
          onClick={() => setShowPinModal(true)}
          className="p-4 flex items-center justify-between hover:bg-slate-800/50 cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">تغيير كلمة السر</h3>
              <p className="text-xs text-slate-400">
                {pinCode ? 'الرقم السري مفعّل (4 أرقام)' : 'الرقم السري المكوّن من 4 أرقام'}
              </p>
            </div>
          </div>
          <ChevronLeft className="w-5 h-5 text-slate-500" />
        </div>

        {/* القفل التلقائي */}
        <div
          onClick={() => setShowAutoLockModal(true)}
          className="p-4 flex items-center justify-between hover:bg-slate-800/50 cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">القفل التلقائي</h3>
              <p className="text-xs text-amber-400 font-bold">{getAutoLockLabel(autoLockSeconds)}</p>
            </div>
          </div>
          <ChevronLeft className="w-5 h-5 text-slate-500" />
        </div>

      </div>

      {/* 2. SECTION: المظهر (Dark / Light / System) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1 text-amber-400 font-black text-sm border-r-4 border-amber-500 pr-2">
          <span>المظهر</span>
        </div>

        <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-3xl">
          
          <button
            onClick={() => setThemeMode('light')}
            className={`py-3 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              themeMode === 'light'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white bg-slate-950/60'
            }`}
          >
            <Sun className="w-4 h-4" />
            <span>فاتح</span>
            {themeMode === 'light' && <Check className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setThemeMode('dark')}
            className={`py-3 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              themeMode === 'dark'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white bg-slate-950/60'
            }`}
          >
            <Moon className="w-4 h-4" />
            <span>داكن</span>
            {themeMode === 'dark' && <Check className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setThemeMode('system')}
            className={`py-3 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              themeMode === 'system'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white bg-slate-950/60'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>النظام</span>
            {themeMode === 'system' && <Check className="w-3.5 h-3.5" />}
          </button>

        </div>
      </div>

      {/* 3. SECTION: المزامنة بين الأجهزة (Protected by Store Email + Password) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1 text-emerald-400 font-black text-sm border-r-4 border-emerald-500 pr-2">
          <span>المزامنة بين الأجهزة</span>
        </div>

        {isCloudSignedIn && userEmail ? (
          /* Active Green Cloud Card matching Flutter Screenshot */
          <div className="bg-emerald-950/25 border-2 border-emerald-500/50 rounded-3xl p-5 space-y-4 shadow-xl">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <h4 className="font-black text-emerald-400 text-base flex items-center gap-1.5">
                  <span>المزامنة مفعّلة</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </h4>
              </div>
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-full">
                <Cloud className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-emerald-950/60 p-3 rounded-2xl border border-emerald-800/60 text-center space-y-1">
              <div className="text-sm font-mono text-emerald-300 font-bold tracking-wide">
                {userEmail}
              </div>
              <span className="text-[10px] text-emerald-400 font-bold block">
                حساب المتجر محمي ومشفر بكلمة سر خاصة 🔒
              </span>
            </div>

            <div className="text-xs text-slate-300 text-center font-semibold">
              آخر مزامنة: <span className="font-mono text-emerald-400 font-bold">{lastSyncTime}</span>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleSignOut}
                className="py-2.5 px-4 bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                title="تسجيل الخروج لمنع مزامنة هذا الجهاز"
              >
                <LogOut className="w-4 h-4" />
                <span>خروج</span>
              </button>

              <button
                onClick={handleTriggerSync}
                disabled={isSyncing}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-slate-950 font-black text-xs rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 text-slate-950 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>مزامنة الآن</span>
              </button>
            </div>

            <button
              onClick={handlePullNow}
              disabled={isSyncing}
              className="w-full py-2.5 bg-slate-900/90 hover:bg-slate-800 text-emerald-300 border border-emerald-700/60 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              <span>جلب تحديثات الأجهزة الأخرى</span>
            </button>

            {/* لوحة التشخيص: هذا الجهاز مقابل السحابة */}
            <div className="bg-slate-950/70 border border-slate-700 rounded-2xl p-3 space-y-2">
              <div className="text-[11px] font-black text-slate-200 text-center">
                فحص المزامنة — هذا الجهاز مقابل السيرفر
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-slate-900 rounded-xl p-2 text-center border border-slate-800">
                  <div className="text-slate-400 font-bold mb-0.5">📱 هذا الجهاز</div>
                  <div className="font-mono text-amber-300 font-bold">
                    {allPurchases.length} شراء • {allSales.length} بيع
                  </div>
                  <div className="font-mono text-emerald-300 font-bold">
                    {allExpenses.length} مصروف • {allLoans.length} سلفة
                  </div>
                </div>
                <div className="bg-slate-900 rounded-xl p-2 text-center border border-slate-800">
                  <div className="text-slate-400 font-bold mb-0.5">☁️ على السيرفر</div>
                  {cloudInfo ? (
                    <div className="font-bold text-slate-200 leading-relaxed">{cloudInfo}</div>
                  ) : (
                    <div className="text-slate-500 font-bold">اضغط «فحص السيرفر»</div>
                  )}
                </div>
              </div>

              {activeBranchId !== 'all' ? (
                <button
                  onClick={() => setActiveBranchId('all')}
                  className="w-full py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-black text-[11px]"
                >
                  ⚠️ القائمة معروضة بفرع واحد — اضغط لعرض كل الفروع ({branches.length} فرع)
                </button>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleInspectCloud}
                  disabled={checkingCloud}
                  className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] disabled:opacity-50"
                >
                  {checkingCloud ? 'جاري الفحص...' : 'فحص السيرفر'}
                </button>
                <button
                  onClick={handlePullNow}
                  disabled={isSyncing}
                  className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] disabled:opacity-50"
                >
                  جلب وتطبيق الآن
                </button>
              </div>

              <div className="text-[9px] text-slate-500 text-center font-mono">
                النسخة {APP_VERSION_LABEL} • شريك: {partners.filter((p) => !p.archived).length}
              </div>
            </div>

            {/* حالة المزامنة الحقيقية */}
            <div
              className={`text-[11px] text-center font-bold leading-relaxed rounded-2xl px-3 py-2 border ${
                syncError
                  ? 'text-rose-300 bg-rose-950/40 border-rose-800/60'
                  : pendingSync
                  ? 'text-amber-300 bg-amber-950/40 border-amber-800/60'
                  : 'text-emerald-300 bg-emerald-950/40 border-emerald-800/60'
              }`}
            >
              {syncError
                ? syncError
                : pendingSync
                ? 'توجد تغييرات لم تُزامن بعد — سيتم رفعها تلقائياً'
                : 'كل شئ متزامن ✅'}
            </div>

            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              المزامنة تلقائية في الاتجاهين: أي تعديل هنا يظهر على أجهزة الشركاء خلال ثوانٍ، وأي تعديل
              منهم يظهر هنا فوراً — حتى بدون ضغط أي زر.
            </p>

          </div>
        ) : (
          /* Password-Protected Login / Signup Form for Complete Privacy */
          <form
            onSubmit={handleCloudAuth}
            className="bg-slate-900 border-2 border-emerald-500/40 rounded-3xl p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-2xl">
                  <CloudLightning className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white">حساب المتجر والمزامنة السحابية</h4>
                  <p className="text-[11px] text-slate-400">حماية وتشفير حساباتك بكلمة سر خاصة</p>
                </div>
              </div>
            </div>

            {/* Login vs Signup Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  authMode === 'login'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>تسجيل دخول</span>
              </button>

              <button
                type="button"
                onClick={() => setAuthMode('signup')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  authMode === 'signup'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>حساب متجر جديد</span>
              </button>
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                البريد الإلكتروني للتاجر / المتجر (Email)
              </label>
              <input
                type="email"
                required
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                placeholder="example@gmail.com"
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 rounded-2xl p-3.5 text-white text-sm font-mono focus:outline-none transition-colors"
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                كلمة المرور السحابية (Password)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 rounded-2xl p-3.5 pl-10 text-white text-sm font-mono focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {authError && (
              <p className="text-xs text-rose-400 font-bold text-center bg-rose-950/40 p-2 rounded-xl border border-rose-800">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSyncing}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-slate-950 font-black text-xs rounded-2xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
              {isSyncing ? (
                <RefreshCw className="w-4 h-4 text-slate-950 animate-spin" />
              ) : (
                <Check className="w-4 h-4 text-slate-950" />
              )}
              <span>
                {authMode === 'login'
                  ? 'تسجيل الدخول ومزامنة الأجهزة'
                  : 'إنشاء حساب متجر وتشفير البيانات'}
              </span>
            </button>

            <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 text-[11px] text-slate-400 leading-relaxed text-center">
              🔒 <b>ضمان الخصوصية:</b> حساباتك المالية مشفرة وخاصة بمتجرك فقط. لا يمكن لأي شخص آخر ينزل التطبيق الوصول لبياناتك إلا بمعرفة هذا البريد وكلمة المرور.
            </div>

          </form>
        )}

      </div>

      {/* 3.b SECTION: تسعير السوق المحلي */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1 text-amber-400 font-black text-sm border-r-4 border-amber-500 pr-2">
          <span>تسعير السوق</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-extrabold text-sm text-white">سعر جرام عيار 21 الحالي</h4>
              <p className="text-[11px] text-slate-400">
                العيار الرسمي للبيع والشراء — كل الحسابات تُبنى عليه
              </p>
            </div>
            <span className="font-mono font-black text-amber-300 text-sm">{fmtNum(rates.karat21)}</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2">
            <label className="block text-[11px] text-slate-400 font-bold">
              تعديل سوقك المحلي (٪): إذا كان سعر مدينتك أعلى أو أقل من السعر المنشور
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                value={premiumInput}
                onChange={(e) => setPremiumInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-sm text-right focus:border-amber-400 focus:outline-none"
                placeholder="0"
              />
              <button
                onClick={() => {
                  const value = parseFloat(premiumInput) || 0;
                  setLocalPremium(value);
                  setSyncToast(`تم تطبيق تعديل السوق: ${value > 0 ? '+' : ''}${value}%`);
                  setTimeout(() => setSyncToast(''), 2500);
                }}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl"
              >
                تطبيق
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-slate-950 rounded-xl p-2.5 flex items-center justify-between">
              <span className="text-slate-400">دولار السوق</span>
              <span className="font-mono text-slate-200">{fmtNum(rates.usdRate)}</span>
            </div>
            <div className="bg-slate-950 rounded-xl p-2.5 flex items-center justify-between">
              <span className="text-slate-400">دولار البنوك</span>
              <span className="font-mono text-slate-200">{rates.bankUsdRate ? fmtNum(rates.bankUsdRate) : '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3.b SECTION: الإشعارات */}
      <NotificationsSection />

      {/* 3.c SECTION: الفروع */}
      <BranchesSection />

      {/* 4. SECTION: cloud backup only */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1 text-amber-400 font-black text-sm border-r-4 border-amber-500 pr-2">
          <span>حفظ البيانات والمزامنة</span>
        </div>
        <div className="bg-emerald-950/20 border border-emerald-500/40 rounded-3xl p-4 sm:p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0"><Cloud className="w-5 h-5" /></div>
            <div>
              <h4 className="font-extrabold text-sm text-emerald-300">Supabase هو النسخة الأساسية</h4>
              <p className="text-xs text-slate-300 leading-relaxed mt-1">يتم حفظ البيانات ومزامنتها بين الأجهزة عبر حسابك فقط. لن يتم استيراد بيانات من واتساب أو من ذاكرة الهاتف حتى لا تدخل سجلات غير مطلوبة.</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-emerald-500/20 text-center">
            <div className="bg-slate-950/70 p-2 rounded-xl"><span className="text-[10px] text-slate-400 block">مشتريات</span><span className="text-xs font-mono font-black text-emerald-400">{purchases.length}</span></div>
            <div className="bg-slate-950/70 p-2 rounded-xl"><span className="text-[10px] text-slate-400 block">مبيعات</span><span className="text-xs font-mono font-black text-emerald-400">{sales.length}</span></div>
            <div className="bg-slate-950/70 p-2 rounded-xl"><span className="text-[10px] text-slate-400 block">منصرفات</span><span className="text-xs text-emerald-400 font-black">{expenses.length}</span></div>
            <div className="bg-slate-950/70 p-2 rounded-xl"><span className="text-[10px] text-slate-400 block">شركاء</span><span className="text-xs text-emerald-400 font-black">{partners.length}</span></div>
          </div>
        </div>
        <button onClick={handleTriggerSync} disabled={isSyncing} className="w-full py-3 rounded-2xl bg-emerald-500 disabled:opacity-60 text-slate-950 font-black shadow-lg shadow-emerald-500/20">
          {isSyncing ? 'جاري المزامنة...' : 'حفظ ومزامنة البيانات على Supabase'}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={exportData} className="py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700">
            نسخة احتياطية (JSON)
          </button>
          <button onClick={exportCsv} className="py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700">
            تصدير Excel (CSV)
          </button>
        </div>

        <p className="text-[10px] text-slate-500 leading-relaxed">
          سجل الحذف: {deletedCount} عنصر. يُحفظ هذا السجل حتى لا تعود السجلات المحذوفة عند المزامنة
          من جهاز آخر.
        </p>
      </div>

      {/* 5. SECTION: البيانات */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1 text-rose-400 font-black text-sm border-r-4 border-rose-500 pr-2">
          <span>البيانات</span>
        </div>

        {/* نسخة آخر خروج/تبديل حساب — قابلة للاسترجاع بضغطة */}
        {snapshotMeta && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-500/15 text-amber-400 rounded-2xl">
                <History className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-extrabold text-sm text-amber-300">نسخة آخر خروج / تبديل حساب</h4>
                <p className="text-[11px] text-slate-300 mt-0.5">{describeSnapshot(snapshotMeta).title}</p>
                <p className="text-[11px] text-slate-500">{describeSnapshot(snapshotMeta).breakdown}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const res = restoreSnapshot();
                  if (res.ok) {
                    setSyncToast(`تم استرجاع ${fmtNum(res.total)} سجل إلى الجهاز`);
                    setTimeout(() => setSyncToast(''), 3000);
                  } else {
                    setSyncToast('تعذر الاسترجاع — لا توجد نسخة');
                    setTimeout(() => setSyncToast(''), 3000);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-colors"
              >
                استرجاع الآن
              </button>
              <button
                onClick={() => {
                  if (confirm('حذف نسخة الاسترجاع نهائياً؟')) discardSnapshot();
                }}
                className="shrink-0 px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                حذف النسخة
              </button>
            </div>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
          <div
            onClick={() => {
              if (confirm('تحذير: هل أنت متأكد من حذف كافة البيانات والمشتريات والمبيعات؟ لا يمكن التراجع!')) {
                resetAllData();
                alert('تم حذف كل البيانات وإعادة ضبط المصنع.');
              }
            }}
            className="p-4 flex items-center justify-between hover:bg-rose-950/30 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-2xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-rose-400">حذف كل البيانات</h4>
                <p className="text-xs text-slate-500">إعادة تعيين التطبيق وحذف السجلات</p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </div>
        </div>
      </div>

      {/* 6. SECTION: عن التطبيق */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1 text-amber-400 font-black text-sm border-r-4 border-amber-500 pr-2">
          <span>عن التطبيق</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-white">حاسبة الذهب والشركاء (Sudan Gold Pro)</h4>
              <button
                onClick={handleForceUpdate}
                className="mb-3 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center justify-center gap-2 mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                <span>تحديث التطبيق لأحدث نسخة</span>
              </button>
              <p className="text-xs text-slate-400">النسخة {APP_VERSION_LABEL} — معتمد لتجارة الذهب بالسودان (أساس عيار 21) + الفروع وطباعة الفواتير والسلف النقدية والإشعارات</p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {syncToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border-2 border-emerald-500 text-emerald-300 px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-2 animate-in fade-in zoom-in-95">
          <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
          <span>{syncToast}</span>
        </div>
      )}

      {/* PIN Change Dialog Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSavePin}
            className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-white animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-base text-amber-400">تغيير كلمة السر (PIN)</h3>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {pinCode && (
                <div>
                  <label className="block text-slate-300 font-bold mb-1">كلمة السر الحالية (4 أرقام)</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={oldPinInput}
                    onChange={(e) => setOldPinInput(e.target.value)}
                    placeholder="••••"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-center font-mono text-lg tracking-widest focus:border-amber-400 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-bold mb-1">الرقم السري الجديد (4 أرقام)</label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  placeholder="••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-center font-mono text-lg tracking-widest focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">تأكيد الرقم الجديد</label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={confirmPinInput}
                  onChange={(e) => setConfirmPinInput(e.target.value)}
                  placeholder="••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-center font-mono text-lg tracking-widest focus:border-amber-400 focus:outline-none"
                />
              </div>

              {pinError && (
                <p className="text-xs text-rose-400 font-bold text-center">{pinError}</p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              {pinCode && (
                <button
                  type="button"
                  onClick={handleRemovePin}
                  className="py-3 px-3 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 font-bold rounded-xl text-xs border border-rose-600/40"
                >
                  إلغاء القفل
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-black rounded-xl text-xs shadow-md"
              >
                حفظ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Auto Lock Selection Modal */}
      {showAutoLockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-white animate-in zoom-in-95">
            <h3 className="font-black text-base text-amber-400 border-b border-slate-800 pb-3">
              القفل التلقائي بعد الخروج
            </h3>

            <div className="space-y-2">
              {[
                { s: 0, label: 'فوراً' },
                { s: 30, label: 'بعد 30 ثانية' },
                { s: 60, label: 'بعد دقيقة' },
                { s: 300, label: 'بعد 5 دقائق' },
                { s: 1800, label: 'بعد 30 دقيقة' },
              ].map((item) => (
                <button
                  key={item.s}
                  onClick={() => {
                    setAutoLockSeconds(item.s);
                    localStorage.setItem('gold_auto_lock_time', item.s.toString());
                    setShowAutoLockModal(false);
                  }}
                  className={`w-full p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between transition-colors ${
                    autoLockSeconds === item.s
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>{item.label}</span>
                  {autoLockSeconds === item.s && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowAutoLockModal(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl mt-2"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
