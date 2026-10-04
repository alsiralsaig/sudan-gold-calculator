import React, { useState } from 'react';
import { Lock, Unlock, ShieldAlert, KeyRound } from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';

export const LockScreen: React.FC = () => {
  const { unlockApp } = useGoldStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleDigit = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      setError(false);
      if (newPin.length >= 4) {
        // try unlock
        if (unlockApp(newPin)) {
          // Unlocked!
        } else if (newPin.length === 6) {
          setError(true);
          setPin('');
        }
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  const handleManualUnlock = () => {
    if (unlockApp(pin)) {
      setError(false);
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-6 text-white select-none">
      <div className="max-w-xs w-full text-center space-y-6">
        
        {/* Lock Icon */}
        <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/10">
          <Lock className="w-10 h-10" />
        </div>

        <div>
          <h2 className="text-xl font-black text-amber-400">حاسبة الذهب مقفلة</h2>
          <p className="text-xs text-slate-400 mt-1">أدخل رمز الدخول السري للمتابعة</p>
        </div>

        {/* PIN Dots */}
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
          <p className="text-xs font-bold text-rose-400 animate-shake">
            رمز الدخول غير صحيح، يرجى المحاولة مرة أخرى
          </p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((item, idx) => {
            if (item === '') return <div key={idx} />;
            return (
              <button
                key={idx}
                onClick={() => {
                  if (item === '⌫') handleDelete();
                  else handleDigit(item);
                }}
                className="h-16 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/60 active:bg-amber-500/20 text-xl font-bold font-mono text-white transition-all active:scale-95 flex items-center justify-center shadow-md"
              >
                {item}
              </button>
            );
          })}
        </div>

        {pin.length >= 4 && (
          <button
            onClick={handleManualUnlock}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm rounded-2xl shadow-lg transition-transform active:scale-95"
          >
            فتح التطبيق
          </button>
        )}

      </div>
    </div>
  );
};
