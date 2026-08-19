import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { payments } from "@/config";

function safeOrigin(origin: string): string {
  if (!/^https?:\/\/[^\s/]+$/.test(origin)) throw new Error("Invalid origin");
  return origin;
}

function newReference(bookingId: string) {
  return `eco_${bookingId.replace(/-/g, "").slice(0, 12)}_${Date.now().toString(36)}`;
}

/** Creates a Paystack checkout session for a booking the caller owns. */
export const initializeBookingPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string; origin: string }) => input)
  .handler(async ({ data, context }) => {
    const origin = safeOrigin(data.origin);
    const { data: booking, error } = await context.supabase
      .from("bookings")
      .select("id, farmer_id, price_quoted, status, payment_status, type")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!booking || booking.farmer_id !== context.userId) throw new Error("Booking not found");
    if (booking.payment_status === "paid") throw new Error("This booking is already paid");
    if (booking.status !== "pending") throw new Error("This booking can no longer be paid for");
    const amount = Number(booking.price_quoted);
    if (!(amount > 0)) throw new Error("This booking has no price to charge");

    const email = (context.claims["email"] as string | undefined) ?? `${context.userId}@ecocold.invalid`;
    const { initializeTransaction } = await import("./paystack.server");
    const res = await initializeTransaction({
      email,
      amountNgn: amount,
      reference: newReference(booking.id),
      callbackUrl: `${origin}/payment-status`,
      metadata: { booking_id: booking.id, booking_type: booking.type, farmer_id: context.userId },
    });
    return { authorizationUrl: res.authorization_url, reference: res.reference };
  });

/** Verifies a reference after the Paystack redirect and records it (idempotent with the webhook). */
export const verifyBookingPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => input)
  .handler(async ({ data, context }) => {
    const { verifyTransaction } = await import("./paystack.server");
    const tx = await verifyTransaction(data.reference);
    const bookingId = (tx.metadata?.["booking_id"] as string | undefined) ?? null;
    if (tx.status !== "success" || !bookingId) {
      return { status: tx.status, bookingId, recorded: false as const };
    }

    const { data: booking } = await context.supabase
      .from("bookings")
      .select("id, farmer_id")
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking || booking.farmer_id !== context.userId) throw new Error("Booking not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("process_payment_webhook", {
      p_booking_id: bookingId,
      p_gateway_reference: tx.reference,
      p_amount_ngn: tx.amount / 100,
      p_platform_fee_pct: payments.platform_fee_percentage,
    });
    if (error) throw new Error(error.message);
    return { status: "success" as const, bookingId, recorded: true as const };
  });

/**
 * Initiates a Paystack refund for a booking's held payment.
 * Callable by the farmer, the assigned driver, the facility owner, or an admin.
 * The DB stays in `refund_pending` until Paystack's refund webhook lands.
 */
export const requestBookingRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string }) => input)
  .handler(async ({ data, context }) => {
    // RLS already limits visibility to the farmer, driver, facility owner and admins.
    const { data: booking, error } = await context.supabase
      .from("bookings")
      .select("id, status, payment_status")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!booking) throw new Error("Booking not found");
    if (booking.payment_status !== "paid" && booking.payment_status !== "refund_pending") {
      return { refunded: false as const, reason: "nothing_to_refund" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: txn } = await supabaseAdmin
      .from("transactions")
      .select("id, gateway_reference, status")
      .eq("booking_id", booking.id)
      .in("status", ["held", "refund_pending", "refund_failed"])
      .order("created_at", { ascending: false })
      .maybeSingle();
    if (!txn) return { refunded: false as const, reason: "no_transaction" };

    const { refundTransaction } = await import("./paystack.server");
    try {
      await refundTransaction(txn.gateway_reference);
    } catch (e) {
      await supabaseAdmin.from("transactions").update({ status: "refund_failed" }).eq("id", txn.id);
      throw e instanceof Error ? e : new Error("Refund failed");
    }

    await supabaseAdmin.from("transactions").update({ status: "refund_pending" }).eq("id", txn.id);
    await supabaseAdmin
      .from("bookings")
      .update({ payment_status: "refund_pending" })
      .eq("id", booking.id);
    return { refunded: true as const, reason: "refund_initiated" };
  });
