import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { powerSources } from "@/config";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Facility = Database["public"]["Tables"]["storage_facilities"]["Row"];

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · EcoCold" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      const { data } = await supabase.from("profiles").select("*").eq("id", sess.session.user.id).maybeSingle();
      if (!alive) return;
      setProfile(data);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-4xl px-4 py-10 text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {roleLabel(profile.role)}
          </div>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
            Welcome, {profile.full_name || "there"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Region: {profile.region || "—"} · Verification: {profile.verification_status}
          </p>
        </div>

        {profile.role === "farmer" && <FarmerDash />}
        {profile.role === "driver" && <DriverDash />}
        {profile.role === "facility_owner" && <FacilityOwnerDash ownerId={profile.id} />}
        {profile.role === "admin" && (
          <EmptyCard title="Admin console" body="The internal admin dashboard will land in a later build." />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function roleLabel(r: Profile["role"]) {
  return { farmer: "Farmer / Trader", driver: "Driver", facility_owner: "Facility Owner", admin: "Admin" }[r];
}

function FarmerDash() {
  return (
    <EmptyCard
      title="My Bookings"
      body="You haven't booked storage or transport yet. Browsing and booking flows arrive in the next build."
    />
  );
}
function DriverDash() {
  return (
    <EmptyCard
      title="My Jobs"
      body="No transport jobs yet. Job matching and acceptance arrive in the next build."
    />
  );
}

function FacilityOwnerDash({ ownerId }: { ownerId: string }) {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // form state
  const [name, setName] = useState("");
  const [addressText, setAddressText] = useState("");
  const [totalCap, setTotalCap] = useState(50);
  const [price, setPrice] = useState(150);
  const [power, setPower] = useState<(typeof powerSources)[number]["value"]>("solar");

  async function load() {
    const { data } = await supabase.from("storage_facilities").select("*").eq("owner_id", ownerId).order("created_at", { ascending: false });
    setFacilities(data ?? []);
  }
  useEffect(() => { load(); }, [ownerId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await supabase.from("storage_facilities").insert({
      owner_id: ownerId,
      name,
      address_text: addressText,
      total_capacity_crates: totalCap,
      available_capacity_crates: totalCap,
      price_per_crate_per_day: price,
      power_source: power,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setShowForm(false);
    setName(""); setAddressText("");
    await load();
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">My Facility</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground hover:opacity-90"
          >
            Add facility
          </button>
        )}
      </div>

      {facilities.length === 0 && !showForm && (
        <EmptyCard title="No facilities yet" body="Add your first cold storage facility to start receiving bookings." />
      )}

      {facilities.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {facilities.map((f) => (
            <li key={f.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{f.name}</h3>
                  <p className="text-xs text-muted-foreground">{f.address_text}</p>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{f.verification_status}</span>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <Stat label="Capacity" value={`${f.available_capacity_crates}/${f.total_capacity_crates} crates`} />
                <Stat label="Price/crate/day" value={`₦${f.price_per_crate_per_day}`} />
                <Stat label="Power" value={f.power_source} />
              </dl>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <form onSubmit={submit} className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h3 className="font-semibold">New facility</h3>
          <Field label="Facility name">
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Address (text)">
            <input required placeholder="Lugbe, Abuja" value={addressText} onChange={(e) => setAddressText(e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total capacity (crates)">
              <input required type="number" min={1} value={totalCap} onChange={(e) => setTotalCap(parseInt(e.target.value) || 0)} className={inputCls} />
            </Field>
            <Field label="Price / crate / day (₦)">
              <input required type="number" min={0} value={price} onChange={(e) => setPrice(parseInt(e.target.value) || 0)} className={inputCls} />
            </Field>
          </div>
          <Field label="Power source">
            <select value={power} onChange={(e) => setPower(e.target.value as typeof power)} className={inputCls}>
              {powerSources.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </Field>
          {err && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>
          )}
          <div className="flex gap-2">
            <button disabled={busy} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-60">
              {busy ? "Saving…" : "Save facility"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-[--ring] focus:ring-2";
