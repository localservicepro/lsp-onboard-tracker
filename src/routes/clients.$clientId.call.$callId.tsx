import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "../lib/store";
import {
  CONNECTION_STATUSES,
  TASK_STATUSES,
  REVIEW_OUTCOMES,
  type ConnectionStatus,
  type TaskStatus,
  type ReviewOutcome,
} from "../lib/types";
import { buildCallSummary, copyToClipboard } from "../lib/call-summary";

export const Route = createFileRoute("/clients/$clientId/call/$callId")({
  head: () => ({
    meta: [
      { title: "Live call — LSP Onboarding Checklist" },
      { name: "description", content: "Focused checklist usable during a live onboarding call." },
      { property: "og:title", content: "Live call — LSP Onboarding Checklist" },
      { property: "og:description", content: "Focused checklist usable during a live onboarding call." },
    ],
  }),
  component: CallSessionPage,
});

function CallSessionPage() {
  const { clientId, callId } = Route.useParams();
  const { state, setConnection, setTask, updateCallSession } = useStore();
  const client = state.clients.find((c) => c.id === clientId);
  const session = client?.callSessions.find((s) => s.id === callId);
  const [actor, setActor] = useState(state.settings.team[0]?.name ?? "Staff");
  const [copied, setCopied] = useState(false);

  if (!client || !session) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground">Call session not found.</p>
        <Link to="/clients/$clientId" params={{ clientId }} className="text-primary underline">Back to client</Link>
      </div>
    );
  }

  const onCopy = async () => {
    await copyToClipboard(buildCallSummary(client));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/clients/$clientId" params={{ clientId }} className="text-xs text-muted-foreground hover:text-foreground">← {client.businessName}</Link>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">Live call — {session.date}</h1>
          <p className="text-sm text-muted-foreground">{client.clientName} · {session.staffMember}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Acting as</label>
          <select value={actor} onChange={(e) => setActor(e.target.value)} className={inputCls + " w-40"}>
            {state.settings.team.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Call notes (saved to this session)</span>
          <textarea
            className={inputCls}
            rows={3}
            defaultValue={session.notes ?? ""}
            onBlur={(e) => updateCallSession(client.id, session.id, { notes: e.target.value }, actor)}
          />
        </label>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">Connections</h2>
        <p className="mt-1 text-xs text-muted-foreground">A connected integration does NOT complete any practical task.</p>
        <div className="mt-3 space-y-2">
          {client.connections.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background p-3">
              <div className="font-medium text-sm">{c.label}</div>
              <select className={inputCls + " w-44"} value={c.status} onChange={(e) => setConnection(client.id, c.id, { status: e.target.value as ConnectionStatus }, actor)}>
                {CONNECTION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">Client-led practice</h2>
        <p className="mt-1 text-xs text-muted-foreground">"Demonstrated by staff" does NOT count as client completion.</p>
        <div className="mt-3 space-y-2">
          {client.tasks.map((t) => {
            const isReview = t.id.endsWith("-5") || t.id.endsWith("-6");
            return (
              <div key={t.id} className="rounded-md border border-border bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-sm">{t.label}</div>
                  <select className={inputCls + " w-52"} value={t.status} onChange={(e) => setTask(client.id, t.id, { status: e.target.value as TaskStatus }, actor)}>
                    {TASK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                {t.status === "client_completed" && isReview && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Review outcome:</span>
                    <select className={inputCls + " w-52"} value={t.reviewOutcome ?? "unknown"} onChange={(e) => setTask(client.id, t.id, { reviewOutcome: e.target.value as ReviewOutcome }, actor)}>
                      {REVIEW_OUTCOMES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <span className="text-xs text-muted-foreground">"Sent" ≠ "Receipt confirmed".</span>
                  </div>
                )}
                {t.status === "demonstrated_by_staff" && (
                  <div className="mt-2 text-xs text-muted-foreground">Demonstrated by staff — does NOT count as client completion.</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex justify-end">
        <button onClick={onCopy} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{copied ? "Copied!" : "Copy call summary"}</button>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";