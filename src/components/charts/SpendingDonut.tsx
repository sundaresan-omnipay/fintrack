"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { CATEGORY_META } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface Props {
  categoryTotals: Record<string, number>;
}

export default function SpendingDonut({ categoryTotals }: Props) {
  const data = Object.entries(categoryTotals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amount]) => ({
      name: CATEGORY_META[cat as keyof typeof CATEGORY_META]?.label || cat,
      value: amount,
      color: CATEGORY_META[cat as keyof typeof CATEGORY_META]?.color || "#6b7280",
      icon: CATEGORY_META[cat as keyof typeof CATEGORY_META]?.icon || "📦",
    }));

  const total = data.reduce((s, d) => s + d.value, 0);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No spending data
      </div>
    );
  }

  return (
    <div>
      <div className="relative h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), ""]}
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid hsl(var(--border))",
                backgroundColor: "hsl(var(--card))",
                fontSize: "12px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-lg font-display font-700 number-font">{formatCurrency(total)}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">total</div>
        </div>
      </div>

      <div className="space-y-2 mt-4">
        {data.slice(0, 5).map((d) => (
          <div key={d.name} className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-xs text-muted-foreground flex-1 truncate">{d.name}</span>
            <span className="text-xs font-medium number-font">{((d.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
