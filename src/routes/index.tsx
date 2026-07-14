import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { hero, nav, brand } from "@/config";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        {/* Hero */}
        <section
          className="relative overflow-hidden"
          style={{
            background: `linear-gradient(180deg, #F9FAFB 0%, #FFFFFF 60%),
              radial-gradient(circle at 90% 10%, ${brand.colors.solar}22, transparent 40%),
              radial-gradient(circle at 10% 90%, ${brand.colors.secondaryGreen}33, transparent 45%)`,
          }}
        >
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:py-24 md:grid-cols-2 md:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[--brand]" />
                Pay-as-you-go · Solar-powered · Nigeria-first
              </div>
              <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
                {hero.headline}
              </h1>
              <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
                {hero.subheadline}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/auth"
                  className="inline-flex items-center justify-center rounded-md bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground shadow-sm hover:opacity-90"
                >
                  {nav.ctaPrimary}
                </Link>
                <Link
                  to="/auth"
                  className="inline-flex items-center justify-center rounded-md border-2 border-[--brand] bg-transparent px-5 py-3 text-sm font-semibold text-[--brand] hover:bg-accent"
                >
                  {nav.ctaSecondary}
                </Link>
              </div>
            </div>

            {/* Inline SVG hero art — no external images */}
            <div className="relative">
              <HeroArt />
            </div>
          </div>
        </section>

        {/* Value strip */}
        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { title: "Solar cold storage", body: "Book crates near you with verified facilities.", accent: brand.colors.secondaryGreen },
              { title: "Vetted transport", body: "On-demand motorcycles, vans, and trucks.", accent: brand.colors.tech },
              { title: "Fair pay-as-you-go", body: "Only pay for the days and space you use.", accent: brand.colors.solar },
            ].map((c) => (
              <div key={c.title} className="rounded-xl border border-border bg-card p-5">
                <span
                  aria-hidden
                  className="inline-block h-2 w-10 rounded-full"
                  style={{ background: c.accent }}
                />
                <h3 className="mt-3 text-base font-semibold">{c.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function HeroArt() {
  return (
    <svg viewBox="0 0 400 320" className="w-full max-w-md mx-auto" role="img" aria-label="Solar cold storage illustration">
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#E8F3EE" />
          <stop offset="1" stopColor="#FFFFFF" />
        </linearGradient>
      </defs>
      <rect width="400" height="320" fill="url(#sky)" rx="16" />
      {/* sun */}
      <circle cx="320" cy="70" r="28" fill="#FBBF24" />
      {/* building */}
      <rect x="60" y="150" width="220" height="130" rx="8" fill="#1E5E3A" />
      <rect x="80" y="170" width="60" height="40" fill="#34D399" opacity="0.9" />
      <rect x="150" y="170" width="60" height="40" fill="#34D399" opacity="0.7" />
      <rect x="220" y="170" width="40" height="40" fill="#34D399" opacity="0.5" />
      {/* solar panel */}
      <g transform="translate(70,110) rotate(-8)">
        <rect width="140" height="50" rx="4" fill="#2563EB" />
        <line x1="35" y1="0" x2="35" y2="50" stroke="#fff" strokeWidth="1" />
        <line x1="70" y1="0" x2="70" y2="50" stroke="#fff" strokeWidth="1" />
        <line x1="105" y1="0" x2="105" y2="50" stroke="#fff" strokeWidth="1" />
        <line x1="0" y1="25" x2="140" y2="25" stroke="#fff" strokeWidth="1" />
      </g>
      {/* truck */}
      <g transform="translate(240,220)">
        <rect width="90" height="40" rx="4" fill="#FFFFFF" stroke="#1E5E3A" strokeWidth="2" />
        <rect x="60" y="-20" width="40" height="60" rx="4" fill="#34D399" />
        <circle cx="20" cy="45" r="8" fill="#1E5E3A" />
        <circle cx="75" cy="45" r="8" fill="#1E5E3A" />
      </g>
    </svg>
  );
}
