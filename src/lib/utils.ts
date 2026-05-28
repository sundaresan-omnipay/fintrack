import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return new Date(Number(year), Number(month) - 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export function calcEMI(principal: number, annualRate: number, months: number): number {
  const r = annualRate / 12 / 100;
  if (r === 0) return principal / months;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

export function calculateAmortization(
  principal: number,
  annualRate: number,
  emi: number,
  startDate: string,
  prepayments: { date: string; amount: number }[] = []
) {
  const r = annualRate / 12 / 100;
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const start = new Date(startDate + "T00:00:00");

  let balance = principal;
  const schedule = [];
  let i = 0;

  while (balance > 1 && i < 600) {
    const d = new Date(start);
    d.setMonth(start.getMonth() + i);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    const interest = balance * r;
    const principalPaid = Math.min(emi - interest, balance);
    const prep = prepayments
      .filter((p) => p.date.slice(0, 7) === monthStr)
      .reduce((s, p) => s + p.amount, 0);

    const newBalance = Math.max(0, balance - principalPaid - prep);

    schedule.push({
      month: i + 1,
      date: monthStr,
      emi: Math.round(Math.min(emi, interest + principalPaid)),
      interest: Math.round(interest),
      principal: Math.round(principalPaid),
      prepayment: prep,
      balance: Math.round(newBalance),
      isCurrent: monthStr === todayKey,
      isPast: monthStr < todayKey,
    });

    balance = newBalance;
    i++;
  }

  return schedule;
}

export function getLast6Months(): string[] {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push(getMonthKey(d));
  }
  return months;
}
