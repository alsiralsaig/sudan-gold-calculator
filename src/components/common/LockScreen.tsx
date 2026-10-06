'use client';

import React, { useEffect, useState } from 'react';
import { Lock, ShieldAlert, Timer, Delete } from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';

export const LockScreen: React.FC = () => {
  const { unlockApp, lockout } = useGoldStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [now, setNow] = useState(Date.now());

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
      </div>
    </div>
  );
};
