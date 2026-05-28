import { createClient } from "@/lib/supabase/server";
import { getLast6Months } from "@/lib/utils";
import AnalyticsClient from "./AnalyticsClient";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const last6 = getLast6Months();
  const startDate = `${last6[0]}-01`;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user!.id)
    .gte("date", startDate)
    .order("date", { ascending: false });

  return <AnalyticsClient transactions={transactions || []} />;
}
