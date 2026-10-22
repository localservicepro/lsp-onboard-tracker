import { Link, useRouterState, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useStore } from "../lib/store";
import { derivedOverallStatus } from "../lib/completion";
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
  const blockedCount = state.clients.filter((c) => derivedOverallStatus(c) === "blocked").length;

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
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground")
                  }
                >
                  {item.label}
                  {item.to === "/follow-up" && blockedCount > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-xs font-semibold text-destructive-foreground">
                      {blockedCount}
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
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-3 text-xs text-muted-foreground">
          <strong className="font-medium text-foreground">Prototype notice:</strong> this tool uses
          synthetic demo data held in browser memory. It is not connected to live client records, and
          browser storage is not a secure shared store. Do not enter real client PII or credentials.
          Enable Cloud for real staff accounts and persisted records.
        </div>
      </footer>
    </div>
  );
}

export { StatusBadge };