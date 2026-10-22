import { Link, useRouterState, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { useStore } from "../lib/store";
import { useAuth } from "../lib/auth";
import { deriveClientStatus } from "../lib/completion";

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
  const { staff, ready, loading, error, signIn, signOut, refresh } = useAuth();

  // Auth gate: show sign-in before any client records.
  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  // A genuine lookup/network error is distinct from "not signed in" or
  // "not approved". Surface it with a Retry so we never show "Account not
  // approved" for a failed request.
  if (error && !staff) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="font-display text-xl font-bold text-foreground">Couldn't verify access</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => void refresh()}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer min-h-[40px]"
            >
              Retry
            </button>
            <button
              onClick={() => void signOut()}
              className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold text-foreground hover:bg-secondary cursor-pointer min-h-[40px]"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!staff) {
    return <SignInScreen loading={loading} error={error} onSignIn={signIn} />;
  }

  if (!staff.approved) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="max-w-md text-center">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary font-display text-xl font-bold text-primary-foreground">
            L
          </div>
          <h1 className="font-display text-xl font-bold text-foreground">Account not approved</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You are signed in as <strong className="text-foreground">{staff.email}</strong> but this
            account is not on the approved staff list. Contact an administrator to be added to the
            staff table before accessing client records.
          </p>
          <button
            onClick={() => void signOut()}
            className="mt-6 rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold text-foreground hover:bg-secondary cursor-pointer min-h-[40px]"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <ShellContent>{children}</ShellContent>;
}

function ShellContent({ children }: { children: ReactNode }) {
  const { state, loading, loadError, reload } = useStore();
  const { staff, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const guides = state.settings.guides;
  const needsFollowUpCount = state.clients.filter(
    (c) => deriveClientStatus(c, guides) === "needs_followup",
  ).length;

  // Reload the store when auth is confirmed — StoreProvider mounts before
  // auth is ready, so its initial getState() 401s. Retry here.
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff?.userId]);

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
          {staff && (
            <div className="ml-2 flex items-center gap-2">
              <span className="hidden text-xs font-semibold text-muted-foreground sm:block">
                {staff.displayName}
              </span>
              <button
                onClick={() => void signOut()}
                className="rounded-md border border-border px-2.5 py-1 text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {loading ? (
          <div className="grid place-items-center py-20">
            <p className="text-sm text-muted-foreground">Loading records…</p>
          </div>
        ) : loadError ? (
          <div className="mx-auto max-w-md rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center">
            <p className="text-sm font-semibold text-destructive">Failed to load records</p>
            <p className="mt-1 text-xs text-muted-foreground">{loadError}</p>
            <button
              onClick={() => void reload()}
              className="mt-4 rounded-xl border border-destructive/40 bg-card px-4 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 cursor-pointer min-h-[40px]"
            >
              Retry
            </button>
          </div>
        ) : (
          (children ?? <Outlet />)
        )}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6">
        <div className="rounded-md border border-border/70 bg-card/40 px-3 py-1.5 text-[11px] text-muted-foreground">
          <strong className="font-medium text-foreground/90">Cloud-connected</strong> — records are
          stored in the Cloud database. Access requires approved staff sign-in. Email notifications
          require provider setup before live use.
        </div>
      </footer>
    </div>
  );
}

function SignInScreen({
  loading,
  error,
  onSignIn,
}: {
  loading: boolean;
  error: string | null;
  onSignIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErr(null);
    setSubmitting(true);
    const res = await onSignIn(email.trim(), password);
    setSubmitting(false);
    if (!res.ok) setErr(res.error ?? "Sign-in failed");
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-primary font-display text-xl font-bold text-primary-foreground">
            L
          </div>
          <h1 className="font-display text-xl font-bold text-foreground">LSP Onboarding</h1>
          <p className="mt-1 text-xs text-muted-foreground">Staff sign-in required</p>
        </div>
        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-hidden focus:ring-2 focus:ring-accent min-h-[40px]"
              placeholder="you@localservicepro.com.au"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-hidden focus:ring-2 focus:ring-accent min-h-[40px]"
              placeholder="••••••••"
            />
          </div>
          {(err || error) && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
              {err ?? error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting || loading}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 disabled:opacity-60 min-h-[44px] cursor-pointer"
          >
            {submitting || loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          No public registration. Only approved staff accounts can access client records.
        </p>
      </div>
    </div>
  );
}
