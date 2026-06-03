import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ensureFeatureTables } from "@/lib/db";
import SavingsClient from "./SavingsClient";

export default async function SavingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  let { data, error } = await supabase
    .from("savings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  // Table missing — create it directly, then retry
  if (error?.code === "PGRST205" && process.env.DATABASE_URL) {
    await ensureFeatureTables();
    await new Promise((r) => setTimeout(r, 1500)); // give PostgREST time to reload
    const retry = await supabase
      .from("savings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    data = retry.data;
    error = retry.error;
  }

  const tableReady = !error || error.code !== "PGRST205";

  return (
    <SavingsClient
      savings={(data || []).map((s) => ({ ...s, monthly_amount: Number(s.monthly_amount) }))}
      userId={user.id}
      tableReady={tableReady}
    />
  );
}
