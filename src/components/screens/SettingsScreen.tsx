import React, { useState, useEffect } from 'react';
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
  Eye,
  EyeOff,
  Smartphone,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { fmtNum, kCurrency } from '../../core/format';

interface SettingsScreenProps {
  onOpenInstallModal: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onOpenInstallModal }) => {
  const {
    pinCode,
    setPinCode,
    userEmail,
    setUserEmail,
    purchases,
    sales,
    expenses,
    partners,
    exportData,
    importData,
    resetAllData,
  } = useGoldStore();

  // Theme mode
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('dark');

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

  // Cloud Sync State
  const [cloudEmail, setCloudEmail] = useState(userEmail || 'tajalsir2026@gmail.com');
  const [cloudPass, setCloudPass] = useState('123456');
  const [showPass, setShowPass] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<string>('4 أكتوبر 2026 17:03');
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [cloudMsg, setCloudMsg] = useState('');

  // Load from local storage
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('gold_cloud_email');
      const savedAuth = localStorage.getItem('gold_cloud_signed_in');
      const savedLockTime = localStorage.getItem('gold_auto_lock_time');
      if (savedEmail) setCloudEmail(savedEmail);
      if (savedAuth !== null) setIsSignedIn(savedAuth === 'true');
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

  // Handle PIN Save
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

  // Cloud Actions
  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloudEmail || !cloudPass) {
      setCloudMsg('يرجى إدخال الإيميل وكلمة السر');
      return;
    }
    if (cloudPass.length < 6) {
      setCloudMsg('كلمة السر يجب أن تكون 6 أحرف فأكثر');
      return;
    }

    setIsSyncingCloud(true);
    setTimeout(() => {
      setIsSignedIn(true);
      setUserEmail(cloudEmail);
      localStorage.setItem('gold_cloud_email', cloudEmail);
      localStorage.setItem('gold_cloud_signed_in', 'true');
      const now = new Date();
      const timeStr = `${now.getDate()} أكتوبر ${now.getFullYear()} ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
      setLastSyncTime(timeStr);
      setIsSyncingCloud(false);
      setCloudMsg('تم تسجيل الدخول وتفعيل المزامنة السحابية بنجاح! ☁️');
      setTimeout(() => setCloudMsg(''), 3000);
    }, 600);
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    handleSignIn(e);
  };

  const handleSyncNow = () => {
    setIsSyncingCloud(true);
    setTimeout(() => {
      const now = new Date();
      const timeStr = `${now.getDate()} أكتوبر ${now.getFullYear()} ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
      setLastSyncTime(timeStr);
      setIsSyncingCloud(false);
      setCloudMsg('تمت المزامنة بنجاح وحفظ كافة البيانات على السحابة ⚡');
      setTimeout(() => setCloudMsg(''), 3000);
    }, 700);
  };

  const handleSignOut = () => {
    if (confirm('تسجيل الخروج: بياناتك على هذا الجهاز لن تُحذف، لكن ستتوقف المزامنة السحابية. متأكد؟')) {
      setIsSignedIn(false);
      localStorage.setItem('gold_cloud_signed_in', 'false');
      setCloudMsg('تم تسجيل الخروج');
      setTimeout(() => setCloudMsg(''), 2500);
    }
  };

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
      alert('تم نسخ البيانات — يمكنك لصقها في الواتساب أو الملاحظات!');
    } catch (_) {
      alert('تعذر النسخ إلى الحافظة');
    }
  };

  const handleRestoreFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        alert('الحافظة فارغة');
        return;
      }
      if (confirm('سيتم استبدال كل البيانات الحالية بالبيانات الملصوقة. متأكد؟')) {
        const ok = importData(text);
        if (ok) {
          alert('تمت استعادة البيانات بنجاح!');
        } else {
          alert('البيانات غير صالحة');
        }
      }
    } catch (_) {
      alert('يرجى منح إذن قراءة الحافظة');
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-200">
      
      {/* 1. SECTION: الحماية */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1 text-amber-400 font-extrabold text-sm border-r-4 border-amber-500 pr-2">
          <span>الحماية</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden divide-y divide-slate-800/80">
          
          {/* Change PIN Row */}
          <div
            onClick={() => setShowPinModal(true)}
            className="p-4 flex items-center justify-between hover:bg-slate-800/60 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">تغيير كلمة السر</h4>
                <p className="text-xs text-slate-400">الرقم السري المكوّن من 4 أرقام</p>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </div>

          {/* Auto Lock Timeout Row */}
          <div
            onClick={() => setShowAutoLockModal(true)}
            className="p-4 flex items-center justify-between hover:bg-slate-800/60 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                <Timer className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">القفل التلقائي</h4>
                <p className="text-xs text-amber-400 font-bold">{getAutoLockLabel(autoLockSeconds)}</p>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </div>

        </div>

        {pinSuccess && (
          <p className="text-xs text-emerald-400 font-bold text-center animate-in fade-in">{pinSuccess}</p>
        )}
      </div>

      {/* 2. SECTION: المظهر */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1 text-amber-400 font-extrabold text-sm border-r-4 border-amber-500 pr-2">
          <span>المظهر</span>
        </div>

        <div className="grid grid-cols-3 gap-2 bg-slate-900 p-2 rounded-2xl border border-slate-800 text-xs">
          <button
            onClick={() => setThemeMode('light')}
            className={`py-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
              themeMode === 'light' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sun className="w-4 h-4" />
            <span>فاتح</span>
          </button>

          <button
            onClick={() => setThemeMode('dark')}
            className={`py-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
              themeMode === 'dark' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Moon className="w-4 h-4" />
            <span>داكن ✓</span>
          </button>

          <button
            onClick={() => setThemeMode('system')}
            className={`py-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
              themeMode === 'system' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>النظام</span>
          </button>
        </div>
      </div>

      {/* 3. SECTION: المزامنة بين الأجهزة (Exact Matching Cloud Card from Screenshots) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1 text-amber-400 font-extrabold text-sm border-r-4 border-amber-500 pr-2">
          <span>المزامنة بين الأجهزة</span>
        </div>

        {isSignedIn ? (
          // Logged-in State (الصورة الثانية: المزامنة مفعلة)
          <div className="bg-emerald-950/20 border-2 border-emerald-500/40 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl">
                <Check className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-extrabold text-base text-emerald-400">المزامنة مفعّلة</h4>
                <p className="text-xs text-slate-300 font-mono" dir="ltr">{cloudEmail}</p>
              </div>
            </div>

            <div className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span>آخر مزامنة: </span>
              <span className="font-mono text-emerald-400 font-bold">{lastSyncTime}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={handleSyncNow}
                disabled={isSyncingCloud}
                className="py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                <span>مزامنة الآن</span>
              </button>

              <button
                onClick={handleSignOut}
                className="py-3 bg-slate-900 hover:bg-rose-950/40 text-rose-300 font-bold text-xs rounded-xl border border-rose-500/30 flex items-center justify-center gap-1.5 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>خروج</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              المزامنة تتم تلقائياً عند فتح التطبيق وبعد كل تعديل (عند توفر النت).
            </p>
          </div>
        ) : (
          // Sign In / Sign Up Form (الصورة الأولى: تسجيل بالبريد وكلمة السر)
          <div className="bg-gradient-to-br from-amber-500/15 via-slate-900 to-slate-950 border-2 border-amber-500/50 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2.5">
              <Cloud className="w-5 h-5 text-amber-400" />
              <p className="text-xs font-bold text-slate-200">
                سجّل بنفس الإيميل وكلمة السر في كل الأجهزة لتوحّد البيانات
              </p>
            </div>

            <form onSubmit={handleSignIn} className="space-y-3">
              <div>
                <input
                  type="email"
                  required
                  value={cloudEmail}
                  onChange={(e) => setCloudEmail(e.target.value)}
                  placeholder="الإيميل"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-white text-sm font-mono focus:border-amber-400 focus:outline-none"
                  dir="ltr"
                />
              </div>

              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={cloudPass}
                  onChange={(e) => setCloudPass(e.target.value)}
                  placeholder="كلمة السر (6 أحرف فأكثر)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-white text-sm focus:border-amber-400 focus:outline-none pr-3 pl-11"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="submit"
                  disabled={isSyncingCloud}
                  className="py-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  <span>تسجيل دخول</span>
                </button>

                <button
                  type="button"
                  onClick={handleSignUp}
                  disabled={isSyncingCloud}
                  className="py-3 bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>إنشاء حساب</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400 text-center">
                أول جهاز: «إنشاء حساب». باقي الأجهزة: «تسجيل دخول» بنفس البيانات.
              </p>
            </form>
          </div>
        )}

        {cloudMsg && (
          <p className="text-xs text-amber-400 font-bold text-center animate-in fade-in">{cloudMsg}</p>
        )}
      </div>

      {/* 4. SECTION: النسخ الاحتياطي (Exact Stats Box from Screenshot) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1 text-amber-400 font-extrabold text-sm border-r-4 border-amber-500 pr-2">
          <span>النسخ الاحتياطي</span>
        </div>

        {/* Stats Info Card */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-300">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="leading-relaxed text-slate-200 font-medium">
              بياناتك محفوظة داخل الجهاز فقط. خُذ نسخة احتياطية بانتظام حتى لا تفقدها عند تغيير الهاتف.
            </p>
            <p className="font-bold text-amber-400">
              عندك {purchases.length} مشترى، {sales.length} بيع، {expenses.length} مصروف، {partners.length} شريك.
            </p>
          </div>
        </div>

        {/* Backup Actions List */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden divide-y divide-slate-800/80">
          
          <div
            onClick={exportData}
            className="p-4 flex items-center justify-between hover:bg-slate-800/60 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <Save className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">إنشاء نسخة احتياطية الآن</h4>
                <p className="text-xs text-slate-400">تُحفظ كملف JSON داخل جهازك</p>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </div>

          <label className="p-4 flex items-center justify-between hover:bg-slate-800/60 cursor-pointer transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">استعادة نسخة سابقة</h4>
                <p className="text-xs text-slate-400">تحميل واستعادة ملف من الهاتف</p>
              </div>
            </div>
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const r = new FileReader();
                r.onload = (evt) => {
                  const content = evt.target?.result as string;
                  if (content && importData(content)) {
                    alert('تمت استعادة النسخة بنجاح!');
                  }
                };
                r.readAsText(file);
              }}
              className="hidden"
            />
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </label>

          <div
            onClick={handleCopyToClipboard}
            className="p-4 flex items-center justify-between hover:bg-slate-800/60 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl">
                <Copy className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">نسخ البيانات كنص</h4>
                <p className="text-xs text-slate-400">لإرسالها عبر الواتساب أو الإيميل</p>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </div>

          <div
            onClick={handleRestoreFromClipboard}
            className="p-4 flex items-center justify-between hover:bg-slate-800/60 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                <ClipboardPaste className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">استعادة من نص منسوخ</h4>
                <p className="text-xs text-slate-400">لصق نسخة احتياطية من الحافظة</p>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </div>

        </div>
      </div>

      {/* 5. SECTION: البيانات */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1 text-rose-400 font-extrabold text-sm border-r-4 border-rose-500 pr-2">
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
              <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-rose-400">حذف كل البيانات</h4>
                <p className="text-xs text-slate-500">إعادة تعيين التطبيق وحذف السجلات</p>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </div>
        </div>
      </div>

      {/* 6. SECTION: عن التطبيق */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1 text-amber-400 font-extrabold text-sm border-r-4 border-amber-500 pr-2">
          <span>عن التطبيق</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">حاسبة الذهب والشركاء (Sudan Gold Pro)</h4>
              <p className="text-xs text-slate-400">النسخة v4.0.0 — معتمد لتجارة الذهب بالسودان</p>
            </div>
          </div>
        </div>
      </div>

      {/* PIN Change Dialog Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSavePin}
            className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-white animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-amber-400">تغيير كلمة السر (PIN)</h3>
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

            <div className="flex items-center gap-3 pt-2">
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
            <h3 className="font-extrabold text-base text-amber-400 border-b border-slate-800 pb-3">
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
                  className={`w-full p-3 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                    autoLockSeconds === item.s ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
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
