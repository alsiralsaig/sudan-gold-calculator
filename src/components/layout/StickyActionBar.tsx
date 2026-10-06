'use client';

import React, { useEffect, useRef, useState } from 'react';
import { LucideIcon } from 'lucide-react';

/**
 * شريط سفلي ثابت (Sticky Action Bar)
 *
 * السلوك المطلوب:
 * - الشريط ملتصق تماماً بأسفل الشاشة (bottom: 0) ولا يتحرك مع السحب.
 * - المسافة البديلة أعلى الشريط تُحسب تلقائياً من ارتفاعه الحقيقي،
 *   فلا يبقى فراغ ميت بين آخر صف من البيانات وبين الإجماليات،
 *   ولا يُحجب أي صف خلف الشريط.
 */

export type BarTone = 'amber' | 'emerald' | 'rose' | 'cyan' | 'slate' | 'blue';

const toneClasses: Record<BarTone, string> = {
  amber: 'text-amber-300',
  emerald: 'text-emerald-300',
  rose: 'text-rose-300',
  cyan: 'text-cyan-300',
  slate: 'text-slate-200',
  blue: 'text-blue-300',
};

const actionTones: Record<BarTone, string> = {
  amber: 'from-amber-500 to-amber-600 text-slate-950 shadow-amber-500/25',
  emerald: 'from-emerald-500 to-emerald-600 text-slate-950 shadow-emerald-500/25',
  rose: 'from-rose-500 to-rose-600 text-white shadow-rose-500/25',
  cyan: 'from-cyan-500 to-cyan-600 text-slate-950 shadow-cyan-500/25',
  slate: 'from-slate-600 to-slate-700 text-white shadow-slate-700/25',
  blue: 'from-blue-500 to-blue-600 text-white shadow-blue-500/25',
};

export interface BarStat {
  label: string;
  value: React.ReactNode;
  tone?: BarTone;
}

export interface BarAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  tone?: BarTone;
  /** الزر الأساسي يأخذ مساحة أكبر */
  primary?: boolean;
  disabled?: boolean;
}

interface StickyActionBarProps {
  stats?: BarStat[];
  actions?: BarAction[];
  /** سطر توضيحي صغير (مثال: نطاق الفلتر الحالي) */
  hint?: React.ReactNode;
  /** عدد أعمدة الإجماليات (افتراضي: حسب عدد الإحصائيات) */
  columns?: number;
}

export const StickyActionBar: React.FC<StickyActionBarProps> = ({
  stats,
  actions,
  hint,
  columns,
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [barHeight, setBarHeight] = useState(0);

  const hasStats = Boolean(stats && stats.length);
  const hasActions = Boolean(actions && actions.length);

  // يقيس ارتفاع الشريط الفعلي (بما فيه مساحة الأمان أسفل الشاشة)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const update = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      setBarHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev));
    };

    update();
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(update);
      observer.observe(el);
    }
    if (typeof document !== 'undefined' && document.fonts && 'ready' in document.fonts) {
      document.fonts.ready.then(update).catch(() => {});
    }
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  if (!hasStats && !hasActions) return null;

  const cols = columns || Math.min(stats?.length || 1, 4);

  return (
    <>
      {/* مساحة بديلة = ارتفاع الشريط الفعلي + هامش صغير، حتى لا يغطي الشريط آخر صف */}
      <div aria-hidden style={{ height: barHeight ? barHeight + 12 : 132 }} />

      <div
        ref={wrapRef}
        className="fixed left-0 right-0 z-30 px-3 pointer-events-none"
        style={{
          bottom: 0,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="sticky-action-bar max-w-4xl mx-auto bg-slate-900/97 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl shadow-slate-950/60 overflow-hidden pointer-events-auto">
          {hasStats && (
            <div
              className="grid divide-x divide-x-reverse divide-slate-800 border-b border-slate-800"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {stats!.map((stat, idx) => (
                <div key={`${stat.label}-${idx}`} className="px-2 py-2 text-center min-w-0">
                  <span className="block text-[9px] text-slate-400 font-bold truncate">{stat.label}</span>
                  <span
                    className={`block text-[11px] sm:text-xs font-black font-mono truncate ${
                      toneClasses[stat.tone || 'slate']
                    }`}
                  >
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {hasActions && (
            <div className="p-2.5 flex items-center gap-2">
              {actions!.map((action, idx) => {
                const Icon = action.icon;
                const tone = action.tone || 'amber';
                return (
                  <button
                    key={`${action.label}-${idx}`}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={`${
                      action.primary === false ? 'flex-none px-4' : 'flex-1'
                    } bg-gradient-to-r ${
                      actionTones[tone]
                    } disabled:opacity-50 disabled:cursor-not-allowed font-black py-3 px-4 rounded-xl shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-[0.97]`}
                  >
                    {Icon && <Icon className="w-4 h-4 shrink-0" />}
                    <span className="text-xs font-bold whitespace-nowrap">{action.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {hint && (
            <div className="px-3 pb-2 -mt-1 text-[10px] text-slate-400 text-center">{hint}</div>
          )}
        </div>
      </div>
    </>
  );
};

export default StickyActionBar;
