import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getMonthKey } from "@/lib/utils";
import { ensureFeatureTables } from "@/lib/db";
import BudgetClient from "./BudgetClient";

export default async function BudgetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const currentMonth = getMonthKey();

  const [txResult, budgetResult, incomeResult, loansResult] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", `${currentMonth}-01`)
      .lte("date", `${currentMonth}-31`)
      .order("date", { ascending: false }),
    supabase
      .from("budgets")
      .select("*")
      .eq("user_id", user.id)
      .eq("month", currentMonth),
    supabase
      .from("incomes")
      .select("*")
      .eq("user_id", user.id)
      .eq("month", currentMonth)
      .order("created_at", { ascending: true }),
    supabase
      .from("loans")
      .select("emi_amount")
      .eq("user_id", user.id),
  ]);

  // Income table missing — create it directly, then retry
  let incomes = (incomeResult.data || []).map((i) => ({ ...i, amount: Number(i.amount) }));
  let incomeTableReady = !incomeResult.error || incomeResult.error.code !== "PGRST205";

  if (incomeResult.error?.code === "PGRST205" && process.env.DATABASE_URL) {
    try {
      await ensureFeatureTables();
      await new Promise((r) => setTimeout(r, 1500));
      const retry = await supabase
        .from("incomes")
        .select("*")
        .eq("user_id", user.id)
        .eq("month", currentMonth)
        .order("created_at", { ascending: true });
      incomes = (retry.data || []).map((i) => ({ ...i, amount: Number(i.amount) }));
      incomeTableReady = !retry.error || retry.error.code !== "PGRST205";
    } catch {
      // DB connection failed — keep incomeTableReady = false so setup card is shown
    }
  }

  const totalEMI = loansResult.data?.reduce((s, l) => s + Number(l.emi_amount), 0) ?? 0;

  return (
    <BudgetClient
      transactions={txResult.data || []}
      budgets={budgetResult.data || []}
      currentMonth={currentMonth}
      userId={user.id}
      incomes={incomes}
      totalEMI={totalEMI}
      incomeTableReady={incomeTableReady}
    />
  );
}
