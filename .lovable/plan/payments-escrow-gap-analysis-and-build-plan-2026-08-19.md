# Payments & Escrow — Gap Analysis and Build Plan

## What is already built (verified in the live database)

The database half of this prompt is largely done:

- `transactions` table exists with `booking_id`, `amount`, `platform_fee`, `payout_amount`, `gateway`, `gateway_reference`, `status`, `payout_status`, `paid_out_at`, timestamps, plus RLS (farmer sees own, admin sees all).
- `bookings.payment_status` exists (default `unpaid`).
- Server-side money logic exists as security-definer functions:
  - `process_payment_webhook(...)` — idempotent by `gateway_reference`, locks the booking, validates the amount against `price_quoted`, reserves storage capacity, writes the `held` transaction, sets `payment_status='paid'`; routes late/mismatched/over-capacity payments to `refund_pending`.
  - `process_refund_webhook(...)` — flips transaction to `refunded`/`refund_failed` and mirrors onto the booking.
  - `on_booking_completed()` trigger — `held` → `released` when a booking completes.
  - `on_booking_cancelled()` trigger — releases capacity on cancellation.
  - `prevent_unpaid_booking_confirmation()` trigger — a booking cannot be confirmed while unpaid.
  - `expire_ecocold_bookings()` plus a pg_cron job running every minute (unpaid → cancelled; paid → `refund_pending`).

Note: the implemented states are richer than the prompt (`refund_pending`, `refund_failed`) because Paystack refunds settle asynchronously. That is the correct model; the prompt's "instantly refunded" wording should be read as "refund initiated".

## What is NOT built yet

Everything outside the database. There is currently zero Paystack code in the app: no API keys, no server functions, no server routes, no checkout, no admin transactions view.

1. **Paystack credentials** — no `PAYSTACK_SECRET_KEY` (test mode) secret, no public key.
2. **config.ts values** — no `platform_fee_percentage` (10), no transport flat rates, no payment copy.
3. **Transport pricing** — `price_quoted` is still 0/null for transport bookings; no rate lookup on submit.
4. **Checkout initiation** — no server function that calls Paystack `/transaction/initialize` and redirects the farmer after booking creation (storage and transport).
5. **Webhook endpoint** — no `/api/public/webhooks/paystack` route to verify the HMAC signature and call `process_payment_webhook` / `process_refund_webhook`. Without it, nothing ever reaches `paid`/`held`.
6. **Payment return page** — no page for the Paystack callback that verifies the reference and shows the result.
7. **Refund initiation** — the DB can *record* refunds, but nothing calls Paystack's refund API on decline, expiry, or farmer cancellation, and nothing drains the `refund_pending` queue.
8. **Farmer cancel action** — no pre-completion cancel button wired to refund.
9. **Admin Transactions tab** — `/admin` only has `queue` and `bookings`; no transactions list, no recipient name, no "Mark as Paid Out".
10. **Payment status in booking lists** — dashboards show booking status only, not `payment_status`.

## Build plan

### 1. Secrets and config
- Request `PAYSTACK_SECRET_KEY` (test key, `sk_test_...`) via the secure secret form.
- `src/config.ts`: add `payments = { platformFeePercentage: 10, currency: "NGN", transportFlatRates: { motorcycle: 5000, tricycle: 8000, car: 10000, van: 15000, truck: 30000 } }` plus payment copy (checkout button, paid/refund badges, cancellation notice).

### 2. Transport pricing
- On transport booking submit, set `price_quoted` from `transportFlatRates[vehicle_type_requested]`. Flat per-vehicle-type rate, no distance maths (as the prompt allows).

### 3. Checkout
- `src/lib/payments.functions.ts`:
  - `initializeBookingPayment` (auth middleware) — loads the caller's booking, rejects if not theirs / already paid / not pending, calls Paystack initialize with a unique reference and a callback URL, returns `authorization_url`.
  - `verifyPayment` — reads a reference from Paystack for the return page (webhook stays the source of truth).
  - `initiateRefund` (admin or owner-triggered internally) — calls Paystack refund, leaves the DB in `refund_pending` until the refund webhook lands.
- Booking forms redirect to `authorization_url` right after creating the booking.

### 4. Webhook
- `src/routes/api/public/webhooks/paystack.ts` — verify `x-paystack-signature` (HMAC SHA512 over the raw body, timing-safe), then:
  - `charge.success` → `process_payment_webhook(booking_id, reference, amount/100, platform_fee_pct)`
  - `refund.processed` / `refund.failed` → `process_refund_webhook(reference, status)`
  - Always return 200 for handled events. Requires a new `PAYSTACK_WEBHOOK_SECRET`-style verification using the secret key.

### 5. Refund triggers
- Facility owner decline, driver decline, and farmer pre-completion cancel each call `initiateRefund` when a `held` transaction exists.
- A small sweeper (server function called from the existing admin page, or an added cron-callable public route) picks up `refund_pending` bookings created by `expire_ecocold_bookings()` and fires the Paystack refund.

### 6. Payment return page
- `src/routes/payment-status.tsx` — reads `?reference=`, verifies, shows paid / pending / failed with a link back to the dashboard.

### 7. Admin Transactions tab
- Add `transactions` to the `Tab` union in `src/routes/admin.tsx`: booking ref, type, amount, platform fee, payout, status, payout status, recipient (facility owner or driver name via joins), and a "Mark as Paid Out" button on `released` rows that sets `payout_status='paid_out'` and `paid_out_at`.

### 8. Dashboard surfacing
- Show a payment badge (`unpaid` / `paid` / `refund pending` / `refunded`) on farmer bookings, plus a "Pay now" button for unpaid pending bookings and a "Cancel" button pre-completion.

## Flags for you

- **Cancellation fee policy is undefined.** This build does full refunds on any pre-completion cancellation. That must be decided before real money.
- **Refunds are asynchronous.** UI will say "Refund pending" until Paystack confirms; the DB already models this.
- **Flat transport rates** are a placeholder and will misprice long trips — fine for test mode, replace with distance-based pricing later.
- **Webhook URL** must be registered in the Paystack dashboard against the stable project URL for payments to ever complete.
