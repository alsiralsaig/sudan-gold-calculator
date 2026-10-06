import React from 'react';
import {
  LayoutDashboard,
  Calculator,
  Menu,
  Settings,
  FileBarChart
} from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenMenu: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  onOpenMenu,
}) => {
  const mainTabs = [
    { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'calculator', label: 'الحاسبة', icon: Calculator },
    { id: 'reports', label: 'التقارير', icon: FileBarChart },
    { id: 'settings', label: 'الإعدادات', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/80 px-4 py-2 safe-area-bottom">
      <div className="max-w-md mx-auto grid grid-cols-5 gap-1 items-center">
        
        {mainTabs.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all select-none ${
                isActive
                  ? 'text-amber-400 bg-amber-500/15 font-black shadow-sm shadow-amber-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 text-amber-400' : ''}`} />
              <span className={`text-[11px] mt-1 font-bold ${isActive ? 'text-amber-300' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* 5th Tab: ☰ القائمة (Opens Full Slide-Out Drawer) */}
        <button
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all text-amber-400/90 hover:text-amber-300 hover:bg-slate-900"
          title="عرض باقي الصفحات"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[11px] mt-1 font-bold">القائمة ☰</span>
        </button>

      </div>
    </nav>
  );
};
