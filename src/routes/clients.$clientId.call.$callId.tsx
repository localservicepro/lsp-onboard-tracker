import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "../lib/store";
import { deriveCallStatus, callCompletionBlock, callItemProgress } from "../lib/completion";
import { CALL_TYPE_LABEL } from "../lib/types";
import { StatusBadge } from "../components/status-badge";
import { buildCallSummary, copyToClipboard } from "../lib/call-summary";
import { CallItemRow, GuideDerivedRow, CallGuidesSection, inputCls } from "../components/client-sections";

export const Route = createFileRoute("/clients/$clientId/call/$callId")({
  head: () => ({
    meta: [
      { title: "Live Call — LSP Onboarding Checklist" },
      {
        name: "description",
        content: "Focused checklist usable during a live onboarding or connection call.",
      },
      { property: "og:title", content: "Live Call — LSP Onboarding Checklist" },
      { property: "og:description", content: "Focused checklist usable during a live call." },
    ],
  }),
  component: CallSessionPage,
});

function CallSessionPage() {
  const { clientId, callId } = Route.useParams();
  const { state, setCallItem, setCallGuide, updateCall, finishCall } = useStore();
  const client = state.clients.find((c) => c.id === clientId);
  const call = client?.calls.find((c) => c.id === callId);
  const [actor, setActor] = useState(
    call?.staffMember ?? client?.assignedTeamMember ?? state.settings.team[0]?.name ?? "Staff Member",
  );
  const [copied, setCopied] = useState(false);

  if (!client || !call) {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">Call session not found.</p>
        <Link
          to="/clients/$clientId"
          params={{ clientId }}
          className="inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          Return to Client Record
        </Link>
      </div>
    );
  }

  const guides = state.settings.guides;
  const cs = deriveCallStatus(call, guides);
  const block = callCompletionBlock(call, guides);
  const prog = callItemProgress(call);
  const team = state.settings.team;

  const onCopy = async () => {
    await copyToClipboard(buildCallSummary(client, call, guides));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Split items: guide-derived rows are read-only; everything else is editable.
  const editableItems = call.items.filter((i) => !i.guideDerived);
  const clientActions = editableItems.filter((i) => i.kind === "client_action");
  const staffChecks = editableItems.filter((i) => i.kind === "staff_check");
  const guideDerivedItems = call.items.filter((i) => i.guideDerived);

  const onFinish = () =>
    finishCall(
      client.id,
      call.id,
      { followUpAction: call.followUpAction, followUpDate: call.followUpDate },
      actor,
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 pb-4">
        <div>
          <Link
            to="/clients/$clientId"
            params={{ clientId }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            ← Back to {client.businessName}
          </Link>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {CALL_TYPE_LABEL[call.type]} Call
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{client.businessName}</span> ·{" "}
            {client.clientName} · {call.date}
            {client.accountContext && <> · {client.accountContext}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Observing Staff:</label>
            <select
              value={actor}
              onChange={(e) => {
                setActor(e.target.value);
                updateCall(client.id, call.id, { staffMember: e.target.value }, e.target.value);
              }}
              className="bg-transparent text-xs font-bold text-foreground outline-hidden cursor-pointer"
            >
              {team.map((t) => (
                <option key={t.id} value={t.name} className="bg-card text-foreground">
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <StatusBadge status={cs} />
        </div>
      </div>

      {/* Completion banner — single clear result */}
      {block.ok ? (
        <div className="rounded-2xl border-2 border-chart-1/50 bg-chart-1/10 p-4 text-sm font-bold text-chart-1 flex items-center gap-2">
          <span>✓</span>
          <span>Checklist complete — all required items satisfied, no unresolved issues.</span>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-destructive/50 bg-destructive/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-bold text-destructive">
            <span className="h-2 w-2 rounded-full bg-destructive" />
            Checklist not complete — {prog.needsHelpCount ?? 0 > 0 ? "follow-up required" : "items remaining"}
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-destructive/90">
            {block.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Client-led practical tasks — explanation shown once */}
      {clientActions.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold text-foreground">Client-Led Practical Tasks</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            "Client did it" = staff observed the client personally perform it. A staff demonstration
            does NOT count. Staff identity and timestamps are recorded automatically and hidden under
            each item's "Details".
          </p>
          <div className="mt-3 space-y-2.5">
            {clientActions.map((it) => (
              <CallItemRow
                key={it.id}
                item={it}
                actor={actor}
                onSet={(patch, reason) => setCallItem(client.id, call.id, it.id, patch, actor, reason)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Staff checks */}
      {staffChecks.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold text-foreground">Staff Checks</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Staff-only items use Done (not "Client did it"). These record verification only — they do
            not perform integrations or request credentials.
          </p>
          <div className="mt-3 space-y-2.5">
            {staffChecks.map((it) => (
              <CallItemRow
                key={it.id}
                item={it}
                actor={actor}
                onSet={(patch, reason) => setCallItem(client.id, call.id, it.id, patch, actor, reason)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Guides */}
      <CallGuidesSection
        call={call}
        actor={actor}
        guides={guides}
        onSetGuide={(guideId, patch, reason) =>
          setCallGuide(client.id, call.id, guideId, patch, actor, reason)
        }
      />

      {/* Auto-derived guide item (read-only) */}
      {guideDerivedItems.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold text-foreground">Guide-Derived Summary</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            These items are auto-calculated from the guide records above and cannot be edited directly.
          </p>
          <div className="mt-3 space-y-2.5">
            {guideDerivedItems.map((it) => (
              <GuideDerivedRow key={it.id} call={call} item={it} guides={guides} />
            ))}
          </div>
        </section>
      )}

      {/* Notes + follow-up */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h2 className="font-display text-lg font-bold text-foreground">Call Notes &amp; Follow-up</h2>
        <div>
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Call Notes</span>
          <textarea
            className={inputCls}
            rows={2}
            placeholder="Short call notes..."
            defaultValue={call.notes ?? ""}
            onBlur={(e) => updateCall(client.id, call.id, { notes: e.target.value }, actor)}
          />
        </div>
        {!block.ok && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 space-y-2.5">
            <div className="text-xs font-bold text-amber-300">
              Follow-up required to complete this call
            </div>
            <div className="grid gap-2 sm:grid-cols-3 text-xs">
              <div>
                <span className="mb-1 block text-[11px] text-muted-foreground">Next Action</span>
                <input
                  className={inputCls}
                  placeholder="What needs to happen next..."
                  defaultValue={call.followUpAction ?? ""}
                  onBlur={(e) =>
                    updateCall(client.id, call.id, { followUpAction: e.target.value }, actor)
                  }
                />
              </div>
              <div>
                <span className="mb-1 block text-[11px] text-muted-foreground">Owner</span>
                <select
                  className={inputCls}
                  value={actor}
                  onChange={(e) => setActor(e.target.value)}
                >
                  {team.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="mb-1 block text-[11px] text-muted-foreground">Follow-up Date</span>
                <input
                  type="date"
                  className={inputCls}
                  defaultValue={call.followUpDate ?? ""}
                  onChange={(e) =>
                    updateCall(
                      client.id,
                      call.id,
                      { followUpDate: e.target.value || undefined },
                      actor,
                    )
                  }
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Summary (secondary) */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Call Summary</h2>
            <p className="text-xs text-muted-foreground">Readable guide names. Copying never sends anything.</p>
          </div>
          <button
            onClick={onCopy}
            className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-secondary cursor-pointer min-h-[40px]"
          >
            {copied ? "✓ Copied!" : "📋 Copy Summary"}
          </button>
        </div>
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-border/80 bg-background/80 p-4 font-mono text-xs text-foreground">
          {buildCallSummary(client, call, guides)}
        </pre>
      </section>

      {/* Finish — one clear result */}
      <div className="flex flex-wrap justify-end gap-3 pt-2">
        <Link
          to="/clients/$clientId"
          params={{ clientId }}
          className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-secondary min-h-[40px] inline-flex items-center"
        >
          ← Back to Client
        </Link>
        <button
          onClick={() =>
            updateCall(
              client.id,
              call.id,
              { followUpAction: call.followUpAction, followUpDate: call.followUpDate },
              actor,
            )
          }
          className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-secondary min-h-[40px]"
        >
          Save Progress — this session only
        </button>
        <button
          onClick={onFinish}
          className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 min-h-[40px]"
        >
          {block.ok ? "Finish Call ✓ — completed" : "Finish Call — follow-up required"}
        </button>
      </div>
    </div>
  );
}