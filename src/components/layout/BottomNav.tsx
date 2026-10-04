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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/80 px-1 py-1.5 safe-area-bottom">
      <div className="max-w-4xl mx-auto grid grid-cols-8 gap-0.5 items-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all select-none min-w-0 ${
                isActive
                  ? 'text-amber-400 bg-amber-500/15 font-black shadow-sm shadow-amber-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${isActive ? 'scale-110 text-amber-400' : ''}`} />
              <span className={`text-[8.5px] sm:text-[10px] mt-0.5 truncate max-w-full text-center leading-none ${isActive ? 'font-bold text-amber-300' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
