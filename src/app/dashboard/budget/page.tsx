import { createClient } from "@/lib/supabase/server";
import { getMonthKey } from "@/lib/utils";
import BudgetClient from "./BudgetClient";

export default async function BudgetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const currentMonth = getMonthKey();

  const [{ data: transactions }, { data: budgets }] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user!.id)
      .gte("date", `${currentMonth}-01`)
      .order("date", { ascending: false }),
    supabase
      .from("budgets")
      .select("*")
      .eq("user_id", user!.id)
      .eq("month", currentMonth),
  ]);

  return (
    <BudgetClient
      transactions={transactions || []}
      budgets={budgets || []}
      currentMonth={currentMonth}
      userId={user!.id}
    />
  );
}
