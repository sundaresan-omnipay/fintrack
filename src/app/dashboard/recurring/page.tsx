import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMonthKey } from "@/lib/utils";
import RecurringClient from "./RecurringClient";

export default async function RecurringPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const currentMonth = getMonthKey();

  const [{ data: recurring }, { data: currentMonthTxns }] = await Promise.all([
    supabase
      .from("recurring_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", `${currentMonth}-01`)
      .lte("date", `${currentMonth}-31`),
  ]);

  return (
    <RecurringClient
      recurring={recurring || []}
      currentMonthTxns={currentMonthTxns || []}
      userId={user.id}
      currentMonth={currentMonth}
    />
  );
}
