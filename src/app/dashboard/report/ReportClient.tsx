"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight, TrendingDown, TrendingUp, Wallet, PiggyBank, Target } from "lucide-react";
import { Transaction, Budget, CATEGORY_META, CATEGORIES } from "@/types";
import { formatCurrency, getMonthLabel } from "@/lib/utils";

interface Props {
  transactions: Transaction[];
  budgets: Budget[];
  months: string[];        // last 6 months, oldest first
  currentMonth: string;
  monthlyIncomes: Record<string, number>;
  totalEMI: number;
  totalMonthlySavings: number;
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function computeScore(
  income: number,
  spent: number,
  prevSpent: number,
  fixedOutgo: number,
  categoryTotals: Record<string, number>,
  budgetsForMonth: Budget[]
) {
  // 1. Savings rate (40%) — free cash as % of income
  let savingsScore = 60;
  if (income > 0) {
    const freeCash = income - fixedOutgo - spent;
    const freeRate = (freeCash / income) * 100;
    // 20% free → 100pts, 0% free → 50pts, –20% → 0pts
    savingsScore = Math.min(100, Math.max(0, Math.round(50 + freeRate * 2.5)));
  }

  // 2. Budget adherence (35%) — % of set categories within limit
  let budgetScore = 65;
  const withBudget = budgetsForMonth.filter((b) => b.amount > 0);
  if (withBudget.length > 0) {
    const onBudget = withBudget.filter((b) => (categoryTotals[b.category] || 0) <= b.amount).length;
    budgetScore = Math.round((onBudget / withBudget.length) * 100);
  }

  // 3. Month-over-month trend (25%) — spending vs previous month
  let trendScore = 70;
  if (prevSpent > 0 && spent > 0) {
    const change = (spent - prevSpent) / prevSpent; // + = worse, – = better
    // –30% or better → 100, +30% or worse → 0, linear
    trendScore = Math.min(100, Math.max(0, Math.round(50 - change * 167)));
  }

  const total = Math.round(savingsScore * 0.4 + budgetScore * 0.35 + trendScore * 0.25);
  return { total, savingsScore, budgetScore, trendScore };
}

function scoreToGrade(score: number) {
  if (score >= 90) return { grade: "A+", color: "#10b981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.3)",  verdict: "Outstanding — ahead of every financial goal this month." };
  if (score >= 80) return { grade: "A",  color: "#10b981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.3)",  verdict: "Excellent — strong savings rate and controlled spending." };
  if (score >= 72) return { grade: "B+", color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.3)",  verdict: "Good month — minor overspends but overall well managed." };
  if (score >= 62) return { grade: "B",  color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.3)",  verdict: "Solid month — a few categories ran over, savings are on track." };
  if (score >= 55) return { grade: "C+", color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)",  verdict: "Average month — savings rate slightly below target." };
  if (score >= 45) return { grade: "C",  color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)",  verdict: "Below average — worth reviewing discretionary spending." };
  if (score >= 35) return { grade: "D",  color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.3)",  verdict: "Difficult month — spending significantly exceeded your plan." };
  return               { grade: "F",  color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.3)",   verdict: "Critical — spending has overrun your income budget." };
}

// ── Grade Circle SVG ──────────────────────────────────────────────────────────

function GradeCircle({ score, color, grade }: { score: number; color: string; grade: string }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative w-36 h-36 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
        <motion.circle
          cx="60" cy="60" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-700" style={{ color }}>{grade}</span>
        <span className="text-xs text-muted-foreground font-medium">{score}/100</span>
      </div>
    </div>
  );
}

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ label, score, color, detail }: { label: string; score: number; color: string; detail: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="number-font text-sm font-600" style={{ color }}>{score}/100</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden mb-1">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
        />
      </div>
      <div className="text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReportClient({
  transactions, budgets, months, currentMonth, monthlyIncomes, totalEMI, totalMonthlySavings,
}: Props) {
  const fixedOutgo = totalEMI + totalMonthlySavings;

  // Build per-month spending map
  const monthlySpending = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach((t) => {
      const m = t.date.slice(0, 7);
      map[m] = (map[m] || 0) + t.amount;
    });
    return map;
  }, [transactions]);

  // Category totals for current month
  const currentCatTotals = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter((t) => t.date.startsWith(currentMonth)).forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return map;
  }, [transactions, currentMonth]);

  // Budgets for current month
  const currentBudgets = useMemo(
    () => budgets.filter((b) => b.month === currentMonth),
    [budgets, currentMonth]
  );

  const income = monthlyIncomes[currentMonth] ?? 0;
  const spent = monthlySpending[currentMonth] ?? 0;
  const prevMonth = months[months.length - 2] ?? "";
  const prevSpent = monthlySpending[prevMonth] ?? 0;

  const scores = useMemo(
    () => computeScore(income, spent, prevSpent, fixedOutgo, currentCatTotals, currentBudgets),
    [income, spent, prevSpent, fixedOutgo, currentCatTotals, currentBudgets]
  );
  const { grade, color, bg, border, verdict } = scoreToGrade(scores.total);

  // Financial summary
  const freeCash = income > 0 ? income - fixedOutgo - spent : null;
  const savingsRate = income > 0 ? Math.round(((income - fixedOutgo - spent) / income) * 100) : null;

  // Categories over budget
  const overBudget = useMemo(() =>
    currentBudgets
      .filter((b) => b.amount > 0 && (currentCatTotals[b.category] || 0) > b.amount)
      .map((b) => ({
        cat: b.category,
        over: (currentCatTotals[b.category] || 0) - b.amount,
        meta: CATEGORY_META[b.category as keyof typeof CATEGORY_META],
      }))
      .sort((a, b) => b.over - a.over),
    [currentBudgets, currentCatTotals]
  );

  // History grades (all months except current)
  const history = useMemo(() => {
    return months.map((m, i) => {
      const mSpent = monthlySpending[m] ?? 0;
      const mIncome = monthlyIncomes[m] ?? 0;
      const mPrevSpent = i > 0 ? (monthlySpending[months[i - 1]] ?? 0) : 0;
      const mBudgets = budgets.filter((b) => b.month === m);
      const mCatTotals: Record<string, number> = {};
      transactions.filter((t) => t.date.startsWith(m)).forEach((t) => {
        mCatTotals[t.category] = (mCatTotals[t.category] || 0) + t.amount;
      });
      const s = computeScore(mIncome, mSpent, mPrevSpent, fixedOutgo, mCatTotals, mBudgets);
      const g = scoreToGrade(s.total);
      return { month: m, ...s, ...g, spent: mSpent, income: mIncome, isCurrent: m === currentMonth };
    });
  }, [months, monthlySpending, monthlyIncomes, budgets, transactions, fixedOutgo, currentMonth]);

  const daysElapsed = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const isInProgress = daysElapsed < daysInMonth;

  // Score bar details
  const savingsDetail = income > 0
    ? `Free cash: ${freeCash !== null ? formatCurrency(freeCash) : "—"} (${savingsRate ?? 0}% of income)`
    : "Add income in Budget page to calculate";
  const budgetDetail = currentBudgets.filter((b) => b.amount > 0).length > 0
    ? `${currentBudgets.filter((b) => b.amount > 0).length - overBudget.length} of ${currentBudgets.filter((b) => b.amount > 0).length} categories within limit`
    : "Set category budgets to track";
  const trendDetail = prevSpent > 0
    ? `${spent < prevSpent ? "↓" : "↑"} ${Math.abs(Math.round(((spent - prevSpent) / prevSpent) * 100))}% vs ${getMonthLabel(prevMonth)}`
    : "No previous month data yet";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-700 mb-1">Report Card</h1>
          <p className="text-muted-foreground text-sm">
            {getMonthLabel(currentMonth)}
            {isInProgress && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                In progress — Day {daysElapsed} of {daysInMonth}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Main grade card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border/50 rounded-2xl p-6"
      >
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Grade circle + verdict */}
          <div className="flex items-center gap-5">
            <GradeCircle score={scores.total} color={color} grade={grade} />
            <div>
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border mb-2"
                style={{ background: bg, borderColor: border, color }}
              >
                {scores.total >= 80 ? "🏆" : scores.total >= 60 ? "✅" : scores.total >= 45 ? "⚠️" : "🔴"} {grade} Grade
              </div>
              <p className="text-sm font-medium leading-relaxed max-w-xs">{verdict}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isInProgress ? `Projection based on ${daysElapsed} days of data` : "Final grade"}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px bg-border/50 self-stretch" />

          {/* Score breakdown */}
          <div className="flex-1 space-y-4">
            <ScoreBar
              label="Savings Rate"
              score={scores.savingsScore}
              color={scores.savingsScore >= 70 ? "#10b981" : scores.savingsScore >= 50 ? "#f59e0b" : "#ef4444"}
              detail={savingsDetail}
            />
            <ScoreBar
              label="Budget Adherence"
              score={scores.budgetScore}
              color={scores.budgetScore >= 80 ? "#10b981" : scores.budgetScore >= 60 ? "#f59e0b" : "#ef4444"}
              detail={budgetDetail}
            />
            <ScoreBar
              label="vs Last Month"
              score={scores.trendScore}
              color={scores.trendScore >= 70 ? "#10b981" : scores.trendScore >= 50 ? "#f59e0b" : "#ef4444"}
              detail={trendDetail}
            />
          </div>
        </div>
      </motion.div>

      {/* Financial summary row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
      >
        {[
          {
            label: "Income",
            value: income > 0 ? formatCurrency(income) : "Not set",
            icon: "💰",
            color: "#10b981",
            sub: income > 0 ? "This month" : "Add in Budget",
            link: income === 0 ? "/dashboard/budget" : null,
          },
          {
            label: "Fixed outgo",
            value: fixedOutgo > 0 ? formatCurrency(fixedOutgo) : "—",
            icon: "🏦",
            color: "#f97316",
            sub: fixedOutgo > 0
              ? [totalMonthlySavings > 0 && `SIP ₹${(totalMonthlySavings/1000).toFixed(0)}k`, totalEMI > 0 && `EMI ₹${(totalEMI/1000).toFixed(0)}k`].filter(Boolean).join(" + ")
              : "Savings + EMI",
            link: null,
          },
          {
            label: "Total spent",
            value: formatCurrency(spent),
            icon: "🛒",
            color: "#3b82f6",
            sub: `${transactions.filter(t => t.date.startsWith(currentMonth)).length} transactions`,
            link: null,
          },
          {
            label: freeCash !== null && freeCash >= 0 ? "Free cash" : income > 0 ? "Over budget" : "Budget left",
            value: freeCash !== null
              ? formatCurrency(Math.abs(freeCash))
              : formatCurrency(Math.max(0, (currentBudgets.reduce((s, b) => s + b.amount, 0)) - spent)),
            icon: freeCash !== null ? (freeCash >= 0 ? "✅" : "⚠️") : "📊",
            color: freeCash !== null ? (freeCash >= 0 ? "#8b5cf6" : "#ef4444") : "#8b5cf6",
            sub: savingsRate !== null ? `${savingsRate}% savings rate` : "Add income to see",
            link: null,
          },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05 }}
            className="bg-card border border-border/50 rounded-2xl p-4"
          >
            <div className="text-xl mb-2">{item.icon}</div>
            <div className="number-font text-lg font-700" style={{ color: item.color }}>{item.value}</div>
            <div className="text-[11px] text-muted-foreground/70 uppercase tracking-wide font-medium mt-0.5">{item.label}</div>
            {item.link ? (
              <Link href={item.link} className="text-xs text-primary hover:underline flex items-center gap-0.5 mt-1">
                {item.sub} <ChevronRight className="w-3 h-3" />
              </Link>
            ) : (
              <div className="text-xs text-muted-foreground mt-1">{item.sub}</div>
            )}
          </motion.div>
        ))}
      </motion.div>

      {/* Categories over budget */}
      {overBudget.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border/50 rounded-2xl p-5"
        >
          <h3 className="font-display text-sm font-600 mb-4 flex items-center gap-2">
            <span>⚠️</span> Categories over budget
          </h3>
          <div className="space-y-3">
            {overBudget.map(({ cat, over, meta }) => {
              const budget = currentBudgets.find((b) => b.category === cat)!;
              const actual = currentCatTotals[cat] || 0;
              const pct = Math.round((actual / budget.amount) * 100);
              return (
                <div key={cat} className="flex items-center gap-3">
                  <span className="text-lg w-7 flex-shrink-0">{meta?.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{meta?.label}</span>
                      <span className="text-xs font-medium text-red-500">+{formatCurrency(over)} over</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-red-500"
                        style={{ width: `${Math.min(100, (actual / (budget.amount * 1.5)) * 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatCurrency(actual)} spent of {formatCurrency(budget.amount)} limit ({pct}%)
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Link href="/dashboard/budget" className="flex items-center gap-1 text-xs text-primary font-medium hover:underline mt-4">
            Adjust budgets <ChevronRight className="w-3 h-3" />
          </Link>
        </motion.div>
      )}

      {/* Month history */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-card border border-border/50 rounded-2xl p-5"
      >
        <h3 className="font-display text-sm font-600 mb-4">6-month history</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {history.map((h, i) => (
            <motion.div
              key={h.month}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + i * 0.06 }}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all"
              style={
                h.isCurrent
                  ? { background: h.bg, borderColor: h.border }
                  : { background: "hsl(var(--secondary)/0.5)", borderColor: "hsl(var(--border))" }
              }
            >
              <div
                className="font-display text-xl font-700"
                style={{ color: h.spent > 0 || h.income > 0 ? h.color : "hsl(var(--muted-foreground))" }}
              >
                {h.spent > 0 || h.income > 0 ? h.grade : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground text-center font-medium">
                {getMonthLabel(h.month).slice(0, 3)}
                {h.isCurrent && <span className="block text-[9px] opacity-60">now</span>}
              </div>
              {(h.spent > 0 || h.income > 0) && (
                <div className="text-[10px] text-muted-foreground">{h.total}/100</div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Tips based on score */}
      {scores.total < 80 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-card border border-border/50 rounded-2xl p-5"
        >
          <h3 className="font-display text-sm font-600 mb-3">💡 How to improve your grade</h3>
          <div className="space-y-2">
            {income === 0 && (
              <div className="flex items-start gap-2 text-sm">
                <span className="text-green-500 mt-0.5">→</span>
                <span className="text-muted-foreground">
                  <Link href="/dashboard/budget" className="text-primary hover:underline font-medium">Add your monthly income</Link>
                  {" "}— without it, savings rate can&apos;t be calculated, capping your score.
                </span>
              </div>
            )}
            {scores.budgetScore < 70 && overBudget.length > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <span className="text-amber-500 mt-0.5">→</span>
                <span className="text-muted-foreground">
                  Rein in <span className="font-medium">{overBudget[0].meta?.label}</span> — you&apos;re {formatCurrency(overBudget[0].over)} over budget there.
                </span>
              </div>
            )}
            {scores.trendScore < 60 && prevSpent > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <span className="text-orange-500 mt-0.5">→</span>
                <span className="text-muted-foreground">
                  Spending is up vs last month. Target staying under {formatCurrency(prevSpent)} to improve your trend score.
                </span>
              </div>
            )}
            {totalMonthlySavings === 0 && (
              <div className="flex items-start gap-2 text-sm">
                <span className="text-blue-500 mt-0.5">→</span>
                <span className="text-muted-foreground">
                  <Link href="/dashboard/savings" className="text-primary hover:underline font-medium">Set up a savings plan</Link>
                  {" "}(SIP, FD etc.) — committed savings directly improve your savings rate score.
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
