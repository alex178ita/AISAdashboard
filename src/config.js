// === CONFIGURAZIONE ===
// Incolla qui gli URL CSV dei tab pubblicati del Google Sheet "AISA - KPI Log".
// (File → Condividi → Pubblica sul web → scegli il singolo tab → CSV)
export const RUNS_CSV_URL = "INCOLLA-URL-CSV-TAB-runs";
export const FIRECRAWL_CSV_URL = "INCOLLA-URL-CSV-TAB-firecrawl";
export const EMAIL_STATS_CSV_URL = "INCOLLA-URL-CSV-TAB-email_stats";
export const CAMPAIGNS_CSV_URL = "INCOLLA-URL-CSV-TAB-campaigns";

// Nomi brevi dei flussi per ID scenario Make
export const FLOW_LABELS = {
  "6350489": "Flusso A1 — Audit & Email",
  "6359563": "Flusso C1 — Social Writer",
  "6363252": "Flusso C2 — Blog Writer",
  "6446272": "Flusso A2 — Cold Outreach",
};

// Auto-refresh dei dati (minuti)
export const REFRESH_MINUTES = 5;
