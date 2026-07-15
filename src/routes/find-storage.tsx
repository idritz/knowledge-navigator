import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { bookingLabels } from "@/config";
import type { Database } from "@/integrations/supabase/types";

type Facility = Database["public"]["Tables"]["storage_facilities"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const Route = createFileRoute("/find-storage")({
  head: () => ({
    meta: [
      { title: "Find Storage · EcoCold" },
      { name: "description", content: "Browse verified solar cold storage facilities in your region." },
    ],
  }),
  component: FindStorage,
});

function FindStorage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [region, setRegion] = useState("");
  const [regions, setRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", sess.session.user.id)
        .maybeSingle();
      if (!alive) return;
      setProfile(p);

      const { data: f } = await supabase
        .from("storage_facilities")
        .select("*")
        .eq("verification_status", "verified")
        .eq("status", "active")
        .order("price_per_crate_per_day", { ascending: true });
      if (!alive) return;
      const list = f ?? [];
      setFacilities(list);
      const uniqueRegions = Array.from(
        new Set(
          list
            .map((x) => extractRegion(x.address_text))
            .filter((r): r is string => !!r),
        ),
      ).sort();
      setRegions(uniqueRegions);
      // Default region filter to farmer's own region if any facility matches
      const initial = (p?.region ?? "").trim();
      if (initial && uniqueRegions.some((r) => r.toLowerCase() === initial.toLowerCase())) {
        setRegion(initial);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

  const filtered = region
    ? facilities.filter((f) =>
        f.address_text.toLowerCase().includes(region.toLowerCase()),
      )
    : facilities;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">{bookingLabels.findStorage}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Verified solar cold storage near you. Sorted by lowest price.
            </p>
          </div>
          <label className="block sm:w-64">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Region</span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All regions</option>
              {regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
              {profile?.region &&
                !regions.some((r) => r.toLowerCase() === profile.region!.toLowerCase()) && (
                  <option value={profile.region}>{profile.region} (your region)</option>
                )}
            </select>
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading facilities…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center">
            <h2 className="text-base font-semibold">No matching facilities</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Try clearing the region filter, or check back soon as more facilities get verified.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {filtered.map((f) => (
              <li key={f.id} className="flex flex-col rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{f.name}</h3>
                    <p className="text-xs text-muted-foreground">{f.address_text}</p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                    {f.power_source}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Price / crate / day</div>
                    <div className="font-medium">₦{f.price_per_crate_per_day}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Available</div>
                    <div className="font-medium">{f.available_capacity_crates} crates</div>
                  </div>
                </dl>
                <div className="mt-4">
                  <Link
                    to="/book/$facilityId"
                    params={{ facilityId: f.id }}
                    className="inline-flex w-full items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90"
                  >
                    {bookingLabels.bookThisFacility}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function extractRegion(address: string): string | null {
  // Use trailing comma-separated token, e.g. "Lugbe, Abuja" -> "Abuja"
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}
