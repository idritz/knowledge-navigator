import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { paymentLabels } from "@/config";
import { verifyBookingPayment } from "@/lib/payments.functions";

export const Route = createFileRoute("/payment-status")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Payment status · EcoCold" },
      { name: "description", content: "Confirmation of your EcoCold booking payment held in escrow." },
      { property: "og:title", content: "Payment status · EcoCold" },
      { property: "og:description", content: "Confirmation of your EcoCold booking payment held in escrow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentStatus,
});

function PaymentStatus() {
  const verify = useServerFn(verifyBookingPayment);
  const [state, setState] = useState<"loading" | "success" | "pending" | "failed">("loading");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") ?? params.get("trxref");
    if (!reference) {
      setState("failed");
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await verify({ data: { reference } });
        if (!alive) return;
        setState(res.status === "success" ? "success" : res.status === "abandoned" ? "pending" : "failed");
      } catch (e) {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "Verification failed");
        setState("failed");
      }
    })();
    return () => {
      alive = false;
    };
  }, [verify]);

  const copy =
    state === "success"
      ? { title: paymentLabels.successTitle, body: paymentLabels.successBody }
      : state === "pending"
        ? { title: paymentLabels.pendingTitle, body: paymentLabels.pendingBody }
        : { title: paymentLabels.failedTitle, body: paymentLabels.failedBody };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16">
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          {state === "loading" ? (
            <p className="text-sm text-muted-foreground">{paymentLabels.pendingBody}</p>
          ) : (
            <>
              <h1 className="text-xl font-semibold">{copy.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>
              {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
              <Link
                to="/dashboard"
                className="mt-6 inline-block rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90"
              >
                {paymentLabels.backToDashboard}
              </Link>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
