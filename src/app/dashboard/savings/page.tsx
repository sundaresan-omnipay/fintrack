import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SavingsClient from "./SavingsClient";

export default async function SavingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data } = await supabase
    .from("savings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (
    <SavingsClient
      savings={(data || []).map((s) => ({ ...s, monthly_amount: Number(s.monthly_amount) }))}
      userId={user.id}
    />
  );
}
