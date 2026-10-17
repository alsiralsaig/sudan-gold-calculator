'use client';

import React, { useEffect, useState } from 'react';
import { Lock, ShieldAlert, Timer, Delete, HelpCircle, X } from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';

export const LockScreen: React.FC = () => {
  const { unlockApp, lockout, setPinCode } = useGoldStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [forgot, setForgot] = useState(false);
  const [resetting, setResetting] = useState(false);

  const lockedFor = Math.max(0, Math.ceil((lockout.until - now) / 1000));
  const isLockedOut = lockedFor > 0;

  useEffect(() => {
    if (!isLockedOut) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isLockedOut]);

  const tryUnlock = async (code: string) => {
    if (isChecking || isLockedOut) return;
    setIsChecking(true);
    const ok = await unlockApp(code);
    setIsChecking(false);
    if (!ok) {
      setError(
        lockout.attempts + 1 >= 5
          ? 'محاولات كثيرة خاطئة — تم تأخير المحاولة لحماية بياناتك'
          : 'رمز الدخول غير صحيح، حاول مرة أخرى'
      );
      setPin('');
    } else {
      setError('');
    }
  };

  /** تصفير الرمز المنسي: البيانات (مشتريات/بيع/منصرفات/شركاء/فروع) محفوظة منفصلة ولا تُمسّ */
  const resetForgottenPin = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      localStorage.removeItem('gold_pin_lockout');
    } catch (_) {}
    await setPinCode('');
    setResetting(false);
  };

  const handleDigit = (digit: string) => {
    if (isLockedOut || isChecking) return;
    const next = (pin + digit).slice(0, 4);
    setPin(next);
    setError('');
    if (next.length === 4) void tryUnlock(next);
  };

  const handleDelete = () => {
    setError('');
    setPin((prev) => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-6 text-white select-none">
      <div className="max-w-xs w-full text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/10">
          <Lock className="w-10 h-10" />
        </div>

        <div>
          <h2 className="text-xl font-black text-amber-400">حاسبة الذهب مقفلة</h2>
          <p className="text-xs text-slate-400 mt-1">أدخل رمز الدخول السري للمتابعة</p>
        </div>

        <div className="flex items-center justify-center gap-3 py-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all ${
                i < pin.length
                  ? 'bg-amber-400 scale-125 shadow-lg shadow-amber-400/50'
                  : 'bg-slate-800 border border-slate-700'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-xs font-bold text-rose-400 flex items-center justify-center gap-1.5">
            <ShieldAlert className="w-4 h-4" />
            {error}
          </p>
        )}

        {isLockedOut && (
          <p className="text-xs font-bold text-amber-300 flex items-center justify-center gap-1.5">
            <Timer className="w-4 h-4" />
            حاول بعد {Math.floor(lockedFor / 60)}:{String(lockedFor % 60).padStart(2, '0')} دقيقة
          </p>
        )}

        {isChecking && <p className="text-xs text-slate-400">يتحقق...</p>}

        <div className="grid grid-cols-3 gap-3 pt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((item, idx) => {
            if (item === '') return <div key={idx} />;
            const disabled = isLockedOut || isChecking;
            return (
              <button
                key={idx}
                disabled={disabled}
                onClick={() => {
                  if (item === '⌫') handleDelete();
                  else handleDigit(item);
                }}
                className={`h-16 rounded-2xl bg-slate-900/90 border border-slate-800 text-xl font-bold font-mono text-white transition-all flex items-center justify-center shadow-md ${
                  disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:border-amber-500/60 active:bg-amber-500/20 active:scale-95'
                }`}
              >
                {item === '⌫' ? <Delete className="w-6 h-6" /> : item}
              </button>
            );
          })}
        </div>

        {pin.length >= 4 && (
          <button
            onClick={() => void tryUnlock(pin)}
            disabled={isLockedOut || isChecking}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black text-sm rounded-2xl shadow-lg transition-transform active:scale-95"
          >
            فتح التطبيق
          </button>
        )}

        {forgot ? (
          <div className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 p-4 space-y-3 text-center">
            <p className="text-[11px] leading-relaxed text-slate-300">
              بياناتك كلها — مشتريات وبيع ومنصرفات وشركاء وفروع — <strong className="text-amber-400">محفوظة وما بتتشال</strong>.
              التصفير بيلغي رمز الدخول بس، وتدخل عادي، وبعدها تعيّن رمز جديد من
              الإعدادات ← الأمان.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setForgot(false)}
                disabled={resetting}
                className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-xs font-bold hover:bg-slate-800"
              >
                <X className="w-4 h-4 inline-block ml-1 -mt-0.5" />
                تراجع
              </button>
              <button
                onClick={() => void resetForgottenPin()}
                disabled={resetting}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black hover:bg-amber-600 disabled:opacity-50"
              >
                {resetting ? 'جارٍ التصفير…' : 'صفّر الرمز وادخُل'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setForgot(true)}
            disabled={isChecking}
            className="text-slate-400 hover:text-amber-400 text-[11px] font-bold flex items-center gap-1.5 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            نسيت الرمز؟ استعادة بلا فقدان بيانات
          </button>
        )}
      </div>
    </div>
  );
};
