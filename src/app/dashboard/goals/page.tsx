import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import GoalsClient from "./GoalsClient";
import { Goal } from "@/types";

export default async function GoalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .order("is_completed", { ascending: true })
    .order("created_at", { ascending: false });

  return <GoalsClient goals={(data as Goal[]) || []} userId={user.id} />;
}
