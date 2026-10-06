import React, { useState } from 'react';
import {
  Menu,
  X,
  LayoutDashboard,
  Calculator,
  Users,
  ShoppingBag,
  DollarSign,
  TrendingDown,
  Coins,
  Settings,
  Lock,
  Smartphone,
  RotateCw,
  Sparkles,
  ChevronLeft,
  Cloud,
  Archive,
  FileBarChart,
  BarChart3,
  BellRing,
  WifiOff,
  CloudUpload
} from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { fmtNum } from '../../core/format';

interface NavbarProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  onOpenInstallModal: () => void;
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onNavigate,
  onOpenInstallModal,
  isMenuOpen,
  setIsMenuOpen,
}) => {
  const { pinCode, lockApp, rates, updateRates, userEmail, dues, isOnline, pendingSync, forceSync } =
    useGoldStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const navMenuItems = [
    {
      id: 'dashboard',
      label: 'الرئيسية (لوحة التحكم)',
      desc: 'ملخص رأس المال، الأرباح والمخزون',
      icon: LayoutDashboard,
      color: 'text-amber-400 bg-amber-500/10',
    },
    {
      id: 'calculator',
      label: 'الحاسبة (الذهب + الآلة الحاسبة)',
      desc: 'حساب الذهب، العيارات، والآلة الحاسبة العادية',
      icon: Calculator,
      color: 'text-amber-400 bg-amber-500/10',
    },
    {
      id: 'partners',
      label: 'الشركاء وتوزيع الأرباح',
      desc: 'حساب رأس المال والنسب وصافي الأرباح',
      icon: Users,
      color: 'text-blue-400 bg-blue-500/10',
    },
    {
      id: 'purchases',
      label: 'سجل المشتريات',
      desc: 'فواتير شراء الذهب الكسر والديون',
      icon: ShoppingBag,
      color: 'text-emerald-400 bg-emerald-500/10',
    },
    {
      id: 'sales',
      label: 'سجل المبيعات',
      desc: 'فواتير البيع والأرباح الفورية',
      icon: DollarSign,
      color: 'text-green-400 bg-green-500/10',
    },
    {
      id: 'expenses',
      label: 'سجل المصروفات',
      desc: 'المنصرفات العامة والخاصة بالشركاء',
      icon: TrendingDown,
      color: 'text-rose-400 bg-rose-500/10',
    },
    {
      id: 'gold_price',
      label: 'أسعار الذهب والعملات',
      desc: 'السعر العالمي وسعر الدولار بالسوق الموازي',
      icon: Coins,
      color: 'text-amber-400 bg-amber-500/10',
    },
    {
      id: 'reports',
      label: 'التقارير والكشوفات',
      desc: 'تقرير يومي وشهري، جرد المخزون، كشف حساب زبون أو مورد',
      icon: FileBarChart,
      color: 'text-cyan-400 bg-cyan-500/10',
    },
    {
      id: 'analytics',
      label: 'التحليلات والرسوم البيانية',
      desc: 'أرباح يومية وشهرية، حركة الوزن، تطور سعر الذهب',
      icon: BarChart3,
      color: 'text-cyan-400 bg-cyan-500/10',
    },
    {
      id: 'reminders',
      label: 'التنبيهات والمتأخرات',
      desc: 'مواعيد تحصيل الزبائن وسداد الموردين مع تذكير واتساب',
      icon: BellRing,
      color: 'text-rose-400 bg-rose-500/10',
    },
    {
      id: 'archive',
      label: 'الأرشيف',
      desc: 'استعادة السجلات المؤرشفة أو حذفها نهائياً',
      icon: Archive,
      color: 'text-amber-400 bg-amber-500/10',
    },
    {
      id: 'settings',
      label: 'الإعدادات والمزامنة السحابية',
      desc: 'مزامنة الأجهزة، رمز PIN، والنسخ الاحتياطي',
      icon: Settings,
      color: 'text-purple-400 bg-purple-500/10',
    },
  ];

  const syncLabel = () => {
    if (!isOnline) return { text: 'غير متصل', tone: 'text-rose-300 bg-rose-500/15 border-rose-500/40' };
    if (pendingSync)
      return { text: 'بانتظار المزامنة', tone: 'text-amber-300 bg-amber-500/15 border-amber-500/40' };
    return { text: 'متزامن', tone: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40' };
  };

  const getTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'لوحة التحكم';
      case 'calculator':
        return 'حاسبة الذهب والآلة الحاسبة';
      case 'partners':
        return 'الشركاء وتوزيع الأرباح';
      case 'purchases':
        return 'سجل المشتريات';
      case 'sales':
        return 'سجل المبيعات';
      case 'expenses':
        return 'سجل المصروفات';
      case 'gold_price':
        return 'أسعار الذهب والعملات';
      case 'reports':
        return 'التقارير والكشوفات';
      case 'analytics':
        return 'التحليلات والرسوم البيانية';
      case 'reminders':
        return 'التنبيهات والمتأخرات';
      case 'archive':
        return 'الأرشيف';
      case 'settings':
        return 'الإعدادات والمزامنة';
      default:
        return 'حاسبة الذهب';
    }
  };

  const handleGlobalRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setToastMessage('جاري تحديث الأسعار...');

    try {
      const res = await fetch('/api/rates');
      if (res.ok) {
        const data = await res.json();
        updateRates({
          globalOunceUsd: data.ounceUsd || 4144.70,
          usdRate: data.usdRate || 8400.00,
          sarRate: data.sarRate || 2240.00,
          aedRate: data.aedRate || 2288.00,
          egpRate: data.egpRate || 173.00,
          karat24: data.karat24 || 1119344,
          karat21: data.karat21 || 979426,
          karat18: data.karat18 || 839508,
          karat22: data.karat22 || 1026065,
        });
      }
    } catch (_) {
      updateRates({
        globalOunceUsd: 4144.70,
        usdRate: 8400.00,
        sarRate: 2240.00,
        aedRate: 2288.00,
        egpRate: 173.00,
        karat24: 1119344,
        karat21: 979426,
        karat18: 839508,
        karat22: 1026065,
      });
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
        setToastMessage('تم تحديث الأسعار بنجاح ⚡');
        setTimeout(() => setToastMessage(''), 2500);
      }, 500);
    }
  };

  const handleSelectMenuItem = (id: string) => {
    onNavigate(id);
    setIsMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-4 py-2.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          
          {/* Right Side: Single Clean Menu Button (☰ القائمة) */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setIsMenuOpen(true)}
              className="p-2.5 bg-amber-500/15 hover:bg-amber-500/25 active:bg-amber-500/30 text-amber-400 rounded-2xl border border-amber-500/40 transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/10 active:scale-95 shrink-0"
              title="القائمة المنسدلة لكافة الصفحات"
            >
              <Menu className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-black text-amber-300 hidden sm:inline">القائمة</span>
            </button>

            <div className="min-w-0">
              <h1 className="font-black text-sm sm:text-base text-white flex items-center gap-1.5 truncate">
                <span className="truncate">{getTitle()}</span>
                <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded-md font-bold shrink-0">
                  التسعير: عيار 21
                </span>
              </h1>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono truncate flex items-center gap-1.5">
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                    rates.isStale ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
                  }`}
                  title={rates.isStale ? 'الأسعار تحتاج تحديث' : 'الأسعار محدّثة'}
                />
                <span className="text-amber-300 font-bold">عيار 21 (الرسمي):</span>
                <span className="text-amber-400 font-bold">{fmtNum(rates.karat21)}</span>
                <span>ج.س • $</span>
                <span className="text-white font-bold">{fmtNum(rates.usdRate)}</span>
              </p>
            </div>
          </div>

          {/* Left Side: Refresh Arrow (🔄), Install Button (📱), Lock Button (🔒) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            
            {/* Reload / Refresh Button */}
            <button
              onClick={handleGlobalRefresh}
              disabled={isRefreshing}
              className="p-2 sm:p-2.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-amber-400 rounded-2xl border border-slate-700/80 transition-all active:scale-90 flex items-center justify-center shadow-sm"
              title="تحديث ومزامنة الأسعار"
            >
              <RotateCw className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* Install Button */}
            <button
              onClick={onOpenInstallModal}
              className="p-2 sm:px-3 sm:py-2 bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 text-amber-300 border border-amber-500/40 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              title="تثبيت التطبيق على جهازك"
            >
              <Smartphone className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">تثبيت</span>
            </button>

            {/* Alerts (المتأخرات) */}
            <button
              onClick={() => onNavigate('reminders')}
              className={`relative p-2 sm:p-2.5 rounded-2xl border transition-colors ${
                dues.overdue.length > 0
                  ? 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/50 text-rose-300'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
              }`}
              title={
                dues.overdue.length > 0
                  ? `${dues.overdue.length} فاتورة متأخرة`
                  : 'التنبيهات والمتأخرات'
              }
            >
              <BellRing className="w-4 h-4" />
              {dues.overdue.length > 0 && (
                <span className="absolute -top-1 -left-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center">
                  {dues.overdue.length > 9 ? '9+' : dues.overdue.length}
                </span>
              )}
            </button>

            {/* Lock Button */}
            {pinCode && (
              <button
                onClick={lockApp}
                className="p-2 sm:p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-2xl transition-colors"
                title="قفل التطبيق الآن"
              >
                <Lock className="w-4 h-4" />
              </button>
            )}

          </div>

        </div>

        {/* شريط حالة الشبكة والمزامنة */}
        {(!isOnline || pendingSync) && (
          <div
            className={`flex items-center justify-between gap-2 px-3 py-1.5 text-[10px] sm:text-[11px] font-bold border-t ${
              !isOnline
                ? 'bg-rose-950/40 border-rose-500/30 text-rose-200'
                : 'bg-amber-950/40 border-amber-500/30 text-amber-200'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {!isOnline ? <WifiOff className="w-3.5 h-3.5" /> : <CloudUpload className="w-3.5 h-3.5 animate-pulse" />}
              {!isOnline
                ? 'أنت غير متصل — كل التعديلات محفوظة على جهازك'
                : 'توجد تغييرات لم تُزامن بعد — جاري الرفع'}
            </span>
            {isOnline && pendingSync && (
              <button
                onClick={() => void forceSync()}
                className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-100 shrink-0"
              >
                مزامنة الآن
              </button>
            )}
          </div>
        )}

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border-2 border-amber-500 text-amber-300 px-4 py-2 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-2 animate-in fade-in zoom-in-95">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
            <span>{toastMessage}</span>
          </div>
        )}
      </header>

      {/* Slide-out Full Dropdown Menu Drawer */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-start bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          
          {/* Backdrop Click */}
          <div className="absolute inset-0" onClick={() => setIsMenuOpen(false)} />

          {/* Drawer Content Container */}
          <div className="relative w-full max-w-sm h-full bg-slate-950 border-l border-slate-800 p-5 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200 text-white z-10">
            
            <div className="space-y-4">
              
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5 shadow-md shadow-amber-500/20">
                    <div className="w-full h-full bg-slate-950 rounded-2xl flex items-center justify-center">
                      <Coins className="w-5 h-5 text-amber-400" />
                    </div>
                  </div>
                  <div>
                    <h2 className="font-black text-sm text-white">حاسبة الذهب والشركاء</h2>
                    <p className="text-[11px] text-amber-400 font-bold">نسخة السودان المعتمدة</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-900 border border-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sync Status Banner in Menu */}
              {userEmail && (
                <div
                  onClick={() => handleSelectMenuItem('settings')}
                  className="bg-emerald-950/40 border border-emerald-500/40 p-3 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-emerald-950/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-emerald-400" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-emerald-400 font-bold block">المزامنة السحابية مفعّلة</span>
                      <span className="text-xs font-mono text-emerald-200 truncate block">{userEmail}</span>
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-emerald-400 shrink-0" />
                </div>
              )}

              {/* Navigation Items List */}
              <div className="space-y-1.5 pt-1">
                {navMenuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectMenuItem(item.id)}
                      className={`w-full p-3 rounded-2xl text-right flex items-center justify-between transition-all ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20 scale-[1.02]'
                          : 'bg-slate-900/80 hover:bg-slate-900 text-slate-200 border border-slate-800/80 hover:border-amber-500/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2.5 rounded-xl ${
                            isActive ? 'bg-slate-950 text-amber-400' : item.color
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className={`text-xs sm:text-sm font-bold ${isActive ? 'text-slate-950 font-black' : 'text-white'}`}>
                            {item.label}
                          </div>
                          <div className={`text-[10px] mt-0.5 ${isActive ? 'text-slate-900/80 font-bold' : 'text-slate-400'}`}>
                            {item.desc}
                          </div>
                        </div>
                      </div>

                      <ChevronLeft className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-500'}`} />
                    </button>
                  );
                })}
              </div>

            </div>

            {/* Bottom Menu Action (Install App) */}
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenInstallModal();
                }}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs rounded-2xl shadow-lg flex items-center justify-center gap-2"
              >
                <Smartphone className="w-4 h-4" />
                <span>تثبيت التطبيق على جهازك (أندرويد / آيفون)</span>
              </button>

              <div className="text-center text-[10px] text-slate-500 pt-1">
                حاسبة الذهب والشركاء v4.0.0
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
