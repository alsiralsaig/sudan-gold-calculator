'use client';

import React, { useEffect, useState } from 'react';
import { GoldStoreProvider, useGoldStore } from '../context/GoldStoreContext';
import { Navbar } from '../components/layout/Navbar';
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
import { LockScreen } from '../components/common/LockScreen';
import { PwaInstallPrompt } from '../components/common/PwaInstallPrompt';

const KNOWN_TABS = [
  'dashboard',
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
  const { isLocked } = useGoldStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  /**
   * فتح الشاشة المطلوبة عند الضغط على إشعار النظام:
   * Service Worker يفتح الرابط /?tab=loans أو يرسل رسالة notification-click.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyTab = (tab?: string | null) => {
      if (tab && KNOWN_TABS.includes(tab)) setActiveTab(tab);
    };

    const params = new URLSearchParams(window.location.search);
    applyTab(params.get('tab'));

    const onMessage = (event: MessageEvent) => {
      const data = event.data || {};
      if (data.type === 'notification-click') applyTab(data.tab);
    };

    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
  }, []);

  if (isLocked) {
    return <LockScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Cairo',sans-serif] selection:bg-amber-500 selection:text-slate-950">
      
      {/* Top Header Navbar with Dropdown Menu Drawer */}
      <Navbar
        activeTab={activeTab}
        onNavigate={setActiveTab}
        onOpenInstallModal={() => setShowInstallModal(true)}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-3 sm:p-6 pb-0">
        {activeTab === 'dashboard' && <DashboardScreen onNavigate={setActiveTab} />}
        {activeTab === 'calculator' && <CalculatorScreen />}
        {activeTab === 'partners' && <PartnersScreen />}
        {activeTab === 'purchases' && <PurchasesScreen />}
        {activeTab === 'sales' && <SalesScreen />}
        {activeTab === 'expenses' && <ExpensesScreen />}
        {activeTab === 'gold_price' && <GoldPriceScreen />}
        {activeTab === 'reports' && <ReportsScreen />}
        {activeTab === 'analytics' && <AnalyticsScreen />}
        {activeTab === 'reminders' && <RemindersScreen />}
        {activeTab === 'loans' && <LoansScreen />}
        {activeTab === 'archive' && <ArchiveScreen />}
        {activeTab === 'settings' && <SettingsScreen onOpenInstallModal={() => setShowInstallModal(true)} />}
      </main>

      {/* Clean 4-Tab Bottom Navigation + Menu Drawer Button */}
      {/* PWA iOS/Android Install Modal */}
      <PwaInstallPrompt
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />

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
