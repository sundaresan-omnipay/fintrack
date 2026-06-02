"use client";

import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Wallet, ArrowUpRight,
  Flame, Target, Sparkles, ChevronRight
} from "lucide-react";
import { Transaction, Budget, CATEGORY_META, CATEGORIES } from "@/types";
import { formatCurrency, getMonthLabel, getLast6Months } from "@/lib/utils";
import SpendingDonut from "@/components/charts/SpendingDonut";
import MonthlyTrendChart from "@/components/charts/MonthlyTrendChart";
import DailySpendChart from "@/components/charts/DailySpendChart";
import AddTransactionButton from "@/components/ui/AddTransactionButton";
import Link from "next/link";

interface Props {
  transactions: Transaction[];
  budgets: Budget[];
  currentMonth: string;
  displayName: string;
  monthlyIncomes: Record<string, number>;
}

export default function DashboardClient({ transactions, budgets, currentMonth, displayName, monthlyIncomes }: Props) {
  const monthTxs = useMemo(
    () => transactions.filter((t) => t.date.startsWith(currentMonth)),
    [transactions, currentMonth]
  );

  const totalSpent = useMemo(() => monthTxs.reduce((s, t) => s + t.amount, 0), [monthTxs]);
  const totalBudget = useMemo(() => budgets.reduce((s, b) => s + b.amount, 0), [budgets]);
  const remaining = totalBudget - totalSpent;
  const budgetPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const today = new Date().toISOString().split("T")[0];
  const todaySpent = useMemo(
    () => transactions.filter((t) => t.date === today).reduce((s, t) => s + t.amount, 0),
    [transactions, today]
  );

  const prevMonth = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const prevMonthTotal = useMemo(
    () =>
      transactions
        .filter((t) => t.date.startsWith(prevMonth))
        .reduce((s, t) => s + t.amount, 0),
    [transactions, prevMonth]
  );

  const monthChange =
    prevMonthTotal > 0
      ? ((totalSpent - prevMonthTotal) / prevMonthTotal) * 100
      : 0;

  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    monthTxs.forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return map;
  }, [monthTxs]);

  const topCategory = useMemo(() => {
    const entries = Object.entries(categoryTotals);
    if (!entries.length) return null;
    const [cat, amt] = entries.sort((a, b) => b[1] - a[1])[0];
    return { cat, amt, meta: CATEGORY_META[cat as keyof typeof CATEGORY_META] };
  }, [categoryTotals]);

  const fallbackSuggestions = useMemo(() => {
    const tips: Array<{ title: string; description: string; type: "warning" | "success" | "info" }> = [];
    if (budgetPct > 90) {
      tips.push({ title: "Almost at your monthly budget!", description: `You've used ${budgetPct.toFixed(0)}% of your budget. Consider cutting back.`, type: "warning" });
    }
    if (topCategory) {
      const catBudget = budgets.find((b) => b.category === topCategory.cat);
      if (catBudget && topCategory.amt > catBudget.amount) {
        tips.push({ title: `${topCategory.meta?.label} budget exceeded`, description: `You've spent ${formatCurrency(topCategory.amt)} — ${formatCurrency(topCategory.amt - catBudget.amount)} over budget.`, type: "warning" });
      }
    }
    if (monthChange > 15) {
      tips.push({ title: `Spending up ${monthChange.toFixed(0)}% vs last month`, description: `You spent ${formatCurrency(totalSpent)} this month vs ${formatCurrency(prevMonthTotal)} last month.`, type: "info" });
    }
    if (monthChange < -10 && totalSpent > 0) {
      tips.push({ title: "Great job cutting spending!", description: `You're spending ${Math.abs(monthChange).toFixed(0)}% less. You saved ${formatCurrency(prevMonthTotal - totalSpent)}.`, type: "success" });
    }
    if (!tips.length && totalSpent > 0) {
      tips.push({ title: "Looking good this month", description: "Your spending is within normal range. Keep tracking to build better habits.", type: "success" });
    }
    return tips.slice(0, 3);
  }, [budgetPct, topCategory, monthChange, totalSpent, prevMonthTotal, budgets]);

  const [aiInsights, setAiInsights] = useState<Array<{ title: string; description: string; type: "warning" | "success" | "info" }> | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    if (totalSpent === 0) return;
    setInsightsLoading(true);
    fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalSpent, totalBudget, budgetPct, monthChange, prevMonthTotal, topCategory, categoryTotals, txCount: monthTxs.length }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.insights) setAiInsights(d.insights); })
      .catch(() => {})
      .finally(() => setInsightsLoading(false));
  }, []);

  const suggestions = aiInsights || fallbackSuggestions;

  const daysElapsed = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const dailyAvg = daysElapsed > 0 ? totalSpent / daysElapsed : 0;
  const forecastTotal = totalSpent + dailyAvg * (daysInMonth - daysElapsed);

  const weekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split("T")[0];
  }, []);
  const lastWeekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() - 7);
    return d.toISOString().split("T")[0];
  }, []);
  const lastWeekEnd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() - 1);
    return d.toISOString().split("T")[0];
  }, []);
  const thisWeekSpent = useMemo(
    () => transactions.filter((t) => t.date >= weekStart).reduce((s, t) => s + t.amount, 0),
    [transactions, weekStart]
  );
  const lastWeekSpent = useMemo(
    () => transactions.filter((t) => t.date >= lastWeekStart && t.date <= lastWeekEnd).reduce((s, t) => s + t.amount, 0),
    [transactions, lastWeekStart, lastWeekEnd]
  );
  const weekChange = lastWeekSpent > 0 ? ((thisWeekSpent - lastWeekSpent) / lastWeekSpent) * 100 : 0;

  const budgetBreakdown = useMemo(() =>
    CATEGORIES.map((cat) => {
      const spent = categoryTotals[cat] || 0;
      const budget = budgets.find((b) => b.category === cat)?.amount || 0;
      return { cat, spent, budget, meta: CATEGORY_META[cat] };
    }).filter((item) => item.spent > 0 || item.budget > 0),
    [categoryTotals, budgets]
  );

  const dailyAllowance = remaining > 0
    ? remaining / Math.max(1, daysInMonth - daysElapsed)
    : 0;

  const savingsStreak = useMemo(() => {
    const months = getLast6Months();
    // Exclude current month (in progress), check last 5 completed months
    const completed = months.slice(0, -1);
    let streak = 0;
    for (let i = completed.length - 1; i >= 0; i--) {
      const month = completed[i];
      const income = monthlyIncomes[month] || 0;
      if (income === 0) break;
      const spent = transactions.filter((t) => t.date.startsWith(month)).reduce((s, t) => s + t.amount, 0);
      if ((income - spent) / income >= 0.10) streak++;
      else break;
    }
    return streak;
  }, [monthlyIncomes, transactions]);

  const metrics = [
    {
      label: "Spent this month",
      value: formatCurrency(totalSpent),
      sub: `${getMonthLabel(currentMonth)}`,
      icon: Wallet,
      color: "text-violet-600",
      bg: "bg-violet-50 dark:bg-violet-950/30",
      trend: monthChange !== 0 ? { value: Math.abs(monthChange).toFixed(1) + "%", up: monthChange > 0 } : null,
    },
    {
      label: "Budget remaining",
      value: totalBudget > 0 ? formatCurrency(Math.abs(remaining)) : "—",
      sub: totalBudget > 0 ? `${budgetPct.toFixed(0)}% used of ${formatCurrency(totalBudget)}` : "No budget set",
      icon: Target,
      color: remaining < 0 ? "text-red-500" : "text-emerald-600",
      bg: remaining < 0 ? "bg-red-50 dark:bg-red-950/30" : "bg-emerald-50 dark:bg-emerald-950/30",
      trend: null,
    },
    {
      label: "Today",
      value: todaySpent > 0 ? formatCurrency(todaySpent) : "₹0",
      sub: `Daily avg: ${formatCurrency(dailyAvg)}`,
      icon: Flame,
      color: "text-orange-500",
      bg: "bg-orange-50 dark:bg-orange-950/30",
      trend: null,
    },
    {
      label: "This week",
      value: formatCurrency(thisWeekSpent),
      sub: lastWeekSpent > 0 ? `Last week: ${formatCurrency(lastWeekSpent)}` : "First week tracked",
      icon: ArrowUpRight,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      trend: lastWeekSpent > 0 && thisWeekSpent !== lastWeekSpent
        ? { value: Math.abs(weekChange).toFixed(1) + "%", up: weekChange > 0 }
        : null,
    },
  ];


  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-700 mb-1">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"},{" "}
            <span className="gradient-text">{displayName}</span> 👋
          </h1>
          <p className="text-muted-foreground text-sm">
            Here&apos;s your financial overview for {getMonthLabel(currentMonth)}
          </p>
          {savingsStreak >= 1 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-600 mt-2 w-fit">
              🔥 {savingsStreak} month saving streak
            </div>
          )}
        </motion.div>
        <AddTransactionButton />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="bg-card border border-border/50 rounded-2xl p-5 card-hover"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center`}>
                <m.icon className={`w-5 h-5 ${m.color}`} />
              </div>
              {m.trend && (
                <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${m.trend.up ? "bg-red-50 text-red-600 dark:bg-red-950/40" : "bg-green-50 text-green-600 dark:bg-green-950/40"}`}>
                  {m.trend.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {m.trend.value}
                </div>
              )}
            </div>
            <div className="number-font text-2xl font-600 mb-1">{m.value}</div>
            <div className="text-xs text-muted-foreground">{m.sub}</div>
            <div className="text-[11px] text-muted-foreground/70 mt-0.5 font-medium uppercase tracking-wide">{m.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Daily Spending Pulse */}
      {totalBudget > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="bg-card border border-border/50 rounded-2xl p-5"
        >
          <div className="flex items-center justify-between gap-6">
            <div className="min-w-0">
              {remaining > 0 ? (
                <>
                  <div
                    className={`number-font text-3xl font-700 ${
                      dailyAllowance > dailyAvg
                        ? "text-emerald-600"
                        : dailyAllowance < dailyAvg * 0.5
                        ? "text-red-500"
                        : "text-amber-500"
                    }`}
                  >
                    {formatCurrency(dailyAllowance)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    you can spend today and stay on track &middot;{" "}
                    <span className="font-medium">{daysInMonth - daysElapsed} days left</span> in month
                  </div>
                </>
              ) : (
                <div className="text-red-500 font-600 text-sm">
                  Budget exhausted — {formatCurrency(Math.abs(remaining))} over
                </div>
              )}
            </div>
            <div className="flex-shrink-0 w-36">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                <span>Month progress</span>
                <span className="number-font">{Math.round((daysElapsed / daysInMonth) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(daysElapsed / daysInMonth) * 100}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    remaining <= 0
                      ? "bg-red-500"
                      : dailyAllowance < dailyAvg * 0.5
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                />
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Day {daysElapsed} of {daysInMonth}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display text-base font-600">Daily spending</h3>
              <p className="text-xs text-muted-foreground">Last 14 days</p>
            </div>
          </div>
          <DailySpendChart transactions={transactions} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card border border-border/50 rounded-2xl p-6"
        >
          <div className="mb-6">
            <h3 className="font-display text-base font-600">By category</h3>
            <p className="text-xs text-muted-foreground">This month</p>
          </div>
          <SpendingDonut categoryTotals={categoryTotals} />
        </motion.div>
      </div>

      {/* Category budget bars */}
      {budgetBreakdown.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="bg-card border border-border/50 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-display text-base font-600">Budget tracker</h3>
              <p className="text-xs text-muted-foreground">This month by category</p>
            </div>
            {totalBudget > 0 && (
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Month forecast</div>
                <div className={`number-font text-sm font-600 ${forecastTotal > totalBudget ? "text-red-500" : "text-emerald-600"}`}>
                  {formatCurrency(Math.round(forecastTotal))}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-4">
            {budgetBreakdown.map(({ cat, spent, budget, meta }) => {
              const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
              const isOver = budget > 0 && spent > budget;
              const barColor = isOver ? "#ef4444" : pct > 75 ? "#f97316" : meta.color;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{meta.icon}</span>
                      <span className="text-sm font-medium">{meta.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="number-font text-muted-foreground">{formatCurrency(spent)}</span>
                      {budget > 0 && (
                        <span className={`number-font font-medium ${isOver ? "text-red-500" : "text-muted-foreground"}`}>
                          / {formatCurrency(budget)}
                        </span>
                      )}
                      {isOver && (
                        <span className="text-red-500 font-medium">+{formatCurrency(spent - budget)}</span>
                      )}
                      {!isOver && budget > 0 && (
                        <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
                      )}
                    </div>
                  </div>
                  {budget > 0 ? (
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: barColor }}
                      />
                    </div>
                  ) : (
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full w-full rounded-full opacity-30" style={{ backgroundColor: meta.color }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Link href="/dashboard/budget" className="flex items-center gap-1 text-xs text-primary font-medium hover:underline mt-4">
            Manage budgets <ChevronRight className="w-3 h-3" />
          </Link>
        </motion.div>
      )}

      {/* Trend + Suggestions */}
      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display text-base font-600">Monthly trend</h3>
              <p className="text-xs text-muted-foreground">Last 6 months</p>
            </div>
          </div>
          <MonthlyTrendChart transactions={transactions} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-card border border-border/50 rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <h3 className="font-display text-base font-600">AI insights</h3>
            {insightsLoading && (
              <span className="ml-auto text-[10px] text-muted-foreground animate-pulse">Analysing…</span>
            )}
          </div>
          <div className="space-y-4">
            {suggestions.map((s, i) => (
              <div
                key={i}
                className={`p-4 rounded-xl border text-sm ${
                  s.type === "warning"
                    ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50"
                    : s.type === "success"
                    ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50"
                    : "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50"
                }`}
              >
                <div className={`font-medium mb-1 text-xs ${
                  s.type === "warning" ? "text-amber-700 dark:text-amber-400" :
                  s.type === "success" ? "text-green-700 dark:text-green-400" :
                  "text-blue-700 dark:text-blue-400"
                }`}>
                  {s.title}
                </div>
                <div className="text-muted-foreground text-xs leading-relaxed">{s.description}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Recent transactions */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-card border border-border/50 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-display text-base font-600">Recent transactions</h3>
            <p className="text-xs text-muted-foreground">Latest activity</p>
          </div>
          <Link
            href="/dashboard/transactions"
            className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
          >
            View all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Wallet className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No transactions yet. Add your first one!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 6).map((tx) => {
              const meta = CATEGORY_META[tx.category];
              return (
                <div key={tx.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-secondary/50 transition-colors group">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: meta?.lightColor }}
                  >
                    {meta?.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{tx.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {meta?.label} · {new Date(tx.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </div>
                  </div>
                  <div className="number-font text-sm font-600 text-foreground">
                    {formatCurrency(tx.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
