import { Link, useRouterState, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useStore } from "../lib/store";
import { deriveClientStatus } from "../lib/completion";
import { StatusBadge } from "./status-badge";

interface NavItem {
  to: "/" | "/follow-up" | "/settings";
  label: string;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", exact: true },
  { to: "/follow-up", label: "Follow-up" },
  { to: "/settings", label: "Settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const guides = state.settings.guides;
  const needsFollowUpCount = state.clients.filter(
    (c) => deriveClientStatus(c, guides) === "needs_followup",
  ).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground font-display font-bold">
              L
            </span>
            <span className="hidden font-display text-lg font-semibold tracking-tight sm:block">
              LSP Onboarding
            </span>
          </Link>
          <nav className="ml-auto flex items-center gap-1">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                    (active
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-accent/20 hover:text-accent")
                  }
                >
                  {item.label}
                  {item.to === "/follow-up" && needsFollowUpCount > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-xs font-semibold text-destructive-foreground">
                      {needsFollowUpCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children ?? <Outlet />}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6">
        <div className="rounded-md border border-border/70 bg-card/40 px-3 py-1.5 text-[11px] text-muted-foreground">
          <strong className="font-medium text-foreground/90">Session-only storage</strong> — changes
          may be lost on reload and are not shared across browsers or staff. Secure staff
          authentication and shared persistent storage are required before real client use.
        </div>
      </footer>
    </div>
  );
}

export { StatusBadge };
