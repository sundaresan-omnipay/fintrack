"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PiggyBank, Plus, X, Loader2, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Saving, SAVING_TYPES } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const TYPE_ACCENT: Record<Saving["type"], { color: string; bg: string; border: string }> = {
  sip:     { color: "#10b981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.25)"  },
  lumpsum: { color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.25)"  },
  fd:      { color: "#3b82f6", bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.25)"  },
  ppf:     { color: "#8b5cf6", bg: "rgba(139,92,246,0.08)",  border: "rgba(139,92,246,0.25)"  },
  nps:     { color: "#f97316", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.25)"  },
  other:   { color: "#6b7280", bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.25)" },
};

interface Props {
  savings: Saving[];
  userId: string;
}

const EMPTY_FORM = { name: "", type: "sip" as Saving["type"], monthly_amount: "" };

export default function SavingsClient({ savings: initial, userId }: Props) {
  const supabase = createClient();
  const [savings, setSavings] = useState<Saving[]>(initial);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const totalMonthly = savings.filter((s) => s.is_active).reduce((sum, s) => sum + Number(s.monthly_amount), 0);

  async function handleSave() {
    if (!form.name.trim()) { setFormError("Name is required."); return; }
    const monthly = parseFloat(form.monthly_amount);
    if (!monthly || monthly <= 0) { setFormError("Enter a valid monthly amount."); return; }

    setSaving(true);
    setFormError("");

    const { data, error } = await supabase
      .from("savings")
      .insert({
        user_id: userId,
        name: form.name.trim(),
        type: form.type,
        monthly_amount: monthly,
        start_date: new Date().toISOString().split("T")[0],
        expected_return_rate: 12,
        is_active: true,
      })
      .select()
      .single();

    if (!error && data) {
      setSavings((prev) => [...prev, { ...data, monthly_amount: Number(data.monthly_amount) }]);
      setShowModal(false);
      setForm(EMPTY_FORM);
    } else if (error) {
      setFormError(
        error.message.includes("schema cache")
          ? "Table not found. Run supabase-fix-grants.sql and refresh."
          : error.message
      );
    }
    setSaving(false);
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from("savings").update({ is_active: !current }).eq("id", id);
    setSavings((prev) => prev.map((s) => s.id === id ? { ...s, is_active: !current } : s));
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this plan?")) return;
    await supabase.from("savings").delete().eq("id", id);
    setSavings((prev) => prev.filter((s) => s.id !== id));
  }

  const inputCls = "w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-700 mb-1">Savings &amp; Investments</h1>
          <p className="text-muted-foreground text-sm">Track your monthly SIP, FD, PPF and other savings</p>
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setFormError(""); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all"
        >
          <Plus className="w-4 h-4" /> Add Plan
        </button>
      </div>

      {/* Summary card */}
      {savings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border/50 rounded-2xl p-6 flex items-center gap-6"
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(16,185,129,0.1)" }}>
            <PiggyBank className="w-6 h-6" style={{ color: "#10b981" }} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total monthly savings</div>
            <div className="number-font text-3xl font-700" style={{ color: "#10b981" }}>{formatCurrency(totalMonthly)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              across {savings.filter((s) => s.is_active).length} active plan{savings.filter((s) => s.is_active).length !== 1 ? "s" : ""}
            </div>
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {savings.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border/50 rounded-2xl p-16 text-center"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "rgba(16,185,129,0.1)" }}>
            <PiggyBank className="w-8 h-8" style={{ color: "#10b981" }} />
          </div>
          <h3 className="font-display text-xl font-600 mb-2">No savings plans yet</h3>
          <p className="text-muted-foreground text-sm mb-6">Add your SIPs, FDs, PPF etc. to track how much you save each month.</p>
          <button
            onClick={() => { setForm(EMPTY_FORM); setFormError(""); setShowModal(true); }}
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all"
          >
            Add your first plan
          </button>
        </motion.div>
      )}

      {/* Plans list */}
      {savings.length > 0 && (
        <div className="space-y-3">
          {savings.map((s, i) => {
            const accent = TYPE_ACCENT[s.type];
            const meta = SAVING_TYPES[s.type];
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card border border-border/50 rounded-2xl px-5 py-4 flex items-center gap-4 group"
                style={{ opacity: s.is_active ? 1 : 0.55 }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: accent.bg }}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{s.name}</div>
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full border mt-1 inline-block"
                    style={{ background: accent.bg, color: accent.color, borderColor: accent.border }}
                  >
                    {meta.label}
                  </span>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="number-font text-base font-600">{formatCurrency(Number(s.monthly_amount))}</div>
                  <div className="text-xs text-muted-foreground">per month</div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                  <button
                    onClick={() => toggleActive(s.id, s.is_active)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    {s.is_active ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Plan Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-border/50">
                <h3 className="font-display text-lg font-600">Add Savings Plan</h3>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Name</label>
                  <input
                    className={inputCls}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Parag Parikh SIP, HDFC FD"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block text-muted-foreground">Type</label>
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
                            : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
                        >
                          <span>{SAVING_TYPES[key].icon}</span>
                          {SAVING_TYPES[key].label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Monthly amount (₹)</label>
                  <input
                    className={inputCls + " number-font"}
                    type="number"
                    min="1"
                    value={form.monthly_amount}
                    onChange={(e) => setForm({ ...form, monthly_amount: e.target.value })}
                    placeholder="5000"
                  />
                </div>
                {formError && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Save plan</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
