export interface Payment {
  id: string;
  date: string;
  amount: number;
  note: string;
}

export interface Purchase {
  id: string;
  date: string;
  units: number; // total units (1g = 4 habba = 40 juz)
  purity: number; // 24, 21, 18, etc.
  amount: number; // total buy amount in SDG/Currency
  pendingAmount: number; // remaining debt to seller
  seller: string;
  bankAccount: string;
  notes: string;
  payments: Payment[];
  archived?: boolean;
  updatedAt?: string;
}

export interface Sale {
  id: string;
  date: string;
  units: number;
  purity: number;
  buyAmount: number; // cost
  sellAmount: number; // revenue
  buyer: string;
  notes: string;
  purchaseId?: string;
  archived?: boolean;
  updatedAt?: string;
}

export interface Expense {
  id: string;
  date: string;
  amount: number;
  category: string;
  target: string; // 'عام' or partner name
  name: string;
  notes: string;
  archived?: boolean;
  updatedAt?: string;
}

export interface Partner {
  id: string;
  name: string;
  capital: number;
  profitPercent: number;
  phone: string;
  notes: string;
  archived?: boolean;
  updatedAt?: string;
}

export interface GoldRates {
  karat24: number;
  karat21: number;
  karat18: number;
  karat22: number;
  usdRate: number;
  sarRate: number;
  aedRate: number;
  egpRate: number;
  globalOunceUsd: number;
  lastUpdated: string;
}
