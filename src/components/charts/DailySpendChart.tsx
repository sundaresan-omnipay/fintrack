"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Transaction } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface Props {
  transactions: Transaction[];
}

export default function DailySpendChart({ transactions }: Props) {
  const days: { date: string; label: string; amount: number }[] = [];
  const today = new Date();

  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const amount = transactions
      .filter((t) => t.date === dateStr)
      .reduce((s, t) => s + t.amount, 0);
    days.push({
      date: dateStr,
      label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      amount,
    });
  }

  const todayStr = today.toISOString().split("T")[0];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={days} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={18}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          interval={1}
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
          cursor={{ fill: "hsl(var(--border))", fillOpacity: 0.3 }}
        />
        <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
          {days.map((d, i) => (
            <Cell
              key={i}
              fill={d.date === todayStr ? "#7c3aed" : "#7c3aed40"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
