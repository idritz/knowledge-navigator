import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { bookingLabels, cropTypes, type CropType } from "@/config";
import type { Database } from "@/integrations/supabase/types";

type Facility = Database["public"]["Tables"]["storage_facilities"]["Row"];

export const Route = createFileRoute("/book/$facilityId")({
  head: () => ({
    meta: [
      { title: "Book storage · EcoCold" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookFacility,
});

function BookFacility() {
  const { facilityId } = Route.useParams();
  const navigate = useNavigate();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [crop, setCrop] = useState<CropType>("Maize");
  const [volume, setVolume] = useState<number>(1);
  const [checkin, setCheckin] = useState<string>(todayISO());
  const [checkout, setCheckout] = useState<string>(addDaysISO(todayISO(), 1));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ facilityName: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      setUserId(sess.session.user.id);
      const { data } = await supabase
        .from("storage_facilities")
        .select("*")
        .eq("id", facilityId)
        .maybeSingle();
      if (!alive) return;
      setFacility(data);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [facilityId, navigate]);

  const durationDays = useMemo(() => {
    const d = daysBetween(checkin, checkout);
    return d > 0 ? d : 0;
  }, [checkin, checkout]);

  const priceQuoted = useMemo(() => {
    if (!facility) return 0;
    return facility.price_per_crate_per_day * volume * durationDays;
  }, [facility, volume, durationDays]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!facility || !userId) return;
    if (durationDays <= 0) {
      setErr("Check-out date must be after check-in date.");
      return;
    }
    if (volume <= 0) {
      setErr("Volume must be at least 1 crate.");
      return;
    }

    setBusy(true);
    // Re-fetch capacity right before submit to reduce race window
    const { data: fresh, error: fErr } = await supabase
      .from("storage_facilities")
      .select("available_capacity_crates,name")
      .eq("id", facility.id)
      .maybeSingle();
    if (fErr || !fresh) {
      setBusy(false);
      setErr("Could not verify capacity. Please try again.");
      return;
    }
    if (volume > fresh.available_capacity_crates) {
      setBusy(false);
      setErr(
        `Only ${fresh.available_capacity_crates} crate${fresh.available_capacity_crates === 1 ? "" : "s"} available at this facility.`,
      );
      return;
    }

    const deadline = new Date(
      Date.now() + bookingLabels.confirmDeadlineHours * 60 * 60 * 1000,
    ).toISOString();

    const { error } = await supabase.from("bookings").insert({
      type: "storage",
      farmer_id: userId,
      facility_id: facility.id,
      crop_type: crop,
      volume_crates: volume,
      duration_days: durationDays,
      price_quoted: priceQuoted,
      checkin_date: checkin,
      checkout_date: checkout,
      confirm_deadline: deadline,
      status: "pending",
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setDone({ facilityName: fresh.name });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-2xl px-4 py-10">
          <h1 className="text-xl font-semibold">Facility not found</h1>
          <Link to="/find-storage" className="mt-3 inline-block text-sm text-[--brand] underline">
            Back to Find Storage
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-10">
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
              ✓
            </div>
            <h1 className="mt-4 text-xl font-semibold">Booking request sent</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {done.facilityName} has {bookingLabels.confirmDeadlineHours} hours to confirm your request.
              You'll see status updates in {bookingLabels.myBookings}.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Link
                to="/dashboard"
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90"
              >
                Go to {bookingLabels.myBookings}
              </Link>
              <Link
                to="/find-storage"
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Browse more
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
        <Link to="/find-storage" className="text-xs text-muted-foreground hover:text-foreground">
          ← Back to facilities
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{facility.name}</h1>
        <p className="text-sm text-muted-foreground">{facility.address_text}</p>
        <div className="mt-2 text-xs text-muted-foreground">
          ₦{facility.price_per_crate_per_day} / crate / day · {facility.available_capacity_crates} crates available · {facility.power_source}
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5">
          <Field label="Crop type">
            <select
              value={crop}
              onChange={(e) => setCrop(e.target.value as CropType)}
              className={inputCls}
            >
              {cropTypes.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Volume (crates)">
            <input
              required
              type="number"
              min={1}
              max={facility.available_capacity_crates}
              value={volume}
              onChange={(e) => setVolume(parseInt(e.target.value) || 0)}
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Check-in date">
              <input
                required
                type="date"
                min={todayISO()}
                value={checkin}
                onChange={(e) => setCheckin(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Check-out date">
              <input
                required
                type="date"
                min={addDaysISO(checkin, 1)}
                value={checkout}
                onChange={(e) => setCheckout(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">{durationDays} day{durationDays === 1 ? "" : "s"}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Estimated price</span>
              <span className="text-base font-semibold">₦{priceQuoted.toLocaleString()}</span>
            </div>
          </div>

          {err && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}

          <button
            disabled={busy || durationDays <= 0}
            className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Sending…" : bookingLabels.submitBooking}
          </button>
        </form>
      </main>
      <SiteFooter />
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

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function addDaysISO(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string) {
  const d1 = new Date(a + "T00:00:00").getTime();
  const d2 = new Date(b + "T00:00:00").getTime();
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}
