"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Plus, X, Loader2, AlertTriangle, CheckCircle2,
  TrendingDown, Calendar, Wallet, Trash2, ChevronDown, ChevronUp,
  IndianRupee, Clock,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Loan, LoanPrepayment } from "@/types";
import { formatCurrency, calcEMI, calculateAmortization } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface Props {
  loans: Loan[];
  prepayments: LoanPrepayment[];
  userId: string;
}

const EMPTY_FORM = {
  name: "Home Loan",
  original_principal: "",
  interest_rate: "",
  tenure_months: "",
  start_date: "",
  emi_amount: "",
};

export default function LoansClient({ loans: initial, prepayments: initPrep, userId }: Props) {
  const supabase = createClient();
  const currentRowRef = useRef<HTMLTableRowElement>(null);

  const [loans, setLoans] = useState(initial);
  const [prepayments, setPrepayments] = useState(initPrep);
  const [selectedId, setSelectedId] = useState(initial[0]?.id || null);

  const [showAddLoan, setShowAddLoan] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [showAddPrep, setShowAddPrep] = useState(false);
  const [prepForm, setPrepForm] = useState({ amount: "", date: new Date().toISOString().split("T")[0], notes: "" });
  const [savingPrep, setSavingPrep] = useState(false);
  const [prepError, setPrepError] = useState("");
  const [loanError, setLoanError] = useState("");

  const [showAllRows, setShowAllRows] = useState(false);

  const loan = useMemo(() => loans.find((l) => l.id === selectedId) || null, [loans, selectedId]);
  const loanPreps = useMemo(
    () => prepayments.filter((p) => p.loan_id === selectedId).map((p) => ({ date: p.date, amount: p.amount })),
    [prepayments, selectedId]
  );

  const schedule = useMemo(() => {
    if (!loan) return [];
    return calculateAmortization(loan.original_principal, loan.interest_rate, loan.emi_amount, loan.start_date, loanPreps);
  }, [loan, loanPreps]);

  const scheduleNoPrepay = useMemo(() => {
    if (!loan || loanPreps.length === 0) return schedule;
    return calculateAmortization(loan.original_principal, loan.interest_rate, loan.emi_amount, loan.start_date, []);
  }, [loan, loanPreps, schedule]);

  const currentIdx = useMemo(() => {
    const idx = schedule.findIndex((r) => r.isCurrent);
    return idx >= 0 ? idx : schedule.findIndex((r) => !r.isPast);
  }, [schedule]);

  const stats = useMemo(() => {
    if (!loan || schedule.length === 0) return null;
    const cur = schedule[currentIdx] ?? schedule[0];
    const pastRows = schedule.filter((r) => r.isPast);
    const emisPaid = pastRows.length;
    const interestPaid = pastRows.reduce((s, r) => s + r.interest, 0);
    const principalPaid = loan.original_principal - cur.balance;
    const totalInterest = schedule.reduce((s, r) => s + r.interest, 0);
    const originalTotal = scheduleNoPrepay.reduce((s, r) => s + r.interest, 0);
    const interestSaved = originalTotal - totalInterest;
    const monthsSaved = scheduleNoPrepay.length - schedule.length;
    // Next upcoming EMI = first row that is neither past nor current
    const nextRow = schedule.find((r) => !r.isPast && !r.isCurrent) ?? schedule.find((r) => !r.isPast);
    const monthsLeft = schedule.filter((r) => !r.isPast).length;
    return { cur, emisPaid, interestPaid, principalPaid, totalInterest, interestSaved, monthsSaved, nextRow, monthsLeft };
  }, [loan, schedule, scheduleNoPrepay, currentIdx]);

  // Scroll current row into view on loan change only (not on expand/collapse)
  useEffect(() => {
    if (currentRowRef.current) {
      currentRowRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [selectedId]);

  // Chart data: show balance over time, sampled for readability
  const chartData = useMemo(() => {
    if (schedule.length === 0) return [];
    const step = schedule.length > 120 ? Math.ceil(schedule.length / 60) : 1;
    return schedule.filter((_, i) => i % step === 0 || i === schedule.length - 1).map((r) => ({
      date: r.date,
      balance: r.balance,
      isPast: r.isPast,
    }));
  }, [schedule]);

  // EMI breakdown chart: last 6 + next 6 months
  const emiChartData = useMemo(() => {
    const range = schedule.slice(Math.max(0, currentIdx - 5), currentIdx + 7);
    return range.map((r) => ({
      date: r.date.slice(0, 7),
      interest: r.interest,
      principal: r.principal,
      prepayment: r.prepayment,
    }));
  }, [schedule, currentIdx]);

  // Visible rows in table
  const visibleRows = useMemo(() => {
    if (showAllRows) return schedule;
    const start = Math.max(0, currentIdx - 6);
    const end = Math.min(schedule.length, currentIdx + 13);
    return schedule.slice(start, end);
  }, [schedule, currentIdx, showAllRows]);

  // Auto-calc EMI when fields are ready
  function autoCalcEMI() {
    const p = parseFloat(form.original_principal);
    const r = parseFloat(form.interest_rate);
    const n = parseInt(form.tenure_months);
    if (p > 0 && r > 0 && n > 0 && !form.emi_amount) {
      setForm((f) => ({ ...f, emi_amount: String(Math.round(calcEMI(p, r, n))) }));
    }
  }

  async function saveLoan() {
    const p = parseFloat(form.original_principal);
    const r = parseFloat(form.interest_rate);
    const n = parseInt(form.tenure_months);
    const emi = parseFloat(form.emi_amount) || Math.round(calcEMI(p, r, n));
    if (!p || !r || !n || !form.start_date) return;
    setSaving(true);
    setLoanError("");
    const { data, error } = await supabase.from("loans").insert({
      user_id: userId,
      name: form.name || "Home Loan",
      original_principal: p,
      interest_rate: r,
      tenure_months: n,
      start_date: form.start_date,
      emi_amount: emi,
    }).select().single();
    if (!error && data) {
      setLoans((prev) => [data, ...prev]);
      setSelectedId(data.id);
      setShowAddLoan(false);
      setForm(EMPTY_FORM);
    } else if (error) {
      setLoanError(error.message);
    }
    setSaving(false);
  }

  async function savePrepayment() {
    if (!selectedId || !prepForm.amount || !prepForm.date) return;
    setSavingPrep(true);
    setPrepError("");
    const { data, error } = await supabase.from("loan_prepayments").insert({
      loan_id: selectedId,
      user_id: userId,
      amount: parseFloat(prepForm.amount),
      date: prepForm.date,
      notes: prepForm.notes || null,
    }).select().single();
    if (!error && data) {
      setPrepayments((prev) => [...prev, data]);
      setShowAddPrep(false);
      setPrepForm({ amount: "", date: new Date().toISOString().split("T")[0], notes: "" });
    } else if (error) {
      setPrepError(error.message);
    }
    setSavingPrep(false);
  }

  async function deletePrepayment(id: string) {
    await supabase.from("loan_prepayments").delete().eq("id", id);
    setPrepayments((prev) => prev.filter((p) => p.id !== id));
  }

  async function deleteLoan(id: string) {
    if (!confirm("Delete this loan and all its prepayment records?")) return;
    await supabase.from("loans").delete().eq("id", id);
    setLoans((prev) => prev.filter((l) => l.id !== id));
    setSelectedId(loans.find((l) => l.id !== id)?.id || null);
  }

  function formatEMIDate(monthStr: string) {
    return new Date(monthStr + "-05T00:00:00").toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    });
  }

  const inputCls = "w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";
  const labelCls = "text-sm font-medium mb-1.5 block text-muted-foreground";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-700 mb-1">Loans</h1>
          <p className="text-muted-foreground text-sm">Track your home loan, amortisation &amp; prepayments</p>
        </div>
        <button
          onClick={() => { setShowAddLoan(true); setForm(EMPTY_FORM); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all"
        >
          <Plus className="w-4 h-4" /> Add Loan
        </button>
      </div>

      {/* Loan selector tabs */}
      {loans.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {loans.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelectedId(l.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                selectedId === l.id
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              {l.name}
            </button>
          ))}
          {selectedId && (
            <button
              onClick={() => { setPrepError(""); setShowAddPrep(true); }}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Add Prepayment
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {loans.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border/50 rounded-2xl p-16 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center mx-auto mb-4">
            <Home className="w-8 h-8 text-violet-500" />
          </div>
          <h3 className="font-display text-xl font-600 mb-2">No loans added yet</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
            Upload your amortization schedule PDF or enter loan details manually to start tracking.
          </p>
          <button
            onClick={() => setShowAddLoan(true)}
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all"
          >
            Add your first loan
          </button>
        </motion.div>
      )}

      {/* Loan detail */}
      {loan && stats && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "Outstanding balance",
                value: formatCurrency(stats.cur.balance),
                sub: `after ${formatEMIDate(stats.cur.date)} EMI`,
                sub2: `₹${(stats.principalPaid / 100000).toFixed(1)}L principal cleared`,
                color: "text-violet-600",
                bg: "bg-violet-50 dark:bg-violet-950/30",
                icon: Wallet,
              },
              {
                label: "EMIs paid",
                value: `${stats.emisPaid} / ${loan.tenure_months}`,
                sub: `${Math.round((stats.emisPaid / loan.tenure_months) * 100)}% of loan term done`,
                sub2: `₹${(stats.interestPaid / 100000).toFixed(1)}L interest paid so far`,
                color: "text-blue-600",
                bg: "bg-blue-50 dark:bg-blue-950/30",
                icon: Calendar,
              },
              {
                label: "Months remaining",
                value: String(stats.monthsLeft),
                sub: `of ${loan.tenure_months} total`,
                sub2: stats.nextRow
                  ? `Next EMI ${formatCurrency(stats.nextRow.emi)} on ${formatEMIDate(stats.nextRow.date)}`
                  : "Loan complete",
                color: "text-orange-500",
                bg: "bg-orange-50 dark:bg-orange-950/30",
                icon: Clock,
              },
              {
                label: "Interest saved",
                value: stats.interestSaved > 0 ? formatCurrency(stats.interestSaved) : "₹0",
                sub: stats.monthsSaved > 0 ? `${stats.monthsSaved} months early payoff` : "Add prepayments to save",
                sub2: stats.interestSaved > 0 ? `Total interest: ${formatCurrency(schedule.reduce((s, r) => s + r.interest, 0))}` : `Total interest: ${formatCurrency(schedule.reduce((s, r) => s + r.interest, 0))}`,
                color: stats.interestSaved > 0 ? "text-emerald-600" : "text-muted-foreground",
                bg: stats.interestSaved > 0 ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-secondary",
                icon: TrendingDown,
              },
            ].map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="bg-card border border-border/50 rounded-2xl p-5"
              >
                <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center mb-3`}>
                  <m.icon className={`w-5 h-5 ${m.color}`} />
                </div>
                <div className="number-font text-2xl font-600 mb-1">{m.value}</div>
                <div className="text-xs text-muted-foreground">{m.sub}</div>
                <div className="text-[11px] text-muted-foreground/60 mt-0.5">{m.sub2}</div>
              </motion.div>
            ))}
          </div>

          {/* Balance over time chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-card border border-border/50 rounded-2xl p-6"
          >
            <div className="mb-5">
              <h3 className="font-display text-base font-600">Outstanding balance over time</h3>
              <p className="text-xs text-muted-foreground">Includes effect of prepayments</p>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v.slice(2)} interval={Math.ceil(chartData.length / 8)} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `₹${v >= 100000 ? (v / 100000).toFixed(0) + "L" : (v / 1000).toFixed(0) + "k"}`} />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), "Outstanding"]}
                  contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))", fontSize: "12px" }}
                />
                <Area type="monotone" dataKey="balance" stroke="#7c3aed" strokeWidth={2} fill="url(#balGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* EMI breakdown chart + prepayments side by side */}
          <div className="grid lg:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-6"
            >
              <div className="mb-5">
                <h3 className="font-display text-base font-600">EMI breakdown</h3>
                <p className="text-xs text-muted-foreground">Interest vs principal (last 6 + next 6 months)</p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={emiChartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
                  <Tooltip
                    formatter={(v: number, n: string) => [formatCurrency(v), n === "interest" ? "Interest" : n === "principal" ? "Principal" : "Prepayment"]}
                    contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))", fontSize: "12px" }}
                  />
                  <Legend formatter={(v) => v === "interest" ? "Interest" : v === "principal" ? "Principal" : "Prepayment"} />
                  <Bar dataKey="interest" stackId="a" fill="#f97316" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="principal" stackId="a" fill="#7c3aed" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="prepayment" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Prepayments panel */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-card border border-border/50 rounded-2xl p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-base font-600">Prepayments</h3>
                  <p className="text-xs text-muted-foreground">{prepayments.filter(p => p.loan_id === selectedId).length} recorded</p>
                </div>
                <button
                  onClick={() => setShowAddPrep(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto max-h-44">
                {prepayments.filter(p => p.loan_id === selectedId).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No prepayments yet</p>
                ) : (
                  prepayments.filter(p => p.loan_id === selectedId).map((p) => (
                    <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary/50 group">
                      <div className="flex-1 min-w-0">
                        <div className="number-font text-sm font-600 text-emerald-600">{formatCurrency(p.amount)}</div>
                        <div className="text-[10px] text-muted-foreground">{new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                        {p.notes && <div className="text-[10px] text-muted-foreground truncate">{p.notes}</div>}
                      </div>
                      <button onClick={() => deletePrepayment(p.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
              {stats.interestSaved > 0 && (
                <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
                  <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Saving {formatCurrency(stats.interestSaved)} in interest</div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-500">{stats.monthsSaved} months early payoff</div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Amortization table */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border/50 rounded-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-600">Amortisation schedule</h3>
                <p className="text-xs text-muted-foreground">{schedule.length} monthly payments · {showAllRows ? "all" : "showing ±12 months from today"}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => deleteLoan(loan.id)}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Delete loan
                </button>
                <button
                  onClick={() => setShowAllRows(!showAllRows)}
                  className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                >
                  {showAllRows ? <><ChevronUp className="w-3.5 h-3.5" /> Collapse</> : <><ChevronDown className="w-3.5 h-3.5" /> Show all</>}
                </button>
              </div>
            </div>
            <div className="overflow-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card border-b border-border/50">
                  <tr className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Month</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-right">EMI</th>
                    <th className="px-4 py-3 text-right">Interest</th>
                    <th className="px-4 py-3 text-right">Principal</th>
                    <th className="px-4 py-3 text-right">Prepayment</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {visibleRows.map((row) => (
                    <tr
                      key={row.month}
                      ref={row.isCurrent ? currentRowRef : undefined}
                      className={`transition-colors ${
                        row.isCurrent
                          ? "bg-primary/8 border-l-2 border-primary"
                          : row.isPast
                          ? "opacity-50"
                          : "hover:bg-secondary/30"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          {row.isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                          {row.month}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatEMIDate(row.date)}</td>
                      <td className="px-4 py-3 text-right number-font">{formatCurrency(row.emi)}</td>
                      <td className="px-4 py-3 text-right number-font text-orange-600">{formatCurrency(row.interest)}</td>
                      <td className="px-4 py-3 text-right number-font text-violet-600">{formatCurrency(row.principal)}</td>
                      <td className="px-4 py-3 text-right number-font">
                        {row.prepayment > 0 ? (
                          <span className="text-emerald-600 font-600">{formatCurrency(row.prepayment)}</span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right number-font font-600">{formatCurrency(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!showAllRows && schedule.length > visibleRows.length && (
              <div className="px-6 py-3 border-t border-border/50 text-center">
                <button onClick={() => setShowAllRows(true)} className="text-xs text-primary font-medium hover:underline">
                  Show all {schedule.length} months
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* Add Loan Modal */}
      <AnimatePresence>
        {showAddLoan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowAddLoan(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-border/50">
                <h3 className="font-display text-lg font-600">Add Loan</h3>
                <button onClick={() => setShowAddLoan(false)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-4">
                    <div>
                      <label className={labelCls}>Loan name</label>
                      <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. HDFC Home Loan" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Loan amount (₹)</label>
                        <input className={inputCls} type="number" value={form.original_principal} onBlur={autoCalcEMI}
                          onChange={(e) => setForm({ ...form, original_principal: e.target.value })} placeholder="5000000" />
                      </div>
                      <div>
                        <label className={labelCls}>Interest rate (% p.a.)</label>
                        <input className={inputCls} type="number" step="0.05" value={form.interest_rate} onBlur={autoCalcEMI}
                          onChange={(e) => setForm({ ...form, interest_rate: e.target.value })} placeholder="8.5" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Tenure (months)</label>
                        <input className={inputCls} type="number" value={form.tenure_months} onBlur={autoCalcEMI}
                          onChange={(e) => setForm({ ...form, tenure_months: e.target.value })} placeholder="240" />
                      </div>
                      <div>
                        <label className={labelCls}>Start date (first EMI)</label>
                        <input className={inputCls} type="date" value={form.start_date}
                          onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Monthly EMI (₹) <span className="text-xs">(auto-calculated if blank)</span></label>
                      <input className={inputCls} type="number" value={form.emi_amount}
                        onChange={(e) => setForm({ ...form, emi_amount: e.target.value })} placeholder="Auto-calculated" />
                    </div>
                    {form.original_principal && form.interest_rate && form.tenure_months && (
                      <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl px-4 py-3">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        EMI: {formatCurrency(Math.round(calcEMI(parseFloat(form.original_principal), parseFloat(form.interest_rate), parseInt(form.tenure_months))))} / month
                      </div>
                    )}
                    {loanError && (
                      <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {loanError}
                      </div>
                    )}
                    <button
                      onClick={saveLoan}
                      disabled={saving || !form.original_principal || !form.interest_rate || !form.tenure_months || !form.start_date}
                      className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><IndianRupee className="w-4 h-4" /> Save loan</>}
                    </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Prepayment Modal */}
      <AnimatePresence>
        {showAddPrep && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowAddPrep(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-border/50">
                <h3 className="font-display text-lg font-600">Add Prepayment</h3>
                <button onClick={() => setShowAddPrep(false)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className={labelCls}>Prepayment amount (₹)</label>
                  <input className={inputCls} type="number" value={prepForm.amount}
                    onChange={(e) => setPrepForm({ ...prepForm, amount: e.target.value })} placeholder="100000" autoFocus />
                </div>
                <div>
                  <label className={labelCls}>Date</label>
                  <input className={inputCls} type="date" value={prepForm.date}
                    onChange={(e) => setPrepForm({ ...prepForm, date: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Notes (optional)</label>
                  <input className={inputCls} value={prepForm.notes}
                    onChange={(e) => setPrepForm({ ...prepForm, notes: e.target.value })} placeholder="e.g. Annual bonus" />
                </div>
                {prepForm.amount && loan && (
                  <div className="text-sm bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl px-4 py-3">
                    <div className="text-emerald-700 dark:text-emerald-400 font-medium text-xs mb-0.5">Estimated savings with this prepayment</div>
                    <div className="text-emerald-600 text-xs">
                      {(() => {
                        const withPrep = calculateAmortization(loan.original_principal, loan.interest_rate, loan.emi_amount, loan.start_date, [...loanPreps, { date: prepForm.date, amount: parseFloat(prepForm.amount) || 0 }]);
                        const withoutPrep = calculateAmortization(loan.original_principal, loan.interest_rate, loan.emi_amount, loan.start_date, loanPreps);
                        const saved = withoutPrep.reduce((s, r) => s + r.interest, 0) - withPrep.reduce((s, r) => s + r.interest, 0);
                        const months = withoutPrep.length - withPrep.length;
                        return `Save ~${formatCurrency(Math.round(saved))} in interest · ${months > 0 ? `${months} months earlier` : "no change yet"}`;
                      })()}
                    </div>
                  </div>
                )}
                {prepError && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {prepError}
                  </div>
                )}
                <button
                  onClick={savePrepayment}
                  disabled={savingPrep || !prepForm.amount || !prepForm.date}
                  className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {savingPrep ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save prepayment"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
