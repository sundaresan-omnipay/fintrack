import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return NextResponse.json({ error: "Groq key not set" }, { status: 500 });

  try {
    const formData = await req.formData();
    const file = formData.get("pdf") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Import directly from lib to skip the debug-mode test-file read in pdf-parse index.js
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfModule = await import("pdf-parse/lib/pdf-parse.js" as any) as any;
    const pdfParse = pdfModule.default ?? pdfModule;
    const { text } = await pdfParse(buffer);

    const prompt = `You are a financial document parser. Extract home loan details from this HDFC / Indian bank amortization schedule.

Return ONLY a valid JSON object with these exact keys (use null for anything not found):
{
  "name": "suggested short name like 'HDFC Home Loan'",
  "original_principal": <number — total loan amount in INR, no commas, e.g. 5440000>,
  "interest_rate": <number — annual ROI as percentage, e.g. 7.25>,
  "tenure_months": <number — ORIGINAL SANCTION TERM in months, e.g. 120>,
  "emi_amount": <number — CURRENT EMI in INR, e.g. 63867>,
  "start_date": "<YYYY-MM-DD — date of first EMI row, e.g. 2026-05-01>"
}

Look for lines like: LOAN AMOUNT, ROI, CURRENT EMI, ORIGINAL SANCTION TERM, and the first date row.

Document text:
${text.slice(0, 8000)}`;

    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 300,
      }),
    });

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "Could not parse PDF data" }, { status: 422 });

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ data: parsed, rawText: text.slice(0, 500) });
  } catch (err) {
    console.error("PDF parse error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to parse PDF: ${message}` }, { status: 500 });
  }
}
