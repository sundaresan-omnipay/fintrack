import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LoansClient from "./LoansClient";

const HDFC_LOAN = {
  name: "HDFC Home Loan",
  original_principal: 5440000,
  interest_rate: 7.25,
  tenure_months: 120,
  start_date: "2026-06-05",
  emi_amount: 63867,
};

export default async function LoansPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  let loansResult = await supabase
    .from("loans")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Seed the HDFC loan on first visit
  if (!loansResult.data?.length) {
    await supabase.from("loans").insert({ user_id: user.id, ...HDFC_LOAN });
    loansResult = await supabase
      .from("loans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
  } else {
    // One-time fix: update old incorrect start_date (was seeded as 2026-05-01, should be 2026-06-05)
    const staleHdfc = loansResult.data.find(
      (l) => l.name === "HDFC Home Loan" && l.start_date === "2026-05-01"
    );
    if (staleHdfc) {
      await supabase.from("loans").update({ start_date: "2026-06-05" }).eq("id", staleHdfc.id);
      loansResult = await supabase
        .from("loans")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
    }
  }

  const prepaymentsResult = await supabase
    .from("loan_prepayments")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: true });

  return (
    <LoansClient
      loans={loansResult.data || []}
      prepayments={prepaymentsResult.data || []}
      userId={user.id}
    />
  );
}
