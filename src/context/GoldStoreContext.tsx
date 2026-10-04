import React, { createContext, useContext, useState, useEffect } from 'react';
import { Purchase, Sale, Expense, Partner, GoldRates, Payment } from '../types';
import { kUnitsPerGram } from '../core/format';

interface GoldStoreContextType {
  purchases: Purchase[];
  sales: Sale[];
  expenses: Expense[];
  partners: Partner[];
  rates: GoldRates;
  pinCode: string;
  isLocked: boolean;
  
  // Metrics & Stats
  totalCapital: number;
  totalSales: number;
  totalCost: number;
  grossProfit: number;
  generalExpenses: number;
  privateExpenses: number;
  netProfit: number;
  totalProfitPercent: number;
  currentStockUnits: number;

  // Actions
  addPurchase: (p: Omit<Purchase, 'id' | 'payments' | 'updatedAt'>) => void;
  updatePurchase: (p: Purchase) => void;
  deletePurchase: (id: string) => void;
  addPaymentToPurchase: (purchaseId: string, payment: Omit<Payment, 'id'>) => void;

  addSale: (s: Omit<Sale, 'id' | 'updatedAt'>) => void;
  updateSale: (s: Sale) => void;
  deleteSale: (id: string) => void;

  addExpense: (e: Omit<Expense, 'id' | 'updatedAt'>) => void;
  updateExpense: (e: Expense) => void;
  deleteExpense: (id: string) => void;

  addPartner: (p: Omit<Partner, 'id' | 'updatedAt'>) => void;
  updatePartner: (p: Partner) => void;
  deletePartner: (id: string) => void;

  updateRates: (r: Partial<GoldRates>) => void;
  setPinCode: (pin: string) => void;
  unlockApp: (enteredPin: string) => boolean;
  lockApp: () => void;

  exportData: () => void;
  importData: (jsonStr: string) => boolean;
  resetAllData: () => void;
}

const GoldStoreContext = createContext<GoldStoreContextType | undefined>(undefined);

const STORAGE_KEY = 'golden_calculator_db_v4';

const INITIAL_RATES: GoldRates = {
  karat24: 215000,
  karat21: 188125,
  karat18: 161250,
  karat22: 197083,
  usdRate: 8200,
  sarRate: 2185,
  aedRate: 2233,
  egpRate: 157,
  globalOunceUsd: 2650,
  lastUpdated: new Date().toISOString(),
};

const INITIAL_PARTNERS: Partner[] = [
  {
    id: 'pt_1',
    name: 'السر الصائغ (الشريك الأول)',
    capital: 50000000,
    profitPercent: 50,
    phone: '+249913009060',
    notes: 'الشريك المؤسس والمدير التنفيذي',
  },
  {
    id: 'pt_2',
    name: 'محمد أحمد (الشريك الثاني)',
    capital: 50000000,
    profitPercent: 50,
    phone: '+249900000000',
    notes: 'شريك ممول',
  },
];

export const GoldStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [partners, setPartners] = useState<Partner[]>(INITIAL_PARTNERS);
  const [rates, setRates] = useState<GoldRates>(INITIAL_RATES);
  const [pinCode, setPinCodeState] = useState<string>('');
  const [isLocked, setIsLocked] = useState<boolean>(false);

  // Load from LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.purchases) setPurchases(data.purchases);
        if (data.sales) setSales(data.sales);
        if (data.expenses) setExpenses(data.expenses);
        if (data.partners && data.partners.length > 0) setPartners(data.partners);
        if (data.rates) setRates(data.rates);
        if (data.pinCode) {
          setPinCodeState(data.pinCode);
          setIsLocked(true);
        }
      }
    } catch (e) {
      console.warn('Failed to load gold calculator storage:', e);
    }
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    try {
      const dataToSave = {
        purchases,
        sales,
        expenses,
        partners,
        rates,
        pinCode,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (e) {
      console.warn('Failed to save gold calculator storage:', e);
    }
  }, [purchases, sales, expenses, partners, rates, pinCode]);

  // Derived Calculations
  const totalCapital = partners.reduce((sum, p) => sum + (p.capital || 0), 0);
  const totalProfitPercent = partners.reduce((sum, p) => sum + (p.profitPercent || 0), 0);

  const totalSales = sales.reduce((sum, s) => sum + (s.sellAmount || 0), 0);
  const totalCost = sales.reduce((sum, s) => sum + (s.buyAmount || 0), 0);
  const grossProfit = totalSales - totalCost;

  const generalExpenses = expenses
    .filter((e) => e.target === 'عام' || !e.target)
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const privateExpenses = expenses
    .filter((e) => e.target !== 'عام' && e.target)
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const netProfit = grossProfit - generalExpenses;

  const purchasedUnits = purchases.reduce((sum, p) => sum + (p.units || 0), 0);
  const soldUnits = sales.reduce((sum, s) => sum + (s.units || 0), 0);
  const currentStockUnits = Math.max(0, purchasedUnits - soldUnits);

  // Actions
  const addPurchase = (p: Omit<Purchase, 'id' | 'payments' | 'updatedAt'>) => {
    const newP: Purchase = {
      ...p,
      id: `pch_${Date.now()}`,
      payments: [],
      updatedAt: new Date().toISOString(),
    };
    setPurchases((prev) => [newP, ...prev]);
  };

  const updatePurchase = (p: Purchase) => {
    setPurchases((prev) => prev.map((item) => (item.id === p.id ? { ...p, updatedAt: new Date().toISOString() } : item)));
  };

  const deletePurchase = (id: string) => {
    setPurchases((prev) => prev.filter((item) => item.id !== id));
  };

  const addPaymentToPurchase = (purchaseId: string, payment: Omit<Payment, 'id'>) => {
    setPurchases((prev) =>
      prev.map((pch) => {
        if (pch.id === purchaseId) {
          const newPay: Payment = { ...payment, id: `pay_${Date.now()}` };
          const newPending = Math.max(0, pch.pendingAmount - payment.amount);
          return {
            ...pch,
            pendingAmount: newPending,
            payments: [...pch.payments, newPay],
            updatedAt: new Date().toISOString(),
          };
        }
        return pch;
      })
    );
  };

  const addSale = (s: Omit<Sale, 'id' | 'updatedAt'>) => {
    const newS: Sale = {
      ...s,
      id: `sal_${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    setSales((prev) => [newS, ...prev]);
  };

  const updateSale = (s: Sale) => {
    setSales((prev) => prev.map((item) => (item.id === s.id ? { ...s, updatedAt: new Date().toISOString() } : item)));
  };

  const deleteSale = (id: string) => {
    setSales((prev) => prev.filter((item) => item.id !== id));
  };

  const addExpense = (e: Omit<Expense, 'id' | 'updatedAt'>) => {
    const newE: Expense = {
      ...e,
      id: `exp_${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    setExpenses((prev) => [newE, ...prev]);
  };

  const updateExpense = (e: Expense) => {
    setExpenses((prev) => prev.map((item) => (item.id === e.id ? { ...e, updatedAt: new Date().toISOString() } : item)));
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((item) => item.id !== id));
  };

  const addPartner = (p: Omit<Partner, 'id' | 'updatedAt'>) => {
    const newPt: Partner = {
      ...p,
      id: `pt_${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    setPartners((prev) => [...prev, newPt]);
  };

  const updatePartner = (p: Partner) => {
    setPartners((prev) => prev.map((item) => (item.id === p.id ? { ...p, updatedAt: new Date().toISOString() } : item)));
  };

  const deletePartner = (id: string) => {
    setPartners((prev) => prev.filter((item) => item.id !== id));
  };

  const updateRates = (newRates: Partial<GoldRates>) => {
    setRates((prev) => ({
      ...prev,
      ...newRates,
      lastUpdated: new Date().toISOString(),
    }));
  };

  const setPinCode = (pin: string) => {
    setPinCodeState(pin);
    if (!pin) setIsLocked(false);
  };

  const unlockApp = (enteredPin: string): boolean => {
    if (enteredPin === pinCode || !pinCode) {
      setIsLocked(false);
      return true;
    }
    return false;
  };

  const lockApp = () => {
    if (pinCode) setIsLocked(true);
  };

  const exportData = () => {
    const db = {
      purchases,
      sales,
      expenses,
      partners,
      rates,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Gold_Calculator_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (jsonStr: string): boolean => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.purchases) setPurchases(data.purchases);
      if (data.sales) setSales(data.sales);
      if (data.expenses) setExpenses(data.expenses);
      if (data.partners) setPartners(data.partners);
      if (data.rates) setRates(data.rates);
      return true;
    } catch {
      return false;
    }
  };

  const resetAllData = () => {
    setPurchases([]);
    setSales([]);
    setExpenses([]);
    setPartners(INITIAL_PARTNERS);
    setRates(INITIAL_RATES);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <GoldStoreContext.Provider
      value={{
        purchases,
        sales,
        expenses,
        partners,
        rates,
        pinCode,
        isLocked,
        totalCapital,
        totalSales,
        totalCost,
        grossProfit,
        generalExpenses,
        privateExpenses,
        netProfit,
        totalProfitPercent,
        currentStockUnits,
        addPurchase,
        updatePurchase,
        deletePurchase,
        addPaymentToPurchase,
        addSale,
        updateSale,
        deleteSale,
        addExpense,
        updateExpense,
        deleteExpense,
        addPartner,
        updatePartner,
        deletePartner,
        updateRates,
        setPinCode,
        unlockApp,
        lockApp,
        exportData,
        importData,
        resetAllData,
      }}
    >
      {children}
    </GoldStoreContext.Provider>
  );
};

export const useGoldStore = () => {
  const context = useContext(GoldStoreContext);
  if (!context) throw new Error('useGoldStore must be used within GoldStoreProvider');
  return context;
};
