"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, CheckCircle2, AlertTriangle, Loader2, Copy,
  Wallet, TrendingDown, TrendingUp, Plus, Trash2, ChevronDown, ChevronUp, ClipboardCopy,
} from "lucide-react";
import { Transaction, Budget, Income, INCOME_SOURCES, CATEGORY_META, CATEGORIES, Category } from "@/types";
import { formatCurrency, getMonthLabel } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const SETUP_SQL = `drop table if exists incomes cascade;
create table incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount decimal(12,2) not null,
  source text not null default 'Salary',
  month text not null,
  notes text,
  created_at timestamptz not null default now()
);
grant all on incomes to anon, authenticated, service_role, authenticator;
notify pgrst, 'reload schema';`;

interface Props {
  transactions: Transaction[];
  budgets: Budget[];
  currentMonth: string;
  userId: string;
  incomes: Income[];
  totalEMI: number;
  incomeTableReady: boolean;
}

const SOURCE_KEYS = Object.keys(INCOME_SOURCES);

export default function BudgetClient({
  transactions, budgets, currentMonth, userId, incomes: initialIncomes, totalEMI, incomeTableReady,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  // ── Budget state ────────────────────────────────────────────
  const [saving, setSaving] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [localBudgets, setLocalBudgets] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    budgets.forEach((b) => { map[b.category] = String(b.amount); });
    return map;
  });

  // ── Income state ────────────────────────────────────────────
  const [incomes, setIncomes] = useState<Income[]>(initialIncomes);
  const [newSource, setNewSource] = useState("Salary");
  const [newAmount, setNewAmount] = useState("");
  const [addingIncome, setAddingIncome] = useState(false);
  const [incomeError, setIncomeError] = useState("");
  const [sqlCopied, setSqlCopied] = useState(false);

  function copySetupSQL() {
    navigator.clipboard.writeText(SETUP_SQL);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2500);
  }

  const totalIncome = useMemo(() => incomes.reduce((s, i) => s + Number(i.amount), 0), [incomes]);

  // ── Derived financials ──────────────────────────────────────
  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return map;
  }, [transactions]);

  const totalSpent = useMemo(() => Object.values(categoryTotals).reduce((s, v) => s + v, 0), [categoryTotals]);
  const totalBudget = useMemo(
    () => Object.values(localBudgets).reduce((s, v) => s + (parseFloat(v) || 0), 0),
    [localBudgets]
  );

  const afterEMI = totalIncome > 0 ? totalIncome - totalEMI : null;
  const savings = afterEMI !== null ? afterEMI - totalSpent : null;
  const savingsRate = totalIncome > 0 && savings !== null ? (savings / totalIncome) * 100 : null;

  // ── Velocity alerts ─────────────────────────────────────────
  const velocityAlerts = useMemo(() => {
    const daysElapsed = new Date().getDate();
    if (daysElapsed < 3) return [];
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - daysElapsed;
    if (daysRemaining <= 0) return [];

    return CATEGORIES
      .map(cat => {
        const spent = categoryTotals[cat] || 0;
        const budget = parseFloat(localBudgets[cat] || "0");
        if (spent <= 0 || budget <= 0 || spent >= budget) return null;
        const dailyRate = spent / daysElapsed;
        const projectedTotal = spent + dailyRate * daysRemaining;
        const daysUntilOut = (budget - spent) / dailyRate;
        if (daysUntilOut >= daysRemaining || projectedTotal <= budget * 1.05) return null;
        return { cat, spent, budget, daysUntilOut: Math.round(daysUntilOut), projectedTotal: Math.round(projectedTotal) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.daysUntilOut - b.daysUntilOut);
  }, [categoryTotals, localBudgets]);

  // ── Income actions ──────────────────────────────────────────
  async function addIncome() {
    const amount = parseFloat(newAmount);
    if (!amount || amount <= 0) { setIncomeError("Enter a valid amount."); return; }
    setAddingIncome(true);
    setIncomeError("");

    const { data, error } = await supabase
      .from("incomes")
      .insert({ user_id: userId, amount, source: newSource, month: currentMonth })
      .select()
      .single();

    if (error) {
      setIncomeError(
        error.message.includes("schema cache") || error.message.includes("does not exist")
          ? "Table not ready. Please run supabase-fix-grants.sql in your Supabase SQL Editor."
          : error.message
      );
    } else if (data) {
      setIncomes(prev => [...prev, { ...data, amount: Number(data.amount) }]);
      setNewAmount("");
    }
    setAddingIncome(false);
  }

  async function deleteIncome(id: string) {
    await supabase.from("incomes").delete().eq("id", id);
    setIncomes(prev => prev.filter(i => i.id !== id));
  }

  // ── Budget actions ──────────────────────────────────────────
  async function copyLastMonth() {
    setCopying(true);
    setCopyMsg("");
    const prev = new Date();
    prev.setMonth(prev.getMonth() - 1);
    const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    const { data } = await supabase.from("budgets").select("*").eq("user_id", userId).eq("month", prevKey);
    if (!data || data.length === 0) {
      setCopyMsg("No budgets found for last month.");
      setCopying(false);
      setTimeout(() => setCopyMsg(""), 3000);
      return;
    }
    for (const b of data) {
      const existing = budgets.find((cb) => cb.category === b.category);
      if (existing) {
        await supabase.from("budgets").update({ amount: b.amount }).eq("id", existing.id);
      } else {
        await supabase.from("budgets").insert({ user_id: userId, category: b.category, amount: b.amount, month: currentMonth });
      }
    }
    router.refresh();
    setCopyMsg(`Copied ${data.length} budgets from last month!`);
    setCopying(false);
    setTimeout(() => setCopyMsg(""), 3000);
  }

  async function saveBudget(category: string) {
    const amount = parseFloat(localBudgets[category] || "0");
    if (isNaN(amount) || amount < 0) return;
    setSaving(category);
    const existing = budgets.find((b) => b.category === category);
    if (existing) {
      await supabase.from("budgets").update({ amount }).eq("id", existing.id);
    } else {
      await supabase.from("budgets").insert({ user_id: userId, category, amount, month: currentMonth });
    }
    setSaving(null);
  }

  const overallPct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;
  const activeCats = CATEGORIES.filter(c => (categoryTotals[c] || 0) > 0 || parseFloat(localBudgets[c] || "0") > 0);
  const inactiveCats = CATEGORIES.filter(c => !activeCats.includes(c));
  const visibleCats = showAllCategories ? CATEGORIES : activeCats.length > 0 ? activeCats : CATEGORIES;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-700 mb-1">Budget Planner</h1>
          <p className="text-muted-foreground text-sm">{getMonthLabel(currentMonth)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={copyLastMonth}
            disabled={copying}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-60"
          >
            {copying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
            Copy last month
          </button>
          {copyMsg && (
            <span className={`text-xs ${copyMsg.startsWith("No") ? "text-muted-foreground" : "text-emerald-600"}`}>
              {copyMsg}
            </span>
          )}
        </div>
      </div>

      {/* ── Income section ──────────────────────────────────── */}
      {!incomeTableReady ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border/50 rounded-2xl p-6 flex items-start gap-4"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(245,158,11,0.1)" }}>
            <AlertTriangle className="w-5 h-5" style={{ color: "#f59e0b" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-sm font-600 mb-1">Income table needs setup</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Run this SQL in Supabase SQL Editor, then refresh the page.
            </p>
            <div className="bg-secondary/70 rounded-xl p-3 font-mono text-xs text-muted-foreground whitespace-pre-wrap mb-3 overflow-x-auto leading-relaxed">
              {SETUP_SQL}
            </div>
            <button
              onClick={copySetupSQL}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all"
              style={{
                background: sqlCopied ? "rgba(16,185,129,0.1)" : "hsl(var(--secondary))",
                color: sqlCopied ? "#10b981" : "hsl(var(--foreground))",
              }}
            >
              {sqlCopied ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copied!</> : <><ClipboardCopy className="w-3.5 h-3.5" /> Copy SQL</>}
            </button>
          </div>
        </motion.div>
      ) : (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border/50 rounded-2xl p-6"
      >
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(16,185,129,0.12)" }}>
            <TrendingUp className="w-4 h-4" style={{ color: "#10b981" }} />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-600">Monthly Income</h3>
            <p className="text-xs text-muted-foreground">All money received this month</p>
          </div>
          {totalIncome > 0 && (
            <div className="text-right">
              <div className="number-font text-xl font-700" style={{ color: "#10b981" }}>
                {formatCurrency(totalIncome)}
              </div>
              <div className="text-xs text-muted-foreground">total</div>
            </div>
          )}
        </div>

        {/* Existing income entries */}
        {incomes.length > 0 && (
          <div className="space-y-2 mb-4">
            {incomes.map((income) => {
              const meta = INCOME_SOURCES[income.source] || INCOME_SOURCES.Other;
              return (
                <motion.div
                  key={income.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl group"
                  style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}
                >
                  <span className="text-base w-6 flex-shrink-0">{meta.icon}</span>
                  <span className="text-sm font-medium flex-1">{meta.label}</span>
                  <span className="number-font text-sm font-600" style={{ color: "#10b981" }}>
                    {formatCurrency(Number(income.amount))}
                  </span>
                  <button
                    onClick={() => deleteIncome(income.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Add income row */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            className="h-10 px-3 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            {SOURCE_KEYS.map((key) => (
              <option key={key} value={key}>{INCOME_SOURCES[key].icon} {INCOME_SOURCES[key].label}</option>
            ))}
          </select>
          <div className="relative flex-1 min-w-[120px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
            <input
              type="number"
              value={newAmount}
              onChange={(e) => { setNewAmount(e.target.value); setIncomeError(""); }}
              onKeyDown={(e) => e.key === "Enter" && addIncome()}
              placeholder="Amount"
              className="w-full h-10 pl-7 pr-3 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 number-font"
            />
          </div>
          <button
            onClick={addIncome}
            disabled={addingIncome || !newAmount}
            className="h-10 px-4 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-colors disabled:opacity-60"
            style={{ background: "#10b981", color: "#fff" }}
          >
            {addingIncome ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-3.5 h-3.5" /> Add</>}
          </button>
        </div>

        {incomeError && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 mt-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{incomeError}</span>
          </div>
        )}

        {/* Financial breakdown */}
        <AnimatePresence>
          {totalIncome > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5"
            >
              {[
                {
                  label: "Income",
                  value: formatCurrency(totalIncome),
                  pct: "100%",
                  color: "#10b981",
                  bg: "rgba(16,185,129,0.08)",
                  Icon: TrendingUp,
                },
                {
                  label: "EMI (fixed)",
                  value: formatCurrency(totalEMI),
                  pct: totalIncome > 0 ? `${((totalEMI / totalIncome) * 100).toFixed(1)}%` : "—",
                  color: "#f97316",
                  bg: "rgba(249,115,22,0.08)",
                  Icon: TrendingDown,
                },
                {
                  label: "Expenses",
                  value: formatCurrency(totalSpent),
                  pct: totalIncome > 0 ? `${((totalSpent / totalIncome) * 100).toFixed(1)}%` : "—",
                  color: totalSpent > (afterEMI ?? 0) ? "#ef4444" : "#3b82f6",
                  bg: totalSpent > (afterEMI ?? 0) ? "rgba(239,68,68,0.08)" : "rgba(59,130,246,0.08)",
                  Icon: Wallet,
                },
                {
                  label: "Savings",
                  value: savings !== null ? formatCurrency(Math.max(0, savings)) : "—",
                  pct: savingsRate !== null ? `${savingsRate > 0 ? savingsRate.toFixed(1) : "0"}%` : "—",
                  color: (savings ?? 0) >= 0 ? "#8b5cf6" : "#ef4444",
                  bg: (savings ?? 0) >= 0 ? "rgba(139,92,246,0.08)" : "rgba(239,68,68,0.08)",
                  Icon: Target,
                },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl p-4"
                  style={{ background: item.bg }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground font-medium">{item.label}</span>
                    <item.Icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                  </div>
                  <div className="number-font text-lg font-700" style={{ color: item.color }}>{item.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.pct} of income</div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {totalIncome === 0 && (
          <p className="text-xs text-muted-foreground italic mt-1">
            Add your salary and any other income to see your spending breakdown
          </p>
        )}
      </motion.div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total budget", value: formatCurrency(totalBudget), color: "#7c3aed" },
          {
            label: "Spent so far",
            value: formatCurrency(totalSpent),
            color: totalSpent > totalBudget && totalBudget > 0 ? "#ef4444" : "hsl(var(--foreground))",
          },
          {
            label: "Remaining",
            value: formatCurrency(Math.max(0, totalBudget - totalSpent)),
            color: totalSpent > totalBudget && totalBudget > 0 ? "#ef4444" : "#10b981",
          },
        ].map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06 }}
            className="bg-card border border-border/50 rounded-2xl p-5"
          >
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide font-medium">{m.label}</div>
            <div className="number-font text-2xl font-600" style={{ color: m.color }}>{m.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Overall progress bar */}
      {totalBudget > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border/50 rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-medium">Overall budget usage</span>
            <span className="text-sm number-font font-600" style={{ color: overallPct >= 100 ? "#ef4444" : overallPct >= 70 ? "#f97316" : "#10b981" }}>
              {overallPct.toFixed(0)}%
            </span>
          </div>
          <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${overallPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: overallPct >= 100 ? "#ef4444" : overallPct >= 70 ? "#f97316" : "#7c3aed" }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>{formatCurrency(totalSpent)} spent</span>
            <span>{formatCurrency(totalBudget)} budgeted</span>
          </div>
        </motion.div>
      )}

      {/* Spending velocity alerts */}
      {velocityAlerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="border rounded-2xl p-5"
          style={{ background: "rgba(245,158,11,0.06)", borderColor: "rgba(245,158,11,0.25)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">⚡</span>
            <h3 className="font-display text-sm font-600" style={{ color: "#b45309" }}>Spending velocity alerts</h3>
            <span className="ml-auto text-xs" style={{ color: "#d97706" }}>At current daily rate</span>
          </div>
          <div className="space-y-2">
            {velocityAlerts.map(({ cat, daysUntilOut, projectedTotal, budget }) => {
              const meta = CATEGORY_META[cat as Category];
              const overBy = projectedTotal - budget;
              return (
                <div key={cat} className="flex items-center gap-3 text-sm">
                  <span className="text-base w-6 flex-shrink-0">{meta.icon}</span>
                  <span className="flex-1 font-medium" style={{ color: "#92400e" }}>{meta.label}</span>
                  <span className="text-xs" style={{ color: "#b45309" }}>
                    budget out in <span className="font-600">{daysUntilOut}d</span>
                    {overBy > 0 && <span className="ml-1">(+{formatCurrency(overBy)} over)</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Category budget grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-base font-600">Category Budgets</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Set limits and track spending per category</p>
          </div>
          {inactiveCats.length > 0 && activeCats.length > 0 && (
            <button
              onClick={() => setShowAllCategories(!showAllCategories)}
              className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
            >
              {showAllCategories
                ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
                : <><ChevronDown className="w-3.5 h-3.5" /> Show all {CATEGORIES.length}</>}
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {visibleCats.map((cat, i) => {
            const meta = CATEGORY_META[cat as Category];
            const spent = categoryTotals[cat] || 0;
            const budgetAmt = parseFloat(localBudgets[cat] || "0");
            const pct = budgetAmt > 0 ? Math.min(100, (spent / budgetAmt) * 100) : 0;
            const isOver = budgetAmt > 0 && spent > budgetAmt;
            const barColor = isOver ? "#ef4444" : pct >= 70 ? "#f97316" : meta.color;

            return (
              <motion.div
                key={cat}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-card border border-border/50 rounded-2xl p-5"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: meta.lightColor }}
                  >
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{meta.label}</span>
                      {isOver && (
                        <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                          <AlertTriangle className="w-3 h-3" /> Over
                        </span>
                      )}
                      {!isOver && budgetAmt > 0 && pct === 100 && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {spent > 0 ? formatCurrency(spent) + " spent" : "Nothing spent"}
                      {budgetAmt > 0 && ` · ${formatCurrency(budgetAmt)} limit`}
                    </div>
                  </div>
                </div>

                {budgetAmt > 0 && (
                  <div className="mb-3">
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.04 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: barColor }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5 text-[11px] text-muted-foreground">
                      <span>{pct.toFixed(0)}% used</span>
                      {isOver
                        ? <span className="text-red-500 font-medium">{formatCurrency(spent - budgetAmt)} over budget</span>
                        : <span className="text-emerald-600">{formatCurrency(budgetAmt - spent)} left</span>
                      }
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground flex-shrink-0">Budget ₹</span>
                  <input
                    type="number"
                    min="0"
                    value={localBudgets[cat] || ""}
                    onChange={(e) => setLocalBudgets({ ...localBudgets, [cat]: e.target.value })}
                    onBlur={() => saveBudget(cat)}
                    onKeyDown={(e) => e.key === "Enter" && saveBudget(cat)}
                    placeholder="Set limit"
                    className="flex-1 h-8 px-3 rounded-lg border border-border bg-secondary/50 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary number-font"
                  />
                  {saving === cat && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground flex-shrink-0" />}
                </div>
              </motion.div>
            );
          })}
        </div>

        {!showAllCategories && inactiveCats.length > 0 && activeCats.length > 0 && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            {inactiveCats.length} categories with no spending or budget hidden
          </p>
        )}
      </div>
    </div>
  );
}
