"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ApiError,
  adminApi,
  type AdminField,
  type AdminHistoryEntry,
  type AdminInline,
  type AdminInsights,
  type AdminModel,
  type AdminObject,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import GoogleSignInButton from "@/components/GoogleSignInButton";

const displayName = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

type Group = { app_label: string; models: AdminModel[] };

function MetricCard({ title, value, detail }: { title: string; value: string | number; detail?: string }) {
  return <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}><p className="text-xs uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>{title}</p><p className="mt-2 font-display text-3xl font-semibold tabular-nums" style={{ color: "var(--ink)" }}>{value}</p>{detail && <p className="mt-1 text-xs" style={{ color: "var(--ink-dim)" }}>{detail}</p>}</div>;
}

function Bars({ data, color = "#e8ff3d" }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return <div className="flex items-end gap-2 h-40">{data.map((item) => <div key={item.label} className="flex-1 h-full flex flex-col justify-end items-center gap-2"><span className="text-[10px] tabular-nums" style={{ color: "var(--ink-dim)" }}>{item.value}</span><div className="w-full max-w-8 rounded-t" style={{ height: `${Math.max(4, (item.value / max) * 100)}%`, background: color }} /><span className="text-[9px] truncate max-w-full" style={{ color: "var(--ink-faint)" }}>{item.label}</span></div>)}</div>;
}

function Donut({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((sum, value) => sum + value, 0) || 1;
  const colors = ["#e8ff3d", "#22c55e", "#f59e0b", "#ef4444", "#8a8a7e"];
  let offset = 0;
  const gradient = Object.values(data).map((value, index) => { const start = offset; offset += (value / total) * 360; return `${colors[index % colors.length]} ${start}deg ${offset}deg`; }).join(", ");
  return <div className="flex items-center gap-6"><div className="h-32 w-32 rounded-full shrink-0" style={{ background: `conic-gradient(${gradient})` }}><div className="m-5 h-22 w-22 rounded-full flex items-center justify-center" style={{ background: "var(--surface)" }}><span className="font-display font-semibold">{total}</span></div></div><div className="space-y-2">{Object.entries(data).map(([name, value], index) => <div key={name} className="flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: colors[index % colors.length] }} /><span style={{ color: "var(--ink-dim)" }}>{displayName(name)}</span><strong style={{ color: "var(--ink)" }}>{value}</strong></div>)}</div></div>;
}

function Insights({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<AdminInsights | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { adminApi.insights().then(setData).catch((err) => setError(err instanceof ApiError ? err.detail : "Unable to load insights.")); }, []);
  if (error) return <main className="p-6 sm:p-10"><button onClick={onBack} className="text-sm underline">Back</button><p className="mt-8 text-sm" style={{ color: "var(--danger)" }}>{error}</p></main>;
  if (!data) return <main className="p-6 sm:p-10"><p className="text-sm" style={{ color: "var(--ink-faint)" }}>Loading insights...</p></main>;
  const money = (amount: number) => `₹${(amount / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  return <main className="p-4 sm:p-8 max-w-[1400px] fade-up"><div className="flex items-center justify-between mb-8"><div><button onClick={onBack} className="text-xs mb-3 hover:underline" style={{ color: "var(--ink-dim)" }}>← Admin workspace</button><h1 className="font-display text-3xl font-semibold" style={{ color: "var(--ink)" }}>Insights</h1><p className="mt-2 text-sm" style={{ color: "var(--ink-dim)" }}>A live view of growth, engagement, inventory, and revenue.</p></div></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6"><MetricCard title="Companies" value={data.companies} /><MetricCard title="Revenue this month" value={money(data.revenue.month)} /><MetricCard title="New users" value={data.new_users.reduce((sum, item) => sum + item.count, 0)} detail="Last 12 months" /><MetricCard title="Monthly active" value={data.monthly_active_users[data.monthly_active_users.length - 1]?.count ?? 0} /></div><div className="grid lg:grid-cols-2 gap-6"><div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}><h2 className="font-display font-semibold" style={{ color: "var(--ink)" }}>Acquisition sources</h2><p className="text-xs mt-1 mb-5" style={{ color: "var(--ink-faint)" }}>Tracked from ref and UTM links</p><Bars data={Object.entries(data.referrals).map(([label, value]) => ({ label, value }))} /></div><div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}><h2 className="font-display font-semibold mb-5" style={{ color: "var(--ink)" }}>Plan distribution</h2><Donut data={data.plans} /></div><div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}><h2 className="font-display font-semibold" style={{ color: "var(--ink)" }}>New users by month</h2><p className="text-xs mt-1 mb-5" style={{ color: "var(--ink-faint)" }}>Account registrations</p><Bars data={data.new_users.slice(-12).map((item) => ({ label: item.month, value: item.count }))} color="var(--accent)" /></div><div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}><h2 className="font-display font-semibold" style={{ color: "var(--ink)" }}>Monthly active users</h2><p className="text-xs mt-1 mb-5" style={{ color: "var(--ink-faint)" }}>Users with a login in each month</p><Bars data={data.monthly_active_users.slice(-12).map((item) => ({ label: item.month, value: item.count }))} color="#22c55e" /></div><div className="lg:col-span-2 rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}><div className="flex flex-wrap items-center justify-between gap-4 mb-5"><h2 className="font-display font-semibold" style={{ color: "var(--ink)" }}>Revenue</h2><div className="flex gap-4">{Object.entries(data.revenue).map(([period, amount]) => <div key={period}><p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>{period}</p><p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{money(amount)}</p></div>)}</div></div><Bars data={data.revenue_daily.slice(-30).map((item) => ({ label: item.day.slice(5), value: item.amount }))} color="#f59e0b" /></div></div></main>;
}

const inputStyle = { background: "var(--surface)", border: "1px solid var(--border-mid)", color: "var(--ink)" } as const;
const labelStyle = { color: "var(--ink-dim)" } as const;

// FK/M2M picker: preloads a small initial set (field.options, capped server-side
// at 50) and layers an async type-ahead search on top via the lookup endpoint,
// instead of relying on a big preloaded list.
function FkPicker({ field, model, value, onChange, multiple }: {
  field: AdminField;
  model: AdminModel;
  value: unknown;
  onChange: (value: unknown) => void;
  multiple: boolean;
}) {
  const [query, setQuery] = useState("");
  const [extra, setExtra] = useState<{ value: number; label: string }[]>([]);
  useEffect(() => {
    if (!query.trim()) { setExtra([]); return; }
    const handle = setTimeout(() => {
      adminApi.lookup(model.app_label, model.model, query).then((res) => setExtra(res.results)).catch(() => {});
    }, 250);
    return () => clearTimeout(handle);
  }, [query, model.app_label, model.model]);
  const optionMap = new Map<string, string>();
  [...field.options, ...extra].forEach((option) => optionMap.set(String(option.value), option.label));
  const options = Array.from(optionMap.entries()).map(([value, label]) => ({ value, label }));
  return <div>
    <input
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder={`Search ${field.label.toLowerCase()}...`}
      className="w-full rounded px-3 py-2 text-sm mb-1.5"
      style={inputStyle}
    />
    <select
      multiple={multiple}
      required={field.required && !multiple}
      value={multiple ? (Array.isArray(value) ? (value as unknown[]).map(String) : []) : String(value ?? "")}
      onChange={(event) => {
        if (multiple) {
          const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
          onChange(selected);
        } else {
          onChange(event.target.value);
        }
      }}
      className="w-full rounded px-3 py-2.5 text-sm"
      style={inputStyle}
      size={multiple ? Math.min(5, Math.max(3, options.length)) : undefined}
    >
      {!multiple && <option value="">---------</option>}
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </div>;
}

function HistoryPanel({ model, objectId }: { model: AdminModel; objectId: number }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AdminHistoryEntry[] | null>(null);
  const load = () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (entries === null) {
      adminApi.history(model, objectId).then((res) => setEntries(res.entries)).catch(() => setEntries([]));
    }
  };
  return <div className="mt-2 mb-4">
    <button type="button" onClick={load} className="text-xs font-medium hover:underline" style={{ color: "var(--accent)" }}>
      {open ? "Hide history" : "History"}
    </button>
    {open && <div className="mt-2 rounded border p-3 max-h-48 overflow-y-auto text-xs space-y-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      {entries === null && <p style={labelStyle}>Loading...</p>}
      {entries !== null && entries.length === 0 && <p style={labelStyle}>No history recorded.</p>}
      {entries?.map((entry) => <div key={entry.id} style={{ borderBottom: "1px solid var(--border)" }} className="pb-2">
        <p style={{ color: "var(--ink)" }}><strong>{entry.action}</strong> by {entry.user || "system"} — {new Date(entry.timestamp).toLocaleString()}</p>
        {entry.change_message && <p style={labelStyle}>{entry.change_message}</p>}
      </div>)}
    </div>}
  </div>;
}

// Read + quick-add list of a parent object's inline children (Role under
// Company, Round under Role, etc.) reusing the child model's own generic
// list/create endpoints, filtered by the FK back to the parent.
function InlineChildrenSection({ inline, groups, parentId }: {
  inline: AdminInline;
  groups: Group[];
  parentId: number;
}) {
  const childModel = groups.flatMap((group) => group.models).find(
    (model) => model.app_label === inline.app_label && model.model === inline.model_name
  );
  const [rows, setRows] = useState<AdminObject[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [error, setError] = useState("");

  const load = () => {
    if (!childModel) return;
    adminApi.listChildren(childModel, inline.fk_name, parentId).then((res) => setRows(res.results)).catch(() => setRows([]));
  };
  useEffect(load, [childModel, parentId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!childModel) return null;

  const startAdd = () => {
    const values: Record<string, unknown> = {};
    childModel.fields.forEach((field) => { values[field.name] = field.type === "BooleanField" ? false : ""; });
    values[inline.fk_name] = parentId;
    setForm(values);
    setAdding(true);
  };

  const submitAdd = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await adminApi.create(childModel, form);
      setAdding(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Unable to add record.");
    }
  };

  return <div className="mb-5 rounded border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-semibold uppercase tracking-wider" style={labelStyle}>{inline.label}</span>
      {childModel.can_add && <button type="button" onClick={startAdd} className="text-xs font-medium hover:underline" style={{ color: "var(--accent)" }}>+ Add</button>}
    </div>
    {rows === null && <p className="text-xs" style={labelStyle}>Loading...</p>}
    {rows !== null && rows.length === 0 && <p className="text-xs" style={labelStyle}>None yet.</p>}
    <ul className="text-xs space-y-1">
      {rows?.map((row) => <li key={row.id} style={{ color: "var(--ink-dim)" }}>#{row.id} — {String(row[childModel.list_display[1] ?? childModel.list_display[0]] ?? row.id)}</li>)}
    </ul>
    {adding && <form onSubmit={submitAdd} className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
      {childModel.fields.filter((field) => field.name !== inline.fk_name && !field.readonly).map((field) => <label key={field.name} className="block">
        <span className="block text-[10px] font-medium mb-1 uppercase tracking-wider" style={labelStyle}>{field.label}</span>
        {field.choices.length || field.options.length
          ? <select required={field.required} value={String(form[field.name] ?? "")} onChange={(event) => setForm({ ...form, [field.name]: event.target.value })} className="w-full rounded px-2 py-1.5 text-xs" style={inputStyle}>
              <option value="">---------</option>
              {(field.choices.length ? field.choices : field.options).map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
            </select>
          : <input required={field.required} type={field.type === "IntegerField" ? "number" : "text"} value={String(form[field.name] ?? "")} onChange={(event) => setForm({ ...form, [field.name]: event.target.value })} className="w-full rounded px-2 py-1.5 text-xs" style={inputStyle} />}
      </label>)}
      {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="flex gap-2">
        <button className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>Save</button>
        <button type="button" onClick={() => setAdding(false)} className="text-xs" style={labelStyle}>Cancel</button>
      </div>
    </form>}
  </div>;
}

// Renders one edit-form field, dispatching on AdminField.type: readonly
// JSON/plain readonly fields render as a disabled pretty-printed block,
// the User password field gets its dedicated write-only control, FK/M2M
// fields get the searchable FkPicker, enum fields a plain select, and
// everything else the original checkbox/number/text input.
function FieldControl({ field, form, setForm, selected }: {
  field: AdminField;
  form: Record<string, unknown>;
  setForm: (value: Record<string, unknown>) => void;
  selected: AdminModel;
}) {
  if (field.readonly && (field.type === "JSONField" || field.type === "ReadonlyField")) {
    const raw = form[field.name];
    const pretty = field.type === "JSONField" && raw && typeof raw !== "string" ? JSON.stringify(raw, null, 2) : String(raw ?? "—");
    return <div className="block mb-4">
      <span className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={labelStyle}>{field.label}</span>
      <pre className="w-full rounded px-3 py-2.5 text-xs overflow-x-auto whitespace-pre-wrap" style={{ ...inputStyle, maxHeight: 220, overflowY: "auto" }}>{pretty}</pre>
    </div>;
  }

  if (field.type === "PasswordField") {
    return <label className="block mb-4">
      <span className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={labelStyle}>{field.label}</span>
      <input type="password" autoComplete="new-password" placeholder={field.help_text} value={String(form[field.name] ?? "")} onChange={(event) => setForm({ ...form, [field.name]: event.target.value })} className="w-full rounded px-3 py-2.5 text-sm" style={inputStyle} />
      <span className="block text-[11px] mt-1" style={{ color: "var(--ink-faint)" }}>{field.help_text}</span>
    </label>;
  }

  if (!field.choices.length && (field.is_m2m || field.type === "ModelChoiceField")) {
    return <label className="block mb-4">
      <span className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={labelStyle}>{field.label}</span>
      <FkPicker field={field} model={selected} value={form[field.name]} onChange={(value) => setForm({ ...form, [field.name]: value })} multiple={field.is_m2m} />
    </label>;
  }

  return <label className="block mb-4">
    <span className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={labelStyle}>{field.label}</span>
    {field.choices.length || field.options.length
      ? <select required={field.required} disabled={field.readonly} value={String(form[field.name] ?? "")} onChange={(event) => setForm({ ...form, [field.name]: event.target.value })} className="w-full rounded px-3 py-2.5 text-sm" style={inputStyle}>
          <option value="">---------</option>
          {(field.choices.length ? field.choices : field.options).map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
        </select>
      : <input required={field.required} disabled={field.readonly} type={field.type === "BooleanField" ? "checkbox" : field.type === "IntegerField" ? "number" : "text"} checked={field.type === "BooleanField" ? Boolean(form[field.name]) : undefined} value={field.type === "BooleanField" ? undefined : String(form[field.name] ?? "")} onChange={(event) => setForm({ ...form, [field.name]: field.type === "BooleanField" ? event.target.checked : event.target.value })} className={field.type === "BooleanField" ? "h-4 w-4" : "w-full rounded px-3 py-2.5 text-sm"} style={field.type === "BooleanField" ? { accentColor: "var(--accent)" } : inputStyle} />}
  </label>;
}

function AdminWorkspace() {
  const { user, logout } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<AdminModel | null>(null);
  const [rows, setRows] = useState<AdminObject[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState<Record<string, unknown> | null>(null);
  const [editing, setEditing] = useState<AdminObject | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    adminApi.schema().then((data) => {
      setGroups(data.groups);
      setSelected(data.groups[0]?.models[0] ?? null);
    }).catch((err) => setError(err instanceof ApiError ? err.detail : "Unable to load admin models."));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setBusy(true);
    adminApi.list(selected, page, search, filters).then((data) => {
      setRows(data.results);
      setTotal(data.total);
      setSelectedIds(new Set());
    }).catch((err) => setError(err instanceof ApiError ? err.detail : "Unable to load records.")).finally(() => setBusy(false));
  }, [selected, page, search, filters]);

  const selectModel = (model: AdminModel) => {
    setSelected(model); setPage(1); setSearch(""); setFilters({}); setForm(null); setMobileOpen(false); setError("");
  };

  const openForm = (row?: AdminObject) => {
    if (!selected) return;
    const values: Record<string, unknown> = {};
    selected.fields.forEach((field) => {
      if (field.type === "PasswordField") { values[field.name] = ""; return; }
      values[field.name] = row?.[field.name] ?? (field.type === "BooleanField" ? false : field.is_m2m ? [] : "");
    });
    setForm(values); setEditing(row ?? null); setError("");
  };

  const submitForm = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !form) return;
    setBusy(true);
    const payload = { ...form };
    if (payload.password === "") delete payload.password; // blank = keep current password on edit
    try {
      if (editing) await adminApi.update(selected, editing.id, payload); else await adminApi.create(selected, payload);
      setNotice(`${selected.label} saved.`); setForm(null); setEditing(null);
      const data = await adminApi.list(selected, page, search, filters); setRows(data.results); setTotal(data.total);
    } catch (err) { setError(err instanceof ApiError ? err.detail : "Unable to save record."); }
    finally { setBusy(false); }
  };

  const remove = async (row: AdminObject) => {
    if (!selected) return;
    let confirmMessage = `Delete ${selected.label.toLowerCase()} #${row.id}?`;
    try {
      const preview = await adminApi.deletePreview(selected, row.id);
      const counts = Object.entries(preview.model_count).map(([label, count]) => `${count} ${label}`).join(", ");
      if (counts) confirmMessage += `\n\nThis will also delete: ${counts}.`;
      if (preview.protected.length) confirmMessage += `\n\nBlocked by protected relations: ${preview.protected.join(", ")}`;
    } catch {
      // Preview is best-effort — fall back to the plain confirm on failure.
    }
    if (!window.confirm(confirmMessage)) return;
    try { await adminApi.remove(selected, row.id); setRows(rows.filter((item) => item.id !== row.id)); setTotal(total - 1); setNotice("Record deleted."); }
    catch (err) { setError(err instanceof ApiError ? err.detail : "Unable to delete record."); }
  };

  // Operates on the checked rows; if none are checked, falls back to every
  // row currently loaded on the page rather than silently doing nothing.
  const runAction = async (action: string) => {
    if (!selected || !rows.length) return;
    const ids = selectedIds.size ? Array.from(selectedIds) : rows.map((row) => row.id);
    try { const result = await adminApi.action(selected, action, ids); setNotice(result.detail); }
    catch (err) { setError(err instanceof ApiError ? err.detail : "Unable to run action."); }
  };

  const toggleRow = (id: number) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const toggleAll = () => {
    setSelectedIds((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((row) => row.id))));
  };

  const handleSpreadsheetUpload = async (file: File) => {
    setUploading(true); setError("");
    try {
      const result = await adminApi.uploadSpreadsheet(file);
      setNotice(result.detail);
      if (selected) { const data = await adminApi.list(selected, page, search, filters); setRows(data.results); setTotal(data.total); }
    } catch (err) { setError(err instanceof ApiError ? err.detail : "Unable to upload spreadsheet."); }
    finally { setUploading(false); }
  };

  const handleSponsorshipUpload = async (campaignId: number, file: File) => {
    setUploading(true); setError("");
    try {
      const result = await adminApi.uploadSponsorshipEmails(campaignId, file);
      setNotice(result.detail);
    } catch (err) { setError(err instanceof ApiError ? err.detail : "Unable to upload emails."); }
    finally { setUploading(false); }
  };

  return <div className="min-h-screen flex" style={{ background: "var(--page)" }}>
    {mobileOpen && <button aria-label="Close menu" className="fixed inset-0 z-30 bg-black/20 md:hidden" onClick={() => setMobileOpen(false)} />}
    <aside className={`fixed md:static z-40 inset-y-0 left-0 w-64 border-r transform transition-transform md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`} style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="p-5 border-b" style={{ borderColor: "var(--border)" }}><Link href="/malik/admin" className="font-display text-xl font-bold cursor-blink" style={{ color: "var(--ink)" }}>EvaluLabs</Link><p className="mt-2 text-xs uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>Admin console</p></div>
      <nav className="p-3 overflow-y-auto h-[calc(100vh-92px)]"><button onClick={() => { setShowInsights(true); setMobileOpen(false); }} className="w-full text-left px-3 py-2 rounded text-sm font-semibold mb-5" style={{ background: "#e8ff3d", color: "#14140f" }}>Insights</button>{groups.map((group) => <div key={group.app_label} className="mb-5"><p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>{group.app_label}</p>{group.models.map((model) => <button key={`${model.app_label}.${model.model}`} onClick={() => { setShowInsights(false); selectModel(model); }} className="w-full text-left px-3 py-2 rounded text-sm" style={{ background: !showInsights && selected?.model === model.model && selected.app_label === model.app_label ? "var(--ink)" : "transparent", color: !showInsights && selected?.model === model.model && selected.app_label === model.app_label ? "var(--page)" : "var(--ink-dim)" }}>{model.label}</button>)}</div>)}</nav>
    </aside>
    <section className="flex-1 min-w-0">
      <header className="h-16 px-4 sm:px-8 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}><div className="flex items-center gap-3"><button className="md:hidden p-2 rounded" aria-label="Open menu" onClick={() => setMobileOpen(true)} style={{ color: "var(--ink-dim)" }}>☰</button><div><p className="text-xs uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>Workspace</p><h1 className="font-display text-lg font-semibold" style={{ color: "var(--ink)" }}>{selected?.label ?? "Admin"}</h1></div></div><div className="flex items-center gap-3"><span className="hidden sm:block text-xs" style={{ color: "var(--ink-faint)" }}>{user?.email}</span><button onClick={logout} className="text-xs font-medium hover:underline" style={{ color: "var(--accent)" }}>Sign out</button></div></header>
      {showInsights ? <Insights onBack={() => setShowInsights(false)} /> : <main className="p-4 sm:p-8 max-w-[1400px]"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"><p className="text-sm" style={{ color: "var(--ink-dim)" }}>{total} records</p><div className="flex flex-wrap gap-2 items-center">
          {selected?.list_filter.map((filter) => filter.choices.length ? <select key={filter.name} value={filters[filter.name] ?? ""} onChange={(event) => { setFilters({ ...filters, [filter.name]: event.target.value }); setPage(1); }} className="rounded px-2 py-2 text-xs" style={inputStyle}><option value="">All {filter.label}</option>{filter.choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select> : null)}
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search records" className="w-full sm:w-64 rounded px-3 py-2 text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border-mid)", color: "var(--ink)" }} />
          {selected?.app_label === "companies" && selected.model === "company" && selected.can_change && <label className="rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap cursor-pointer" style={{ border: "1px solid var(--border-mid)", color: "var(--ink-dim)" }}>{uploading ? "Uploading..." : "Upload spreadsheet"}<input type="file" accept=".csv,.xlsx" className="hidden" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) handleSpreadsheetUpload(file); event.target.value = ""; }} /></label>}
          {selected?.can_add && <button onClick={() => openForm()} className="rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>Add new</button>}
        </div></div>
        {error && <p className="mb-4 rounded px-3 py-2 text-sm" style={{ background: "rgba(239,68,68,.1)", color: "var(--danger)" }}>{error}</p>}{notice && <p className="mb-4 rounded px-3 py-2 text-sm whitespace-pre-line" style={{ background: "var(--success-bg)", color: "var(--success)" }}>{notice}</p>}
        {selected?.actions.length ? <div className="flex flex-wrap gap-2 mb-4 items-center">{selected.actions.map((action) => <button key={action.name} onClick={() => runAction(action.name)} className="rounded px-3 py-1.5 text-xs font-medium" style={{ border: "1px solid var(--border-mid)", color: "var(--ink-dim)" }}>{action.label}</button>)}<span className="text-xs" style={{ color: "var(--ink-faint)" }}>{selectedIds.size ? `${selectedIds.size} selected` : "acts on all rows on this page unless you check some"}</span></div> : null}
        <div className="overflow-x-auto rounded border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}><table className="w-full text-left text-sm"><thead><tr style={{ borderBottom: "1px solid var(--border)" }}><th className="px-4 py-3 w-8"><input type="checkbox" checked={rows.length > 0 && selectedIds.size === rows.length} onChange={toggleAll} style={{ accentColor: "var(--accent)" }} /></th>{selected?.list_display.map((field) => <th key={field} className="px-4 py-3 text-xs uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--ink-faint)" }}>{displayName(field)}</th>)}<th /></tr></thead><tbody>{busy ? <tr><td colSpan={(selected?.list_display.length ?? 0) + 2} className="px-4 py-10 text-center" style={{ color: "var(--ink-faint)" }}>Loading...</td></tr> : rows.map((row) => <tr key={row.id} style={{ borderBottom: "1px solid var(--border)" }}><td className="px-4 py-3"><input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleRow(row.id)} style={{ accentColor: "var(--accent)" }} /></td>{selected?.list_display.map((field) => <td key={field} className="px-4 py-3 max-w-xs truncate whitespace-nowrap" style={{ color: "var(--ink-dim)" }}>{String(row[`${field}_label`] ?? row[field] ?? "—")}</td>)}<td className="px-4 py-3 whitespace-nowrap text-right">{selected?.can_change && <button onClick={() => openForm(row)} className="mr-3 text-xs font-medium hover:underline" style={{ color: "var(--accent)" }}>Edit</button>}{selected?.can_delete && <button onClick={() => remove(row)} className="text-xs hover:underline" style={{ color: "var(--danger)" }}>Delete</button>}</td></tr>)}</tbody></table>{!busy && !rows.length && <p className="px-4 py-10 text-center text-sm" style={{ color: "var(--ink-faint)" }}>No records found.</p>}</div><div className="flex justify-between mt-4 text-sm" style={{ color: "var(--ink-dim)" }}><button disabled={page === 1} onClick={() => setPage(page - 1)} className="disabled:opacity-30">Previous</button><span>Page {page}</span><button disabled={page * 25 >= total} onClick={() => setPage(page + 1)} className="disabled:opacity-30">Next</button></div>
      </main>}
    </section>
    {form && <div className="fixed inset-0 z-50 bg-black/20 flex justify-end"><form onSubmit={submitForm} className="w-full max-w-lg h-full overflow-y-auto p-6 sm:p-8" style={{ background: "var(--page)" }}><div className="flex justify-between items-center mb-6"><h2 className="font-display text-xl font-semibold" style={{ color: "var(--ink)" }}>{editing ? "Edit" : "Add"} {selected?.label}</h2><button type="button" onClick={() => setForm(null)} aria-label="Close">X</button></div>

      {editing && selected && selected.app_label === "subscriptions" && selected.model === "sponsorshipcampaign" && <div className="mb-5 rounded border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <label className="rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer inline-block" style={{ border: "1px solid var(--border-mid)", color: "var(--ink-dim)" }}>{uploading ? "Uploading..." : "Upload covered emails"}<input type="file" accept=".csv,.xlsx" className="hidden" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) handleSponsorshipUpload(editing.id, file); event.target.value = ""; }} /></label>
      </div>}

      {editing && selected && <HistoryPanel model={selected} objectId={editing.id} />}

      {selected && (selected.fieldsets.length
        ? selected.fieldsets.map((fieldset) => <div key={fieldset.title || "_"} className="mb-5">
            {fieldset.title && <h3 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--ink-faint)" }}>{fieldset.title}</h3>}
            {fieldset.field_names.map((name) => selected.fields.find((f) => f.name === name)).filter((f): f is AdminField => !!f).map((field) => <FieldControl key={field.name} field={field} form={form!} setForm={setForm} selected={selected} />)}
          </div>)
        : selected.fields.map((field) => <FieldControl key={field.name} field={field} form={form!} setForm={setForm} selected={selected} />))}

      {editing && selected?.inlines.map((inline) => <InlineChildrenSection key={`${inline.app_label}.${inline.model_name}`} inline={inline} groups={groups} parentId={editing.id} />)}

      <button disabled={busy} className="w-full rounded-full py-3 text-sm font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>Save</button></form></div>}
  </div>;
}

export default function AdminLoginPage() {
  const { login, user, loading } = useAuth();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async (event: FormEvent) => { event.preventDefault(); setError(""); setSubmitting(true); try { await login(email, password); } catch (err) { setError(err instanceof ApiError ? err.detail : "Unable to sign in."); } finally { setSubmitting(false); } };
  if (user?.is_staff) return <AdminWorkspace />;
  if (user && !user.is_staff) return <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--page)" }}><div className="text-center"><h1 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>Staff access required</h1><p className="mt-2 text-sm" style={{ color: "var(--ink-dim)" }}>This area is restricted to authorized staff accounts.</p><Link href="/dashboard" className="inline-block mt-6 text-sm underline" style={{ color: "var(--accent)" }}>Back to dashboard</Link></div></main>;
  return <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--page)" }}><div className="w-full max-w-md p-6 sm:p-8 fade-up"><div className="mb-8"><span className="text-2xl font-bold cursor-blink" style={{ color: "var(--ink)" }}>EvaluLabs</span><p className="mt-2 text-sm" style={{ color: "var(--ink-dim)" }}>Staff sign in</p></div><div className="mb-6"><GoogleSignInButton adminOnly onError={setError} onStart={() => setSubmitting(true)} /></div><div className="flex items-center gap-3 mb-6"><div className="h-px flex-1" style={{ background: "var(--border-mid)" }} /><span className="text-sm" style={{ color: "var(--ink-faint)" }}>or</span><div className="h-px flex-1" style={{ background: "var(--border-mid)" }} /></div><form onSubmit={handleSubmit} className="space-y-5"><input aria-label="Email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="staff@example.com" className="w-full rounded px-3.5 py-2.5 text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border-mid)", color: "var(--ink)" }} /><input aria-label="Password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="w-full rounded px-3.5 py-2.5 text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border-mid)", color: "var(--ink)" }} />{error && <p className="text-sm rounded px-3 py-2" style={{ color: "var(--danger)" }}>{error}</p>}<button disabled={submitting || loading} className="w-full rounded-full py-3 text-sm font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>{submitting ? "Signing in..." : "Sign in"}</button></form></div></main>;
}
