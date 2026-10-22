import { useState } from "react";
import type { Call, CallGuideRecord, GuideLink, GuideChannel } from "../lib/types";
import {
  guideLabel,
  guideUrl,
  guideHasUrl,
  guideIsSupplied,
  guideSuppliedRef,
  isGuideSentValid,
  isGuideExempt,
  isGuideOutstanding,
} from "../lib/completion";
import { GUIDE_CHANNELS } from "../lib/types";
import { AuditTrail, inputCls } from "./client-sections";

// Resources & Guide Delivery.
//
// Each resource shows: name, Open Resource (when a URL is configured),
// Add/Edit Resource (URL OR document title + version), and Record as Sent.
// When a resource is missing, "Record as Sent" is blocked with an active
// "Add a resource" button — no dead-end disabled checkbox. Recording delivery
// opens a compact inline form (supplied ref prefilled, channel, date/time,
// staff) and only marks Sent on valid submission. Recording delivery does NOT
// actually send an email/SMS/document — it only records the outcome.
export function CallGuidesSection({
  call,
  actor,
  guides,
  onSetGuide,
  onUpdateGuideLink,
}: {
  call: Call;
  actor: string;
  guides: GuideLink[];
  onSetGuide: (guideId: string, patch: Partial<CallGuideRecord>, reason?: string) => void;
  onUpdateGuideLink: (guideId: string, patch: Partial<GuideLink>) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-lg font-bold text-foreground">
        Resources &amp; Guide Delivery
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Sending a written resource is different from demonstrating or practising a task (those are
        tracked on the checklist above). Opening a resource does NOT mark it sent. Recording
        delivery only records the outcome — it does not actually send an email, SMS or document.
      </p>
      <div className="mt-3 space-y-3">
        {call.guides.map((g) => (
          <GuideRow
            key={g.guideId}
            record={g}
            actor={actor}
            guides={guides}
            onSetGuide={onSetGuide}
            onUpdateGuideLink={onUpdateGuideLink}
          />
        ))}
      </div>
    </section>
  );
}

function GuideRow({
  record,
  actor,
  guides,
  onSetGuide,
  onUpdateGuideLink,
}: {
  record: CallGuideRecord;
  actor: string;
  guides: GuideLink[];
  onSetGuide: (guideId: string, patch: Partial<CallGuideRecord>, reason?: string) => void;
  onUpdateGuideLink: (guideId: string, patch: Partial<GuideLink>) => void;
}) {
  const link = guides.find((d) => d.id === record.guideId);
  const label = guideLabel(record, guides);
  const url = guideUrl(record, guides);
  const hasUrl = guideHasUrl(record, guides);
  const supplied = guideIsSupplied(record, guides);
  const suppliedRef = link ? guideSuppliedRef(link) : undefined;
  const sentValid = isGuideSentValid(record, guides);
  const outstanding = isGuideOutstanding(record, guides);
  const exempt = isGuideExempt(record);

  const [showEdit, setShowEdit] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [editUrl, setEditUrl] = useState(link?.url ?? "");
  const [editTitle, setEditTitle] = useState(link?.documentTitle ?? "");
  const [editVersion, setEditVersion] = useState(link?.documentVersion ?? "");
  const [editErr, setEditErr] = useState("");
  const [sendChannel, setSendChannel] = useState<GuideChannel>(record.channel ?? "email");
  const [sendDate, setSendDate] = useState(
    record.sentAt ? record.sentAt.slice(0, 16) : new Date().toISOString().slice(0, 16),
  );
  const [sendBy, setSendBy] = useState(record.sentBy ?? actor);
  const [sendSupplied, setSendSupplied] = useState(
    record.suppliedUrlOrVersion ?? suppliedRef ?? "",
  );
  const [sendErr, setSendErr] = useState("");

  const openEdit = () => {
    setEditUrl(link?.url ?? "");
    setEditTitle(link?.documentTitle ?? "");
    setEditVersion(link?.documentVersion ?? "");
    setEditErr("");
    setShowEdit(true);
    setShowSend(false);
  };

  const openSend = () => {
    setSendChannel(record.channel ?? "email");
    setSendDate(record.sentAt ? record.sentAt.slice(0, 16) : new Date().toISOString().slice(0, 16));
    setSendBy(record.sentBy ?? actor);
    setSendSupplied(record.suppliedUrlOrVersion ?? suppliedRef ?? "");
    setSendErr("");
    setShowSend(true);
    setShowEdit(false);
  };

  const saveResource = () => {
    const u = editUrl.trim();
    const t = editTitle.trim();
    const v = editVersion.trim();
    if (!u && !(t && v)) {
      setEditErr("Enter a valid guide URL, or a document title and version/reference.");
      return;
    }
    if (u && t && v) {
      setEditErr("Enter either a URL or a document title+version, not both.");
      return;
    }
    setEditErr("");
    onUpdateGuideLink(record.guideId, {
      ...(u ? { url: u } : { url: undefined }),
      ...(u
        ? { documentTitle: undefined, documentVersion: undefined }
        : { documentTitle: t, documentVersion: v }),
    });
    setShowEdit(false);
  };

  const saveDelivery = () => {
    if (!supplied) {
      setSendErr("Add a resource before recording delivery.");
      return;
    }
    const s = sendSupplied.trim();
    if (!s) {
      setSendErr("Enter the supplied URL or document version/reference.");
      return;
    }
    if (!sendDate) {
      setSendErr("Enter a date/time.");
      return;
    }
    if (!sendBy.trim()) {
      setSendErr("Enter the staff member who recorded delivery.");
      return;
    }
    setSendErr("");
    onSetGuide(
      record.guideId,
      {
        sent: true,
        sentAt: new Date(sendDate).toISOString(),
        channel: sendChannel,
        sentBy: sendBy.trim(),
        suppliedUrlOrVersion: s,
      },
      "Guide delivery recorded (does not send anything)",
    );
    setShowSend(false);
  };

  const undoDelivery = () => {
    onSetGuide(
      record.guideId,
      {
        sent: false,
        sentAt: undefined,
        channel: undefined,
        sentBy: undefined,
        suppliedUrlOrVersion: undefined,
      },
      "Guide delivery undone",
    );
    setShowSend(false);
  };

  return (
    <div
      className={`rounded-xl border p-3 ${sentValid ? "border-chart-1/40 bg-chart-1/5" : outstanding ? "border-amber-500/40 bg-amber-500/5" : exempt ? "border-accent/30 bg-accent/10" : "border-border bg-background"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-bold text-foreground">{label}</div>
        <div className="flex flex-wrap items-center gap-2">
          {hasUrl && url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent/20 transition-colors"
            >
              Open Resource ↗
            </a>
          ) : (
            <span className="rounded bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
              Guide link not added
            </span>
          )}
          <button
            onClick={openEdit}
            className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary transition-colors cursor-pointer min-h-[36px]"
          >
            {supplied ? "Edit Resource" : "Add Resource"}
          </button>
        </div>
      </div>

      {/* Add / Edit Resource */}
      {showEdit && (
        <div className="mt-2.5 rounded-lg border border-border/60 bg-card/40 p-2.5 space-y-2">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Add / Edit Resource
          </div>
          <div>
            <span className="block text-[11px] text-muted-foreground mb-1">
              Guide URL (option A):
            </span>
            <input
              className={inputCls}
              placeholder="https://..."
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
            />
          </div>
          <div className="text-[11px] text-muted-foreground text-center">— OR —</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <span className="block text-[11px] text-muted-foreground mb-1">
                Document title (option B):
              </span>
              <input
                className={inputCls}
                placeholder="e.g. Add-a-lead guide (PDF)"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground mb-1">
                Version / reference:
              </span>
              <input
                className={inputCls}
                placeholder="e.g. v1.2 / shared-drive-2026"
                value={editVersion}
                onChange={(e) => setEditVersion(e.target.value)}
              />
            </div>
          </div>
          {editErr && (
            <div className="rounded border border-destructive/40 bg-destructive/15 px-2.5 py-1 text-[11px] text-destructive font-medium">
              {editErr}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowEdit(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary cursor-pointer min-h-[36px]"
            >
              Cancel
            </button>
            <button
              onClick={saveResource}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer min-h-[36px]"
            >
              Save Resource
            </button>
          </div>
        </div>
      )}

      {/* Record as Sent */}
      <div className="mt-2.5 flex flex-wrap items-center gap-3 border-t border-border/60 pt-2.5">
        {sentValid ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-chart-1/20 px-2.5 py-1 text-xs font-bold text-chart-1">
            ✓ Sent
          </span>
        ) : supplied ? (
          <button
            onClick={openSend}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer min-h-[36px]"
          >
            Record as Sent
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-300">
              Add a resource before recording delivery.
            </span>
            <button
              onClick={openEdit}
              className="rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent hover:bg-accent/20 cursor-pointer min-h-[36px]"
            >
              + Add Resource
            </button>
          </div>
        )}
        {sentValid && (
          <button
            onClick={openSend}
            className="text-xs text-muted-foreground underline hover:text-foreground cursor-pointer"
          >
            Edit delivery
          </button>
        )}
      </div>

      {/* Delivery form */}
      {showSend && (
        <div className="mt-2.5 rounded-lg border border-border/60 bg-card/40 p-2.5 space-y-2">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Record Delivery (does not send anything)
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <span className="block text-[11px] text-muted-foreground mb-1">
                Resource supplied *:
              </span>
              <input
                className={inputCls}
                placeholder="Supplied URL or document version/reference"
                value={sendSupplied}
                onChange={(e) => setSendSupplied(e.target.value)}
              />
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground mb-1">Channel:</span>
              <select
                className={inputCls}
                value={sendChannel}
                onChange={(e) => setSendChannel(e.target.value as GuideChannel)}
              >
                {GUIDE_CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground mb-1">Date/time *:</span>
              <input
                type="datetime-local"
                className={inputCls}
                value={sendDate}
                onChange={(e) => setSendDate(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <span className="block text-[11px] text-muted-foreground mb-1">Staff *:</span>
              <input
                className={inputCls}
                value={sendBy}
                onChange={(e) => setSendBy(e.target.value)}
              />
            </div>
          </div>
          {sendErr && (
            <div className="rounded border border-destructive/40 bg-destructive/15 px-2.5 py-1 text-[11px] text-destructive font-medium">
              {sendErr}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {sentValid && (
              <button
                onClick={undoDelivery}
                className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 cursor-pointer min-h-[36px]"
              >
                Undo delivery
              </button>
            )}
            <button
              onClick={() => setShowSend(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary cursor-pointer min-h-[36px]"
            >
              Cancel
            </button>
            <button
              onClick={saveDelivery}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer min-h-[36px]"
            >
              Save Delivery
            </button>
          </div>
        </div>
      )}

      {/* Delivery details (when valid) */}
      {sentValid && (
        <div className="mt-2 text-xs text-muted-foreground">
          Delivered via {record.channel} on {record.sentAt?.slice(0, 10)} by {record.sentBy}.
        </div>
      )}

      {/* Exemption */}
      <div className="mt-2.5 rounded-lg border border-border/60 bg-card/40 p-2.5">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
          Documented Exemption (reason + reviewer ack)
        </div>
        <input
          className={inputCls}
          placeholder="Exemption reason..."
          defaultValue={record.notApplicableReason ?? ""}
          onBlur={(e) => onSetGuide(record.guideId, { notApplicableReason: e.target.value }, actor)}
        />
        <label className="mt-2 flex items-center gap-2 text-xs font-semibold cursor-pointer">
          <input
            type="checkbox"
            checked={!!record.acknowledgedByReviewer}
            onChange={(e) =>
              onSetGuide(record.guideId, { acknowledgedByReviewer: e.target.checked }, actor)
            }
            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
          />
          <span>Reviewer acknowledges this exemption.</span>
        </label>
      </div>

      {record.audit.length > 0 && <AuditTrail entries={record.audit} />}
    </div>
  );
}
