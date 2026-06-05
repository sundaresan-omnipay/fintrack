"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X, Paperclip, FileImage, FileText, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, CATEGORY_META } from "@/types";
import { motion, AnimatePresence } from "framer-motion";

export default function AddTransactionButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    description: "",
    amount: "",
    category: "food" as string,
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("File must be under 5 MB");
      return;
    }
    setReceiptFile(file);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated"); setLoading(false); return; }

    const { data: tx, error: insertErr } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        description: form.description,
        amount: parseFloat(form.amount),
        category: form.category,
        date: form.date,
        notes: form.notes || null,
      })
      .select("id")
      .single();

    if (insertErr || !tx) {
      setError(insertErr?.message || "Failed to save transaction");
      setLoading(false);
      return;
    }

    // Upload receipt if selected
    if (receiptFile) {
      const ext = receiptFile.name.split(".").pop();
      const path = `${user.id}/${tx.id}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("receipts")
        .upload(path, receiptFile, { upsert: true });

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
        await supabase
          .from("transactions")
          .update({ receipt_url: urlData.publicUrl })
          .eq("id", tx.id);
      }
    }

    setOpen(false);
    setForm({ description: "", amount: "", category: "food", date: new Date().toISOString().split("T")[0], notes: "" });
    setReceiptFile(null);
    router.refresh();
    setLoading(false);
  }

  function handleClose() {
    setOpen(false);
    setReceiptFile(null);
    setError("");
  }

  const isPdf = receiptFile?.type === "application/pdf";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all hover:-translate-y-0.5"
      >
        <Plus className="w-4 h-4" />
        Add transaction
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={handleClose}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-600">Add transaction</h2>
                <button onClick={handleClose} className="p-2 rounded-lg hover:bg-secondary transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Description</label>
                  <input
                    type="text"
                    required
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    placeholder="e.g. Lunch at Swiggy"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Amount (₹)</label>
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
                    <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Date</label>
                    <input
                      type="date"
                      required
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Category</label>
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

                <div>
                  <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Notes (optional)</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    placeholder="Any extra details..."
                  />
                </div>

                {/* Receipt upload */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                    Attach bill / receipt <span className="text-xs font-normal">(optional, image or PDF, max 5 MB)</span>
                  </label>
                  {receiptFile ? (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/40 bg-primary/5">
                      {isPdf
                        ? <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                        : <FileImage className="w-5 h-5 text-primary flex-shrink-0" />}
                      <span className="text-sm text-foreground truncate flex-1">{receiptFile.name}</span>
                      <span className="text-xs text-muted-foreground">{(receiptFile.size / 1024).toFixed(0)} KB</span>
                      <button
                        type="button"
                        onClick={() => { setReceiptFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-dashed border-border bg-secondary/30 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-secondary/50 transition-all"
                    >
                      <Paperclip className="w-4 h-4" />
                      Click to attach bill or receipt
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>

                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2.5">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
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
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save transaction"}
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
