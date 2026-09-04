import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { transportLabels, vehicleTypes, type VehicleType, bookingLabels, cropTypes, type CropType, transportPrice, paymentLabels } from "@/config";
import { initializeBookingPayment } from "@/lib/payments.functions";
import type { Database } from "@/integrations/supabase/types";


type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type VehicleWithDriver = Vehicle & { driver?: Pick<Profile, "id" | "full_name" | "rating_avg"> | null };

export const Route = createFileRoute("/book-transport")({
  head: () => ({
    meta: [
      { title: "Book Transport · EcoCold" },
      { name: "description", content: "Book a verified driver to move your harvest." },
    ],
  }),
  component: BookTransport,
});

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function BookTransport() {
  const navigate = useNavigate();
  const startPayment = useServerFn(initializeBookingPayment);
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const [vehicleType, setVehicleType] = useState<VehicleType>("van");
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [pickupDate, setPickupDate] = useState(todayISO());
  const [crop, setCrop] = useState<CropType>("Maize");
  const [volume, setVolume] = useState<number>(1);

  const [stage, setStage] = useState<"form" | "results">("form");
  const [matches, setMatches] = useState<VehicleWithDriver[]>([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | { mode: "self" | "admin"; driverName?: string }>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      if (!alive) return;
      setUserId(sess.session.user.id);
      setChecking(false);
    })();
    return () => { alive = false; };
  }, [navigate]);

  async function findDrivers(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!pickup.trim() || !destination.trim()) {
      setErr("Enter both pickup and destination regions.");
      return;
    }
    setSearching(true);
    const { data, error } = await supabase
      .from("vehicles")
      .select("*, driver:profiles!vehicles_driver_id_fkey(id,full_name,rating_avg)")
      .eq("vehicle_type", vehicleType)
      .ilike("home_region", pickup.trim())
      .eq("availability_status", "available")
      .eq("verification_status", "verified");
    setSearching(false);
    if (error) { setErr(error.message); return; }
    setMatches((data as VehicleWithDriver[]) ?? []);
    setStage("results");
  }

  async function createBooking(driverId: string | null) {
    if (!userId) return;
    setSubmitting(true); setErr(null);
    const price = transportPrice(vehicleType);
    const { data: created, error } = await supabase
      .from("bookings")
      .insert({
        type: "transport",
        farmer_id: userId,
        driver_id: driverId,
        crop_type: crop,
        volume_crates: volume,
        status: "pending",
        price_quoted: price,
        match_method: driverId ? "self_selected" : "admin_assisted",
        pickup_region: pickup.trim(),
        destination_region: destination.trim(),
        pickup_date: pickupDate,
        vehicle_type_requested: vehicleType,
        confirm_deadline: new Date(
          Date.now() + bookingLabels.confirmDeadlineHours * 60 * 60 * 1000,
        ).toISOString(),
      })
      .select("id")
      .single();
    if (error || !created) {
      setSubmitting(false);
      setErr(error?.message ?? "Could not create request.");
      return;
    }
    try {
      const res = await startPayment({
        data: { bookingId: created.id, origin: window.location.origin },
      });
      window.location.href = res.authorizationUrl;
    } catch (e) {
      setSubmitting(false);
      setErr(
        (e instanceof Error ? e.message : "Could not start checkout.") +
          " Your request was saved — you can pay from your dashboard.",
      );
    }
  }


  if (checking) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-10">
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">✓</div>
            <h1 className="mt-4 text-xl font-semibold">Transport request sent</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {done.mode === "self"
                ? `Your request was sent to ${done.driverName || "the driver"}. You'll see status updates in ${bookingLabels.myBookings}.`
                : transportLabels.noMatchesBody(pickup, vehicleLabel(vehicleType))}
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Link to="/dashboard" className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90">
                Go to {bookingLabels.myBookings}
              </Link>
              <Link to="/book-transport" className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent" onClick={() => { setDone(null); setStage("form"); }}>
                New request
              </Link>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-semibold sm:text-3xl">{transportLabels.pageTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{transportLabels.pageSubtitle}</p>

        {stage === "form" && (
          <form onSubmit={findDrivers} className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5">
            <Field label="Vehicle type">
              <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value as VehicleType)} className={inputCls}>
                {vehicleTypes.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pickup region">
                <input required value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="e.g. Abuja" className={inputCls} />
              </Field>
              <Field label="Destination region">
                <input required value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Lagos" className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pickup date">
                <input required type="date" min={todayISO()} value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Crop type">
                <select value={crop} onChange={(e) => setCrop(e.target.value as CropType)} className={inputCls}>
                  {cropTypes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Volume (crates)">
              <input required type="number" min={1} value={volume} onChange={(e) => setVolume(parseInt(e.target.value) || 0)} className={inputCls} />
            </Field>
            {err && <ErrBox>{err}</ErrBox>}
            <button disabled={searching} className="w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-60">
              {searching ? "Searching…" : transportLabels.submit}
            </button>
          </form>
        )}

        {stage === "results" && (
          <div className="mt-6 space-y-4">
            <button onClick={() => setStage("form")} className="text-xs text-muted-foreground hover:text-foreground">
              ← Edit request
            </button>
            {matches.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold">{transportLabels.noMatchesTitle}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {transportLabels.noMatchesBody(pickup, vehicleLabel(vehicleType))}
                </p>
                {err && <div className="mt-3"><ErrBox>{err}</ErrBox></div>}
                <button
                  disabled={submitting}
                  onClick={() => createBooking(null)}
                  className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-60"
                >
                  {submitting ? "Sending…" : "Send to matching team"}
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-base font-semibold">{transportLabels.matchesTitle}</h2>
                {err && <ErrBox>{err}</ErrBox>}
                <ul className="space-y-3">
                  {matches.map((m) => (
                    <li key={m.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">{m.driver?.full_name || "Driver"}</h3>
                          <p className="text-xs text-muted-foreground capitalize">
                            {m.vehicle_type} · {m.home_region} · {m.capacity_kg} kg
                          </p>
                        </div>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          ★ {Number(m.driver?.rating_avg ?? 0).toFixed(1)}
                        </span>
                      </div>
                      <div className="mt-3">
                        <button
                          disabled={submitting || !m.driver?.id}
                          onClick={() => createBooking(m.driver!.id)}
                          className="w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-60"
                        >
                          {submitting ? "Sending…" : transportLabels.requestDriver}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function vehicleLabel(v: VehicleType) {
  return vehicleTypes.find((x) => x.value === v)?.label ?? v;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ErrBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-[--ring] focus:ring-2";
