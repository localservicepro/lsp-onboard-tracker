import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "../lib/store";
import {
  deriveClientStatus,
  nextCallTypeForClient,
  unfinishedCallOfType,
  callItemProgress,
  callCompletionBlock,
  deriveCallStatus,
} from "../lib/completion";
import type { CallStatus, CallType } from "../lib/types";
import { CALL_TYPES, CALL_TYPE_LABEL } from "../lib/types";
import { StatusBadge } from "../components/status-badge";
import { buildClientSummary, copyToClipboard } from "../lib/call-summary";
import { inputCls } from "../components/client-sections";

export const Route = createFileRoute("/clients/$clientId/")({
  head: () => ({
    meta: [
      { title: "Client Detail — LSP Onboarding Tracker" },
      {
        name: "description",
        content: "Connection checklist, practical tasks, guides and call history for a client.",
      },
      { property: "og:title", content: "Client Detail — LSP Onboarding Tracker" },
      {
        property: "og:description",
        content: "Connection checklist, practical tasks, guides and call history.",
      },
    ],
  }),
  component: ClientDetailPage,
});

export function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const { state, updateClient, startCall } = useStore();
  const navigate = useNavigate();
  const client = state.clients.find((c) => c.id === clientId);
  const [copied, setCopied] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const guides = state.settings.guides;

  if (!client) {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card p-8 text-center">
        <h2 className="text-xl font-bold text-foreground">Client record not found</h2>
        <p className="text-sm text-muted-foreground">
          The requested client ID does not exist in this store.
        </p>
        <Link
          to="/"
          className="inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const derived = deriveClientStatus(client, guides);
  const nextType = nextCallTypeForClient(client);
  const unfinished = unfinishedCallOfType(client, nextType);

  const onStart = async (type: CallType) => {
    const existing = unfinishedCallOfType(client, type);
    if (existing) {
      navigate({
        to: "/clients/$clientId/call/$callId",
        params: { clientId: client.id, callId: existing.id },
      });
    } else {
      // Await DB persistence so we navigate with the real database call id.
      const callId = await startCall(
        client.id,
        type,
        client.assignedTeamMember,
        new Date().toISOString().slice(0, 10),
      );
      navigate({
        to: "/clients/$clientId/call/$callId",
        params: { clientId: client.id, callId },
      });
    }
  };

  const onCopy = async () => {
    await copyToClipboard(buildClientSummary(client, guides));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 pb-4">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
          >
            ← Back to Dashboard
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {client.businessName}
            </h1>
            <StatusBadge status={derived} />
            {client.isTestRecord && (
              <span className="rounded-full border border-amber-500/50 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-300">
                Internal test record
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Client: <span className="font-semibold text-foreground">{client.clientName}</span> ·
            Assigned:{" "}
            <span className="font-semibold text-foreground">{client.assignedTeamMember}</span>
            {client.accountContext && (
              <>
                {" "}
                · Account:{" "}
                <span className="font-semibold text-foreground">{client.accountContext}</span>
              </>
            )}
          </p>
          {client.isTestRecord && client.testPurpose && (
            <p className="mt-1 text-xs text-amber-300/90">{client.testPurpose}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onStart(nextType)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 min-h-[40px] cursor-pointer"
          >
            {unfinished ? "Continue Call" : "Start Call"} →
          </button>
          <button
            onClick={onCopy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs sm:text-sm font-bold text-foreground hover:bg-secondary min-h-[40px] cursor-pointer"
          >
            {copied ? "✓ Copied!" : "📋 Copy Summary"}
          </button>
          <button
            onClick={() => setShowEdit((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs sm:text-sm font-bold text-foreground hover:bg-secondary min-h-[40px] cursor-pointer"
          >
            {showEdit ? "Close" : "Edit Details"}
          </button>
        </div>
      </div>

      {/* Edit details */}
      {showEdit && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-base font-bold text-foreground mb-3">
            Client Record Information
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
            <Field label="Business Name">
              <input
                className={inputCls}
                defaultValue={client.businessName}
                onBlur={(e) =>
                  updateClient(
                    client.id,
                    { businessName: e.target.value },
                    client.assignedTeamMember,
                  )
                }
              />
            </Field>
            <Field label="Client Name">
              <input
                className={inputCls}
                defaultValue={client.clientName}
                onBlur={(e) =>
                  updateClient(client.id, { clientName: e.target.value }, client.assignedTeamMember)
                }
              />
            </Field>
            <Field label="Assigned Staff">
              <select
                className={inputCls}
                defaultValue={client.assignedTeamMember}
                onChange={(e) =>
                  updateClient(
                    client.id,
                    { assignedTeamMember: e.target.value },
                    client.assignedTeamMember,
                  )
                }
              >
                {state.settings.team.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="GHL Subaccount Link (optional)">
              <input
                className={inputCls}
                defaultValue={client.ghlLink ?? ""}
                placeholder="https://..."
                onBlur={(e) =>
                  updateClient(
                    client.id,
                    { ghlLink: e.target.value || undefined },
                    client.assignedTeamMember,
                  )
                }
              />
            </Field>
            <Field label="Contact Details (no passwords)">
              <input
                className={inputCls}
                defaultValue={client.contactDetails ?? ""}
                onBlur={(e) =>
                  updateClient(
                    client.id,
                    { contactDetails: e.target.value || undefined },
                    client.assignedTeamMember,
                  )
                }
              />
            </Field>
            <Field label="Next Call Date">
              <input
                type="date"
                className={inputCls}
                defaultValue={client.nextCallDate ?? ""}
                onChange={(e) =>
                  updateClient(
                    client.id,
                    { nextCallDate: e.target.value || undefined },
                    client.assignedTeamMember,
                  )
                }
              />
            </Field>
            <Field label="Next Call Type">
              <select
                className={inputCls}
                value={client.nextCallType ?? nextType}
                onChange={(e) =>
                  updateClient(
                    client.id,
                    { nextCallType: e.target.value as CallType },
                    client.assignedTeamMember,
                  )
                }
              >
                {CALL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Notes">
                <textarea
                  className={inputCls}
                  rows={2}
                  defaultValue={client.notes ?? ""}
                  onBlur={(e) =>
                    updateClient(
                      client.id,
                      { notes: e.target.value || undefined },
                      client.assignedTeamMember,
                    )
                  }
                />
              </Field>
            </div>
          </div>
        </section>
      )}

      {/* Call history */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Call History</h2>
            <p className="text-xs text-muted-foreground">
              Multiple call sessions are preserved without erasing previous results.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {CALL_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => onStart(t.value)}
                className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground hover:bg-secondary cursor-pointer min-h-[36px]"
              >
                + {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {client.calls.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              No calls logged yet. Start a call above.
            </div>
          )}
          {[...client.calls]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((c) => {
              const cs = deriveCallStatus(c, guides);
              const prog = callItemProgress(c);
              const block = callCompletionBlock(c, guides);
              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-border bg-background p-4 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-foreground flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-secondary/60 px-2 py-0.5 text-xs text-secondary-foreground">
                          {CALL_TYPE_LABEL[c.type]}
                        </span>
                        <span>{c.date}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          · {c.staffMember}
                        </span>
                        {c.finishedAt && (
                          <span className="rounded bg-chart-1/20 px-1.5 py-0.5 text-[10px] font-bold text-chart-1">
                            Finished
                          </span>
                        )}
                      </div>
                      {c.notes && (
                        <div className="text-xs text-muted-foreground mt-1">{c.notes}</div>
                      )}
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">
                          {prog.done}/{prog.total} items
                        </span>
                        {prog.needsHelpCount ? (
                          <span className="text-destructive font-semibold">
                            · {prog.needsHelpCount} need help
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={cs as CallStatus} />
                      <Link
                        to="/clients/$clientId/call/$callId"
                        params={{ clientId: client.id, callId: c.id }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3.5 py-2 text-xs font-bold text-accent hover:bg-accent/20 transition-colors"
                      >
                        {c.finishedAt ? "Review Call" : "Open Call"} →
                      </Link>
                    </div>
                  </div>
                  {!block.ok && c.finishedAt && (
                    <div className="mt-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                      {block.reasons.join(" · ")}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </section>

      {/* Copyable summary */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Client Summary</h2>
            <p className="text-xs text-muted-foreground">
              Readable guide names. Copying does not send anything.
            </p>
          </div>
          <button
            onClick={onCopy}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer min-h-[40px]"
          >
            {copied ? "✓ Copied!" : "📋 Copy"}
          </button>
        </div>
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-border/80 bg-background/80 p-4 font-mono text-xs text-foreground">
          {buildClientSummary(client, state.settings.guides)}
        </pre>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: import("react").ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
