import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { facilityDocs, verificationLabels } from "@/config";
import type { Database } from "@/integrations/supabase/types";

type Facility = Database["public"]["Tables"]["storage_facilities"]["Row"];
type Doc = Database["public"]["Tables"]["verification_documents"]["Row"];

export const Route = createFileRoute("/verify-facility/$facilityId")({
  head: () => ({
    meta: [
      { title: "Facility verification · EcoCold" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyFacility,
});

function VerifyFacility() {
  const { facilityId } = Route.useParams();
  const navigate = useNavigate();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) { navigate({ to: "/auth", replace: true }); return; }
    const uid = sess.session.user.id;
    const { data: f } = await supabase.from("storage_facilities").select("*").eq("id", facilityId).maybeSingle();
    if (!f || f.owner_id !== uid) { navigate({ to: "/dashboard", replace: true }); return; }
    if (f.verification_status === "verified") { navigate({ to: "/dashboard", replace: true }); return; }
    const { data: d } = await supabase
      .from("verification_documents")
      .select("*")
      .eq("facility_id", facilityId)
      .order("uploaded_at", { ascending: false });
    setFacility(f);
    setDocs(d ?? []);
    setLoading(false);
  }, [facilityId, navigate]);

  useEffect(() => { load(); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!facility) return;
    setErr(null);
    for (const d of facilityDocs) {
      if (!files[d.key]) { setErr(`Please choose a file for ${d.label}.`); return; }
    }
    setBusy(true);
    try {
      for (const d of facilityDocs) {
        const file = files[d.key]!;
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${facility.owner_id}/facility-${facility.id}/${d.key}-${Date.now()}.${ext}`;
        const up = await supabase.storage.from("verification-docs").upload(path, file, { upsert: true });
        if (up.error) throw up.error;
        const ins = await supabase.from("verification_documents").insert({
          user_id: facility.owner_id,
          facility_id: facility.id,
          document_type: d.key,
          file_url: path,
        });
        if (ins.error) throw ins.error;
      }
      const upd = await supabase
        .from("storage_facilities")
        .update({ verification_status: "pending", rejection_reason: null })
        .eq("id", facility.id);
      if (upd.error) throw upd.error;
      await load();
      setFiles({});
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !facility) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">← Back to dashboard</Link>
        <h1 className="mt-2 text-2xl font-semibold">{verificationLabels.facilityTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{facility.name} · {facility.address_text}</p>
        <p className="mt-1 text-sm text-muted-foreground">{verificationLabels.facilitySubtitle}</p>

        {facility.verification_status === "pending" && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{verificationLabels.pendingBanner}</div>
        )}
        {facility.verification_status === "rejected" && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            <div>{verificationLabels.rejectedBanner}</div>
            {facility.rejection_reason && <div className="mt-1"><b>{verificationLabels.rejectionReason}:</b> {facility.rejection_reason}</div>}
          </div>
        )}

        {docs.length > 0 && (
          <div className="mt-6 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Previously uploaded</h2>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {docs.map((d) => (
                <li key={d.id}>
                  {facilityDocs.find((x) => x.key === d.document_type)?.label ?? d.document_type} ·{" "}
                  {verificationLabels.uploadedOn} {new Date(d.uploaded_at).toLocaleString()}
                </li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5">
          {facilityDocs.map((d) => (
            <label key={d.key} className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">{d.label}</span>
              <input
                type="file"
                accept={d.accept}
                onChange={(e) => setFiles((f) => ({ ...f, [d.key]: e.target.files?.[0] ?? null }))}
                className="block w-full text-sm"
              />
            </label>
          ))}
          {err && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>
          )}
          <button
            disabled={busy}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Uploading…" : facility.verification_status === "rejected" ? verificationLabels.resubmit : verificationLabels.submit}
          </button>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
