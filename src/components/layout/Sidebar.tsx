"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  BarChart3,
  Settings,
  LogOut,
  Wallet,
  Menu,
  X,
  Home,
  PiggyBank,
  Repeat,
  Trophy,
  ClipboardList,
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/dashboard/recurring", label: "Recurring", icon: Repeat },
  { href: "/dashboard/budget", label: "Budget", icon: Target },
  { href: "/dashboard/savings", label: "Savings", icon: PiggyBank },
  { href: "/dashboard/goals", label: "Goals", icon: Trophy },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/report", label: "Report Card", icon: ClipboardList },
  { href: "/dashboard/loans", label: "Loans", icon: Home },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

// ─── Top progress bar shown during page navigation ───────────────────────────
function NavProgressBar({ loading }: { loading: boolean }) {
  const [width, setWidth] = useState(0);
  const [opacity, setOpacity] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (loading) {
      // Start: appear and grow towards 80%
      setOpacity(1);
      setWidth(0);
      requestAnimationFrame(() => setWidth(75));
    } else {
      // Complete: snap to 100%, then fade
      setWidth(100);
      timerRef.current = setTimeout(() => {
        setOpacity(0);
        timerRef.current = setTimeout(() => setWidth(0), 350);
      }, 180);
    }

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [loading]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: 3,
        zIndex: 9999,
        borderRadius: "0 2px 2px 0",
        background: "hsl(var(--primary))",
        boxShadow: "0 0 10px hsl(var(--primary)/0.7)",
        width: `${width}%`,
        opacity,
        transition: loading
          ? "width 2.8s cubic-bezier(0.04, 0.6, 0.2, 1), opacity 0.1s"
          : "width 0.18s ease-out, opacity 0.35s 0.18s ease",
        pointerEvents: "none",
      }}
    />
  );
}

// ─── Nav items list ───────────────────────────────────────────────────────────
interface NavContentProps {
  user: User;
  pathname: string;
  onNavigate: () => void;
  onSignOut: () => void;
  onNavClick: (href: string) => void;
}

function NavContent({ user, pathname, onNavigate, onSignOut, onNavClick }: NavContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-display text-base font-700">Finwin</span>
            <div className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">Finance Monitor</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => { onNavClick(item.href); onNavigate(); }}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 group",
                active
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <item.icon
                className={cn(
                  "w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110",
                  active ? "text-white" : ""
                )}
              />
              {item.label}
              {active && (
                <motion.div
                  layoutId="active-dot"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-4 py-4 border-t border-border/50">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/50">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-600 text-primary">
              {(user.user_metadata?.display_name || user.email)?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">
              {user.user_metadata?.display_name || user.email?.split("@")[0]}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
          </div>
          <button
            onClick={onSignOut}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────
export default function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navLoading, setNavLoading] = useState(false);
  const prevPathRef = useRef(pathname);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect when navigation completes
  useEffect(() => {
    if (pathname === prevPathRef.current) return;
    prevPathRef.current = pathname;

    // Stop the loading bar (completion handled inside NavProgressBar)
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    setNavLoading(false);
  }, [pathname]);

  const handleNavClick = useCallback((href: string) => {
    if (href !== pathname) setNavLoading(true);
  }, [pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  }

  return (
    <>
      <NavProgressBar loading={navLoading} />

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 fixed left-0 top-0 h-full bg-card border-r border-border/50 flex-col z-40">
        <NavContent
          user={user}
          pathname={pathname}
          onNavigate={() => {}}
          onSignOut={handleSignOut}
          onNavClick={handleNavClick}
        />
      </aside>

      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-xl bg-card border border-border shadow-sm flex items-center justify-center"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-50"
          >
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="absolute left-0 top-0 h-full w-72 bg-card border-r border-border shadow-2xl"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-secondary"
              >
                <X className="w-4 h-4" />
              </button>
              <NavContent
                user={user}
                pathname={pathname}
                onNavigate={() => setMobileOpen(false)}
                onSignOut={handleSignOut}
                onNavClick={handleNavClick}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
