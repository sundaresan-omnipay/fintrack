export type Category =
  | "food"
  | "transport"
  | "shopping"
  | "bills"
  | "health"
  | "entertainment"
  | "travel"
  | "education"
  | "other";

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  description: string;
  category: Category;
  date: string;
  notes?: string;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category: Category;
  amount: number;
  month: string; // YYYY-MM
  created_at: string;
}

export interface CategoryMeta {
  label: string;
  icon: string;
  color: string;
  lightColor: string;
  textColor: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  food: {
    label: "Food & Dining",
    icon: "🍽️",
    color: "#f97316",
    lightColor: "#fff7ed",
    textColor: "#c2410c",
  },
  transport: {
    label: "Transport",
    icon: "🚗",
    color: "#3b82f6",
    lightColor: "#eff6ff",
    textColor: "#1d4ed8",
  },
  shopping: {
    label: "Shopping",
    icon: "🛍️",
    color: "#a855f7",
    lightColor: "#faf5ff",
    textColor: "#7e22ce",
  },
  bills: {
    label: "Bills & Utilities",
    icon: "💡",
    color: "#eab308",
    lightColor: "#fefce8",
    textColor: "#a16207",
  },
  health: {
    label: "Health",
    icon: "💊",
    color: "#22c55e",
    lightColor: "#f0fdf4",
    textColor: "#15803d",
  },
  entertainment: {
    label: "Entertainment",
    icon: "🎬",
    color: "#ec4899",
    lightColor: "#fdf2f8",
    textColor: "#be185d",
  },
  travel: {
    label: "Travel",
    icon: "✈️",
    color: "#06b6d4",
    lightColor: "#ecfeff",
    textColor: "#0e7490",
  },
  education: {
    label: "Education",
    icon: "📚",
    color: "#8b5cf6",
    lightColor: "#f5f3ff",
    textColor: "#6d28d9",
  },
  other: {
    label: "Other",
    icon: "📦",
    color: "#6b7280",
    lightColor: "#f9fafb",
    textColor: "#374151",
  },
};

export const CATEGORIES = Object.keys(CATEGORY_META) as Category[];

export interface Loan {
  id: string;
  user_id: string;
  name: string;
  original_principal: number;
  interest_rate: number;
  tenure_months: number;
  start_date: string; // YYYY-MM-DD
  emi_amount: number;
  created_at: string;
}

export interface LoanPrepayment {
  id: string;
  loan_id: string;
  user_id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  notes?: string;
  created_at: string;
}

export interface AmortizationRow {
  month: number;
  date: string; // YYYY-MM
  emi: number;
  interest: number;
  principal: number;
  prepayment: number;
  balance: number;
  isCurrent: boolean;
  isPast: boolean;
}

// ------------------------------------------------------------
// Income
// ------------------------------------------------------------

export interface Income {
  id: string;
  user_id: string;
  amount: number;
  source: string;
  month: string; // YYYY-MM
  notes?: string;
  created_at: string;
}

export const INCOME_SOURCES: Record<string, { label: string; icon: string; color: string }> = {
  Salary:    { label: "Salary",          icon: "💼", color: "#10b981" },
  Freelance: { label: "Freelance",       icon: "💻", color: "#3b82f6" },
  Family:    { label: "Family Transfer", icon: "🤝", color: "#8b5cf6" },
  Business:  { label: "Business",        icon: "📊", color: "#f59e0b" },
  Rental:    { label: "Rental",          icon: "🏠", color: "#06b6d4" },
  Other:     { label: "Other",           icon: "💰", color: "#6b7280" },
};

// ------------------------------------------------------------
// Recurring Transactions
// ------------------------------------------------------------

export interface RecurringTransaction {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  category: Category;
  day_of_month: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

// ------------------------------------------------------------
// Savings / Investments
// ------------------------------------------------------------

export interface Saving {
  id: string;
  user_id: string;
  name: string;
  type: 'sip' | 'lumpsum' | 'fd' | 'ppf' | 'nps' | 'other';
  monthly_amount: number;
  start_date: string;
  expected_return_rate: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export const SAVING_TYPES: Record<Saving['type'], { label: string; icon: string }> = {
  sip:     { label: "Mutual Fund SIP",  icon: "📈" },
  lumpsum: { label: "Lump Sum",         icon: "💰" },
  fd:      { label: "Fixed Deposit",    icon: "🏦" },
  ppf:     { label: "PPF",              icon: "📋" },
  nps:     { label: "NPS",              icon: "🌱" },
  other:   { label: "Other Savings",    icon: "💵" },
};

// ------------------------------------------------------------
// Goals
// ------------------------------------------------------------

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date?: string;
  category: string;
  icon: string;
  color: string;
  notes?: string;
  is_completed: boolean;
  created_at: string;
}

export const GOAL_CATEGORIES: Record<string, { label: string; icon: string; color: string }> = {
  emergency_fund: { label: "Emergency Fund",  icon: "🛡️",  color: "#22c55e" },
  home:           { label: "Home / Property", icon: "🏠",  color: "#7c3aed" },
  car:            { label: "Car / Vehicle",   icon: "🚗",  color: "#3b82f6" },
  vacation:       { label: "Vacation",        icon: "✈️",  color: "#06b6d4" },
  education:      { label: "Education",       icon: "📚",  color: "#8b5cf6" },
  wedding:        { label: "Wedding",         icon: "💒",  color: "#ec4899" },
  retirement:     { label: "Retirement",      icon: "🌴",  color: "#f97316" },
  gadget:         { label: "Gadget / Tech",   icon: "💻",  color: "#64748b" },
  other:          { label: "Other",           icon: "🎯",  color: "#6b7280" },
};
