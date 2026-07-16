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
    { label: "Find Storage", to: "/find-storage" },
    { label: "Book Transport", to: "/book-transport" },
    { label: "Partner Network", to: "/" },
  ],
  ctaPrimary: "Book Space/Vehicle",
  ctaSecondary: "Register Asset",
  signIn: "Sign in",
  signUp: "Get started",
};

export const vehicleTypes = [
  { value: "motorcycle", label: "Motorcycle" },
  { value: "tricycle", label: "Tricycle" },
  { value: "car", label: "Car" },
  { value: "van", label: "Van" },
  { value: "truck", label: "Truck" },
] as const;
export type VehicleType = (typeof vehicleTypes)[number]["value"];

export const transportLabels = {
  pageTitle: "Book Transport",
  pageSubtitle: "Find a verified driver for your cargo. Pay-as-you-go.",
  submit: "Find drivers",
  requestDriver: "Request This Driver",
  matchesTitle: "Available drivers",
  noMatchesTitle: "No drivers available right now",
  noMatchesBody: (region: string, vehicle: string) =>
    `No drivers currently available in ${region} for ${vehicle}. Your request has been sent to our matching team and we'll confirm a driver shortly.`,
  awaitingAssignment: "Awaiting driver assignment",
  myJobs: "My Jobs",
  incomingJobs: "Incoming requests",
  activeJobs: "Confirmed & in-progress jobs",
  emptyIncoming: "No incoming transport requests yet.",
  emptyActiveJobs: "No confirmed jobs yet.",
  accept: "Accept",
  decline: "Decline",
  markCompleted: "Mark completed",
  storageTag: "Storage",
  transportTag: "Transport",
  registerVehicleTitle: "Register your vehicle",
  registerVehicleCta: "Add vehicle",
  registerVehicleHint: "Add a vehicle so farmers can request you for transport jobs.",
} as const;

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

// Storage booking config
export const cropTypes = [
  "Maize",
  "Tomatoes",
  "Yam",
  "Cassava",
  "Peppers",
  "Other",
] as const;
export type CropType = (typeof cropTypes)[number];

export const bookingLabels = {
  findStorage: "Find Storage",
  bookThisFacility: "Book This Facility",
  submitBooking: "Send booking request",
  confirm: "Confirm",
  decline: "Decline",
  markCompleted: "Mark completed",
  myBookings: "My Bookings",
  bookingRequests: "Booking Requests",
  activeBookings: "Confirmed & in-progress",
  emptyFarmer: "You haven't booked any storage yet. Browse verified facilities to get started.",
  emptyRequests: "No pending booking requests right now.",
  emptyActive: "No confirmed bookings yet.",
  confirmDeadlineHours: 2,
} as const;

export const bookingStatusStyles: Record<
  "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "disputed",
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 border-amber-200" },
  confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-800 border-blue-200" },
  in_progress: { label: "In progress", className: "bg-blue-100 text-blue-800 border-blue-200" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800 border-green-200" },
  cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-700 border-gray-200" },
  disputed: { label: "Disputed", className: "bg-red-100 text-red-800 border-red-200" },
};
