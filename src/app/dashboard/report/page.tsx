import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getMonthKey, getLast6Months } from "@/lib/utils";
import ReportClient from "./ReportClient";

export default async function ReportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const currentMonth = getMonthKey();
  const last6 = getLast6Months();
  const startDate = `${last6[0]}-01`;

  const [txResult, budgetsResult, incomesResult, loansResult, savingsResult] = await Promise.all([
    supabase.from("transactions").select("*").eq("user_id", user.id)
      .gte("date", startDate).order("date", { ascending: false }),
    supabase.from("budgets").select("*").eq("user_id", user.id).in("month", last6),
    supabase.from("incomes").select("amount, month").eq("user_id", user.id).in("month", last6),
    supabase.from("loans").select("emi_amount").eq("user_id", user.id),
    supabase.from("savings").select("monthly_amount, is_active").eq("user_id", user.id),
  ]);

  const monthlyIncomes: Record<string, number> = {};
  for (const row of incomesResult.data || []) {
    monthlyIncomes[row.month] = (monthlyIncomes[row.month] || 0) + Number(row.amount);
  }

  const totalEMI = loansResult.data?.reduce((s, l) => s + Number(l.emi_amount), 0) ?? 0;
  const totalMonthlySavings = (savingsResult.data || [])
    .filter((s) => s.is_active)
    .reduce((sum, s) => sum + Number(s.monthly_amount), 0);

  return (
    <ReportClient
      transactions={txResult.data || []}
      budgets={budgetsResult.data || []}
      months={last6}
      currentMonth={currentMonth}
      monthlyIncomes={monthlyIncomes}
      totalEMI={totalEMI}
      totalMonthlySavings={totalMonthlySavings}
    />
  );
}
