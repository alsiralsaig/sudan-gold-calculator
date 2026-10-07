'use client';

import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Check, WifiOff } from 'lucide-react';
import { isVerticalPull, pullDistance, pullShouldTrigger, PULL_TRIGGER_PX } from '../../core/backNav';
import { overlayCount } from '../../lib/backStack';

type Phase = 'idle' | 'pulling' | 'refreshing' | 'done' | 'failed';

/**
 * السحب للأسفل للتحديث — داخل منطقة البيانات القابلة للتمرير.
 * (السحب الأصلي في المتصفح معطّل عمداً في globals.css حتى يبقى الإطار ثابتاً.)
 *
 * يعمل فقط عندما تكون الصفحة في أعلاها ولا توجد نافذة/قائمة مفتوحة،
 * وفقط للسحب العمودي حتى لا يتعارض مع تمرير الجداول أفقياً.
 */
export const PullToRefresh: React.FC<{
  scrollRef: React.RefObject<HTMLElement | null>;
  onRefresh: () => Promise<boolean>;
  disabled?: boolean;
}> = ({ scrollRef, onRefresh, disabled }) => {
  const [distance, setDistance] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');

  const start = useRef<{ x: number; y: number } | null>(null);
  const active = useRef(false);
  const distRef = useRef(0);
  const busy = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const reset = () => {
      start.current = null;
      active.current = false;
      distRef.current = 0;
      setDistance(0);
    };

    const onStart = (e: TouchEvent) => {
      if (busy.current || disabledRef.current || overlayCount() > 0) return;
      if (e.touches.length !== 1 || el.scrollTop > 0) return;
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      active.current = false;
    };

    const onMove = (e: TouchEvent) => {
      if (!start.current || busy.current) return;
      const dx = e.touches[0].clientX - start.current.x;
      const dy = e.touches[0].clientY - start.current.y;
      if (!active.current) {
        if (el.scrollTop > 0 || dy < 0) {
          start.current = null;
          return;
        }
        if (!isVerticalPull(dx, dy)) return;
        active.current = true;
        setPhase('pulling');
      }
      const d = pullDistance(dy);
      distRef.current = d;
      setDistance(d);
    };

    const onEnd = async () => {
      if (!active.current) {
        start.current = null;
        return;
      }
      const trigger = pullShouldTrigger(distRef.current);
      if (!trigger) {
        reset();
        setPhase('idle');
        return;
      }
      busy.current = true;
      start.current = null;
      active.current = false;
      setDistance(PULL_TRIGGER_PX * 0.75);
      setPhase('refreshing');
      let ok = false;
      try {
        ok = await onRefreshRef.current();
      } catch {
        ok = false;
      }
      setPhase(ok ? 'done' : 'failed');
      setTimeout(() => {
        reset();
        setPhase('idle');
        busy.current = false;
      }, ok ? 700 : 1600);
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [scrollRef]);

  if (phase === 'idle' && distance === 0) return null;

  const ready = pullShouldTrigger(distance);
  const label =
    phase === 'refreshing'
      ? 'جاري التحديث...'
      : phase === 'done'
        ? 'تم التحديث'
        : phase === 'failed'
          ? 'تعذّر التحديث — تأكد من الإنترنت'
          : ready
            ? 'افلت للتحديث'
            : 'اسحب للتحديث';

  const Icon = phase === 'done' ? Check : phase === 'failed' ? WifiOff : RefreshCw;
  const rotate = phase === 'pulling' ? Math.min(360, (distance / PULL_TRIGGER_PX) * 270) : 0;

  return (
    <div className="pointer-events-none sticky top-0 z-40 h-0 overflow-visible flex justify-center" aria-live="polite">
      <div
        style={{
          transform: `translateY(${Math.max(4, distance - 30)}px)`,
          transition: phase === 'pulling' ? 'none' : 'transform 200ms ease',
        }}
      >
      <div
        className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold shadow-lg shadow-black/40 backdrop-blur ${
          phase === 'failed'
            ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
            : phase === 'done'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : ready || phase === 'refreshing'
                ? 'bg-slate-900/95 border-amber-500/50 text-amber-300'
                : 'bg-slate-900/95 border-slate-700 text-slate-300'
        }`}
        style={{ opacity: phase === 'pulling' ? Math.min(1, distance / 40) : 1 }}
      >
        <Icon
          className={`w-4 h-4 ${phase === 'refreshing' ? 'animate-spin' : ''}`}
          style={phase === 'pulling' ? { transform: `rotate(${rotate}deg)` } : undefined}
        />
        <span>{label}</span>
      </div>
      </div>
    </div>
  );
};
