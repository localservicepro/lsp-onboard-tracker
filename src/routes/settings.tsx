import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "../lib/store";
import type { CallType, TemplateItem } from "../lib/types";
import { CALL_TYPE_LABEL } from "../lib/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — LSP Onboarding Checklist" },
      { name: "description", content: "Configure guide links, team members and editable checklist templates." },
      { property: "og:title", content: "Settings — LSP Onboarding Checklist" },
      { property: "og:description", content: "Configure guide links, team members and checklist templates." },
    ],
  }),
  component: SettingsPage,
});

const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2 text-xs sm:text-sm text-foreground outline-hidden focus:ring-2 focus:ring-accent min-h-[40px]";

function SettingsPage() {
  const { state, addGuide, updateGuide, removeGuide, addTeamMember, removeTeamMember, addTemplateItem, updateTemplateItem, removeTemplateItem, reorderTemplateItem, updateTemplate, reset } = useStore();
  const [guideLabel, setGuideLabel] = useState("");
  const [guideUrl, setGuideUrl] = useState("");
  const [teamName, setTeamName] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Guide links, team members and editable checklist templates. Template changes apply to new calls only — historical calls stay unchanged.</p>
      </div>

      {/* Guides */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">How-to guide links</h2>
        <p className="mt-1 text-xs text-muted-foreground">If a link is unavailable, the call shows "Guide link not added". Do not invent a URL.</p>
        <div className="mt-3 space-y-2">
          {state.settings.guides.map((g) => (
            <div key={g.id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <input className={inputCls} defaultValue={g.label} onBlur={(e) => updateGuide(g.id, { label: e.target.value })} />
                <button onClick={() => removeGuide(g.id)} className="text-xs text-destructive underline">Remove</button>
              </div>
              <input className={inputCls + " mt-2"} placeholder="Guide URL (leave empty if not added)" defaultValue={g.url ?? ""} onBlur={(e) => updateGuide(g.id, { url: e.target.value || undefined })} />
              {!g.url && <div className="mt-1 text-xs text-muted-foreground">Guide link not added</div>}
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input className={inputCls} placeholder="New guide label" value={guideLabel} onChange={(e) => setGuideLabel(e.target.value)} />
          <input className={inputCls} placeholder="URL (optional)" value={guideUrl} onChange={(e) => setGuideUrl(e.target.value)} />
          <button disabled={!guideLabel.trim()} onClick={() => { addGuide(guideLabel, guideUrl || undefined); setGuideLabel(""); setGuideUrl(""); }} className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 min-h-[40px]">+ Add guide</button>
        </div>
      </section>

      {/* Team */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">Team members</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {state.settings.team.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">
              {t.name}
              <button onClick={() => removeTeamMember(t.id)} className="text-xs text-destructive">×</button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input className={inputCls} placeholder="Team member name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
          <button disabled={!teamName.trim()} onClick={() => { addTeamMember(teamName); setTeamName(""); }} className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 min-h-[40px]">+ Add</button>
        </div>
      </section>

      {/* Templates */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">Checklist templates</h2>
        <p className="mt-1 text-xs text-muted-foreground">Separate templates for each call type. Rename items, add new items, reorder, set required/optional, archive, and edit help text. Changes apply to new calls only.</p>
        <div className="mt-4 space-y-5">
          {state.settings.templates.map((t) => (
            <TemplateEditor key={t.id} template={t} onAdd={(label, kind, required) => addTemplateItem(t.id, label, kind, required)} onUpdate={(id, patch) => updateTemplateItem(t.id, id, patch)} onRemove={(id) => removeTemplateItem(t.id, id)} onReorder={(id, dir) => reorderTemplateItem(t.id, id, dir)} onRename={(name) => updateTemplate(t.id, { name })} onDesc={(d) => updateTemplate(t.id, { description: d })} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-border bg-card p-5">
        <h2 className="font-display text-base font-semibold text-foreground">Reset demo data</h2>
        <p className="mt-1 text-xs text-muted-foreground">Restores the synthetic seed data. Real records are not persisted — this is a prototype held in browser memory.</p>
        <button onClick={reset} className="mt-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-secondary min-h-[40px]">Reset to synthetic demo data</button>
      </section>
    </div>
  );
}

function TemplateEditor({ template, onAdd, onUpdate, onRemove, onReorder, onRename, onDesc }: {
  template: import("../lib/types").ChecklistTemplate;
  onAdd: (label: string, kind: TemplateItem["kind"], required: boolean) => void;
  onUpdate: (id: string, patch: Partial<TemplateItem>) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, dir: -1 | 1) => void;
  onRename: (name: string) => void;
  onDesc: (d: string) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newKind, setNewKind] = useState<TemplateItem["kind"]>("staff_check");
  const [newRequired, setNewRequired] = useState(true);
  const ct: CallType = template.callType;

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-md bg-secondary/60 px-2 py-0.5 text-xs font-bold text-secondary-foreground">{CALL_TYPE_LABEL[ct]}</span>
        <input className={inputCls + " max-w-xs"} defaultValue={template.name} onBlur={(e) => onRename(e.target.value)} />
      </div>
      <input className={inputCls + " mt-2"} placeholder="Description" defaultValue={template.description ?? ""} onBlur={(e) => onDesc(e.target.value)} />
      <div className="mt-3 space-y-2">
        {template.items.map((it, idx) => (
          <div key={it.id} className={`rounded-lg border p-3 text-xs ${it.archived ? "border-dashed border-border/60 opacity-60" : "border-border"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground">{idx + 1}.</span>
                <input className={inputCls + " min-w-48"} defaultValue={it.label} onBlur={(e) => onUpdate(it.id, { label: e.target.value })} />
              </div>
              <div className="flex items-center gap-1.5">
                <select className={inputCls + " w-32"} value={it.kind} onChange={(e) => onUpdate(it.id, { kind: e.target.value as TemplateItem["kind"] })}>
                  <option value="client_action">Client action</option>
                  <option value="staff_check">Staff check</option>
                </select>
                <label className="inline-flex items-center gap-1 text-muted-foreground">
                  <input type="checkbox" checked={it.required} onChange={(e) => onUpdate(it.id, { required: e.target.checked })} className="h-4 w-4 rounded border-border accent-primary" />
                  Req
                </label>
                <button onClick={() => onReorder(it.id, -1)} disabled={idx === 0} className="rounded border border-border px-2 py-0.5 disabled:opacity-30">↑</button>
                <button onClick={() => onReorder(it.id, 1)} disabled={idx === template.items.length - 1} className="rounded border border-border px-2 py-0.5 disabled:opacity-30">↓</button>
                <button onClick={() => onUpdate(it.id, { archived: !it.archived })} className="rounded border border-border px-2 py-0.5">{it.archived ? "Unarchive" : "Archive"}</button>
                <button onClick={() => onRemove(it.id)} className="rounded border border-destructive/40 px-2 py-0.5 text-destructive">Del</button>
              </div>
            </div>
            <input className={inputCls + " mt-2"} placeholder="Help text (optional)" defaultValue={it.helpText ?? ""} onBlur={(e) => onUpdate(it.id, { helpText: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <input className={inputCls + " min-w-48"} placeholder="New item label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
        <select className={inputCls + " w-32"} value={newKind} onChange={(e) => setNewKind(e.target.value as TemplateItem["kind"])}>
          <option value="client_action">Client action</option>
          <option value="staff_check">Staff check</option>
        </select>
        <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />
          Required
        </label>
        <button disabled={!newLabel.trim()} onClick={() => { onAdd(newLabel, newKind, newRequired); setNewLabel(""); }} className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50 min-h-[40px]">+ Add item</button>
      </div>
    </div>
  );
}