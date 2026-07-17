import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { bookingLabels, bookingStatusStyles, powerSources, transportLabels, verificationLabels, vehicleTypes, type VehicleType } from "@/config";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Facility = Database["public"]["Tables"]["storage_facilities"]["Row"];
type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type BookingStatus = Booking["status"];

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

        {profile.role === "farmer" && <FarmerDash farmerId={profile.id} />}
        {profile.role === "driver" && <DriverDash driverId={profile.id} />}
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

// ---------- FARMER ----------

type BookingWithRelations = Booking & {
  facility?: Pick<Facility, "id" | "name"> | null;
  driver?: Pick<Profile, "id" | "full_name" | "phone_number"> | null;
};

async function releaseDriverVehicle(driverId: string) {
  await supabase
    .from("vehicles")
    .update({ availability_status: "available" })
    .eq("driver_id", driverId)
    .eq("availability_status", "on_job");
}

function FarmerDash({ farmerId }: { farmerId: string }) {
  const [bookings, setBookings] = useState<BookingWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("farmer_id", farmerId)
      .eq("status", "pending")
      .lt("confirm_deadline", new Date().toISOString());

    const { data, error } = await supabase
      .from("bookings")
      .select(
        "*, facility:storage_facilities(id,name), driver:profiles!bookings_driver_id_fkey(id,full_name,phone_number)",
      )
      .eq("farmer_id", farmerId)
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    setBookings((data as BookingWithRelations[]) ?? []);
    setLoading(false);
  }, [farmerId]);

  useEffect(() => { load(); }, [load]);

  async function markCompleted(b: BookingWithRelations) {
    setErr(null);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", b.id);
    if (error) { setErr(error.message); return; }
    if (b.type === "transport" && b.driver_id) {
      await releaseDriverVehicle(b.driver_id);
    }
    await load();
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{bookingLabels.myBookings}</h2>
        <div className="flex gap-2">
          <Link
            to="/find-storage"
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            {bookingLabels.findStorage}
          </Link>
          <Link
            to="/book-transport"
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground hover:opacity-90"
          >
            {transportLabels.pageTitle}
          </Link>
        </div>
      </div>
      {err && <ErrBox>{err}</ErrBox>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : bookings.length === 0 ? (
        <EmptyCard title={bookingLabels.myBookings} body={bookingLabels.emptyFarmer} />
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => (
            <li key={b.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <TypeTag type={b.type} />
                  </div>
                  {b.type === "storage" ? (
                    <>
                      <h3 className="font-semibold">{b.facility?.name ?? "Facility"}</h3>
                      <p className="text-xs text-muted-foreground">
                        {b.crop_type} · {b.volume_crates} crates · {b.checkin_date} → {b.checkout_date}
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="font-semibold">
                        {b.pickup_region} → {b.destination_region}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {b.crop_type} · {b.volume_crates} crates · {vehicleLabel(b.vehicle_type_requested)} · Pickup {b.pickup_date}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Driver: {b.driver?.full_name
                          ? `${b.driver.full_name}${b.driver.phone_number ? ` · ${b.driver.phone_number}` : ""}`
                          : transportLabels.awaitingAssignment}
                      </p>
                    </>
                  )}
                </div>
                <StatusBadge status={b.status} />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Price</span>
                <span className="font-medium">₦{Number(b.price_quoted).toLocaleString()}</span>
              </div>
              {canMarkComplete(b) && (
                <div className="mt-3">
                  <button
                    onClick={() => markCompleted(b)}
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
                  >
                    {bookingLabels.markCompleted}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------- DRIVER ----------

type BookingWithFarmer = Booking & { farmer?: Pick<Profile, "id" | "full_name" | "phone_number"> | null };

function DriverDash({ driverId }: { driverId: string }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [pending, setPending] = useState<BookingWithFarmer[]>([]);
  const [active, setActive] = useState<BookingWithFarmer[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  // vehicle form state
  const [vType, setVType] = useState<VehicleType>("van");
  const [homeRegion, setHomeRegion] = useState("");
  const [capacityKg, setCapacityKg] = useState<number>(500);

  const load = useCallback(async () => {
    setLoading(true);
    // Auto-expire pending assigned to this driver
    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("driver_id", driverId)
      .eq("status", "pending")
      .lt("confirm_deadline", new Date().toISOString());

    const [{ data: veh }, { data: bks }] = await Promise.all([
      supabase.from("vehicles").select("*").eq("driver_id", driverId).order("created_at", { ascending: false }),
      supabase
        .from("bookings")
        .select("*, farmer:profiles!bookings_farmer_id_fkey(id,full_name,phone_number)")
        .eq("driver_id", driverId)
        .eq("type", "transport")
        .order("created_at", { ascending: false }),
    ]);
    setVehicles(veh ?? []);
    const list = (bks as BookingWithFarmer[]) ?? [];
    setPending(list.filter((b) => b.status === "pending"));
    setActive(list.filter((b) => b.status === "confirmed" || b.status === "in_progress"));
    setLoading(false);
  }, [driverId]);

  useEffect(() => { load(); }, [load]);

  async function saveVehicle(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await supabase.from("vehicles").insert({
      driver_id: driverId,
      vehicle_type: vType,
      home_region: homeRegion,
      capacity_kg: capacityKg,
      availability_status: "available",
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setShowForm(false);
    setHomeRegion("");
    await load();
  }

  async function accept(b: BookingWithFarmer) {
    setErr(null);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "confirmed" })
      .eq("id", b.id);
    if (error) { setErr(error.message); return; }
    if (b.vehicle_type_requested) {
      await supabase
        .from("vehicles")
        .update({ availability_status: "on_job" })
        .eq("driver_id", driverId)
        .eq("vehicle_type", b.vehicle_type_requested)
        .eq("availability_status", "available");
    }
    await load();
  }

  async function decline(b: BookingWithFarmer) {
    setErr(null);
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", b.id);
    if (error) { setErr(error.message); return; }
    await load();
  }

  async function complete(b: BookingWithFarmer) {
    setErr(null);
    const { error } = await supabase.from("bookings").update({ status: "completed" }).eq("id", b.id);
    if (error) { setErr(error.message); return; }
    await releaseDriverVehicle(driverId);
    await load();
  }

  return (
    <section className="space-y-8">
      {/* Vehicles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">My vehicles</h2>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground hover:opacity-90"
            >
              {transportLabels.registerVehicleCta}
            </button>
          )}
        </div>
        {vehicles.length === 0 && !showForm && (
          <EmptyCard title={transportLabels.registerVehicleTitle} body={transportLabels.registerVehicleHint} />
        )}
        {vehicles.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {vehicles.map((v) => (
              <li key={v.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold capitalize">{vehicleLabel(v.vehicle_type)}</h3>
                    <p className="text-xs text-muted-foreground">{v.home_region} · {v.capacity_kg} kg</p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{v.availability_status}</span>
                </div>
                <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Verification: {v.verification_status}
                </p>
              </li>
            ))}
          </ul>
        )}
        {showForm && (
          <form onSubmit={saveVehicle} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold">New vehicle</h3>
            <Field label="Vehicle type">
              <select value={vType} onChange={(e) => setVType(e.target.value as VehicleType)} className={inputCls}>
                {vehicleTypes.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </Field>
            <Field label="Home region">
              <input required value={homeRegion} onChange={(e) => setHomeRegion(e.target.value)} placeholder="e.g. Abuja" className={inputCls} />
            </Field>
            <Field label="Capacity (kg)">
              <input required type="number" min={1} value={capacityKg} onChange={(e) => setCapacityKg(parseInt(e.target.value) || 0)} className={inputCls} />
            </Field>
            {err && <ErrBox>{err}</ErrBox>}
            <div className="flex gap-2">
              <button disabled={busy} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-60">
                {busy ? "Saving…" : "Save vehicle"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Jobs */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{transportLabels.myJobs}</h2>
        {err && <ErrBox>{err}</ErrBox>}
        <h3 className="text-base font-semibold">{transportLabels.incomingJobs}</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : pending.length === 0 ? (
          <EmptyCard title="No incoming jobs" body={transportLabels.emptyIncoming} />
        ) : (
          <ul className="space-y-3">
            {pending.map((b) => (
              <li key={b.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{b.pickup_region} → {b.destination_region}</h3>
                    <p className="text-xs text-muted-foreground">
                      {b.crop_type} · {b.volume_crates} crates · {vehicleLabel(b.vehicle_type_requested)} · Pickup {b.pickup_date}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      From {b.farmer?.full_name || "Farmer"}{b.farmer?.phone_number ? ` · ${b.farmer.phone_number}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => accept(b)} className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-brand-foreground hover:opacity-90">
                    {transportLabels.accept}
                  </button>
                  <button onClick={() => decline(b)} className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent">
                    {transportLabels.decline}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h3 className="pt-2 text-base font-semibold">{transportLabels.activeJobs}</h3>
        {active.length === 0 ? (
          <EmptyCard title="Nothing active" body={transportLabels.emptyActiveJobs} />
        ) : (
          <ul className="space-y-3">
            {active.map((b) => (
              <li key={b.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{b.pickup_region} → {b.destination_region}</h3>
                    <p className="text-xs text-muted-foreground">
                      {b.crop_type} · {b.volume_crates} crates · Pickup {b.pickup_date}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      For {b.farmer?.full_name || "Farmer"}{b.farmer?.phone_number ? ` · ${b.farmer.phone_number}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
                <div className="mt-3">
                  <button onClick={() => complete(b)} className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent">
                    {transportLabels.markCompleted}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ---------- FACILITY OWNER ----------


function FacilityOwnerDash({ ownerId }: { ownerId: string }) {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [pending, setPending] = useState<BookingWithFarmer[]>([]);
  const [active, setActive] = useState<BookingWithFarmer[]>([]);

  // form state
  const [name, setName] = useState("");
  const [addressText, setAddressText] = useState("");
  const [totalCap, setTotalCap] = useState(50);
  const [price, setPrice] = useState(150);
  const [power, setPower] = useState<(typeof powerSources)[number]["value"]>("solar");

  const load = useCallback(async () => {
    const { data: fac } = await supabase
      .from("storage_facilities")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    const facList = fac ?? [];
    setFacilities(facList);

    const ids = facList.map((f) => f.id);
    if (ids.length === 0) {
      setPending([]);
      setActive([]);
      return;
    }

    // Auto-expire pending bookings past deadline for this owner's facilities
    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .in("facility_id", ids)
      .eq("status", "pending")
      .lt("confirm_deadline", new Date().toISOString());

    const { data: bookings } = await supabase
      .from("bookings")
      .select("*, farmer:profiles!bookings_farmer_id_fkey(id,full_name,phone_number)")
      .in("facility_id", ids)
      .eq("type", "storage")
      .order("created_at", { ascending: false });

    const list = (bookings as BookingWithFarmer[]) ?? [];
    setPending(list.filter((b) => b.status === "pending"));
    setActive(list.filter((b) => b.status === "confirmed" || b.status === "in_progress"));
  }, [ownerId]);

  useEffect(() => { load(); }, [load]);

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

  async function updateStatus(b: BookingWithFarmer, status: BookingStatus) {
    setErr(null);
    const { error } = await supabase.from("bookings").update({ status }).eq("id", b.id);
    if (error) {
      if (error.message.includes("insufficient_capacity")) {
        setErr("Not enough capacity to confirm — another booking may have taken the space.");
      } else {
        setErr(error.message);
      }
      return;
    }
    await load();
  }

  return (
    <section className="space-y-8">
      {/* Facility list */}
      <div className="space-y-4">
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
            {err && <ErrBox>{err}</ErrBox>}
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
      </div>

      {/* Booking requests */}
      {facilities.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{bookingLabels.bookingRequests}</h2>
          {err && <ErrBox>{err}</ErrBox>}
          {pending.length === 0 ? (
            <EmptyCard title="All caught up" body={bookingLabels.emptyRequests} />
          ) : (
            <ul className="space-y-3">
              {pending.map((b) => (
                <li key={b.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">
                        {b.crop_type} · {b.volume_crates} crates
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {b.checkin_date} → {b.checkout_date} · {b.farmer?.full_name || "Farmer"}
                        {b.farmer?.phone_number ? ` · ${b.farmer.phone_number}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Respond by {formatDeadline(b.confirm_deadline)}
                      </p>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Price quoted</span>
                    <span className="font-medium">₦{Number(b.price_quoted).toLocaleString()}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => updateStatus(b, "confirmed")}
                      className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-brand-foreground hover:opacity-90"
                    >
                      {bookingLabels.confirm}
                    </button>
                    <button
                      onClick={() => updateStatus(b, "cancelled")}
                      className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
                    >
                      {bookingLabels.decline}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h3 className="pt-2 text-base font-semibold">{bookingLabels.activeBookings}</h3>
          {active.length === 0 ? (
            <EmptyCard title="Nothing active" body={bookingLabels.emptyActive} />
          ) : (
            <ul className="space-y-3">
              {active.map((b) => (
                <li key={b.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">
                        {b.crop_type} · {b.volume_crates} crates
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {b.checkin_date} → {b.checkout_date} · {b.farmer?.full_name || "Farmer"}
                      </p>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Price</span>
                    <span className="font-medium">₦{Number(b.price_quoted).toLocaleString()}</span>
                  </div>
                  {canMarkComplete(b) && (
                    <div className="mt-3">
                      <button
                        onClick={() => updateStatus(b, "completed")}
                        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
                      >
                        {bookingLabels.markCompleted}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

// ---------- helpers ----------

function canMarkComplete(b: Booking) {
  if (b.status !== "confirmed" && b.status !== "in_progress") return false;
  if (!b.checkout_date) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkout = new Date(b.checkout_date + "T00:00:00");
  return checkout.getTime() <= today.getTime();
}

function formatDeadline(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function vehicleLabel(v: VehicleType | null | undefined) {
  if (!v) return "—";
  return vehicleTypes.find((x) => x.value === v)?.label ?? v;
}

function TypeTag({ type }: { type: Booking["type"] }) {
  const label = type === "storage" ? "Storage" : "Transport";
  const cls =
    type === "storage"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : "bg-sky-100 text-sky-800 border-sky-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const s = bookingStatusStyles[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
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

function ErrBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
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
