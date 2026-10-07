'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { decideBack, HOME_TAB, pushTabHistory } from '../core/backNav';
import { closeTopOverlay, overlayCount } from '../lib/backStack';

/**
 * زر الرجوع في التلفون: يقفل النافذة/القائمة أو يرجع للشاشة السابقة
 * بدل الخروج من التطبيق. في الرئيسية يطلب ضغطة ثانية للخروج.
 *
 * الطريقة: «مدخل حارس» واحد في سجل المتصفح فوق مدخل التطبيق.
 * الرجوع ينزع الحارس (popstate) → ننفّذ الإجراء ثم نعيد الحارس.
 * عند طلب الخروج لا نعيده — فالضغطة التالية تخرج فعلاً،
 * وأي لمسة للشاشة تعيد الحارس (لمسة المستخدم تجعل كروم يحترمه).
 */
export function useBackButton(opts: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}) {
  const { activeTab, setActiveTab, menuOpen, setMenuOpen } = opts;
  const [exitHint, setExitHint] = useState(false);

  const historyRef = useRef<string[]>([]);
  const stateRef = useRef({ activeTab, menuOpen });
  stateRef.current = { activeTab, menuOpen };
  const armedRef = useRef(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** التنقل بين الشاشات مع حفظ السجل — بديل setActiveTab */
  const navigate = useCallback(
    (tab: string) => {
      historyRef.current = pushTabHistory(historyRef.current, stateRef.current.activeTab, tab);
      setActiveTab(tab);
    },
    [setActiveTab]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const arm = () => {
      if (armedRef.current) return;
      try {
        window.history.pushState({ ...(window.history.state || {}), sgcGuard: true }, '');
        armedRef.current = true;
      } catch {
        /* تجاهل */
      }
    };

    // مدخل التطبيق يُعلَّم، ثم الحارس فوقه
    try {
      const st = window.history.state || {};
      if (st.sgcGuard) {
        armedRef.current = true; // إعادة تحميل والصفحة أصلاً على الحارس
      } else {
        window.history.replaceState({ ...st, sgcRoot: true }, '');
        arm();
      }
    } catch {
      /* تجاهل */
    }

    const hideHint = () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
      setExitHint(false);
    };

    const onPopState = (e: PopStateEvent) => {
      // رجعنا إلى الحارس (تقدّم للأمام) — لا شيء
      if (e.state && e.state.sgcGuard) {
        armedRef.current = true;
        return;
      }
      armedRef.current = false;

      const action = decideBack({
        overlayCount: overlayCount(),
        menuOpen: stateRef.current.menuOpen,
        activeTab: stateRef.current.activeTab,
        tabHistory: historyRef.current,
      });

      switch (action.type) {
        case 'closeOverlay':
          closeTopOverlay();
          arm();
          break;
        case 'closeMenu':
          setMenuOpen(false);
          arm();
          break;
        case 'goTab':
          historyRef.current = action.history;
          setActiveTab(action.tab);
          arm();
          break;
        case 'exitPrompt':
          // لا نعيد الحارس: الضغطة التالية تخرج من التطبيق
          setExitHint(true);
          if (hintTimer.current) clearTimeout(hintTimer.current);
          hintTimer.current = setTimeout(() => {
            setExitHint(false);
            arm();
          }, 2500);
          break;
      }
    };

    // أي لمسة/كتابة → إعادة الحارس إن كان منزوعاً (بتفاعل المستخدم)
    const onInteract = () => {
      if (!armedRef.current) {
        hideHint();
        arm();
      }
    };

    window.addEventListener('popstate', onPopState);
    window.addEventListener('pointerdown', onInteract, true);
    window.addEventListener('keydown', onInteract, true);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('pointerdown', onInteract, true);
      window.removeEventListener('keydown', onInteract, true);
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, [setActiveTab, setMenuOpen]);

  return { navigate, exitHint, HOME_TAB };
}
