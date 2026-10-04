import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  Unlock,
  KeyRound,
  Timer,
  Sun,
  Moon,
  Laptop,
  Cloud,
  CloudOff,
  CloudLightning,
  RefreshCw,
  LogOut,
  LogIn,
  UserPlus,
  Save,
  FolderOpen,
  Copy,
  ClipboardPaste,
  Trash2,
  Info,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Smartphone,
  Eye,
  EyeOff,
  ShieldCheck
} from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { fmtNum } from '../../core/format';

interface SettingsScreenProps {
  onOpenInstallModal?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = () => {
  const {
    pinCode,
    setPinCode,
    userEmail,
    themeMode,
    setThemeMode,
    lastSyncTime,
    isCloudSignedIn,
    signInCloud,
    signUpCloud,
    signOutCloud,
    syncWithCloud,
    purchases,
    sales,
    expenses,
    partners,
    exportData,
    importData,
    resetAllData,
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
  const [inputEmail, setInputEmail] = useState(userEmail || 'tajalsir2026@gmail.com');
  const [inputPassword, setInputPassword] = useState('123456');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState('');

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
  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    if (pinCode && oldPinInput !== pinCode) {
      setPinError('كلمة السر الحالية غير صحيحة');
      return;
    }
    if (newPinInput.length !== 4) {
      setPinError('يجب أن يتكون الرقم السري من 4 أرقام بالضبط');
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setPinError('الرقم الجديد غير مطابق للتأكيد');
      return;
    }

    setPinCode(newPinInput);
    setShowPinModal(false);
    setOldPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setPinSuccess('تم تغيير كلمة السر بنجاح ✅');
    setTimeout(() => setPinSuccess(''), 3000);
  };

  const handleRemovePin = () => {
    if (confirm('هل تريد إلغاء كلمة السر ورمز القفل تماماً؟')) {
      setPinCode('');
      setShowPinModal(false);
      setPinSuccess('تم إلغاء قفل التطبيق');
      setTimeout(() => setPinSuccess(''), 3000);
    }
  };

  // Cloud Authentication (Password-Protected to isolate merchants)
  const handleCloudAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsSyncing(true);

    if (authMode === 'login') {
      const res = await signInCloud(inputEmail, inputPassword);
      setIsSyncing(false);
      if (res.success) {
        setSyncToast(res.message);
        setTimeout(() => setSyncToast(''), 3000);
      } else {
        setAuthError(res.message);
      }
    } else {
      const res = await signUpCloud(inputEmail, inputPassword);
      setIsSyncing(false);
      if (res.success) {
        setSyncToast(res.message);
        setTimeout(() => setSyncToast(''), 3000);
      } else {
        setAuthError(res.message);
      }
    }
  };

  // Trigger Sync Now
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncToast('جاري المزامنة مع سحابة المتجر المشفرة...');
    await syncWithCloud();
    setTimeout(() => {
      setIsSyncing(false);
      setSyncToast('تمت المزامنة بنجاح وحفظ كافة السجلات ⚡');
      setTimeout(() => setSyncToast(''), 3000);
    }, 600);
  };

  const handleSignOut = () => {
    if (confirm('تسجيل الخروج: سيتم إيقاف المزامنة السحابية على هذا الجهاز وستبقى بياناتك المحلية محفوظة. هل تريد المتابعة؟')) {
      signOutCloud();
      setSyncToast('تم تسجيل الخروج بنجاح');
      setTimeout(() => setSyncToast(''), 2500);
    }
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
    <div className="space-y-6 pb-24 animate-in fade-in duration-200">
      
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
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-slate-950 font-black text-xs rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <RefreshCw className={`w-4 h-4 text-slate-950 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>مزامنة الآن</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400 text-center leading-relaxed pt-1">
              المزامنة تتم تلقائياً بصورة مشفرة بين أجهزتك وأجهزة الشركاء المصرح لهم فقط.
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

      {/* 4. SECTION: النسخ الاحتياطي (Yellow Warning Card + 4 Action Items) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1 text-amber-400 font-black text-sm border-r-4 border-amber-500 pr-2">
          <span>النسخ الاحتياطي</span>
        </div>

        {/* Yellow Notice Card */}
        <div className="bg-amber-950/20 border border-amber-500/40 rounded-3xl p-4 sm:p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl shrink-0 mt-0.5">
              <Info className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-extrabold text-sm text-amber-300">
                بياناتك محفوظة داخل الجهاز فقط
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                خُذ نسخة احتياطية بانتظام حتى لا تفقدها عند تغيير الهاتف.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-amber-500/20 text-center">
            <div className="bg-slate-950/70 p-2 rounded-xl">
              <span className="text-[10px] text-slate-400 block">مشتريات</span>
              <span className="text-xs font-mono font-black text-amber-400">{purchases.length}</span>
            </div>
            <div className="bg-slate-950/70 p-2 rounded-xl">
              <span className="text-[10px] text-slate-400 block">مبيعات</span>
              <span className="text-xs font-mono font-black text-amber-400">{sales.length}</span>
            </div>
            <div className="bg-slate-950/70 p-2 rounded-xl">
              <span className="text-[10px] text-slate-400 block">منصرفات</span>
              <span className="text-xs font-mono font-black text-amber-400">{expenses.length}</span>
            </div>
            <div className="bg-slate-950/70 p-2 rounded-xl">
              <span className="text-[10px] text-slate-400 block">شركاء</span>
              <span className="text-xs font-mono font-black text-amber-400">{partners.length}</span>
            </div>
          </div>
        </div>

        {/* 4 Backup Actions List */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden divide-y divide-slate-800/80 shadow-md">
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />

          <div
            onClick={exportData}
            className="p-4 flex items-center justify-between hover:bg-slate-800/60 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl">
                <Save className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white">حفظ ملف نسخة احتياطية (JSON)</h4>
                <p className="text-xs text-slate-400">تصدير وتنزيل ملف بكافة البيانات</p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-4 flex items-center justify-between hover:bg-slate-800/60 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-2xl">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white">فتح ملف نسخة احتياطية واستعادة</h4>
                <p className="text-xs text-slate-400">استيراد ملف من ذاكرة الجهاز</p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </div>

          <div
            onClick={handleCopyToClipboard}
            className="p-4 flex items-center justify-between hover:bg-slate-800/60 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl">
                <Copy className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white">نسخ البيانات كنص (واتساب)</h4>
                <p className="text-xs text-slate-400">مشاركة النسخة الاحتياطية بسهولة</p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </div>

          <div
            onClick={handleRestoreFromClipboard}
            className="p-4 flex items-center justify-between hover:bg-slate-800/60 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-2xl">
                <ClipboardPaste className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white">استعادة من نص منسوخ</h4>
                <p className="text-xs text-slate-400">لصق نسخة احتياطية من الحافظة</p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </div>

        </div>
      </div>

      {/* 5. SECTION: البيانات */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1 text-rose-400 font-black text-sm border-r-4 border-rose-500 pr-2">
          <span>البيانات</span>
        </div>

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
              <p className="text-xs text-slate-400">النسخة v4.0.0 — معتمد لتجارة الذهب بالسودان</p>
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
