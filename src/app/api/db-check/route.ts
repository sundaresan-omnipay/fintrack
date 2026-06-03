import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const results: Record<string, string> = {};

  for (const table of ["transactions", "incomes", "savings", "budgets", "loans"]) {
    const { error } = await supabase.from(table as "transactions").select("id").limit(1);
    results[table] = error ? `❌ ${error.code}: ${error.message}` : "✅ accessible";
  }

  return NextResponse.json(results);
}
