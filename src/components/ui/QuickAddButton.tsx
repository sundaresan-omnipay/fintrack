"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, CATEGORY_META } from "@/types";
import { motion, AnimatePresence } from "framer-motion";

export default function QuickAddButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    amount: "",
    description: "",
    category: "food" as string,
    date: new Date().toISOString().split("T")[0],
  });

  function handleClose() {
    setOpen(false);
    setError("");
    setForm({
      amount: "",
      description: "",
      category: "food",
      date: new Date().toISOString().split("T")[0],
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const { error: err } = await supabase.from("transactions").insert({
      user_id: user.id,
      description: form.description,
      amount: parseFloat(form.amount),
      category: form.category,
      date: form.date,
    });

    if (err) {
      setError(err.message);
    } else {
      handleClose();
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <>
      <motion.button
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center hover:bg-primary/90 hover:scale-105 transition-transform"
        aria-label="Quick add transaction"
      >
        <Plus className="w-6 h-6" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={handleClose}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              transition={{ type: "spring", damping: 26, stiffness: 340 }}
              className="relative bg-card border border-border rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6 pb-8 sm:pb-6"
            >
              {/* Drag handle (mobile) */}
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5 sm:hidden" />

              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-lg font-600">Quick add</h2>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Amount — first and largest */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    autoFocus
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full h-12 px-4 rounded-xl border border-border bg-secondary/50 text-lg number-font focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    placeholder="0"
                  />
                </div>

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
                    placeholder="e.g. Lunch at Swiggy"
                  />
                </div>

                {/* Category grid */}
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

                {/* Date */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                    Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      type="date"
                      required
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2.5">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 h-11 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
