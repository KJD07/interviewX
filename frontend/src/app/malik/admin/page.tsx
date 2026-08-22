"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ApiError, adminApi, type AdminField, type AdminModel, type AdminObject } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import GoogleSignInButton from "@/components/GoogleSignInButton";

const displayName = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

type Group = { app_label: string; models: AdminModel[] };

function AdminWorkspace() {
  const { user, logout } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<AdminModel | null>(null);
  const [rows, setRows] = useState<AdminObject[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState<Record<string, unknown> | null>(null);
  const [editing, setEditing] = useState<AdminObject | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi.schema().then((data) => {
      setGroups(data.groups);
      setSelected(data.groups[0]?.models[0] ?? null);
    }).catch((err) => setError(err instanceof ApiError ? err.detail : "Unable to load admin models."));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setBusy(true);
    adminApi.list(selected, page, search).then((data) => {
      setRows(data.results);
      setTotal(data.total);
    }).catch((err) => setError(err instanceof ApiError ? err.detail : "Unable to load records.")).finally(() => setBusy(false));
  }, [selected, page, search]);

  const selectModel = (model: AdminModel) => {
    setSelected(model); setPage(1); setSearch(""); setForm(null); setMobileOpen(false); setError("");
  };

  const openForm = (row?: AdminObject) => {
    if (!selected) return;
    const values: Record<string, unknown> = {};
    selected.fields.forEach((field) => { values[field.name] = row?.[field.name] ?? (field.type === "BooleanField" ? false : ""); });
    setForm(values); setEditing(row ?? null); setError("");
  };

  const submitForm = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !form) return;
    setBusy(true);
    try {
      if (editing) await adminApi.update(selected, editing.id, form); else await adminApi.create(selected, form);
      setNotice(`${selected.label} saved.`); setForm(null); setEditing(null);
      const data = await adminApi.list(selected, page, search); setRows(data.results); setTotal(data.total);
    } catch (err) { setError(err instanceof ApiError ? err.detail : "Unable to save record."); }
    finally { setBusy(false); }
  };

  const remove = async (row: AdminObject) => {
    if (!selected || !window.confirm(`Delete ${selected.label.toLowerCase()} #${row.id}?`)) return;
    try { await adminApi.remove(selected, row.id); setRows(rows.filter((item) => item.id !== row.id)); setTotal(total - 1); setNotice("Record deleted."); }
    catch (err) { setError(err instanceof ApiError ? err.detail : "Unable to delete record."); }
  };

  const runAction = async (action: string) => {
    if (!selected || !rows.length) return;
    try { const result = await adminApi.action(selected, action, rows.map((row) => row.id)); setNotice(result.detail); }
    catch (err) { setError(err instanceof ApiError ? err.detail : "Unable to run action."); }
  };

  return <div className="min-h-screen flex" style={{ background: "var(--page)" }}>
    {mobileOpen && <button aria-label="Close menu" className="fixed inset-0 z-30 bg-black/20 md:hidden" onClick={() => setMobileOpen(false)} />}
    <aside className={`fixed md:static z-40 inset-y-0 left-0 w-64 border-r transform transition-transform md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`} style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="p-5 border-b" style={{ borderColor: "var(--border)" }}><Link href="/malik/admin" className="font-display text-xl font-bold cursor-blink" style={{ color: "var(--ink)" }}>EvaluLabs</Link><p className="mt-2 text-xs uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>Admin console</p></div>
      <nav className="p-3 overflow-y-auto h-[calc(100vh-92px)]">{groups.map((group) => <div key={group.app_label} className="mb-5"><p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>{group.app_label}</p>{group.models.map((model) => <button key={`${model.app_label}.${model.model}`} onClick={() => selectModel(model)} className="w-full text-left px-3 py-2 rounded text-sm" style={{ background: selected?.model === model.model && selected.app_label === model.app_label ? "var(--ink)" : "transparent", color: selected?.model === model.model && selected.app_label === model.app_label ? "var(--page)" : "var(--ink-dim)" }}>{model.label}</button>)}</div>)}</nav>
    </aside>
    <section className="flex-1 min-w-0">
      <header className="h-16 px-4 sm:px-8 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}><div className="flex items-center gap-3"><button className="md:hidden p-2 rounded" aria-label="Open menu" onClick={() => setMobileOpen(true)} style={{ color: "var(--ink-dim)" }}>☰</button><div><p className="text-xs uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>Workspace</p><h1 className="font-display text-lg font-semibold" style={{ color: "var(--ink)" }}>{selected?.label ?? "Admin"}</h1></div></div><div className="flex items-center gap-3"><span className="hidden sm:block text-xs" style={{ color: "var(--ink-faint)" }}>{user?.email}</span><button onClick={logout} className="text-xs font-medium hover:underline" style={{ color: "var(--accent)" }}>Sign out</button></div></header>
      <main className="p-4 sm:p-8 max-w-[1400px]"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"><p className="text-sm" style={{ color: "var(--ink-dim)" }}>{total} records</p><div className="flex gap-2"><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search records" className="w-full sm:w-64 rounded px-3 py-2 text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border-mid)", color: "var(--ink)" }} /><button onClick={() => openForm()} className="rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>Add new</button></div></div>
        {error && <p className="mb-4 rounded px-3 py-2 text-sm" style={{ background: "rgba(239,68,68,.1)", color: "var(--danger)" }}>{error}</p>}{notice && <p className="mb-4 rounded px-3 py-2 text-sm" style={{ background: "var(--success-bg)", color: "var(--success)" }}>{notice}</p>}
        {selected?.actions.length ? <div className="flex flex-wrap gap-2 mb-4">{selected.actions.map((action) => <button key={action.name} onClick={() => runAction(action.name)} className="rounded px-3 py-1.5 text-xs font-medium" style={{ border: "1px solid var(--border-mid)", color: "var(--ink-dim)" }}>{action.label}</button>)}</div> : null}
        <div className="overflow-x-auto rounded border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}><table className="w-full text-left text-sm"><thead><tr style={{ borderBottom: "1px solid var(--border)" }}>{selected?.list_display.map((field) => <th key={field} className="px-4 py-3 text-xs uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--ink-faint)" }}>{displayName(field)}</th>)}<th /></tr></thead><tbody>{busy ? <tr><td colSpan={(selected?.list_display.length ?? 0) + 1} className="px-4 py-10 text-center" style={{ color: "var(--ink-faint)" }}>Loading...</td></tr> : rows.map((row) => <tr key={row.id} style={{ borderBottom: "1px solid var(--border)" }}>{selected?.list_display.map((field) => <td key={field} className="px-4 py-3 max-w-xs truncate whitespace-nowrap" style={{ color: "var(--ink-dim)" }}>{String(row[`${field}_label`] ?? row[field] ?? "—")}</td>)}<td className="px-4 py-3 whitespace-nowrap text-right"><button onClick={() => openForm(row)} className="mr-3 text-xs font-medium hover:underline" style={{ color: "var(--accent)" }}>Edit</button><button onClick={() => remove(row)} className="text-xs hover:underline" style={{ color: "var(--danger)" }}>Delete</button></td></tr>)}</tbody></table>{!busy && !rows.length && <p className="px-4 py-10 text-center text-sm" style={{ color: "var(--ink-faint)" }}>No records found.</p>}</div><div className="flex justify-between mt-4 text-sm" style={{ color: "var(--ink-dim)" }}><button disabled={page === 1} onClick={() => setPage(page - 1)} className="disabled:opacity-30">Previous</button><span>Page {page}</span><button disabled={page * 25 >= total} onClick={() => setPage(page + 1)} className="disabled:opacity-30">Next</button></div>
      </main>
    </section>
    {form && <div className="fixed inset-0 z-50 bg-black/20 flex justify-end"><form onSubmit={submitForm} className="w-full max-w-lg h-full overflow-y-auto p-6 sm:p-8" style={{ background: "var(--page)" }}><div className="flex justify-between items-center mb-6"><h2 className="font-display text-xl font-semibold" style={{ color: "var(--ink)" }}>{editing ? "Edit" : "Add"} {selected?.label}</h2><button type="button" onClick={() => setForm(null)} aria-label="Close">X</button></div>{selected?.fields.map((field: AdminField) => <label key={field.name} className="block mb-4"><span className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: "var(--ink-dim)" }}>{field.label}</span>{field.choices.length || field.options.length ? <select required={field.required} disabled={field.readonly} value={String(form[field.name] ?? "")} onChange={(event) => setForm({ ...form, [field.name]: event.target.value })} className="w-full rounded px-3 py-2.5 text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border-mid)", color: "var(--ink)" }}><option value="">---------</option>{(field.choices.length ? field.choices : field.options).map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}</select> : <input required={field.required} disabled={field.readonly} type={field.type === "BooleanField" ? "checkbox" : field.type === "IntegerField" ? "number" : "text"} checked={field.type === "BooleanField" ? Boolean(form[field.name]) : undefined} value={field.type === "BooleanField" ? undefined : String(form[field.name] ?? "")} onChange={(event) => setForm({ ...form, [field.name]: field.type === "BooleanField" ? event.target.checked : event.target.value })} className={field.type === "BooleanField" ? "h-4 w-4" : "w-full rounded px-3 py-2.5 text-sm"} style={field.type === "BooleanField" ? { accentColor: "var(--accent)" } : { background: "var(--surface)", border: "1px solid var(--border-mid)", color: "var(--ink)" }} />}</label>)}<button disabled={busy} className="w-full rounded-full py-3 text-sm font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>Save</button></form></div>}
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
