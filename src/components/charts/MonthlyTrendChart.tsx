"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Transaction } from "@/types";
import { getLast6Months, getMonthLabel, formatCurrency } from "@/lib/utils";

interface Props {
  transactions: Transaction[];
}

export default function MonthlyTrendChart({ transactions }: Props) {
  const months = getLast6Months();

  const data = months.map((m) => {
    const total = transactions
      .filter((t) => t.date.startsWith(m))
      .reduce((s, t) => s + t.amount, 0);
    return {
      month: new Date(m + "-01").toLocaleDateString("en-IN", { month: "short" }),
      amount: total,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
        />
        <Tooltip
          formatter={(value: number) => [formatCurrency(value), "Spent"]}
          contentStyle={{
            borderRadius: "12px",
            border: "1px solid hsl(var(--border))",
            backgroundColor: "hsl(var(--card))",
            fontSize: "12px",
          }}
          cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="#7c3aed"
          strokeWidth={2}
          fill="url(#colorAmount)"
          dot={{ r: 4, fill: "#7c3aed", strokeWidth: 0 }}
          activeDot={{ r: 6, fill: "#7c3aed", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
