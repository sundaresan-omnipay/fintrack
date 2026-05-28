"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, Radar
} from "recharts";
import { Transaction, CATEGORY_META, CATEGORIES } from "@/types";
import { formatCurrency, getLast6Months, getMonthLabel } from "@/lib/utils";
import SpendingDonut from "@/components/charts/SpendingDonut";

interface Props {
  transactions: Transaction[];
}

export default function AnalyticsClient({ transactions }: Props) {
  const months = getLast6Months();

  const monthlyByCategory = useMemo(() => {
    return months.map((m) => {
      const mtxs = transactions.filter((t) => t.date.startsWith(m));
      const label = new Date(m + "-01").toLocaleDateString("en-IN", { month: "short" });
      const row: Record<string, string | number> = { month: label };
      CATEGORIES.forEach((c) => {
        row[c] = mtxs.filter((t) => t.category === c).reduce((s, t) => s + t.amount, 0);
      });
      row.total = mtxs.reduce((s, t) => s + t.amount, 0);
      return row;
    });
  }, [transactions, months]);

  const currentMonthKey = months[months.length - 1];
  const currentTotals = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter((t) => t.date.startsWith(currentMonthKey))
      .forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return map;
  }, [transactions, currentMonthKey]);

  const radarData = useMemo(() =>
    CATEGORIES.filter((c) => currentTotals[c] > 0).map((c) => ({
      category: CATEGORY_META[c].label.split(" ")[0],
      amount: currentTotals[c],
    })),
    [currentTotals]
  );

  const avgByCategory = useMemo(() => {
    return CATEGORIES.map((c) => {
      const total = transactions.filter((t) => t.category === c).reduce((s, t) => s + t.amount, 0);
      const count = transactions.filter((t) => t.category === c).length;
      return {
        category: CATEGORY_META[c].label,
        icon: CATEGORY_META[c].icon,
        total,
        count,
        avg: count > 0 ? total / count : 0,
        color: CATEGORY_META[c].color,
        lightColor: CATEGORY_META[c].lightColor,
      };
    }).filter((d) => d.count > 0).sort((a, b) => b.total - a.total);
  }, [transactions]);

  const dayOfWeekData = useMemo(() => {
    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const totals = [0, 0, 0, 0, 0, 0, 0];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    transactions.forEach((t) => {
      const day = new Date(t.date + "T12:00:00").getDay();
      totals[day] += t.amount;
      counts[day]++;
    });
    return labels.map((name, i) => ({
      day: name,
      total: Math.round(totals[i]),
      count: counts[i],
    }));
  }, [transactions]);

  const topSpendDays = useMemo(() => {
    const dayMap: Record<string, number> = {};
    transactions.forEach((t) => { dayMap[t.date] = (dayMap[t.date] || 0) + t.amount; });
    return Object.entries(dayMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([date, amount]) => ({ date, amount }));
  }, [transactions]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-700 mb-1">Analytics</h1>
        <p className="text-muted-foreground text-sm">Deep dive into your spending patterns</p>
      </div>

      {/* Monthly stacked */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border/50 rounded-2xl p-6"
      >
        <h3 className="font-display text-base font-600 mb-1">Month-by-month breakdown</h3>
        <p className="text-xs text-muted-foreground mb-5">Stacked by category over 6 months</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthlyByCategory} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
            <Tooltip
              formatter={(value: number, name: string) => [formatCurrency(value), CATEGORY_META[name as keyof typeof CATEGORY_META]?.label || name]}
              contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))", fontSize: "12px" }}
            />
            {CATEGORIES.map((c) => (
              <Bar key={c} dataKey={c} stackId="a" fill={CATEGORY_META[c].color} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Donut + Radar */}
      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border/50 rounded-2xl p-6"
        >
          <h3 className="font-display text-base font-600 mb-1">This month</h3>
          <p className="text-xs text-muted-foreground mb-4">{getMonthLabel(currentMonthKey)}</p>
          <SpendingDonut categoryTotals={currentTotals} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card border border-border/50 rounded-2xl p-6"
        >
          <h3 className="font-display text-base font-600 mb-1">Spending shape</h3>
          <p className="text-xs text-muted-foreground mb-4">Radar view of this month</p>
          {radarData.length > 2 ? (
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Radar dataKey="amount" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.15} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              Need 3+ categories for radar chart
            </div>
          )}
        </motion.div>
      </div>

      {/* Category breakdown table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card border border-border/50 rounded-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border/50">
          <h3 className="font-display text-base font-600">Category breakdown</h3>
          <p className="text-xs text-muted-foreground mt-0.5">All time totals and averages</p>
        </div>
        <div className="divide-y divide-border/50">
          {avgByCategory.map((d, i) => {
            const totalAll = avgByCategory.reduce((s, x) => s + x.total, 0);
            const pct = totalAll > 0 ? (d.total / totalAll) * 100 : 0;
            return (
              <div key={d.category} className="px-6 py-4 flex items-center gap-4">
                <div className="text-lg w-8 text-center flex-shrink-0">{d.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium">{d.category}</span>
                    <span className="number-font text-sm font-600">{formatCurrency(d.total)}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: i * 0.05, duration: 0.6 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: d.color }}
                    />
                  </div>
                </div>
                <div className="text-right flex-shrink-0 text-xs text-muted-foreground">
                  <div>{d.count} txns</div>
                  <div className="number-font">avg {formatCurrency(d.avg)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Day-of-week pattern */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-card border border-border/50 rounded-2xl p-6"
      >
        <h3 className="font-display text-base font-600 mb-1">Spending by day of week</h3>
        <p className="text-xs text-muted-foreground mb-5">Total spending accumulated per weekday</p>
        {transactions.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dayOfWeekData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
              <Tooltip
                formatter={(value: number, _: string, props: { payload?: { count: number } }) => [
                  `${formatCurrency(value)} (${props.payload?.count ?? 0} txns)`,
                  "Total spent",
                ]}
                contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))", fontSize: "12px" }}
              />
              <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                {dayOfWeekData.map((entry, i) => {
                  const max = Math.max(...dayOfWeekData.map((d) => d.total));
                  return <Cell key={i} fill={entry.total === max ? "#7c3aed" : "hsl(var(--secondary))"} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">No data yet</div>
        )}
      </motion.div>

      {/* Top spend days */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card border border-border/50 rounded-2xl p-6"
      >
        <h3 className="font-display text-base font-600 mb-1">Biggest spending days</h3>
        <p className="text-xs text-muted-foreground mb-5">All time top 5</p>
        <div className="space-y-3">
          {topSpendDays.map((d, i) => (
            <div key={d.date} className="flex items-center gap-4">
              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-600 text-muted-foreground flex-shrink-0">
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {new Date(d.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </div>
              </div>
              <div className="number-font font-600 text-sm">{formatCurrency(d.amount)}</div>
            </div>
          ))}
          {topSpendDays.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">No data yet</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
