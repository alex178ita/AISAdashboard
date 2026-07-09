// === CONFIGURATION ===
// Public CSV URLs of the published tabs from the "AISA - KPI Log" Google Sheet.
// (File → Share → Publish to web → pick the single tab → CSV)
export const RUNS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT9Wuv7UIv1AsXCeM8IKD4VZl5VZDWEYOKy8qVvEeC1tUX1rwlvm0EmuxNvRJvh2qTlee2QcMeLEJJW/pub?gid=2009841754&single=true&output=csv";
export const FIRECRAWL_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT9Wuv7UIv1AsXCeM8IKD4VZl5VZDWEYOKy8qVvEeC1tUX1rwlvm0EmuxNvRJvh2qTlee2QcMeLEJJW/pub?gid=216631446&single=true&output=csv";
export const EMAIL_STATS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT9Wuv7UIv1AsXCeM8IKD4VZl5VZDWEYOKy8qVvEeC1tUX1rwlvm0EmuxNvRJvh2qTlee2QcMeLEJJW/pub?gid=904199926&single=true&output=csv";
export const CAMPAIGNS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT9Wuv7UIv1AsXCeM8IKD4VZl5VZDWEYOKy8qVvEeC1tUX1rwlvm0EmuxNvRJvh2qTlee2QcMeLEJJW/pub?gid=1493707327&single=true&output=csv";

// Zoho Analytics — A2 engagement (opens/clicks/unsubscribes for "Cold Outreach Message").
// Publish the query table as CSV in Zoho Analytics and paste the URL here.
export const A2_ENGAGEMENT_CSV_URL = ""; // <-- paste the published Analytics CSV URL

// Auto-refresh (minutes)
export const REFRESH_MINUTES = 5;

// Make.com team + zone (for building scenario links)
const MAKE_BASE = "https://eu1.make.com/1967086/scenarios";

// External detail links (open in a new tab)
export const LINKS = {
  campaignsReport: "https://campaigns.zoho.eu/campaigns/org20070200946/home.do#reports/48756000030171157/view",
  zeptomailReport: "https://zeptomail.zoho.eu/zem/20115882015#reports/overview",
};

// Flow registry — the backbone of the layout.
// family drives the colour; scenarioId links to Make; status: active | standby | invalid | soon
export const FLOWS = [
  // Family A — AISA audit & outreach (green)
  { code: "A1", family: "A", name: "Webhook — audit upon sign-up",    scenarioId: "6350489", makeUrl: `${MAKE_BASE}/6350489/edit`, detail: { label: "See details in ZeptoMail", url: "zeptomailReport" } },
  { code: "A2", family: "A", name: "Cold outreach email",             scenarioId: "6446272", makeUrl: `${MAKE_BASE}/6446272/edit`, detail: { label: "See details in Zoho Campaigns", url: "campaignsReport" } },
  // Family B — not yet available (pink)
  { code: "B1", family: "B", name: "Not yet available", placeholder: true },
  { code: "B2", family: "B", name: "Not yet available", placeholder: true },
  // Family C — content generation (indigo)
  { code: "C1", family: "C", name: "Social writer → Zoho Social",     scenarioId: "6359563", makeUrl: `${MAKE_BASE}/6359563/edit` },
  { code: "C2", family: "C", name: "Blog writer → WordPress",         scenarioId: "6363252", makeUrl: `${MAKE_BASE}/6363252/edit` },
  // Family D — not yet available (amber)
  { code: "D1", family: "D", name: "Not yet available", placeholder: true },
  { code: "D2", family: "D", name: "Not yet available", placeholder: true },
];

// Service flows (K collectors + MD) — shown in the service strip.
// status is fixed here (these scenarios do not log their own runs to the KPI sheet).
export const SERVICE_FLOWS = [
  { code: "K1", name: "KPI collector (Make + Firecrawl)", status: "active",  scenarioId: "6441414", makeUrl: `${MAKE_BASE}/6441414/edit` },
  { code: "K2", name: "ZeptoMail events → KPI Log",       status: "active",  scenarioId: "6441412", makeUrl: `${MAKE_BASE}/6441412/edit` },
  { code: "K3", name: "Campaigns stats collector",        status: "active",  scenarioId: "6448767", makeUrl: `${MAKE_BASE}/6448767/edit` },
  { code: "MD", name: "Markdown consolidator",            status: "standby", scenarioId: "6440510", makeUrl: `${MAKE_BASE}/6440510/edit` },
];

// Family colours (border + accent). Green & pink from the AISA logo.
export const FAMILY = {
  A: { name: "AISA — Audit & Outreach", color: "#2FB980", soft: "#E7F7F855", tint: "#2FB98022" },
  B: { name: "AISA — Reserved",         color: "#E6568F", soft: "#FDEAF255", tint: "#E6568F22" },
  C: { name: "Content Generation",      color: "#5B63D3", soft: "#EEF0FB55", tint: "#5B63D322" },
  D: { name: "Reserved",                color: "#E08A3C", soft: "#FCF1E555", tint: "#E08A3C22" },
  S: { name: "Service Flows",           color: "#8A94A6", soft: "#F2F4F755", tint: "#8A94A622" },
};
