"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, CheckCircle2, AlertTriangle, Loader2, Copy,
  Wallet, TrendingDown, TrendingUp, IndianRupee, ChevronDown, ChevronUp,
} from "lucide-react";
import { Transaction, Budget, CATEGORY_META, CATEGORIES, Category } from "@/types";
import { formatCurrency, getMonthLabel } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface Props {
  transactions: Transaction[];
  budgets: Budget[];
  currentMonth: string;
  userId: string;
  salary: number | null;
  totalEMI: number;
}

export default function BudgetClient({
  transactions, budgets, currentMonth, userId, salary: initialSalary, totalEMI,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [saving, setSaving] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");
  const [salaryInput, setSalaryInput] = useState(initialSalary ? String(initialSalary) : "");
  const [salaryValue, setSalaryValue] = useState<number | null>(initialSalary);
  const [savingSalary, setSavingSalary] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const [localBudgets, setLocalBudgets] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    budgets.forEach((b) => { map[b.category] = String(b.amount); });
    return map;
  });

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

  // Financial overview calculations
  const afterEMI = salaryValue ? salaryValue - totalEMI : null;
  const savings = afterEMI !== null ? afterEMI - totalSpent : null;
  const savingsRate = salaryValue && salaryValue > 0 && savings !== null
    ? (savings / salaryValue) * 100
    : null;

  async function saveSalary() {
    const amount = parseFloat(salaryInput);
    if (!amount || amount <= 0) return;
    setSavingSalary(true);
    await supabase.from("incomes").upsert(
      { user_id: userId, amount, source: "Salary", month: currentMonth },
      { onConflict: "user_id,source,month" }
    );
    setSalaryValue(amount);
    setSavingSalary(false);
  }

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

  // Show categories with spending or budget first, rest behind "show all"
  const activeCats = CATEGORIES.filter(
    (c) => (categoryTotals[c] || 0) > 0 || parseFloat(localBudgets[c] || "0") > 0
  );
  const inactiveCats = CATEGORIES.filter(
    (c) => !activeCats.includes(c)
  );
  const visibleCats = showAllCategories ? CATEGORIES : activeCats.length > 0 ? activeCats : CATEGORIES;

  const inputCls = "w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

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

      {/* Salary / Income section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border/50 rounded-2xl p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
            <IndianRupee className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-display text-base font-600">Monthly Income</h3>
            <p className="text-xs text-muted-foreground">Your take-home salary this month</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
            <input
              type="number"
              value={salaryInput}
              onChange={(e) => setSalaryInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveSalary()}
              placeholder="e.g. 120000"
              className="w-full h-11 pl-8 pr-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 number-font"
            />
          </div>
          <button
            onClick={saveSalary}
            disabled={savingSalary || !salaryInput}
            className="h-11 px-5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {savingSalary ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </button>
        </div>

        {/* Financial breakdown row */}
        <AnimatePresence>
          {salaryValue && salaryValue > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            >
              {[
                {
                  label: "Income",
                  value: formatCurrency(salaryValue),
                  pct: "100%",
                  color: "text-emerald-600",
                  bg: "bg-emerald-50 dark:bg-emerald-950/30",
                  icon: TrendingUp,
                  iconColor: "text-emerald-600",
                },
                {
                  label: "EMI (fixed)",
                  value: formatCurrency(totalEMI),
                  pct: salaryValue > 0 ? `${((totalEMI / salaryValue) * 100).toFixed(1)}%` : "—",
                  color: "text-orange-600",
                  bg: "bg-orange-50 dark:bg-orange-950/30",
                  icon: TrendingDown,
                  iconColor: "text-orange-600",
                },
                {
                  label: "Expenses",
                  value: formatCurrency(totalSpent),
                  pct: salaryValue > 0 ? `${((totalSpent / salaryValue) * 100).toFixed(1)}%` : "—",
                  color: totalSpent > (afterEMI ?? 0) ? "text-red-500" : "text-blue-600",
                  bg: totalSpent > (afterEMI ?? 0) ? "bg-red-50 dark:bg-red-950/30" : "bg-blue-50 dark:bg-blue-950/30",
                  icon: Wallet,
                  iconColor: totalSpent > (afterEMI ?? 0) ? "text-red-500" : "text-blue-600",
                },
                {
                  label: "Savings",
                  value: savings !== null ? formatCurrency(Math.max(0, savings)) : "—",
                  pct: savingsRate !== null
                    ? `${savingsRate > 0 ? savingsRate.toFixed(1) : "0"}%`
                    : "—",
                  color: (savings ?? 0) >= 0 ? "text-violet-600" : "text-red-500",
                  bg: (savings ?? 0) >= 0 ? "bg-violet-50 dark:bg-violet-950/30" : "bg-red-50 dark:bg-red-950/30",
                  icon: Target,
                  iconColor: (savings ?? 0) >= 0 ? "text-violet-600" : "text-red-500",
                },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`rounded-xl p-4 ${item.bg}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground font-medium">{item.label}</span>
                    <item.icon className={`w-3.5 h-3.5 ${item.iconColor}`} />
                  </div>
                  <div className={`number-font text-lg font-700 ${item.color}`}>{item.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.pct} of income</div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {!salaryValue && (
          <p className="text-xs text-muted-foreground italic">
            Set your salary to see spending breakdown against income
          </p>
        )}
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total budget", value: formatCurrency(totalBudget), color: "text-violet-600" },
          {
            label: "Spent so far",
            value: formatCurrency(totalSpent),
            color: totalSpent > totalBudget && totalBudget > 0 ? "text-red-500" : "text-foreground",
          },
          {
            label: "Remaining",
            value: formatCurrency(Math.max(0, totalBudget - totalSpent)),
            color: totalSpent > totalBudget && totalBudget > 0 ? "text-red-500" : "text-emerald-600",
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
            <div className={`number-font text-2xl font-600 ${m.color}`}>{m.value}</div>
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
            <span className={`text-sm number-font font-600 ${overallPct >= 100 ? "text-red-500" : overallPct >= 70 ? "text-orange-500" : "text-emerald-600"}`}>
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
                {/* Top row */}
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

                {/* Progress bar */}
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

                {/* Budget input */}
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

        {/* Show inactive categories hint */}
        {!showAllCategories && inactiveCats.length > 0 && activeCats.length > 0 && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            {inactiveCats.length} categories with no spending or budget hidden
          </p>
        )}
      </div>
    </div>
  );
}
