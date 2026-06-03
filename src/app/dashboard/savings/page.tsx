import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SavingsClient from "./SavingsClient";

export default async function SavingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data, error } = await supabase
    .from("savings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const tableReady = !error || !error.message?.includes("schema cache");

  return (
    <SavingsClient
      savings={(data || []).map((s) => ({ ...s, monthly_amount: Number(s.monthly_amount) }))}
      userId={user.id}
      tableReady={tableReady}
    />
  );
}
