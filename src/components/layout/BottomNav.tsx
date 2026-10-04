import React from 'react';
import {
  LayoutDashboard,
  Calculator,
  Users,
  ShoppingBag,
  DollarSign,
  TrendingDown,
  Coins,
  Settings
} from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const navItems = [
    { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'calculator', label: 'الحاسبة', icon: Calculator },
    { id: 'partners', label: 'الشركاء', icon: Users },
    { id: 'purchases', label: 'المشتريات', icon: ShoppingBag },
    { id: 'sales', label: 'المبيعات', icon: DollarSign },
    { id: 'expenses', label: 'المصروفات', icon: TrendingDown },
    { id: 'gold_price', label: 'الأسعار', icon: Coins },
    { id: 'settings', label: 'الإعدادات', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/80 px-2 py-2 safe-area-bottom">
      <div className="max-w-4xl mx-auto flex items-center justify-around overflow-x-auto no-scrollbar gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center min-w-[50px] py-1 px-1 rounded-2xl transition-all ${
                isActive
                  ? 'text-amber-400 bg-amber-500/10 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
              <span className="text-[10px] mt-1 truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
