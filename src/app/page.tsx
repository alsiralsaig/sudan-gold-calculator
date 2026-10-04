'use client';

import React, { useState } from 'react';
import { GoldStoreProvider, useGoldStore } from '../context/GoldStoreContext';
import { Navbar } from '../components/layout/Navbar';
import { BottomNav } from '../components/layout/BottomNav';
import { DashboardScreen } from '../components/screens/DashboardScreen';
import { CalculatorScreen } from '../components/screens/CalculatorScreen';
import { PartnersScreen } from '../components/screens/PartnersScreen';
import { PurchasesScreen } from '../components/screens/PurchasesScreen';
import { SalesScreen } from '../components/screens/SalesScreen';
import { ExpensesScreen } from '../components/screens/ExpensesScreen';
import { GoldPriceScreen } from '../components/screens/GoldPriceScreen';
import { SettingsScreen } from '../components/screens/SettingsScreen';
import { LockScreen } from '../components/common/LockScreen';
import { PwaInstallPrompt } from '../components/common/PwaInstallPrompt';

function MainAppContent() {
  const { isLocked } = useGoldStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showInstallModal, setShowInstallModal] = useState(false);

  if (isLocked) {
    return <LockScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Cairo',sans-serif] selection:bg-amber-500 selection:text-slate-950">
      
      {/* Top Header Navbar */}
      <Navbar
        activeTab={activeTab}
        onOpenInstallModal={() => setShowInstallModal(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'dashboard' && <DashboardScreen onNavigate={setActiveTab} />}
        {activeTab === 'calculator' && <CalculatorScreen />}
        {activeTab === 'partners' && <PartnersScreen />}
        {activeTab === 'purchases' && <PurchasesScreen />}
        {activeTab === 'sales' && <SalesScreen />}
        {activeTab === 'expenses' && <ExpensesScreen />}
        {activeTab === 'gold_price' && <GoldPriceScreen />}
        {activeTab === 'settings' && <SettingsScreen onOpenInstallModal={() => setShowInstallModal(true)} />}
      </main>

      {/* Bottom Navigation Tab Bar */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

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
