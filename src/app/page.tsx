'use client';

import { OPEN_ARCHIVE_EVENT } from '../core/archiveNav';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GoldStoreProvider, useGoldStore } from '../context/GoldStoreContext';
import type { RestoreRequest } from '../components/calculator/GoldCalculator';
import { VoiceAssistant } from '../components/common/VoiceAssistant';
import { Navbar } from '../components/layout/Navbar';
import { AutoUpdate } from '../components/common/AutoUpdate';
import { DashboardScreen } from '../components/screens/DashboardScreen';
import { CalculatorScreen } from '../components/screens/CalculatorScreen';
import { PartnersScreen } from '../components/screens/PartnersScreen';
import { PurchasesScreen } from '../components/screens/PurchasesScreen';
import { SalesScreen } from '../components/screens/SalesScreen';
import { ExpensesScreen } from '../components/screens/ExpensesScreen';
import { GoldPriceScreen } from '../components/screens/GoldPriceScreen';
import { ArchiveScreen } from '../components/screens/ArchiveScreen';
import { SettingsScreen } from '../components/screens/SettingsScreen';
import { ReportsScreen } from '../components/screens/ReportsScreen';
import { AnalyticsScreen } from '../components/screens/AnalyticsScreen';
import { RemindersScreen } from '../components/screens/RemindersScreen';
import { LoansScreen } from '../components/screens/LoansScreen';
import { SearchScreen } from '../components/screens/SearchScreen';
import { LockScreen } from '../components/common/LockScreen';
import { PwaInstallPrompt } from '../components/common/PwaInstallPrompt';
import { StoreNamePrompt } from '../components/onboarding/StoreNamePrompt';
import { BranchScopedNotice } from '../components/layout/BranchScopedNotice';
import { NotificationsHealthBanner } from '../components/common/NotificationsHealthBanner';
import { PullToRefresh } from '../components/common/PullToRefresh';
import { useBackButton } from '../hooks/useBackButton';
import { useBackClose } from '../lib/backStack';

const KNOWN_TABS = [
  'dashboard',
  'search',
  'calculator',
  'partners',
  'purchases',
  'sales',
  'expenses',
  'gold_price',
  'reports',
  'analytics',
  'reminders',
  'loans',
  'archive',
  'settings',
];

function MainAppContent() {
  const { isLocked, refreshFromCloud, refreshRates, isCloudSignedIn } = useGoldStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [voiceCalc, setVoiceCalc] = useState<RestoreRequest | null>(null);
  const scrollRef = useRef<HTMLElement>(null);

  // زر الرجوع: يقفل النافذة/القائمة أو يرجع للشاشة السابقة بدل الخروج
  const { navigate, exitHint } = useBackButton({
    activeTab,
    setActiveTab,
    menuOpen: isMenuOpen,
    setMenuOpen: setIsMenuOpen,
  });
  useBackClose(showInstallModal, () => setShowInstallModal(false));

  // كل شاشة جديدة تبدأ من أعلاها
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [activeTab]);

  /** السحب للتحديث: بيانات السحابة + الأسعار + فحص نسخة جديدة من التطبيق */
  const handlePullRefresh = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    navigator.serviceWorker?.ready.then((reg) => reg.update()).catch(() => undefined);
    const [cloud, rates] = await Promise.all([
      isCloudSignedIn ? refreshFromCloud(false) : Promise.resolve({ ok: true, changed: false }),
      refreshRates().catch(() => false),
    ]);
    return isCloudSignedIn ? cloud.ok : Boolean(rates);
  }, [isCloudSignedIn, refreshFromCloud, refreshRates]);

  /**
   * فتح الشاشة المطلوبة عند الضغط على إشعار النظام:
   * Service Worker يفتح الرابط /?tab=loans أو يرسل رسالة notification-click.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyTab = (tab?: string | null) => {
      if (tab && KNOWN_TABS.includes(tab)) navigate(tab);
    };

    const params = new URLSearchParams(window.location.search);
    applyTab(params.get('tab'));

    const onMessage = (event: MessageEvent) => {
      const data = event.data || {};
      if (data.type === 'notification-click') applyTab(data.tab);
    };

    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
  }, [navigate]);

  // زر «الأرشيف» داخل أي شاشة يفتح تبويب قسمه مباشرة
  useEffect(() => {
    const onOpen = () => navigate('archive');
    window.addEventListener(OPEN_ARCHIVE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ARCHIVE_EVENT, onOpen);
  }, [navigate]);

  if (isLocked) {
    return <LockScreen />;
  }

  return (
    <div className="app-shell bg-slate-950 text-slate-100 font-['Cairo',sans-serif] selection:bg-amber-500 selection:text-slate-950">
      
      {/* Top Header Navbar with Dropdown Menu Drawer */}
      <Navbar
        activeTab={activeTab}
        onNavigate={navigate}
        onOpenInstallModal={() => setShowInstallModal(true)}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
      />

      {/* Main Content Area */}
      <main ref={scrollRef} className="app-scroll w-full p-3 sm:p-6 pb-0">
        <PullToRefresh scrollRef={scrollRef} onRefresh={handlePullRefresh} disabled={isMenuOpen} />
        <div className="max-w-4xl mx-auto">
        {/* تنبيه: الفرع النشط يخفي سجلات موجودة — ضغطة واحدة ترجّعها */}
        <BranchScopedNotice />
        {/* صحة الإشعارات: يظهر فقط لو الإشعارات مفعّلة وفيها خلل */}
        <NotificationsHealthBanner />
        {activeTab === 'dashboard' && <DashboardScreen onNavigate={navigate} />}
        {activeTab === 'calculator' && <CalculatorScreen voiceRestore={voiceCalc} />}
        {activeTab === 'partners' && <PartnersScreen />}
        {activeTab === 'purchases' && <PurchasesScreen />}
        {activeTab === 'sales' && <SalesScreen />}
        {activeTab === 'expenses' && <ExpensesScreen />}
        {activeTab === 'search' && <SearchScreen onNavigate={navigate} />}
        {activeTab === 'gold_price' && <GoldPriceScreen />}
        {activeTab === 'reports' && <ReportsScreen />}
        {activeTab === 'analytics' && <AnalyticsScreen />}
        {activeTab === 'reminders' && <RemindersScreen />}
        {activeTab === 'loans' && <LoansScreen />}
        {activeTab === 'archive' && <ArchiveScreen />}
        {activeTab === 'settings' && <SettingsScreen onOpenInstallModal={() => setShowInstallModal(true)} />}
        </div>
      </main>

      {/* المساعد الصوتي: مايك في كل الشاشات — أوامر حساب وأسعار وتنقل */}
      <VoiceAssistant
        onNavigate={navigate}
        onCalc={(req) => {
          setVoiceCalc(req);
          navigate('calculator');
        }}
      />

      {/* Clean 4-Tab Bottom Navigation + Menu Drawer Button */}
      {/* PWA iOS/Android Install Modal */}
      <AutoUpdate />

      {/* شاشة الترحيب: اختيار اسم المحل — مرة واحدة في التثبيت الجديد */}
      <StoreNamePrompt />

      <PwaInstallPrompt
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />

      {/* تنبيه الخروج: ضغطة رجوع ثانية تخرج من التطبيق */}
      {exitHint && (
        <div className="pointer-events-none fixed inset-x-0 z-[90] flex justify-center px-4" style={{ bottom: 'calc(var(--sab-h, 0px) + 20px)' }} role="status">
          <div className="rounded-full bg-slate-800/95 border border-slate-600 px-4 py-2.5 text-xs font-bold text-white shadow-xl shadow-black/50">
            اضغط رجوع مرة تانية للخروج
          </div>
        </div>
      )}

    </div>
  );
}

export default function Home() {
  return (
    <GoldStoreProvider>
      <MainAppContent />
    </GoldStoreProvider>
  );
}
