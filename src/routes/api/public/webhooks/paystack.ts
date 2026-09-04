import { createFileRoute } from "@tanstack/react-router";
import { payments } from "@/config";

export const Route = createFileRoute("/api/public/webhooks/paystack")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const { isValidWebhookSignature } = await import("@/lib/paystack.server");
        const ok = await isValidWebhookSignature(raw, request.headers.get("x-paystack-signature"));
        if (!ok) return new Response("Invalid signature", { status: 401 });

        let event: { event?: string; data?: Record<string, unknown> };
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const data = (event.data ?? {}) as Record<string, unknown>;

        if (event.event === "charge.success") {
          const metadata = (data["metadata"] ?? {}) as Record<string, unknown>;
          const bookingId = metadata["booking_id"] as string | undefined;
          const reference = data["reference"] as string | undefined;
          const amount = Number(data["amount"] ?? 0) / 100;
          if (!bookingId || !reference) return new Response("ok");
          const { error } = await supabaseAdmin.rpc("process_payment_webhook", {
            p_booking_id: bookingId,
            p_gateway_reference: reference,
            p_amount_ngn: amount,
            p_platform_fee_pct: payments.platform_fee_percentage,
          });
          if (error) console.error("process_payment_webhook", error.message);
          return new Response("ok");
        }

        if (event.event === "refund.processed" || event.event === "refund.failed") {
          const txn = (data["transaction"] ?? {}) as Record<string, unknown>;
          const reference =
            (txn["reference"] as string | undefined) ?? (data["transaction_reference"] as string | undefined);
          if (!reference) return new Response("ok");
          const { error } = await supabaseAdmin.rpc("process_refund_webhook", {
            p_gateway_reference: reference,
            p_refund_status: event.event === "refund.processed" ? "success" : "failed",
          });
          if (error) console.error("process_refund_webhook", error.message);
          return new Response("ok");
        }

        return new Response("ok");
      },
    },
  },
});
