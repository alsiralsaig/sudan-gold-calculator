'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import { APP_VERSION_LABEL } from '../../core/version';

/**
 * تحديث تلقائي للتطبيق (PWA):
 * - يفحص وجود نسخة جديدة من التطبيق على السيرفر (Service Worker) كل دقيقتين،
 *   وكذلك عند رجوع التطبيق للمقدمة.
 * - عند وجود نسخة جديدة: يفعلها ويحدّث الصفحة تلقائياً.
 *
 * بدون هذا كانت الأجهزة تبقى على نسخة قديمة مخزّنة في الكاش بعد كل تحديث.
 */
export const AutoUpdate: React.FC = () => {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let reloaded = false;
    let registration: ServiceWorkerRegistration | null = null;

    const reloadOnce = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };

    const activateWaiting = () => {
      const waiting = registration?.waiting;
      if (waiting) {
        setUpdateReady(true);
        waiting.postMessage('skip-waiting');
        setTimeout(reloadOnce, 400);
      }
    };

    const watchInstalling = (reg: ServiceWorkerRegistration) => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          activateWaiting();
        }
      });
    };

    navigator.serviceWorker.addEventListener('controllerchange', reloadOnce);

    void (async () => {
      try {
        registration = await navigator.serviceWorker.ready;
        if (registration.waiting) activateWaiting();
        registration.addEventListener('updatefound', () => watchInstalling(registration!));
        // فحص دوري
        const interval = setInterval(() => {
          registration?.update().catch(() => undefined);
        }, 120_000);
        // فحص عند رجوع التطبيق للمقدمة
        const onVisible = () => {
          if (document.visibilityState === 'visible') {
            registration?.update().catch(() => undefined);
            setTimeout(activateWaiting, 300);
          }
        };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onVisible);
        return () => {
          clearInterval(interval);
          document.removeEventListener('visibilitychange', onVisible);
          window.removeEventListener('focus', onVisible);
        };
      } catch {
        /* لا شئ */
      }
    })();

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', reloadOnce);
    };
  }, []);

  if (!updateReady) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[80] bg-amber-500 text-slate-950 font-black text-xs px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2">
      <Download className="w-4 h-4 animate-bounce" />
      <span>جاري تحديث التطبيق إلى {APP_VERSION_LABEL}...</span>
      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
    </div>
  );
};

export default AutoUpdate;
