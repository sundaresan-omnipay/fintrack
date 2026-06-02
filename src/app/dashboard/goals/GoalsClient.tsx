"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Trophy,
  Loader2,
  CalendarDays,
  Target,
  PiggyBank,
  Wallet,
} from "lucide-react";
import { Goal, GOAL_CATEGORIES } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  goals: Goal[];
  userId: string;
}

interface AddGoalForm {
  name: string;
  category: string;
  target_amount: string;
  target_date: string;
  notes: string;
}

const EMPTY_ADD_FORM: AddGoalForm = {
  name: "",
  category: "emergency_fund",
  target_amount: "",
  target_date: "",
  notes: "",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon,
  color,
  delay,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-card border border-border/50 rounded-2xl p-5"
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
        <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
          {label}
        </span>
      </div>
      <div className="number-font text-2xl font-semibold">{value}</div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function GoalsClient({ goals: initialGoals, userId }: Props) {
  const supabase = createClient();

  const [goals, setGoals] = useState<Goal[]>(initialGoals);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [addGoalForm, setAddGoalForm] = useState<AddGoalForm>(EMPTY_ADD_FORM);
  const [addFundsAmount, setAddFundsAmount] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);
  const [savingFunds, setSavingFunds] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);

  // Derived lists
  const activeGoals = useMemo(() => goals.filter((g) => !g.is_completed), [goals]);
  const completedGoals = useMemo(() => goals.filter((g) => g.is_completed), [goals]);

  // Stats
  const totalSaved = useMemo(
    () => goals.reduce((s, g) => s + g.current_amount, 0),
    [goals]
  );
  const totalTarget = useMemo(
    () => goals.reduce((s, g) => s + g.target_amount, 0),
    [goals]
  );

  // -------------------------------------------------------------------------
  // Add Goal
  // -------------------------------------------------------------------------

  async function handleAddGoal() {
    const amount = parseFloat(addGoalForm.target_amount);
    if (!addGoalForm.name.trim() || isNaN(amount) || amount <= 0) return;

    const catMeta = GOAL_CATEGORIES[addGoalForm.category];
    setSavingGoal(true);

    const payload: Omit<Goal, "id" | "created_at"> = {
      user_id: userId,
      name: addGoalForm.name.trim(),
      category: addGoalForm.category,
      target_amount: amount,
      current_amount: 0,
      target_date: addGoalForm.target_date || undefined,
      notes: addGoalForm.notes.trim() || undefined,
      icon: catMeta.icon,
      color: catMeta.color,
      is_completed: false,
    };

    const { data, error } = await supabase
      .from("goals")
      .insert(payload)
      .select()
      .single();

    if (!error && data) {
      setGoals((prev) => [data as Goal, ...prev]);
    }

    setSavingGoal(false);
    setShowAddGoal(false);
    setAddGoalForm(EMPTY_ADD_FORM);
  }

  // -------------------------------------------------------------------------
  // Add Funds
  // -------------------------------------------------------------------------

  async function handleAddFunds() {
    if (!selectedGoal) return;
    const amount = parseFloat(addFundsAmount);
    if (isNaN(amount) || amount <= 0) return;

    setSavingFunds(true);
    const newAmount = selectedGoal.current_amount + amount;
    const nowComplete = newAmount >= selectedGoal.target_amount;

    const updates: Partial<Goal> = { current_amount: newAmount };
    if (nowComplete) updates.is_completed = true;

    const { error } = await supabase
      .from("goals")
      .update(updates)
      .eq("id", selectedGoal.id);

    if (!error) {
      setGoals((prev) =>
        prev.map((g) =>
          g.id === selectedGoal.id ? { ...g, ...updates } : g
        )
      );
    }

    setSavingFunds(false);
    setShowAddFunds(false);
    setSelectedGoal(null);
    setAddFundsAmount("");
  }

  // -------------------------------------------------------------------------
  // Complete goal
  // -------------------------------------------------------------------------

  async function handleComplete(goal: Goal) {
    setCompletingId(goal.id);
    const { error } = await supabase
      .from("goals")
      .update({ is_completed: true })
      .eq("id", goal.id);

    if (!error) {
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goal.id ? { ...g, is_completed: true } : g
        )
      );
    }
    setCompletingId(null);
  }

  // -------------------------------------------------------------------------
  // Delete goal
  // -------------------------------------------------------------------------

  async function handleDelete(goal: Goal) {
    if (!window.confirm(`Delete "${goal.name}"? This cannot be undone.`)) return;
    setDeletingId(goal.id);

    const { error } = await supabase.from("goals").delete().eq("id", goal.id);
    if (!error) {
      setGoals((prev) => prev.filter((g) => g.id !== goal.id));
    }
    setDeletingId(null);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold mb-1">Goals</h1>
          <p className="text-muted-foreground text-sm">Track your financial milestones</p>
        </div>
        <button
          onClick={() => setShowAddGoal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Add Goal
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Active Goals"
          value={activeGoals.length}
          icon={<Target className="w-4 h-4" />}
          color="#7c3aed"
          delay={0}
        />
        <StatCard
          label="Total Saved"
          value={formatCurrency(totalSaved)}
          icon={<PiggyBank className="w-4 h-4" />}
          color="#22c55e"
          delay={0.06}
        />
        <StatCard
          label="Total Target"
          value={formatCurrency(totalTarget)}
          icon={<Wallet className="w-4 h-4" />}
          color="#06b6d4"
          delay={0.12}
        />
      </div>

      {/* Active goals grid */}
      {activeGoals.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card border border-border/50 rounded-2xl p-12 text-center"
        >
          <div className="text-5xl mb-4">🎯</div>
          <p className="text-muted-foreground">No active goals yet. Add one to start saving!</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {activeGoals.map((goal, i) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                index={i}
                onAddFunds={() => {
                  setSelectedGoal(goal);
                  setAddFundsAmount("");
                  setShowAddFunds(true);
                }}
                onComplete={() => handleComplete(goal)}
                onDelete={() => handleDelete(goal)}
                isDeleting={deletingId === goal.id}
                isCompleting={completingId === goal.id}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Completed goals */}
      {completedGoals.length > 0 && (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
          <button
            onClick={() => setCompletedOpen((o) => !o)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-secondary/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span className="font-medium text-sm">
                Completed ({completedGoals.length})
              </span>
            </div>
            {completedOpen ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          <AnimatePresence>
            {completedOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="divide-y divide-border/50">
                  {completedGoals.map((goal) => (
                    <div
                      key={goal.id}
                      className="px-6 py-3 flex items-center gap-3"
                    >
                      <span className="text-lg">{goal.icon}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm line-through text-muted-foreground">
                          {goal.name}
                        </span>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(goal.target_amount)} saved
                        </div>
                      </div>
                      <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <button
                        onClick={() => handleDelete(goal)}
                        disabled={deletingId === goal.id}
                        className="text-muted-foreground hover:text-destructive transition-colors ml-2"
                      >
                        {deletingId === goal.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Add Goal Modal */}
      <AnimatePresence>
        {showAddGoal && (
          <AddGoalModal
            form={addGoalForm}
            onChange={setAddGoalForm}
            onSave={handleAddGoal}
            onClose={() => {
              setShowAddGoal(false);
              setAddGoalForm(EMPTY_ADD_FORM);
            }}
            saving={savingGoal}
          />
        )}
      </AnimatePresence>

      {/* Add Funds Modal */}
      <AnimatePresence>
        {showAddFunds && selectedGoal && (
          <AddFundsModal
            goal={selectedGoal}
            amount={addFundsAmount}
            onAmountChange={setAddFundsAmount}
            onSave={handleAddFunds}
            onClose={() => {
              setShowAddFunds(false);
              setSelectedGoal(null);
              setAddFundsAmount("");
            }}
            saving={savingFunds}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GoalCard
// ---------------------------------------------------------------------------

function GoalCard({
  goal,
  index,
  onAddFunds,
  onComplete,
  onDelete,
  isDeleting,
  isCompleting,
}: {
  goal: Goal;
  index: number;
  onAddFunds: () => void;
  onComplete: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  isCompleting: boolean;
}) {
  const pct = Math.min(100, (goal.current_amount / goal.target_amount) * 100);
  const remaining = goal.target_amount - goal.current_amount;
  const catMeta = GOAL_CATEGORIES[goal.category];
  const days = goal.target_date ? daysUntil(goal.target_date) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.06 }}
      className="bg-card border border-border/50 rounded-2xl p-5 relative group"
    >
      {/* Delete button */}
      <button
        onClick={onDelete}
        disabled={isDeleting}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        aria-label="Delete goal"
      >
        {isDeleting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </button>

      {/* Progress ring */}
      <div className="relative w-16 h-16 mx-auto mb-3">
        <div
          className="w-16 h-16 rounded-full"
          style={{
            background: `conic-gradient(${goal.color} ${pct}%, hsl(var(--secondary)) 0%)`,
            padding: "3px",
          }}
        >
          <div className="w-full h-full rounded-full bg-card flex items-center justify-center text-2xl">
            {goal.icon}
          </div>
        </div>
        <div
          className="absolute -bottom-1 -right-1 bg-card border border-border rounded-full px-1.5 py-0.5 text-[10px] font-semibold number-font"
          style={{ color: goal.color }}
        >
          {pct.toFixed(0)}%
        </div>
      </div>

      {/* Name + category badge */}
      <h3 className="text-center font-medium text-sm mt-2 truncate px-2">{goal.name}</h3>
      <div className="flex justify-center mt-1.5 mb-4">
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: `${goal.color}20`,
            color: goal.color,
          }}
        >
          {catMeta?.label ?? goal.category}
        </span>
      </div>

      {/* Amounts */}
      <div className="text-center mb-1">
        <span className="number-font text-xl font-semibold">
          {formatCurrency(goal.current_amount)}
        </span>
      </div>
      <div className="text-center text-xs text-muted-foreground mb-1">
        of {formatCurrency(goal.target_amount)}
      </div>
      {remaining > 0 && (
        <div className="text-center text-xs text-muted-foreground mb-3">
          <span className="font-medium" style={{ color: goal.color }}>
            {formatCurrency(remaining)}
          </span>{" "}
          to go
        </div>
      )}

      {/* Target date */}
      {goal.target_date && days !== null && (
        <div className="flex items-center justify-center gap-1.5 mb-3">
          <CalendarDays className="w-3 h-3 text-muted-foreground" />
          {days >= 0 ? (
            <span className="text-xs text-muted-foreground">{days} days left</span>
          ) : (
            <span className="text-xs text-red-500 font-medium">Overdue</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        <button
          onClick={onAddFunds}
          className="flex-1 py-2 px-3 text-xs font-medium rounded-xl border transition-colors"
          style={{
            borderColor: goal.color,
            color: goal.color,
          }}
        >
          Add Funds
        </button>
        {pct >= 100 && (
          <button
            onClick={onComplete}
            disabled={isCompleting}
            className="flex-1 py-2 px-3 text-xs font-medium rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-1"
          >
            {isCompleting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <>
                <Trophy className="w-3 h-3" />
                Complete
              </>
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Add Goal Modal
// ---------------------------------------------------------------------------

function AddGoalModal({
  form,
  onChange,
  onSave,
  onClose,
  saving,
}: {
  form: AddGoalForm;
  onChange: (f: AddGoalForm) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const catEntries = Object.entries(GOAL_CATEGORIES);
  const selectedCat = GOAL_CATEGORIES[form.category];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: "spring", duration: 0.35 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          {/* Modal header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-xl font-bold">New Goal</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Define your financial milestone
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="space-y-5">
            {/* Goal name */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Goal name</label>
              <input
                type="text"
                placeholder="e.g. Emergency Fund"
                value={form.name}
                onChange={(e) => onChange({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            {/* Category picker */}
            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <div className="grid grid-cols-3 gap-2">
                {catEntries.map(([key, meta]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onChange({ ...form, category: key })}
                    className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-medium transition-all"
                    style={
                      form.category === key
                        ? {
                            borderColor: meta.color,
                            backgroundColor: `${meta.color}15`,
                            color: meta.color,
                          }
                        : {
                            borderColor: "hsl(var(--border))",
                            color: "hsl(var(--muted-foreground))",
                          }
                    }
                  >
                    <span className="text-lg">{meta.icon}</span>
                    {meta.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto-selected icon + color preview */}
            {selectedCat && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 border border-border/50">
                <span className="text-2xl">{selectedCat.icon}</span>
                <div>
                  <div className="text-sm font-medium">{selectedCat.label}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: selectedCat.color }}
                    />
                    <span className="text-xs text-muted-foreground">{selectedCat.color}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Target amount */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Target amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.target_amount}
                  onChange={(e) => onChange({ ...form, target_amount: e.target.value })}
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-border bg-secondary/50 text-sm number-font focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            </div>

            {/* Target date (optional) */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Target date{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={form.target_date}
                onChange={(e) => onChange({ ...form, target_date: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            {/* Notes (optional) */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Notes{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Any notes about this goal..."
                value={form.notes}
                onChange={(e) => onChange({ ...form, notes: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-secondary/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary/60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !form.name.trim() || !form.target_amount}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Create Goal"
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Add Funds Modal
// ---------------------------------------------------------------------------

function AddFundsModal({
  goal,
  amount,
  onAmountChange,
  onSave,
  onClose,
  saving,
}: {
  goal: Goal;
  amount: string;
  onAmountChange: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const remaining = Math.max(0, goal.target_amount - goal.current_amount);
  const addAmount = parseFloat(amount) || 0;
  const newTotal = goal.current_amount + addAmount;
  const newPct = Math.min(100, (newTotal / goal.target_amount) * 100);
  const willComplete = newTotal >= goal.target_amount;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: "spring", duration: 0.35 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">{goal.icon}</span>
              <div>
                <h2 className="font-display text-lg font-bold">{goal.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(remaining)} remaining
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Progress preview */}
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>{formatCurrency(newTotal)}</span>
              <span>{newPct.toFixed(0)}%</span>
            </div>
            <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
              <motion.div
                animate={{ width: `${newPct}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ backgroundColor: goal.color }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Current: {formatCurrency(goal.current_amount)}</span>
              <span>Target: {formatCurrency(goal.target_amount)}</span>
            </div>
          </div>

          {/* Amount input */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1.5">Amount to add</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                ₹
              </span>
              <input
                type="number"
                min="1"
                placeholder="0"
                autoFocus
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSave()}
                className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-border bg-secondary/50 text-sm number-font focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>

          {/* Will complete notice */}
          {willComplete && addAmount > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2"
            >
              <Trophy className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                This will complete your goal — it will be marked as done!
              </span>
            </motion.div>
          )}

          {/* Footer */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary/60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || addAmount <= 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 text-white"
              style={{ backgroundColor: goal.color }}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Add Funds"
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
