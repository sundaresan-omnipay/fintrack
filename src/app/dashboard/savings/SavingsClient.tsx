"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PiggyBank, Plus, X, Loader2, Trash2,
  TrendingUp, IndianRupee, CalendarDays, AlertTriangle, Edit2, Check,
} from "lucide-react";
import { Saving, SAVING_TYPES } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeSaving(s: Saving): Saving {
  return { ...s, monthly_amount: Number(s.monthly_amount), expected_return_rate: Number(s.expected_return_rate) };
}

function monthsSince(startDate: string): number {
  const start = new Date(startDate + "T00:00:00");
  const now = new Date();
  return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
}

function calcProjection(monthlyAmount: number, annualRate: number, months: number) {
  const invested = monthlyAmount * months;
  if (months === 0) return { invested: 0, projected: 0, returns: 0 };
  const r = annualRate / 12 / 100;
  if (r === 0) return { invested, projected: invested, returns: 0 };
  const projected = Math.round(monthlyAmount * ((Math.pow(1 + r, months) - 1) / r) * (1 + r));
  return { invested, projected, returns: projected - invested };
}

// ---------------------------------------------------------------------------
// Type accent colours — inline style only (avoids Tailwind dark: issues)
// ---------------------------------------------------------------------------

const TYPE_ACCENT: Record<Saving["type"], { color: string; bg: string; border: string }> = {
  sip:     { color: "#10b981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.25)"  },
  lumpsum: { color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.25)"  },
  fd:      { color: "#3b82f6", bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.25)"  },
  ppf:     { color: "#8b5cf6", bg: "rgba(139,92,246,0.08)",  border: "rgba(139,92,246,0.25)"  },
  nps:     { color: "#f97316", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.25)"  },
  other:   { color: "#6b7280", bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.25)" },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  savings: Saving[];
  userId: string;
}

const TODAY = new Date().toISOString().split("T")[0];

const EMPTY_FORM = {
  name: "",
  type: "sip" as Saving["type"],
  monthly_amount: "",
  start_date: TODAY,
  expected_return_rate: "12",
  notes: "",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SavingsClient({ savings: initial, userId }: Props) {
  const supabase = createClient();

  const [savings, setSavings] = useState<Saving[]>(initial.map(normalizeSaving));
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState("");

  // ---------------------------------------------------------------------------
  // Top-level stats
  // ---------------------------------------------------------------------------

  const stats = useMemo(() => {
    let totalInvested = 0;
    let totalProjected = 0;
    let monthlyCommitment = 0;
    let activePlans = 0;

    for (const s of savings) {
      if (!s.is_active) continue;
      activePlans++;
      const months = monthsSince(s.start_date);
      const proj = calcProjection(s.monthly_amount, s.expected_return_rate, months);
      totalInvested += proj.invested;
      totalProjected += proj.projected;
      monthlyCommitment += s.monthly_amount;
    }

    return { totalInvested, totalProjected, totalReturns: totalProjected - totalInvested, monthlyCommitment, activePlans };
  }, [savings]);

  // ---------------------------------------------------------------------------
  // Add plan
  // ---------------------------------------------------------------------------

  async function handleSave() {
    const monthly = parseFloat(form.monthly_amount);
    const rate = parseFloat(form.expected_return_rate);

    if (!form.name.trim()) { setFormError("Plan name is required."); return; }
    if (!monthly || monthly <= 0) { setFormError("Enter a valid monthly amount."); return; }
    if (!form.start_date) { setFormError("Start date is required."); return; }

    setSaving(true);
    setFormError("");

    const { data, error } = await supabase
      .from("savings")
      .insert({
        user_id: userId,
        name: form.name.trim(),
        type: form.type,
        monthly_amount: monthly,
        start_date: form.start_date,
        expected_return_rate: rate || 12,
        is_active: true,
        notes: form.notes.trim() || null,
      })
      .select()
      .single();

    if (!error && data) {
      setSavings((prev) => [...prev, normalizeSaving(data)]);
      setShowModal(false);
      setForm(EMPTY_FORM);
    } else if (error) {
      setFormError(error.message);
    }

    setSaving(false);
  }

  // ---------------------------------------------------------------------------
  // Toggle active
  // ---------------------------------------------------------------------------

  async function toggleActive(id: string, current: boolean) {
    await supabase.from("savings").update({ is_active: !current }).eq("id", id);
    setSavings((prev) => prev.map((s) => s.id === id ? { ...s, is_active: !current } : s));
  }

  // ---------------------------------------------------------------------------
  // Update return rate inline
  // ---------------------------------------------------------------------------

  async function saveRate(id: string) {
    const rate = parseFloat(rateInput);
    if (!rate || rate <= 0 || rate > 50) return;
    await supabase.from("savings").update({ expected_return_rate: rate }).eq("id", id);
    setSavings((prev) => prev.map((s) => s.id === id ? { ...s, expected_return_rate: rate } : s));
    setEditingRate(null);
  }

  // ---------------------------------------------------------------------------
  // Delete plan
  // ---------------------------------------------------------------------------

  async function handleDelete(id: string) {
    if (!confirm("Delete this savings plan? This cannot be undone.")) return;
    await supabase.from("savings").delete().eq("id", id);
    setSavings((prev) => prev.filter((s) => s.id !== id));
  }

  // ---------------------------------------------------------------------------
  // Shared input style
  // ---------------------------------------------------------------------------

  const inputCls = "w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";
  const labelCls = "text-sm font-medium mb-1.5 block text-muted-foreground";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-700 mb-1">Savings &amp; Investments</h1>
          <p className="text-muted-foreground text-sm">Track your SIPs, FDs, PPF and other investment plans</p>
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setFormError(""); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all"
        >
          <Plus className="w-4 h-4" /> Add Plan
        </button>
      </div>

      {/* ---- Top stats ---- */}
      {savings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }} className="bg-card border border-border/50 rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(139,92,246,0.1)" }}>
              <IndianRupee className="w-5 h-5" style={{ color: "#8b5cf6" }} />
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Invested</div>
            <div className="number-font text-2xl font-600">{formatCurrency(stats.totalInvested)}</div>
            <div className="text-xs text-muted-foreground mt-1">across {stats.activePlans} active plan{stats.activePlans !== 1 ? "s" : ""}</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }} className="bg-card border border-border/50 rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(16,185,129,0.1)" }}>
              <TrendingUp className="w-5 h-5" style={{ color: "#10b981" }} />
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Projected Value</div>
            <div className="number-font text-2xl font-600" style={{ color: "#10b981" }}>{formatCurrency(stats.totalProjected)}</div>
            <div className="text-xs mt-1" style={{ color: "#10b981" }}>+{formatCurrency(stats.totalReturns)} est. returns</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="bg-card border border-border/50 rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(59,130,246,0.1)" }}>
              <CalendarDays className="w-5 h-5" style={{ color: "#3b82f6" }} />
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Monthly SIP</div>
            <div className="number-font text-2xl font-600">{formatCurrency(stats.monthlyCommitment)}</div>
            <div className="text-xs text-muted-foreground mt-1">per month commitment</div>
          </motion.div>
        </div>
      )}

      {/* ---- Empty state ---- */}
      {savings.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border/50 rounded-2xl p-16 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(16,185,129,0.1)" }}>
            <PiggyBank className="w-8 h-8" style={{ color: "#10b981" }} />
          </div>
          <h3 className="font-display text-xl font-600 mb-2">No savings plans yet</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
            Add your existing SIPs, fixed deposits, PPF and other investments. Just enter the start date and monthly amount.
          </p>
          <button
            onClick={() => { setForm(EMPTY_FORM); setFormError(""); setShowModal(true); }}
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all"
          >
            Add your first plan
          </button>
        </motion.div>
      )}

      {/* ---- Savings grid ---- */}
      {savings.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {savings.map((s, i) => {
            const months = monthsSince(s.start_date);
            const proj = calcProjection(s.monthly_amount, s.expected_return_rate, months);
            const returnPct = proj.invested > 0 ? ((proj.returns / proj.invested) * 100).toFixed(1) : "0.0";
            const accent = TYPE_ACCENT[s.type];
            const meta = SAVING_TYPES[s.type];

            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-card border border-border/50 rounded-2xl p-5 group relative"
                style={{ opacity: s.is_active ? 1 : 0.6 }}
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: accent.bg }}>
                      {meta.icon}
                    </div>
                    <div>
                      <div className="font-medium text-sm leading-tight">{s.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
                          style={{ background: accent.bg, color: accent.color, borderColor: accent.border }}
                        >
                          {meta.label}
                        </span>
                        {!s.is_active && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">Paused</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons — visible on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => toggleActive(s.id, s.is_active)}
                      className="p-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
                      title={s.is_active ? "Pause" : "Resume"}
                    >
                      {s.is_active ? "Pause" : "Resume"}
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                      title="Delete plan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Key numbers */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Invested so far</div>
                    <div className="number-font text-lg font-600">{formatCurrency(proj.invested)}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {months === 0 ? "Starting this month" : `${months} month${months !== 1 ? "s" : ""} · ₹${s.monthly_amount.toLocaleString("en-IN")}/mo`}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-0.5">Projected value</div>
                    <div className="number-font text-lg font-600" style={{ color: "#10b981" }}>{formatCurrency(proj.projected)}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: "#10b981" }}>
                      +{formatCurrency(proj.returns)} ({returnPct}%)
                    </div>
                  </div>
                </div>

                {/* Timeline bar — months elapsed */}
                <div className="mb-3">
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, months * 2)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.06 }}
                      className="h-full rounded-full"
                      style={{ background: accent.color }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-muted-foreground">
                      {months} month{months !== 1 ? "s" : ""} in
                    </span>
                    {/* Inline rate editor */}
                    {editingRate === s.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={rateInput}
                          onChange={(e) => setRateInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveRate(s.id)}
                          className="w-14 h-5 px-1.5 text-[10px] rounded border border-border bg-secondary/50 number-font text-right focus:outline-none"
                          autoFocus
                        />
                        <span className="text-[10px] text-muted-foreground">% p.a.</span>
                        <button onClick={() => saveRate(s.id)} className="p-0.5 text-emerald-600">
                          <Check className="w-3 h-3" />
                        </button>
                        <button onClick={() => setEditingRate(null)} className="p-0.5 text-muted-foreground">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingRate(s.id); setRateInput(String(s.expected_return_rate)); }}
                        className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border hover:bg-secondary transition-colors"
                        style={{ color: accent.color, borderColor: accent.border, background: accent.bg }}
                      >
                        {s.expected_return_rate}% p.a.
                        <Edit2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ---- Add Plan Modal ---- */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between p-6 border-b border-border/50">
                <div>
                  <h3 className="font-display text-lg font-600">Record Investment Plan</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Already investing? Enter the start date — we&apos;ll calculate what you&apos;ve built up so far.
                  </p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-6 space-y-4">
                {/* Plan name */}
                <div>
                  <label className={labelCls}>Plan / Fund name</label>
                  <input
                    className={inputCls}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Parag Parikh Flexi Cap"
                    autoFocus
                  />
                </div>

                {/* Type selector */}
                <div>
                  <label className={labelCls}>Investment type</label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(SAVING_TYPES) as Saving["type"][]).map((key) => {
                      const active = form.type === key;
                      const a = TYPE_ACCENT[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setForm({ ...form, type: key })}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all"
                          style={active
                            ? { background: a.bg, color: a.color, borderColor: a.border }
                            : {}}
                        >
                          <span>{SAVING_TYPES[key].icon}</span>
                          {SAVING_TYPES[key].label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Monthly amount + start date */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Monthly amount (₹)</label>
                    <input
                      className={inputCls}
                      type="number"
                      min="1"
                      value={form.monthly_amount}
                      onChange={(e) => setForm({ ...form, monthly_amount: e.target.value })}
                      placeholder="5000"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>SIP start date</label>
                    <input
                      className={inputCls}
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    />
                  </div>
                </div>

                {/* Return rate */}
                <div>
                  <label className={labelCls}>Expected return rate (% p.a.)</label>
                  <input
                    className={inputCls}
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    value={form.expected_return_rate}
                    onChange={(e) => setForm({ ...form, expected_return_rate: e.target.value })}
                    placeholder="12"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Typical: SIP 12%, FD 7%, PPF 7.1%</p>
                </div>

                {/* Notes */}
                <div>
                  <label className={labelCls}>Notes (optional)</label>
                  <input
                    className={inputCls}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="e.g. HDFC AMC, DEMAT no. 12345"
                  />
                </div>

                {/* Live projection preview */}
                {form.monthly_amount && parseFloat(form.monthly_amount) > 0 && form.start_date && (
                  <div className="rounded-xl border p-4" style={{ background: "rgba(16,185,129,0.06)", borderColor: "rgba(16,185,129,0.2)" }}>
                    {(() => {
                      const months = monthsSince(form.start_date);
                      const proj = calcProjection(
                        parseFloat(form.monthly_amount),
                        parseFloat(form.expected_return_rate) || 12,
                        Math.max(1, months)
                      );
                      return (
                        <div className="space-y-1.5">
                          <div className="text-xs font-medium mb-2" style={{ color: "#10b981" }}>
                            {months > 0 ? `Based on ${months} months since start date` : "Starting fresh"}
                          </div>
                          <div className="flex justify-between text-xs" style={{ color: "#059669" }}>
                            <span>Invested ({Math.max(1, months)} months)</span>
                            <span className="number-font font-600">{formatCurrency(proj.invested)}</span>
                          </div>
                          <div className="flex justify-between text-xs" style={{ color: "#059669" }}>
                            <span>Projected value</span>
                            <span className="number-font font-600">{formatCurrency(proj.projected)}</span>
                          </div>
                          <div className="flex justify-between text-xs" style={{ color: "#10b981" }}>
                            <span>Est. returns</span>
                            <span className="number-font font-600">+{formatCurrency(proj.returns)}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Error */}
                {formError && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {formError}
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><PiggyBank className="w-4 h-4" /> Save plan</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
