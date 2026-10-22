import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { outstandingActions, type FollowUpAction } from "../lib/completion";

export const Route = createFileRoute("/follow-up")({
  head: () => ({
    meta: [
      { title: "Follow-up — LSP Onboarding Tracker" },
      { name: "description", content: "Outstanding onboarding actions grouped by owner." },
      { property: "og:title", content: "Follow-up — LSP Onboarding Tracker" },
      { property: "og:description", content: "Outstanding onboarding actions grouped by owner." },
    ],
  }),
  component: FollowUpPage,
});

function FollowUpPage() {
  const { state } = useStore();
  const [owner, setOwner] = useState("all");
  const guides = state.settings.guides;

  const actions = useMemo<FollowUpAction[]>(() => {
    const out: FollowUpAction[] = [];
    for (const c of state.clients) out.push(...outstandingActions(c, guides));
    return out;
  }, [state, guides]);

  const owners = useMemo(() => {
    const set = new Set<string>();
    actions.forEach((a) => set.add(a.owner));
    return Array.from(set).sort();
  }, [actions]);

  const filtered = owner === "all" ? actions : actions.filter((a) => a.owner === owner);
  const byOwner = useMemo(() => {
    const map = new Map<string, FollowUpAction[]>();
    filtered.forEach((a) => {
      const arr = map.get(a.owner) ?? [];
      arr.push(a);
      map.set(a.owner, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Follow-up
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Outstanding actions grouped by owner. "Needs follow-up" means an actual issue was recorded
          — not just that a call hasn't happened.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Filter by owner:</span>
        <select
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-hidden focus:ring-2 focus:ring-accent cursor-pointer min-h-[40px]"
        >
          <option value="all">All owners ({actions.length})</option>
          {owners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {byOwner.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No outstanding actions. 🎉
        </div>
      )}

      <div className="space-y-4">
        {byOwner.map(([name, items]) => (
          <section key={name} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-foreground">{name}</h2>
              <span className="text-xs text-muted-foreground">{items.length} action(s)</span>
            </div>
            <div className="mt-3 space-y-2">
              {items.map((a, i) => (
                <div key={i} className="rounded-xl border border-border bg-background p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium text-foreground">{a.summary}</div>
                    <Link
                      to="/clients/$clientId"
                      params={{ clientId: a.clientId }}
                      className="text-xs text-primary underline"
                    >
                      Open {a.businessName}
                    </Link>
                  </div>
                  {a.nextAction && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Next action: {a.nextAction}
                    </div>
                  )}
                  {a.detail && (
                    <div className="mt-0.5 text-xs text-muted-foreground">{a.detail}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
