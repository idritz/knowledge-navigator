import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { brand, nav, currencies, type Currency } from "@/config";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const navigate = useNavigate();
  const [currency, setCurrency] = useState<Currency>("NGN");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-6 w-6 rounded-md"
            style={{
              background: `linear-gradient(135deg, ${brand.colors.primaryGreen}, ${brand.colors.secondaryGreen})`,
            }}
          />
          <span className="text-lg font-semibold tracking-tight">{brand.name}</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {nav.links.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="currency">Currency</label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {signedIn ? (
            <>
              <Link
                to="/dashboard"
                className="hidden rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent sm:inline-block"
              >
                Dashboard
              </Link>
              <button
                onClick={signOut}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground hover:opacity-90"
            >
              {nav.signIn}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
        <div>© {new Date().getFullYear()} {brand.name}</div>
        <div className="flex gap-6">
          <Link to="/" className="hover:text-foreground">Terms</Link>
          <Link to="/" className="hover:text-foreground">Regions</Link>
        </div>
      </div>
    </footer>
  );
}
