// api/ga4-overview.js — Vercel serverless function
//
// Site-wide Google Analytics 4 figures for the "Site traffic (GA4)" tab:
// audience over time, where people come from, what they use, what they read.
//
// This is the sibling of /api/blog-ga4, which answers a narrower question —
// how each *published article* performed, joined to the Airtable editorial
// records. That route asks GA4 about a known list of paths; this one asks GA4
// about the property as a whole and never touches Airtable. Keeping them apart
// means the article panel cannot break when this tab changes, and neither has
// to carry the other's caching policy.
//
// CREDENTIALS — none of its own.
// It reuses the same three environment variables as /api/blog-ga4:
//     GA4_PROPERTY_ID, GA4_SA_EMAIL, GA4_SA_KEY
// which are a read-only service account with Viewer on one property (the setup
// notes live at the top of blog-ga4.js and are not repeated here). If any is
// missing the route answers 200 with { configured: false } and the tab shows a
// short explanation instead of an error — an unconfigured deployment degrades
// to a blank space, never to a red box.
//
// WHY THE AUTH CODE IS DUPLICATED RATHER THAN SHARED
// Every function in api/ is self-contained by design in this project: no local
// imports, no build step, no shared module that a deploy could leave stale.
// Forty lines of JWT signing repeated once is a smaller cost than a shared file
// that couples two independently deployable routes.
//
// QUERY PARAMETERS
//   ?days=7|28|90   size of the reporting window (default 28, max 365)
// The response always carries the previous window of the same length alongside,
// so the page can show a change without asking twice.

import crypto from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const API = "https://analyticsdata.googleapis.com/v1beta";

// How many rows to keep per dimension. GA4 will happily return thousands;
// nobody reads past the first handful, and the payload is served to a browser.
const TOP_N = 12;

/* ------------------------------------------------------------------ auth */

let cachedToken = null; // { token, expiresAt } — survives while the lambda is warm

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function normaliseKey(raw) {
  // Vercel's UI keeps real newlines; a JSON copy-paste keeps \n escapes. Accept both.
  const key = raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
  return key.trim() + "\n";
}

async function getAccessToken(email, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.token;

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })
  );
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const assertion = `${header}.${claim}.${b64url(signer.sign(normaliseKey(privateKey)))}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      `Google token ${res.status}: ${json.error_description || json.error || "unknown"}`
    );
  }
  cachedToken = { token: json.access_token, expiresAt: now + (json.expires_in || 3600) };
  return cachedToken.token;
}

/* ------------------------------------------------------------------ GA4 */

// One HTTP call carries up to five reports. Batching matters here: eight
// separate round trips would put the tab's first paint several seconds behind
// the rest of the dashboard.
async function batchRunReports(propertyId, token, requests) {
  const res = await fetch(`${API}/properties/${propertyId}:batchRunReports`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      `GA4 ${res.status}: ${(json.error && json.error.message) || "unknown"}`.slice(0, 300)
    );
  }
  return json.reports || [];
}

const dim = (name) => ({ name });
const met = (name) => ({ name });

// GA4 returns every metric as a string, including integers.
const n = (v) => {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : 0;
};

// Rows come back as parallel arrays of dimension and metric values; this turns
// one into an object with the names the page expects.
function rows(report, dimNames, metNames) {
  return (report?.rows || []).map((r) => {
    const o = {};
    dimNames.forEach((k, i) => (o[k] = r.dimensionValues?.[i]?.value ?? ""));
    metNames.forEach((k, i) => (o[k] = n(r.metricValues?.[i]?.value)));
    return o;
  });
}

function totalsOf(report, metNames) {
  const o = {};
  const values = report?.rows?.[0]?.metricValues || report?.totals?.[0]?.metricValues || [];
  metNames.forEach((k, i) => (o[k] = n(values[i]?.value)));
  return o;
}

/* ------------------------------------------------------------- handler */

const TOTAL_METRICS = [
  "activeUsers",
  "sessions",
  "screenPageViews",
  "averageSessionDuration",
  "screenPageViewsPerSession",
  "bounceRate",
];
const TOTAL_KEYS = ["users", "sessions", "views", "avgDuration", "viewsPerSession", "bounceRate"];

// GA4 wants YYYY-MM-DD. Everything here is computed in UTC, which is what the
// property reports in unless it has been told otherwise; a day boundary that
// disagrees with Rome by an hour is not worth a timezone dependency.
function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const email = process.env.GA4_SA_EMAIL;
  const key = process.env.GA4_SA_KEY;

  if (!propertyId || !email || !key) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      configured: false,
      missing: [
        !propertyId && "GA4_PROPERTY_ID",
        !email && "GA4_SA_EMAIL",
        !key && "GA4_SA_KEY",
      ].filter(Boolean),
    });
  }

  const asked = parseInt(req.query?.days, 10);
  const days = Number.isFinite(asked) && asked > 0 ? Math.min(asked, 365) : 28;

  // "today" is included, so a window of 28 days is today plus the 27 before it.
  // The previous window is the 28 days immediately before that, which makes the
  // two directly comparable — same length, no overlap, no gap.
  const today = new Date();
  const startCur = new Date(today);
  startCur.setUTCDate(startCur.getUTCDate() - (days - 1));
  const endPrev = new Date(startCur);
  endPrev.setUTCDate(endPrev.getUTCDate() - 1);
  const startPrev = new Date(endPrev);
  startPrev.setUTCDate(startPrev.getUTCDate() - (days - 1));

  const current = { startDate: isoDay(startCur), endDate: "today" };
  const previous = { startDate: isoDay(startPrev), endDate: isoDay(endPrev) };

  try {
    const token = await getAccessToken(email, key);

    const [rTotals, rPrev, rSeries, rChannels, rDevices] = await batchRunReports(
      propertyId,
      token,
      [
        { dateRanges: [current], metrics: TOTAL_METRICS.map(met) },
        { dateRanges: [previous], metrics: TOTAL_METRICS.map(met) },
        {
          dateRanges: [current],
          dimensions: [dim("date")],
          metrics: ["activeUsers", "sessions", "screenPageViews"].map(met),
          orderBys: [{ dimension: { dimensionName: "date" } }],
          limit: 400,
        },
        {
          dateRanges: [current],
          dimensions: [dim("sessionDefaultChannelGroup")],
          metrics: ["sessions", "activeUsers"].map(met),
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: TOP_N,
        },
        {
          dateRanges: [current],
          dimensions: [dim("deviceCategory")],
          metrics: ["activeUsers", "sessions", "averageSessionDuration", "bounceRate"].map(met),
          orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
          limit: 10,
        },
      ]
    );

    const [rCountries, rCities, rPages, rLanding] = await batchRunReports(propertyId, token, [
      {
        dateRanges: [current],
        dimensions: [dim("country")],
        metrics: ["activeUsers", "sessions"].map(met),
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit: TOP_N,
      },
      {
        dateRanges: [current],
        dimensions: [dim("city"), dim("country")],
        metrics: ["activeUsers"].map(met),
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit: TOP_N,
      },
      {
        dateRanges: [current],
        dimensions: [dim("pagePath"), dim("pageTitle")],
        metrics: ["screenPageViews", "activeUsers", "averageSessionDuration"].map(met),
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: TOP_N,
      },
      {
        dateRanges: [current],
        dimensions: [dim("landingPage")],
        metrics: ["sessions", "bounceRate"].map(met),
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: TOP_N,
      },
    ]);

    // Five minutes fresh, ten more while a new copy is fetched behind the
    // reader's back. GA4 itself is not real-time for most dimensions, so a
    // tighter window would buy latency that the data does not have.
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

    return res.status(200).json({
      configured: true,
      windowDays: days,
      range: { from: current.startDate, to: isoDay(today), prevFrom: previous.startDate, prevTo: previous.endDate },
      totals: totalsOf(rTotals, TOTAL_KEYS),
      previous: totalsOf(rPrev, TOTAL_KEYS),
      series: rows(rSeries, ["date"], ["users", "sessions", "views"]).map((r) => ({
        // GA4 gives "20260908"; the page wants something Date can parse.
        date: `${r.date.slice(0, 4)}-${r.date.slice(4, 6)}-${r.date.slice(6, 8)}`,
        users: r.users,
        sessions: r.sessions,
        views: r.views,
      })),
      channels: rows(rChannels, ["name"], ["sessions", "users"]),
      devices: rows(rDevices, ["name"], ["users", "sessions", "avgDuration", "bounceRate"]),
      countries: rows(rCountries, ["name"], ["users", "sessions"]),
      cities: rows(rCities, ["name", "country"], ["users"]),
      pages: rows(rPages, ["path", "title"], ["views", "users", "avgDuration"]),
      landing: rows(rLanding, ["path"], ["sessions", "bounceRate"]),
    });
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ configured: true, error: String(err.message || err) });
  }
}
