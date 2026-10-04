import React, { useState } from 'react';
import { Settings, Lock, Unlock, Download, Upload, Trash2, Smartphone, Shield, Mail, Store, Check, Send, Sparkles } from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { fmtMoney, fmtNum, unitsToGramsDecimal, unitsToWeight, kCurrency } from '../../core/format';

interface SettingsScreenProps {
  onOpenInstallModal: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onOpenInstallModal }) => {
  const {
    pinCode,
    setPinCode,
    userEmail,
    setUserEmail,
    storeName,
    setStoreName,
    totalCapital,
    netProfit,
    generalExpenses,
    currentStockUnits,
    partners,
    purchases,
    sales,
    exportData,
    importData,
    resetAllData,
  } = useGoldStore();

  // Local state for Email & Store Form
  const [emailInput, setEmailInput] = useState(userEmail || 'alsiralsaig@gmail.com');
  const [storeInput, setStoreInput] = useState(storeName || 'مجوهرات السر الصائغ');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // PIN Form
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMessage, setPinMessage] = useState('');

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setUserEmail(emailInput);
    setStoreName(storeInput);
    setSaveSuccessMsg('تم حفظ وتحديث بيانات البريد بنجاح! ✨');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const handleSetPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4) {
      setPinMessage('يجب أن يتكون رمز القفل من 4 أرقام على الأقل');
      return;
    }
    if (newPin !== confirmPin) {
      setPinMessage('الرمزان غير متطابقين!');
      return;
    }
    setPinCode(newPin);
    setNewPin('');
    setConfirmPin('');
    setPinMessage('تم تفعيل رمز القفل بنجاح!');
    setTimeout(() => setPinMessage(''), 3000);
  };

  const handleRemovePin = () => {
    if (confirm('هل تريد بالتأكيد إلغاء قفل التطبيق؟')) {
      setPinCode('');
      setPinMessage('تم إلغاء القفل');
      setTimeout(() => setPinMessage(''), 3000);
    }
  };

  const handleSendEmailReport = () => {
    const stockGrams = unitsToGramsDecimal(currentStockUnits);
    const subject = encodeURIComponent(`تقرير مالي شامل - ${storeInput} (${new Date().toLocaleDateString('ar-SD')})`);
    const bodyText = encodeURIComponent(
      `تقرير حسابات الذهب والشركاء\n` +
      `المتجر: ${storeInput}\n` +
      `التاريخ: ${new Date().toLocaleString('ar-SD')}\n\n` +
      `-----------------------------------------\n` +
      `• إجمالي رأس مال الشركاء: ${fmtMoney(totalCapital)}\n` +
      `• صافي الأرباح: ${fmtMoney(netProfit)}\n` +
      `• المنصرفات العامة: ${fmtMoney(generalExpenses)}\n` +
      `• رصيد الذهب بالمخزن: ${stockGrams.toFixed(2)} جرام (${unitsToWeight(currentStockUnits)})\n` +
      `• عدد الشركاء: ${partners.length}\n` +
      `• عدد فواتير الشراء: ${purchases.length}\n` +
      `• عدد فواتير البيع: ${sales.length}\n` +
      `-----------------------------------------\n\n` +
      `تم استخراج هذا التقرير من تطبيق حاسبة الذهب السوداني.`
    );

    // Open default mail client with prefilled report
    window.location.href = `mailto:${emailInput}?subject=${subject}&body=${bodyText}`;
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        const ok = importData(content);
        if (ok) {
          alert('تمت استعادة البيانات بنجاح!');
        } else {
          alert('الملف غير صالح أو تالف');
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      
      {/* 1. Account & Email Configuration Card */}
      <div className="bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950 border-2 border-amber-500/50 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/40">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-white">البريد الإلكتروني وحساب التاجر</h3>
            <p className="text-xs text-slate-300">لإرسال التقارير اليومية والنسخ الاحتياطي واستعادة القفل</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-3.5 pt-1">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-amber-400" />
              <span>البريد الإلكتروني (Email)</span>
            </label>
            <input
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="example@gmail.com"
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-2xl p-3.5 text-white text-sm font-mono focus:outline-none transition-colors"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-amber-400" />
              <span>اسم المتجر / النشاط التجاري</span>
            </label>
            <input
              type="text"
              value={storeInput}
              onChange={(e) => setStoreInput(e.target.value)}
              placeholder="مثال: مجوهرات السر الصائغ"
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-2xl p-3.5 text-white text-sm focus:outline-none transition-colors"
            />
          </div>

          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 font-bold text-center animate-in fade-in">
              {saveSuccessMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="submit"
              className="py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition-transform active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>حفظ بيانات البريد</span>
            </button>

            <button
              type="button"
              onClick={handleSendEmailReport}
              className="py-3 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>إرسال تقرير مالي للإيميل</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. Security PIN Lock */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-2xl border border-cyan-500/30">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-white">قفل الحماية وكلمة المرور (PIN)</h3>
            <p className="text-xs text-slate-400">حماية بيانات وحسابات الذهب برمز سري</p>
          </div>
        </div>

        {pinCode ? (
          <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/40 flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <Shield className="w-4 h-4" />
              <span>رمز القفل مفعل حالياً</span>
            </div>
            <button
              onClick={handleRemovePin}
              className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs rounded-xl border border-rose-500/40 transition-colors"
            >
              إلغاء القفل
            </button>
          </div>
        ) : (
          <form onSubmit={handleSetPin} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">رمز القفل الجديد (4 أرقام)</label>
                <input
                  type="password"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-center font-mono text-base focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">تأكيد الرمز</label>
                <input
                  type="password"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-center font-mono text-base focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {pinMessage && (
              <p className="text-xs text-amber-400 font-bold text-center">{pinMessage}</p>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all"
            >
              تعيين رمز القفل
            </button>
          </form>
        )}
      </div>

      {/* 3. Backup and Restore */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-white">النسخ الاحتياطي واستعادة البيانات</h3>
            <p className="text-xs text-slate-400">حفظ نسخة من سجلاتك على جهازك واستعادتها في أي وقت</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={exportData}
            className="py-3 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-2xl border border-slate-700 flex items-center justify-center gap-2 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>تصدير نسخة احتياطية</span>
          </button>

          <label className="py-3 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold text-xs rounded-2xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-all">
            <Upload className="w-4 h-4" />
            <span>استيراد نسخة سابقة</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* 4. Reset Data Warning */}
      <div className="bg-rose-950/20 border border-rose-900/50 rounded-3xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-rose-400">
          <Trash2 className="w-5 h-5" />
          <h4 className="font-extrabold text-sm">إعادة ضبط المصنع وحذف البيانات</h4>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          سيؤدي هذا الإجراء إلى مسح جميع فواتير الشراء، البيع، المنصرفات، وقائمة الشركاء وإعادة التطبيق إلى حالته الأولى.
        </p>
        <button
          onClick={() => {
            if (confirm('تحذير: هل أنت متأكد تماماً من حذف كافة البيانات المخزنة؟ لا يمكن التراجع عن هذا الإجراء.')) {
              resetAllData();
              alert('تمت إعادة ضبط البيانات بنجاح.');
            }
          }}
          className="w-full py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-bold text-xs rounded-xl border border-rose-600/40 transition-colors"
        >
          حذف كافة البيانات
        </button>
      </div>

      {/* About Developer & App Info */}
      <div className="text-center text-xs text-slate-500 space-y-1 pt-4">
        <p className="font-bold text-slate-400">حاسبة الذهب والشركاء - الإصدار 4.0.0</p>
        <p>تطبيق تجارة الذهب المعتمد والمصمم خصيصاً للسوق السوداني</p>
      </div>

    </div>
  );
};
