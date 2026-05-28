import { createClient } from "@/lib/supabase/server";
import { getMonthKey, getLast6Months } from "@/lib/utils";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const currentMonth = getMonthKey();
  const last6 = getLast6Months();
  const startDate = `${last6[0]}-01`;

  const [txResult, budgetResult] = await Promise.all([
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
  ]);

  return (
    <DashboardClient
      transactions={txResult.data || []}
      budgets={budgetResult.data || []}
      currentMonth={currentMonth}
      displayName={user!.user_metadata?.display_name || user!.email?.split("@")[0] || ""}
    />
  );
}
