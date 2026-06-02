"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  Loader2,
  X,
  RefreshCw,
  CheckCircle2,
  CalendarClock,
  Zap,
} from "lucide-react";
import { RecurringTransaction, Transaction, Category, CATEGORY_META, CATEGORIES } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface Props {
  recurring: RecurringTransaction[];
  currentMonthTxns: Transaction[];
  userId: string;
  currentMonth: string; // YYYY-MM
}

const defaultForm = {
  description: "",
  amount: "",
  category: "bills" as Category,
  day_of_month: "1",
  notes: "",
};

function ordinalDay(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export default function RecurringClient({
  recurring: initialRecurring,
  currentMonthTxns,
  userId,
  currentMonth,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [recurring, setRecurring] = useState<RecurringTransaction[]>(initialRecurring);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  // ---------- derived stats ----------
  const activeItems = recurring.filter((r) => r.is_active);
  const monthlyTotal = activeItems.reduce((s, r) => s + r.amount, 0);

  const postedDescriptions = new Set(
    currentMonthTxns.map((t) => t.description.toLowerCase())
  );

  const nextUp = activeItems
    .filter((r) => !postedDescriptions.has(r.description.toLowerCase()))
    .sort((a, b) => a.day_of_month - b.day_of_month)[0];

  // ---------- generate this month ----------
  async function generateThisMonth() {
    setGenerating(true);
    setGenerateMsg("");

    let created = 0;

    for (const item of activeItems) {
      const alreadyPosted = postedDescriptions.has(item.description.toLowerCase());
      if (alreadyPosted) continue;

      const day = String(item.day_of_month).padStart(2, "0");
      const date = `${currentMonth}-${day}`;

      const { error } = await supabase.from("transactions").insert({
        user_id: userId,
        description: item.description,
        amount: item.amount,
        category: item.category,
        date,
        notes: item.notes || null,
      });

      if (!error) created++;
    }

    if (created > 0) {
      setGenerateMsg(`Created ${created} transaction${created !== 1 ? "s" : ""}`);
      router.refresh();
    } else {
      setGenerateMsg("All already posted");
    }

    setGenerating(false);
    setTimeout(() => setGenerateMsg(""), 4000);
  }

  // ---------- add recurring ----------
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    const day = parseInt(form.day_of_month, 10);
    if (isNaN(day) || day < 1 || day > 28) {
      setFormError("Day of month must be between 1 and 28.");
      setSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("recurring_transactions")
      .insert({
        user_id: userId,
        description: form.description,
        amount: parseFloat(form.amount),
        category: form.category,
        day_of_month: day,
        is_active: true,
        notes: form.notes || null,
      })
      .select()
      .single();

    if (error) {
      setFormError(error.message);
      setSaving(false);
      return;
    }

    setRecurring((prev) => [data, ...prev]);
    setForm(defaultForm);
    setAddOpen(false);
    setSaving(false);
  }

  // ---------- toggle active ----------
  async function toggleActive(item: RecurringTransaction) {
    // optimistic update
    setRecurring((prev) =>
      prev.map((r) => (r.id === item.id ? { ...r, is_active: !r.is_active } : r))
    );

    const { error } = await supabase
      .from("recurring_transactions")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);

    if (error) {
      // revert on failure
      setRecurring((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, is_active: item.is_active } : r))
      );
    }
  }

  // ---------- delete ----------
  async function handleDelete(item: RecurringTransaction) {
    const confirmed = window.confirm(
      `Delete "${item.description}"? This only removes the recurring rule — existing transactions are unaffected.`
    );
    if (!confirmed) return;

    setDeleting(item.id);
    await supabase.from("recurring_transactions").delete().eq("id", item.id);
    setRecurring((prev) => prev.filter((r) => r.id !== item.id));
    setDeleting(null);
  }

  // ---------- render ----------
  return (
    <>
      {/* ── Add Modal ── */}
      <AnimatePresence>
        {addOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setAddOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18 }}
              className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 overflow-y-auto max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-600">Add Recurring</h2>
                <button
                  onClick={() => setAddOpen(false)}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAdd} className="space-y-4">
                {/* Description */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                    Description
                  </label>
                  <input
                    type="text"
                    required
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    placeholder="e.g. Netflix, Rent, Insurance"
                  />
                </div>

                {/* Amount + Day */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                      Amount (₹)
                    </label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                      Day of month (1–28)
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={28}
                      value={form.day_of_month}
                      onChange={(e) => setForm({ ...form, day_of_month: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all number-font"
                      placeholder="1"
                    />
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                    Category
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {CATEGORIES.map((cat) => {
                      const meta = CATEGORY_META[cat];
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setForm({ ...form, category: cat })}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                            form.category === cat
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          <span>{meta.icon}</span>
                          <span className="truncate">{meta.label.split(" ")[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                    Notes (optional)
                  </label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    placeholder="Any extra details..."
                  />
                </div>

                {formError && (
                  <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2.5">
                    {formError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setAddOpen(false)}
                    className="flex-1 h-11 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Main content ── */}
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl font-700 mb-1">Recurring</h1>
            <p className="text-muted-foreground text-sm">Monthly bills, rent, subscriptions</p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            Add Recurring
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {/* Active count */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
            className="bg-card border border-border/50 rounded-2xl p-5"
          >
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Active</div>
            <div className="number-font text-2xl font-600 text-foreground">
              {activeItems.length}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {recurring.length - activeItems.length} paused
            </div>
          </motion.div>

          {/* Monthly total */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="bg-card border border-border/50 rounded-2xl p-5"
          >
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
              Monthly total
            </div>
            <div className="number-font text-2xl font-600 text-violet-600 dark:text-violet-400">
              {formatCurrency(monthlyTotal)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">active items only</div>
          </motion.div>

          {/* Next up */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="bg-card border border-border/50 rounded-2xl p-5"
          >
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Next up</div>
            {nextUp ? (
              <>
                <div className="text-sm font-medium truncate">{nextUp.description}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {ordinalDay(nextUp.day_of_month)} · {formatCurrency(nextUp.amount)}
                </div>
              </>
            ) : (
              <div className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                All posted
              </div>
            )}
          </motion.div>
        </div>

        {/* Post this month card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="bg-card border border-border/50 rounded-2xl p-5 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <CalendarClock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium">Post this month</div>
              <div className="text-xs text-muted-foreground">
                Instantly create transactions for all active recurring items
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {generateMsg && (
              <motion.span
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                className={`text-xs font-medium ${
                  generateMsg.startsWith("All")
                    ? "text-muted-foreground"
                    : "text-emerald-600"
                }`}
              >
                {generateMsg.startsWith("Created") && (
                  <CheckCircle2 className="inline w-3.5 h-3.5 mr-1" />
                )}
                {generateMsg}
              </motion.span>
            )}
            <button
              onClick={generateThisMonth}
              disabled={generating || activeItems.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Generate this month&apos;s transactions
            </button>
          </div>
        </motion.div>

        {/* Recurring list */}
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-600">Recurring items</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {recurring.length} item{recurring.length !== 1 ? "s" : ""} total
              </p>
            </div>
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </div>

          {recurring.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <div className="text-3xl mb-3">🔄</div>
              <p className="text-sm font-medium">No recurring items yet</p>
              <p className="text-xs mt-1">Add your first bill or subscription above</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {recurring.map((item, i) => {
                const meta = CATEGORY_META[item.category];
                const isPostedThisMonth = postedDescriptions.has(
                  item.description.toLowerCase()
                );

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-secondary/30 transition-colors group"
                  >
                    {/* Category icon */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: meta?.lightColor }}
                    >
                      {meta?.icon}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{item.description}</span>
                        {isPostedThisMonth && (
                          <span className="flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            posted
                          </span>
                        )}
                        {!item.is_active && (
                          <span className="flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                            paused
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Every {ordinalDay(item.day_of_month)} of the month
                        {item.notes && ` · ${item.notes}`}
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="number-font font-600 text-lg min-w-24 text-right">
                      {formatCurrency(item.amount)}
                    </div>

                    {/* Toggle */}
                    <button
                      onClick={() => toggleActive(item)}
                      aria-label={item.is_active ? "Pause" : "Resume"}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                        item.is_active
                          ? "bg-primary"
                          : "bg-secondary border border-border"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          item.is_active ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={deleting === item.id}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    >
                      {deleting === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
