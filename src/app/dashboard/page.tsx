import { createClient } from "@/lib/supabase/server";
import { getMonthKey, getLast6Months } from "@/lib/utils";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const currentMonth = getMonthKey();
  const last6 = getLast6Months();
  const startDate = `${last6[0]}-01`;

  const [txResult, budgetResult, incomeResult, loansResult, savingsResult] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user!.id)
      .gte("date", startDate)
      .order("date", { ascending: false }),
    supabase
      .from("budgets")
      .select("*")
      .eq("user_id", user!.id)
      .eq("month", currentMonth),
    supabase
      .from("incomes")
      .select("amount,month")
      .eq("user_id", user!.id)
      .in("month", last6),
    supabase
      .from("loans")
      .select("emi_amount")
      .eq("user_id", user!.id),
    supabase
      .from("savings")
      .select("monthly_amount, is_active")
      .eq("user_id", user!.id),
  ]);

  const monthlyIncomes: Record<string, number> = {};
  for (const row of incomeResult.data || []) {
    monthlyIncomes[row.month] = (monthlyIncomes[row.month] || 0) + Number(row.amount);
  }

  const totalCurrentIncome = monthlyIncomes[currentMonth] ?? 0;
  const totalEMI = loansResult.data?.reduce((s, l) => s + Number(l.emi_amount), 0) ?? 0;
  const activeSavings = (savingsResult.data || []).filter((s) => s.is_active);
  const totalMonthlySavings = activeSavings.reduce((sum, s) => sum + Number(s.monthly_amount), 0);
  const savingsCount = activeSavings.length;

  return (
    <DashboardClient
      transactions={txResult.data || []}
      budgets={budgetResult.data || []}
      currentMonth={currentMonth}
      displayName={user!.user_metadata?.display_name || user!.email?.split("@")[0] || ""}
      monthlyIncomes={monthlyIncomes}
      totalCurrentIncome={totalCurrentIncome}
      totalEMI={totalEMI}
      totalMonthlySavings={totalMonthlySavings}
      savingsCount={savingsCount}
    />
  );
}
