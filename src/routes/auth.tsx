import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { roles, type SignupRole, brand } from "@/config";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or join · EcoCold" },
      { name: "description", content: "Sign up as a farmer, driver, or facility owner on EcoCold." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [role, setRole] = useState<SignupRole>("farmer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { role, full_name: fullName, phone_number: phone, region },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
        <Link to="/" className="mb-6 flex items-center gap-2 self-start text-sm text-muted-foreground hover:text-foreground">
          <span
            aria-hidden
            className="inline-block h-5 w-5 rounded-md"
            style={{ background: `linear-gradient(135deg, ${brand.colors.primaryGreen}, ${brand.colors.secondaryGreen})` }}
          />
          {brand.name}
        </Link>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1">
            {(["signup", "signin"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  mode === m ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                {m === "signup" ? "Create account" : "Sign in"}
              </button>
            ))}
          </div>

          <h1 className="text-xl font-semibold">
            {mode === "signup" ? "Join EcoCold" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Farmers, drivers, and facility owners — pick your role below."
              : "Sign in to your dashboard."}
          </p>

          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            {mode === "signup" && (
              <>
                <Field label="Full name">
                  <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Phone number">
                  <input required inputMode="tel" placeholder="+234…" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Region (city / state)">
                  <input required placeholder="Lugbe, Abuja" value={region} onChange={(e) => setRegion(e.target.value)} className={inputCls} />
                </Field>
                <Field label="I am a…">
                  <div className="grid grid-cols-3 gap-2">
                    {roles.map((r) => (
                      <button
                        type="button"
                        key={r.value}
                        onClick={() => setRole(r.value)}
                        className={`rounded-md border px-2 py-2 text-xs font-medium ${
                          role === r.value
                            ? "border-[--brand] bg-accent text-[--brand]"
                            : "border-input bg-background text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </>
            )}
            <Field label="Email">
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Password">
              <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
            </Field>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Phone + OTP is planned. For now sign-up uses email + password so you can test all roles quickly.
        </p>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-[--ring] focus:ring-2";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
