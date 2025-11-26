"use client";
import Link from "next/link";
import Image from "next/image";
import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type SavedQuery = {
  id: number | string;
  owner_id?: string;
  name: string;
  filters?: Record<string, any> | null;
  semantic_query?: string | null;
  schedule_cron?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function fmtDateCell(v: any): string {
  if (v === null || v === undefined || v === "") return "";
  const s = String(v);
  try {
    if (/^\d{8}$/.test(s)) {
      const y = Number(s.slice(0, 4));
      const m = Number(s.slice(4, 6)) - 1;
      const d = Number(s.slice(6, 8));
      return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return s;
  } catch {
    return s;
  }
}

export default function NavBar() {
  const { isAuthenticated, isLoading, user, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0();

  const [showAlerts, setShowAlerts] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [alerts, setAlerts] = useState<SavedQuery[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsErr, setAlertsErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  const userInitials = useMemo(() => {
    const name = user?.name || user?.email || "";
    if (!name) return "";
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [user]);

  const loadAlerts = useCallback(async () => {
    if (!isAuthenticated) return;
    setAlertsLoading(true);
    setAlertsErr(null);
    try {
      const token = await getAccessTokenSilently();
      const r = await fetch("/api/saved-queries", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const t = await r.json();
      const items: SavedQuery[] = Array.isArray(t?.items) ? t.items : Array.isArray(t) ? t : [];
      setAlerts(items);
    } catch (e: any) {
      setAlertsErr(e?.message ?? "failed to load alerts");
    } finally {
      setAlertsLoading(false);
    }
  }, [getAccessTokenSilently, isAuthenticated]);

  const openAlerts = useCallback(() => {
    if (!isAuthenticated) return loginWithRedirect();
    setShowAlerts(true);
    loadAlerts();
  }, [isAuthenticated, loadAlerts, loginWithRedirect]);

  const closeAlerts = useCallback(() => setShowAlerts(false), []);

  const toggleActive = useCallback(async (id: string | number, next: boolean) => {
    try {
      const token = await getAccessTokenSilently();
      const r = await fetch(`/api/saved-queries/${encodeURIComponent(String(id))}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: next }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setAlerts((prev) => prev.map((x) => (String(x.id) === String(id) ? { ...x, is_active: next } : x)));
    } catch (err: any) {
      alert(err?.message ?? "Failed to update");
    }
  }, [getAccessTokenSilently]);

  const deleteAlert = useCallback(async (id: string | number) => {
    const confirmDelete = window.confirm("Delete this alert? This cannot be undone.");
    if (!confirmDelete) return;
    try {
      setDeletingId(id);
      const token = await getAccessTokenSilently();
      const r = await fetch(`/api/saved-queries/${encodeURIComponent(String(id))}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setAlerts((prev) => prev.filter((a) => String(a.id) !== String(id)));
    } catch (e: any) {
      alert(e?.message ?? "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }, [getAccessTokenSilently]);

  // Mount flag to safely use document in Next.js app router
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!mounted) return;
    if (showAlerts) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [showAlerts, mounted]);

  // Close on Escape
  useEffect(() => {
    if (!mounted || !showAlerts) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setShowAlerts(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mounted, showAlerts]);

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-b border-slate-200">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-2">
        <div className="flex items-center gap-2">
          <Link href="/" aria-label="SynapseIP Home" className="inline-flex items-center gap-2">
            <Image src="/images/synapseip-banner-short.png" alt="SynapseIP" width={300} height={60} className="hover:scale-110 transition-transform py-2" />
          </Link>
        </div>

        <div className="flex-1" />

        <div className="hidden md:flex items-center gap-2">
          <Link href="/" className="px-3 py-1.5 text-sm font-semibold rounded-md hover:bg-[#d9e1eb] hover:underline text-[#3A506B]">Search & Trends</Link>
          <Link href="/overview" className="px-3 py-1.5 text-sm font-semibold rounded-md hover:bg-[#d9e1eb] hover:underline text-[#3A506B]">IP Overview</Link>
          <Link href="/citation" className="px-3 py-1.5 text-sm font-semibold rounded-md hover:bg-[#d9e1eb] hover:underline text-[#3A506B]">Citation Tracker</Link>
          <Link href="/scope-analysis" className="px-3 py-1.5 text-sm font-semibold rounded-md hover:bg-[#d9e1eb] hover:underline text-[#3A506B]">Scope Analysis</Link>
        </div>

        <div className="hidden md:flex items-center px-2 mx-2 border-l border-r border-slate-200">
          <Link href="/help" className="px-3 py-1.5 text-sm font-semibold rounded-md hover:bg-[#d9e1eb] hover:underline text-[#3A506B]">Help</Link>
        </div>
        <div className="hidden md:flex items-center gap-1 pl-1 ml-1">
          {isLoading ? (
            <span className="text-xs text-slate-500">Loading…</span>
          ) : isAuthenticated ? (
            <div className="relative group">
              <button
                type="button"
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold text-[#3A506B] hover:bg-[#d9e1eb] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                aria-haspopup="menu"
              >
                <span className="hidden sm:inline whitespace-nowrap">{user?.name || user?.email}</span>
                <div className="w-7 h-7 rounded-full bg-sky-500/10 border border-sky-300 text-sky-700 text-xs font-semibold grid place-items-center">
                  {userInitials}
                </div>
              </button>
              <div className="absolute right-0 top-full mt-2 w-48 rounded-md border border-slate-200 bg-white shadow-lg opacity-0 pointer-events-none translate-y-1 transition-all group-hover:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 z-50">
                <button
                  type="button"
                  onClick={openAlerts}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  disabled={isLoading}
                >
                  Alerts
                </button>
                <Link href="/billing" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  Billing
                </Link>
                <button
                  type="button"
                  onClick={() => logout({ logoutParams: { returnTo: typeof window !== "undefined" ? window.location.origin : undefined } })}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Log out
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => loginWithRedirect()}
              className="h-8 px-3 text-sm rounded-md border border-sky-600 bg-sky-500 text-white hover:bg-sky-600 shadow-sm"
            >
              Log in / Sign up
            </button>
          )}
        </div>

        {/* Mobile menu (simple) */}
        <div className="md:hidden flex items-center gap-1">
          <Link href="/" className="px-2 py-1 text-xs rounded hover:bg-slate-100">Search</Link>
          <Link href="/overview" className="px-2 py-1 text-xs rounded hover:bg-slate-100">IP Overview</Link>
          <Link href="/citation" className="px-2 py-1 text-xs rounded hover:bg-slate-100">Citation</Link>
          <Link href="/scope-analysis" className="px-2 py-1 text-xs rounded hover:bg-slate-100">Scope</Link>
          <button onClick={openAlerts} className="px-2 py-1 text-xs rounded hover:bg-slate-100">Alerts</button>
          <Link href="/billing" className="px-2 py-1 text-xs rounded hover:bg-slate-100">Billing</Link>
          <Link href="/help" className="px-2 py-1 text-xs rounded hover:bg-slate-100">Help</Link>
        </div>
      </nav>

      {/* Alerts Modal via Portal to escape header's containing context */}
      {mounted && showAlerts && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
              <div className="w-[min(1200px,95vw)] max-h-[80vh] bg-white rounded-xl shadow-xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b">
                  <div className="flex items-center gap-2">
                    <h3 className="m-0 font-semibold">Your Alerts</h3>
                  </div>
                  <button onClick={closeAlerts} className="h-8 px-3 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50">Close</button>
                </div>
                <div className="p-4 overflow-auto">
                  {alertsLoading ? (
                    <div className="text-sm text-slate-500">Loading…</div>
                  ) : alertsErr ? (
                    <div className="text-sm text-red-600">Error: {alertsErr}</div>
                  ) : alerts.length === 0 ? (
                    <div className="text-sm text-slate-500">No alerts saved yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-700">
                            <th className="text-left px-3 py-2 border-b">Name</th>
                            <th className="text-left px-3 py-2 border-b">Keywords</th>
                            <th className="text-left px-3 py-2 border-b">Assignee</th>
                            <th className="text-left px-3 py-2 border-b">CPC</th>
                            <th className="text-left px-3 py-2 border-b">Date Range</th>
                            <th className="text-left px-3 py-2 border-b">Semantic</th>
                            <th className="text-left px-3 py-2 border-b">Schedule</th>
                            <th className="text-left px-3 py-2 border-b">Active</th>
                            <th className="text-left px-3 py-2 border-b">Created</th>
                            <th className="px-3 py-2 border-b"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {alerts.map((a) => {
                            const f = (a.filters ?? {}) as Record<string, any>;
                            const kw = f.keywords ?? f.q ?? "";
                            const ass = f.assignee ?? "";
                            const cpcv = f.cpc ?? "";
                            const df = f.date_from ?? "";
                            const dt = f.date_to ?? "";
                            const dr = df || dt ? `${fmtDateCell(df)} – ${fmtDateCell(dt)}` : "";
                            return (
                              <tr key={String(a.id)} className="odd:bg-white even:bg-slate-50/40">
                                <td className="px-3 py-2 align-top">{a.name}</td>
                                <td className="px-3 py-2 align-top">{String(kw).length > 36 ? String(kw).slice(0, 35) + "…" : String(kw)}</td>
                                <td className="px-3 py-2 align-top">{String(ass).length > 24 ? String(ass).slice(0, 23) + "…" : String(ass)}</td>
                                <td className="px-3 py-2 align-top">{Array.isArray(cpcv) ? cpcv.join(', ') : String(cpcv ?? '')}</td>
                                <td className="px-3 py-2 align-top">{dr}</td>
                                <td className="px-3 py-2 align-top">{String(a.semantic_query ?? '')}</td>
                                <td className="px-3 py-2 align-top">{a.schedule_cron ?? '—'}</td>
                                <td className="px-3 py-2 align-top">
                                  <label className="inline-flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={!!(a.is_active ?? true)}
                                      onChange={(e) => toggleActive(a.id, e.currentTarget.checked)}
                                    />
                                    <span className="text-xs text-slate-600">{(a.is_active ?? true) ? 'Active' : 'Inactive'}</span>
                                  </label>
                                </td>
                                <td className="px-3 py-2 align-top">{a.created_at ? fmtDateCell(a.created_at) : ''}</td>
                                <td className="px-3 py-2 align-top text-right">
                                  <button
                                    onClick={() => deleteAlert(a.id)}
                                    disabled={deletingId === a.id}
                                    className="h-7 px-2 text-xs rounded border border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                                    title="Delete alert"
                                  >
                                    {deletingId === a.id ? 'Deleting…' : 'Delete'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </header>
  );
}
