// Server-only Paystack REST helpers. Never import from client code.

const BASE = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env["PAYSTACK_SECRET_KEY"];
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  return key;
}

async function paystack<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json()) as { status: boolean; message: string } & Record<string, unknown>;
  if (!res.ok || json.status === false) {
    throw new Error(`Paystack ${path} failed: ${json.message ?? res.statusText}`);
  }
  return json as T;
}

export async function initializeTransaction(input: {
  email: string;
  amountNgn: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}) {
  const json = await paystack<{ data: { authorization_url: string; reference: string } }>(
    "/transaction/initialize",
    {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        amount: Math.round(input.amountNgn * 100), // kobo
        currency: "NGN",
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
      }),
    },
  );
  return json.data;
}

export async function verifyTransaction(reference: string) {
  const json = await paystack<{
    data: { status: string; reference: string; amount: number; metadata?: Record<string, unknown> };
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);
  return json.data;
}

export async function refundTransaction(reference: string) {
  const json = await paystack<{ data: { status: string } }>("/refund", {
    method: "POST",
    body: JSON.stringify({ transaction: reference }),
  });
  return json.data;
}

/** Paystack signs webhooks with HMAC SHA512 of the raw body using the secret key. */
export async function isValidWebhookSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secretKey()),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
