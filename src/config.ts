// Central config for copy, branding, and dropdowns. Edit here rather than in components.
export const brand = {
  name: "EcoCold",
  tagline: "Zero Spoilage. Max Profit.",
  colors: {
    primaryGreen: "#1E5E3A",
    secondaryGreen: "#34D399",
    solar: "#FBBF24",
    tech: "#2563EB",
    bgSoft: "#F9FAFB",
    bg: "#FFFFFF",
  },
};

export const nav = {
  links: [
    { label: "Find Storage", to: "/" },
    { label: "Book Transport", to: "/" },
    { label: "Partner Network", to: "/" },
  ],
  ctaPrimary: "Book Space/Vehicle",
  ctaSecondary: "Register Asset",
  signIn: "Sign in",
  signUp: "Get started",
};

export const hero = {
  headline: "Zero Spoilage. Max Profit. Solar Cold Storage & On-Demand Logistics.",
  subheadline:
    "Preserve your harvest, book vetted vehicles, and connect to markets. Flexible pay-as-you-go pricing tailored for you.",
};

export const footer = {
  links: [
    { label: "Terms", to: "/" },
    { label: "Regions", to: "/" },
  ],
};

export const currencies = ["NGN", "KES", "ZAR", "GHS", "XOF", "USD"] as const;
export type Currency = (typeof currencies)[number];

export const roles = [
  { value: "farmer", label: "Farmer / Trader" },
  { value: "driver", label: "Driver" },
  { value: "facility_owner", label: "Facility Owner" },
] as const;
export type SignupRole = (typeof roles)[number]["value"];

export const powerSources = [
  { value: "solar", label: "Solar" },
  { value: "grid", label: "Grid" },
  { value: "hybrid", label: "Hybrid" },
] as const;
