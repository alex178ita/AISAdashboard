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

// === REDEMPTION ATTRIBUTION (K5 + K4) ===
// Three published tabs of the "AISA - KPI Log" sheet that drive the Redemption KPIs page.
//   attribution      · logged_at | channel | sent            (one row per channel per night; channel = B | A2)
//   redemption_detail · logged_at | channel | name | email | company | master_contact | match_type
//                       (one row per matched registrant; match_type = persona | azienda | «» for A2)
//   a2_engagement    · opens | clicks | replies | delivered | last_update   (manually maintained + Analytics)
export const ATTRIBUTION_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT9Wuv7UIv1AsXCeM8IKD4VZl5VZDWEYOKy8qVvEeC1tUX1rwlvm0EmuxNvRJvh2qTlee2QcMeLEJJW/pub?gid=623512043&single=true&output=csv";
export const REDEMPTION_DETAIL_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT9Wuv7UIv1AsXCeM8IKD4VZl5VZDWEYOKy8qVvEeC1tUX1rwlvm0EmuxNvRJvh2qTlee2QcMeLEJJW/pub?gid=1936950578&single=true&output=csv";
export const A2_ENGAGEMENT_TAB_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT9Wuv7UIv1AsXCeM8IKD4VZl5VZDWEYOKy8qVvEeC1tUX1rwlvm0EmuxNvRJvh2qTlee2QcMeLEJJW/pub?gid=565163290&single=true&output=csv";

// Flow B Master list (AISA_Flusso_B_Fogli). Column G "stato" carries the LinkedIn
// funnel state per contact: invito_inviato · connesso_no_dm · dm_inviato · risposto.
// Used on the Redemption page to show the B "Replied" figure (stato = risposto),
// symmetric with the A2 email-reply figure.
export const B_MASTER_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT2QNJv9wz9vGSFh_VioH1mo8XFWo_CFwnqpONPMOGZ1OA0kC4sax4PEFL8SZWKzqEZJmR4HM_wiLXL/pub?gid=2065401423&single=true&output=csv";

// Flow B — LinkedIn ABM funnel.
// Publish the "KPI_Log" tab of the "AISA_Flusso_B_Fogli" workbook as CSV and paste the URL here.
// Expected columns: data · evento · linkedin_url · dettaglio
// Events counted: invito_inviato · escluso_crm · connessione_accettata · dm_inviato · risposta
export const B_FUNNEL_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT2QNJv9wz9vGSFh_VioH1mo8XFWo_CFwnqpONPMOGZ1OA0kC4sax4PEFL8SZWKzqEZJmR4HM_wiLXL/pub?gid=664403748&single=true&output=csv"; // KPI_Log tab (AISA_Flusso_B_Fogli), published CSV

// Flow C2 — blog editorial KPIs (Airtable "AISA Blog Editorial").
// Unlike every other source here, these are STATES, not events: how many ideas are queued,
// how many drafts await review, how many articles went live. A published CSV is therefore
// the wrong shape — the dashboard calls a serverless route instead, which reads the Airtable
// token from a Vercel environment variable and returns aggregates only. The token must never
// reach the browser. Leave empty to hide the blog panel.
export const BLOG_KPI_URL = "/api/blog-kpi";

// Auto-refresh (minutes)
export const REFRESH_MINUTES = 5;

// Make.com team + zone (for building scenario links)
const MAKE_BASE = "https://eu1.make.com/1967086/scenarios";

// External detail links (open in a new tab)
export const LINKS = {
  campaignsReport: "https://campaigns.zoho.eu/campaigns/org20070200946/home.do#reports/48756000030171157/view",
  zeptomailReport: "https://zeptomail.zoho.eu/zem/20115882015#reports/overview",
  airtableBase: "https://airtable.com/appN8ORvz4lZKyjO1",
  blogSection: "https://www.aisearchaudit.ai/blog/",
};

// Full technical & user documentation (Google Drive folder, opens in a new tab)
export const DOC_URL = "https://drive.google.com/drive/folders/1j9Kg76JddbTKo3_OZw80ZQ1Qc3WNkXa1?usp=share_link";

// Public URL of the deployed dashboard — used by the "Share via email" button.
export const DASHBOARD_URL = "https://ais-adashboard.vercel.app/";

// Top navigation — hash routes. The four views the dashboard is split into.
export const NAV = [
  { key: "",         label: "Flows Data & Stats" },
  { key: "#/kpis",   label: "Redemption KPIs" },
  { key: "#/docs",   label: "Full Tech & User Documentation" },
  { key: "#/charts", label: "Statistical graphs over time" },
];

// Flow registry — the backbone of the layout.
// family drives the colour; scenarioId links to Make; status: active | standby | invalid | soon
export const FLOWS = [
  // Family A — AISA audit & outreach (green)
  { code: "A1", family: "A", name: "Webhook — audit upon sign-up",    scenarioId: "6350489", status: "standby", makeUrl: `${MAKE_BASE}/6350489/edit`, detail: { label: "See details in ZeptoMail", url: "zeptomailReport" } },
  { code: "A2", family: "A", name: "Cold outreach email",             scenarioId: "6446272", status: "active", makeUrl: `${MAKE_BASE}/6446272/edit`, detail: { label: "See details in Zoho Campaigns", url: "campaignsReport" } },
  // Family B — LinkedIn ABM outreach (pink)
  { code: "B0",  family: "B", name: "Ingestion — PhantomBuster search → Sheet", scenarioId: "6676757", status: "active",  makeUrl: `${MAKE_BASE}/6676757/edit` },
  { code: "B1",  family: "B", name: "CRM dedup → Lemlist connection invite",    scenarioId: "6513141", status: "active",  makeUrl: `${MAKE_BASE}/6513141/edit` },
  { code: "B3",  family: "B", name: "Housekeeping & KPI — acceptances",         scenarioId: "6543270", status: "active",  makeUrl: `${MAKE_BASE}/6543270/edit` },
  { code: "B4",  family: "B", name: "Activity Extractor → scraped",             scenarioId: "6696522", status: "active",  makeUrl: `${MAKE_BASE}/6696522/edit` },
  { code: "B4b", family: "B", name: "Profile Scraper → About",                  scenarioId: "6697349", status: "active",  makeUrl: `${MAKE_BASE}/6697349/edit` },
  { code: "Bg",  family: "B", name: "B-guard — skip already-messaged",          scenarioId: "6745694", status: "active",  makeUrl: `${MAKE_BASE}/6745694/edit` },
  { code: "B2",  family: "B", name: "DM writer (Claude) — review-gate",         scenarioId: "6513152", status: "active",  makeUrl: `${MAKE_BASE}/6513152/edit` },
  { code: "B2s", family: "B", name: "DM send (Message Sender)",                 scenarioId: "6698916", status: "active",  makeUrl: `${MAKE_BASE}/6698916/edit` },
  { code: "B2c", family: "B", name: "B2-cleanup — clear DM_Log + Master",       scenarioId: "6729475", status: "active",  makeUrl: `${MAKE_BASE}/6729475/edit` },
  { code: "B5",  family: "B", name: "Reply alert → Gmail + Cliq",               scenarioId: "6731586", status: "active",  makeUrl: `${MAKE_BASE}/6731586/edit` },
  // Family C — content generation (indigo)
  { code: "C1",  family: "C", name: "Social writer → Zoho Social",              scenarioId: "6359563", status: "active", makeUrl: `${MAKE_BASE}/6359563/edit` },
  { code: "C2a", family: "C", name: "Topic radar → Airtable Ideas",             scenarioId: "6871616", status: "active", makeUrl: `${MAKE_BASE}/6871616/edit`, detail: { label: "Open the editorial base", url: "airtableBase" } },
  { code: "C2b", family: "C", name: "Blog writer → WordPress draft",            scenarioId: "6864777", status: "active", makeUrl: `${MAKE_BASE}/6864777/edit` },
  { code: "C2c", family: "C", name: "Publisher — approved → live",              scenarioId: "6871324", status: "active", makeUrl: `${MAKE_BASE}/6871324/edit`, detail: { label: "See the blog", url: "blogSection" } },
  // Family D — not yet available (amber)
  { code: "D1", family: "D", name: "Not yet available", placeholder: true },
  { code: "D2", family: "D", name: "Not yet available", placeholder: true },
];

// Service flows (K collectors + MD + B launchers) — shown in the service strip
export const SERVICE_FLOWS = [
  { code: "K1", name: "KPI collector (Make + Firecrawl)", scenarioId: "6441414", status: "active", makeUrl: `${MAKE_BASE}/6441414/edit` },
  { code: "K2", name: "ZeptoMail events → KPI Log",       scenarioId: "6441412", status: "active", makeUrl: `${MAKE_BASE}/6441412/edit` },
  { code: "K3", name: "Campaigns stats collector",        scenarioId: "6448767", status: "active", makeUrl: `${MAKE_BASE}/6448767/edit` },
  { code: "K4B", name: "Sent-B counter → attribution",    scenarioId: "6920156", status: "active", makeUrl: `${MAKE_BASE}/6920156/edit` },
  { code: "K4A2", name: "Sent-A2 + engagement → attribution", scenarioId: "6936993", status: "active", makeUrl: `${MAKE_BASE}/6936993/edit` },
  { code: "K5", name: "Redemption attribution engine",    scenarioId: "6951866", status: "active", makeUrl: `${MAKE_BASE}/6951866/edit` },
  { code: "R1", name: "WordPress sign-ups → Registrations", scenarioId: "6919928", status: "active", makeUrl: `${MAKE_BASE}/6919928/edit` },
  { code: "B4l", name: "B — launch Activity + Profile",   scenarioId: "6697179", status: "active", makeUrl: `${MAKE_BASE}/6697179/edit` },
  { code: "MD", name: "Markdown consolidator",            scenarioId: "6440510", status: "standby", makeUrl: `${MAKE_BASE}/6440510/edit` },
];

// Family colours (border + accent). Green & pink from the AISA logo.
export const FAMILY = {
  A: { name: "AISA — Audit & Outreach", color: "#2FB980", soft: "#E7F7F855", tint: "#2FB98022" },
  B: { name: "AISA — LinkedIn (Account-Based Marketing)", color: "#E6568F", soft: "#FDEAF255", tint: "#E6568F22" },
  C: { name: "Content Generation",      color: "#5B63D3", soft: "#EEF0FB55", tint: "#5B63D322" },
  D: { name: "Reserved",                color: "#E08A3C", soft: "#FCF1E555", tint: "#E08A3C22" },
  S: { name: "Service Flows",           color: "#8A94A6", soft: "#F2F4F755", tint: "#8A94A622" },
};
