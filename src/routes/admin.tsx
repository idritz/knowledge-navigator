import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { adminLabels, bookingStatusStyles, driverDocs, facilityDocs, verificationLabels } from "@/config";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Facility = Database["public"]["Tables"]["storage_facilities"]["Row"];
type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Doc = Database["public"]["Tables"]["verification_documents"]["Row"];
type BookingStatus = Booking["status"];

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin · EcoCold" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Tab = "queue" | "bookings" | "transactions";

function AdminPage() {
  const navigate = useNavigate();
  const [ok, setOk] = useState(false);
  const [tab, setTab] = useState<Tab>("queue");

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) { navigate({ to: "/auth", replace: true }); return; }
      const { data: p } = await supabase.from("profiles").select("role").eq("id", sess.session.user.id).maybeSingle();
      if (!p || p.role !== "admin") { navigate({ to: "/dashboard", replace: true }); return; }
      setOk(true);
    })();
  }, [navigate]);

  if (!ok) return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground">Checking access…</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-semibold">{adminLabels.title}</h1>
        <div className="mt-4 inline-flex gap-1 rounded-lg bg-muted p-1">
          {(["queue", "bookings", "transactions"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === t ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              {adminLabels.tabs[t]}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "queue" ? <QueueTab /> : tab === "bookings" ? <BookingsTab /> : <TransactionsTab />}
        </div>

      </main>
      <SiteFooter />
    </div>
  );
}

// -------- Queue --------

type DriverRow = Profile & { docs: Doc[] };
type FacilityRow = Facility & { owner: Pick<Profile, "id" | "full_name" | "phone_number"> | null; docs: Doc[] };

function QueueTab() {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [facilities, setFacilities] = useState<FacilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ kind: "driver" | "facility"; id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const [{ data: drv, error: eD }, { data: fac, error: eF }] = await Promise.all([
      supabase.from("profiles").select("*").eq("role", "driver").eq("verification_status", "pending"),
      supabase
        .from("storage_facilities")
        .select("*, owner:profiles!storage_facilities_owner_id_fkey(id,full_name,phone_number)")
        .eq("verification_status", "pending"),
    ]);
    if (eD) setErr(eD.message);
    if (eF) setErr(eF.message);

    const driverIds = (drv ?? []).map((d) => d.id);
    const facilityIds = (fac ?? []).map((f) => f.id);

    const [{ data: dDocs }, { data: fDocs }] = await Promise.all([
      driverIds.length
        ? supabase.from("verification_documents").select("*").in("user_id", driverIds).in("document_type", ["drivers_license", "vehicle_particulars"])
        : Promise.resolve({ data: [] as Doc[] }),
      facilityIds.length
        ? supabase.from("verification_documents").select("*").in("facility_id", facilityIds)
        : Promise.resolve({ data: [] as Doc[] }),
    ]);

    setDrivers((drv ?? []).map((d) => ({
      ...d,
      docs: (dDocs ?? []).filter((x) => x.user_id === d.id),
    })));
    setFacilities((fac ?? []).map((f) => ({
      ...(f as FacilityRow),
      docs: (fDocs ?? []).filter((x) => x.facility_id === f.id),
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approveDriver(id: string) {
    const upd = await supabase.from("profiles").update({ verification_status: "verified", rejection_reason: null }).eq("id", id);
    if (upd.error) { setErr(upd.error.message); return; }
    // Auto-verify their vehicles so matching works.
    await supabase.from("vehicles").update({ verification_status: "verified" }).eq("driver_id", id);
    await load();
  }

  async function approveFacility(id: string) {
    const upd = await supabase.from("storage_facilities").update({ verification_status: "verified", rejection_reason: null }).eq("id", id);
    if (upd.error) { setErr(upd.error.message); return; }
    await load();
  }

  async function submitReject() {
    if (!rejectTarget || !rejectReason.trim()) return;
    const reason = rejectReason.trim();
    if (rejectTarget.kind === "driver") {
      const upd = await supabase.from("profiles").update({ verification_status: "rejected", rejection_reason: reason }).eq("id", rejectTarget.id);
      if (upd.error) { setErr(upd.error.message); return; }
    } else {
      const upd = await supabase.from("storage_facilities").update({ verification_status: "rejected", rejection_reason: reason }).eq("id", rejectTarget.id);
      if (upd.error) { setErr(upd.error.message); return; }
    }
    setRejectTarget(null); setRejectReason("");
    await load();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading queue…</p>;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {err && (
        <div className="lg:col-span-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">{adminLabels.queuePendingDrivers}</h2>
        {drivers.length === 0 ? (
          <EmptyCard body={adminLabels.emptyDrivers} />
        ) : (
          <ul className="space-y-3">
            {drivers.map((d) => (
              <li key={d.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{d.full_name || "(no name)"}</h3>
                    <p className="text-xs text-muted-foreground">
                      {d.region ?? "—"}{d.phone_number ? ` · ${d.phone_number}` : ""}
                    </p>
                  </div>
                </div>
                <DocList docs={d.docs} labels={driverDocs} />
                <div className="mt-3 flex gap-2">
                  <button onClick={() => approveDriver(d.id)} className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-brand-foreground hover:opacity-90">
                    {adminLabels.approve}
                  </button>
                  <button onClick={() => { setRejectTarget({ kind: "driver", id: d.id }); setRejectReason(""); }} className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent">
                    {adminLabels.reject}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{adminLabels.queuePendingFacilities}</h2>
        {facilities.length === 0 ? (
          <EmptyCard body={adminLabels.emptyFacilities} />
        ) : (
          <ul className="space-y-3">
            {facilities.map((f) => (
              <li key={f.id} className="rounded-xl border border-border bg-card p-4">
                <div>
                  <h3 className="font-semibold">{f.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {f.address_text} · Owner: {f.owner?.full_name || "—"}
                    {f.owner?.phone_number ? ` · ${f.owner.phone_number}` : ""}
                  </p>
                </div>
                <DocList docs={f.docs} labels={facilityDocs} />
                <div className="mt-3 flex gap-2">
                  <button onClick={() => approveFacility(f.id)} className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-brand-foreground hover:opacity-90">
                    {adminLabels.approve}
                  </button>
                  <button onClick={() => { setRejectTarget({ kind: "facility", id: f.id }); setRejectReason(""); }} className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent">
                    {adminLabels.reject}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5">
            <h3 className="text-base font-semibold">{adminLabels.rejectPromptTitle}</h3>
            <textarea
              autoFocus
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={adminLabels.rejectPromptPlaceholder}
              rows={4}
              className="mt-3 w-full rounded-md border border-input bg-background p-2 text-sm outline-none focus:ring-2"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setRejectTarget(null)} className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent">
                {adminLabels.cancel}
              </button>
              <button
                disabled={!rejectReason.trim()}
                onClick={submitReject}
                className="rounded-md bg-destructive px-3 py-1.5 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-60"
              >
                {adminLabels.confirmReject}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocList({ docs, labels }: { docs: Doc[]; labels: readonly { key: string; label: string }[] }) {
  async function view(path: string) {
    const { data, error } = await supabase.storage.from("verification-docs").createSignedUrl(path, 60 * 10);
    if (error || !data) { alert(error?.message ?? "Could not load file"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }
  if (docs.length === 0) {
    return <p className="mt-3 text-xs text-muted-foreground italic">No documents submitted.</p>;
  }
  return (
    <ul className="mt-3 space-y-1 text-xs">
      {docs.map((d) => {
        const label = labels.find((l) => l.key === d.document_type)?.label ?? d.document_type;
        return (
          <li key={d.id} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">
              {label} · {verificationLabels.uploadedOn} {new Date(d.uploaded_at).toLocaleDateString()}
            </span>
            <button onClick={() => view(d.file_url)} className="rounded-md border border-input bg-background px-2 py-0.5 font-medium hover:bg-accent">
              {adminLabels.viewDoc}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// -------- Live bookings --------

type BookingWithRels = Booking & {
  farmer?: Pick<Profile, "id" | "full_name"> | null;
  driver?: Pick<Profile, "id" | "full_name"> | null;
  facility?: Pick<Facility, "id" | "name"> | null;
};

function BookingsTab() {
  const [rows, setRows] = useState<BookingWithRels[]>([]);
  const [status, setStatus] = useState<BookingStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "*, farmer:profiles!bookings_farmer_id_fkey(id,full_name), driver:profiles!bookings_driver_id_fkey(id,full_name), facility:storage_facilities(id,name)",
        )
        .order("created_at", { ascending: false });
      if (error) setErr(error.message);
      setRows((data as BookingWithRels[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = status === "all" ? rows : rows.filter((r) => r.status === status);
  const statuses = Object.keys(bookingStatusStyles) as BookingStatus[];

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{adminLabels.liveBookingsTitle}</h2>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{adminLabels.filterStatus}</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as BookingStatus | "all")}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            <option value="all">{adminLabels.allStatuses}</option>
            {statuses.map((s) => <option key={s} value={s}>{bookingStatusStyles[s].label}</option>)}
          </select>
        </label>
      </div>

      {err && <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyCard body="No bookings match this filter." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Farmer</th>
                <th className="px-3 py-2">Facility / Driver</th>
                <th className="px-3 py-2">Dates</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 capitalize">{b.type}</td>
                  <td className="px-3 py-2">{b.farmer?.full_name ?? "—"}</td>
                  <td className="px-3 py-2">
                    {b.type === "storage"
                      ? b.facility?.name ?? "—"
                      : b.driver?.full_name ?? <span className="italic text-muted-foreground">unassigned</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {b.type === "storage"
                      ? `${b.checkin_date ?? "?"} → ${b.checkout_date ?? "?"}`
                      : `Pickup ${b.pickup_date ?? "?"}`}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${bookingStatusStyles[b.status].className}`}>
                      {bookingStatusStyles[b.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// -------- Transactions --------

type Txn = Database["public"]["Tables"]["transactions"]["Row"] & {
  booking:
    | (Pick<Booking, "id" | "type" | "status" | "payment_status"> & {
        farmer: Pick<Profile, "id" | "full_name"> | null;
        driver: Pick<Profile, "id" | "full_name"> | null;
        facility: { id: string; name: string; owner_id: string } | null;
      })
    | null;
};

function TransactionsTab() {
  const [rows, setRows] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select(
        "*, booking:bookings(id,type,status,payment_status, farmer:profiles!bookings_farmer_id_fkey(id,full_name), driver:profiles!bookings_driver_id_fkey(id,full_name), facility:storage_facilities(id,name,owner_id))",
      )
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    setRows((data as unknown as Txn[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markPaidOut(t: Txn) {
    setErr(null);
    setBusyId(t.id);
    const { error } = await supabase
      .from("transactions")
      .update({ payout_status: "paid_out", paid_out_at: new Date().toISOString() })
      .eq("id", t.id);
    setBusyId(null);
    if (error) { setErr(error.message); return; }
    await load();
  }

  function recipient(t: Txn) {
    if (!t.booking) return "—";
    return t.booking.type === "storage"
      ? t.booking.facility?.name ?? "—"
      : t.booking.driver?.full_name ?? "unassigned";
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{adminLabels.transactionsTitle}</h2>
      {err && <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyCard body={adminLabels.emptyTransactions} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Farmer</th>
                <th className="px-3 py-2">{adminLabels.recipient}</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Fee</th>
                <th className="px-3 py-2">Payout</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Payout status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const s = transactionStatusStyles[t.status];
                return (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{t.booking?.farmer?.full_name ?? "—"}</td>
                    <td className="px-3 py-2">{recipient(t)}</td>
                    <td className="px-3 py-2">₦{Number(t.amount).toLocaleString()}</td>
                    <td className="px-3 py-2">₦{Number(t.platform_fee).toLocaleString()}</td>
                    <td className="px-3 py-2">₦{Number(t.payout_amount).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${s?.className ?? ""}`}>
                        {s?.label ?? t.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {t.payout_status === "paid_out" ? (
                        <span className="text-xs text-muted-foreground">
                          {adminLabels.paidOut}
                          {t.paid_out_at ? ` · ${new Date(t.paid_out_at).toLocaleDateString()}` : ""}
                        </span>
                      ) : t.status === "released" ? (
                        <button
                          disabled={busyId === t.id}
                          onClick={() => markPaidOut(t)}
                          className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground hover:opacity-90 disabled:opacity-60"
                        >
                          {adminLabels.markPaidOut}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}


function EmptyCard({ body }: { body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center">
      <p className="text-sm text-muted-foreground">{body}</p>
      <p className="mt-2 text-xs text-muted-foreground"><Link to="/dashboard" className="hover:text-foreground underline">Back to dashboard</Link></p>
    </div>
  );
}
