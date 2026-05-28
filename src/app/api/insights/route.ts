import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Groq API key not configured" }, { status: 500 });
  }

  const body = await req.json();
  const { totalSpent, totalBudget, budgetPct, monthChange, prevMonthTotal, topCategory, categoryTotals, txCount } = body;

  const prompt = `You are a personal finance advisor. Analyze this user's spending data and give 3 concise, actionable insights.

Financial data for this month:
- Total spent: ₹${totalSpent?.toFixed(0) || 0}
- Monthly budget: ₹${totalBudget?.toFixed(0) || 0}
- Budget used: ${budgetPct?.toFixed(0) || 0}%
- Change vs last month: ${monthChange > 0 ? "+" : ""}${monthChange?.toFixed(0) || 0}% (last month: ₹${prevMonthTotal?.toFixed(0) || 0})
- Top spending category: ${topCategory?.cat || "none"} (₹${topCategory?.amt?.toFixed(0) || 0})
- Category breakdown: ${Object.entries(categoryTotals || {}).map(([k, v]) => `${k}: ₹${(v as number).toFixed(0)}`).join(", ")}
- Transaction count: ${txCount || 0}

Return ONLY a JSON array of exactly 3 objects, no other text:
[
  { "title": "short title", "description": "one actionable sentence", "type": "warning|success|info" },
  ...
]

Use "warning" for overspending alerts, "success" for good habits, "info" for neutral observations.`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 512,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Groq API error" }, { status: 502 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Invalid response format" }, { status: 502 });
    }

    const insights = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ insights });
  } catch {
    return NextResponse.json({ error: "Failed to fetch insights" }, { status: 502 });
  }
}
