// api/blog-ga4.js — Vercel serverless function
//
// Returns per-article blog traffic from Google Analytics 4, joined to the
// Airtable "Articles" table so every row carries its pillar and publish date.
//
// WHY A SERVICE ACCOUNT, NOT A PERSONAL LOGIN
// The dashboard is a page anyone with the URL can open. Hanging GA4 on a named
// person's Google account would mean either an OAuth flow for every visitor or
// that person's refresh token sitting in an environment variable — a personal
// credential that dies at the next password or 2FA change and that cannot be
// revoked without touching the person. A service account is owned by the
// project, not by anybody, and read-only on one property.
//
// SETUP (once)
//   1. Google Cloud console → the Kleecks project → APIs & Services
//      → enable "Google Analytics Data API".
//   2. IAM & Admin → Service Accounts → Create.
//      Name it e.g. aisa-dashboard-ga4. No project roles are needed.
//      Keys → Add key → JSON. Keep the file; it is shown once.
//   3. GA4 → Admin → Property access management → add the service-account
//      e-mail (…@….iam.gserviceaccount.com) with the **Viewer** role.
//      This is the only grant it ever gets.
//   4. Vercel → project → Settings → Environment Variables (Production+Preview):
//        GA4_PROPERTY_ID = 123456789         (Admin → Property details, numeric)
//        GA4_SA_EMAIL    = …@….iam.gserviceaccount.com
//        GA4_SA_KEY      = the private_key value from the JSON, in full,
//                          -----BEGIN PRIVATE KEY----- … -----END PRIVATE KEY-----
//                          Paste it with real newlines, or with \n escapes —
//                          both are accepted below.
//        AIRTABLE_TOKEN  = already set for /api/blog-kpi; reused here.
//      Redeploy after saving: environment variables are read at boot.
//
// The three GA4 variables never reach the browser. If any is missing the route
// answers 200 with { configured: false } and the panel hides itself, so an
// unconfigured deployment degrades to an empty space rather than an error.

import crypto from "node:crypto";

const BASE_ID = "appN8ORvz4lZKyjO1";
const ARTICLES_TABLE = "tbl5EKkIVIF9JeUKm";
const BLOG_PREFIX = "/blog/";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

// ---------------------------------------------------------------- auth
// A service-account access token is a signed JWT exchanged for a bearer token.
// Doing it by hand keeps this project dependency-free, as /api/blog-kpi is.

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
    JSON.stringify({
      iss: email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = b64url(signer.sign(normaliseKey(privateKey)));
  const assertion = `${header}.${claim}.${signature}`;

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
    // The two usual causes are worth naming in the message: a key that was
    // pasted with its newlines mangled, and a clock-skewed "invalid_grant".
    throw new Error(
      `Google token ${res.status}: ${json.error_description || json.error || "unknown"}`
    );
  }
  cachedToken = { token: json.access_token, expiresAt: now + (json.expires_in || 3600) };
  return cachedToken.token;
}

// ---------------------------------------------------------------- GA4
async function runReport(propertyId, token, body) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      `GA4 ${res.status}: ${(json.error && json.error.message) || "unknown"}`.slice(0, 300)
    );
  }
  return json;
}

// ---------------------------------------------------------------- Airtable
async function fetchArticles(token) {
  const rows = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${ARTICLES_TABLE}`);
    url.searchParams.set("pageSize", "100");
    ["Status", "Pillar", "Title", "Published_At", "WP_Public_URL"].forEach((f) =>
      url.searchParams.append("fields[]", f)
    );
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    rows.push(...json.records);
    offset = json.offset;
  } while (offset);
  return rows;
}

// ---------------------------------------------------------------- helpers
// GA4 reports pagePath; Airtable holds a full URL. Reduce both to the same key.
function toPath(url) {
  if (!url) return null;
  let p = String(url).trim();
  p = p.replace(/^https?:\/\/[^/]+/i, "");
  p = p.split("?")[0].split("#")[0];
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return p.toLowerCase();
}

const num = (v) => Number(v || 0);
const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d)) / 86400000) : null);

export default async function handler(req, res) {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const saEmail = process.env.GA4_SA_EMAIL;
  const saKey = process.env.GA4_SA_KEY;
  const airtable = process.env.AIRTABLE_TOKEN;

  if (!propertyId || !saEmail || !saKey) {
    // Not an error: the panel simply stays hidden until the property is wired up.
    return res.status(200).json({
      configured: false,
      missing: [
        !propertyId && "GA4_PROPERTY_ID",
        !saEmail && "GA4_SA_EMAIL",
        !saKey && "GA4_SA_KEY",
      ].filter(Boolean),
    });
  }

  const window = Math.min(365, Math.max(7, parseInt(req.query?.days, 10) || 28));

  try {
    // Airtable FIRST, because the article URLs decide what to ask GA4 for.
    // The earlier version filtered on a hardcoded "/blog/" prefix, which returned
    // nothing at all on a site whose articles sit at the domain root — and an empty
    // GA4 answer is indistinguishable from "nobody read anything". Asking for the
    // exact paths the editorial table holds cannot miss in that way.
    let records = null;
    let joinError = null;
    if (airtable) {
      try {
        records = await fetchArticles(airtable);
      } catch (e) {
        joinError = String(e.message || e);
      }
    }

    const articlePaths = [
      ...new Set(
        (records || [])
          .map((r) => toPath(r.fields.WP_Public_URL))
          .filter(Boolean)
          // GA4 stores pagePath as the site serves it, so a WordPress permalink
          // appears with its trailing slash. toPath() strips it on our side; ask
          // for both spellings rather than betting on one.
          .flatMap((p) => [p, `${p}/`])
      ),
    ];

    // An explicit prefix wins when the site does keep its articles under one:
    // set BLOG_PATH_PREFIX (e.g. "/blog/") to measure the whole section,
    // including pages that have no Airtable record yet.
    const prefix = process.env.BLOG_PATH_PREFIX || "";
    const dimensionFilter = prefix
      ? {
          filter: {
            fieldName: "pagePath",
            stringFilter: { matchType: "CONTAINS", value: prefix, caseSensitive: false },
          },
        }
      : articlePaths.length
        ? {
            filter: {
              fieldName: "pagePath",
              inListFilter: { values: articlePaths.slice(0, 300), caseSensitive: false },
            },
          }
        : undefined; // no records and no prefix: report the whole property rather than nothing

    const token = await getAccessToken(saEmail, saKey);

    // One report, two date ranges. The long window is the standing figure; the
    // short one is what says whether an article is still being read or was a
    // publication-day spike. GA4 returns the range as an extra dimension.
    // endDate is "today": today's figures are incomplete, but a visit an hour ago
    // is exactly what someone checking the panel wants to see.
    const report = await runReport(propertyId, token, {
      dateRanges: [
        { startDate: `${window}daysAgo`, endDate: "today", name: "window" },
        { startDate: "7daysAgo", endDate: "today", name: "last7" },
      ],
      dimensions: [{ name: "pagePath" }],
      metrics: [
        { name: "screenPageViews" },
        { name: "totalUsers" },
        { name: "userEngagementDuration" },
      ],
      ...(dimensionFilter ? { dimensionFilter } : {}),
      limit: 1000,
    });

    // rows: [pagePath, dateRangeName] → metrics
    const byPath = new Map();
    (report.rows || []).forEach((r) => {
      const path = toPath(r.dimensionValues[0].value);
      const range = r.dimensionValues[1] ? r.dimensionValues[1].value : "window";
      const entry = byPath.get(path) || {
        path,
        views: 0,
        users: 0,
        engagementSec: 0,
        views7: 0,
        users7: 0,
      };
      const views = num(r.metricValues[0].value);
      const users = num(r.metricValues[1].value);
      const engaged = num(r.metricValues[2].value);
      if (range === "last7") {
        entry.views7 += views;
        entry.users7 += users;
      } else {
        entry.views += views;
        entry.users += users;
        entry.engagementSec += engaged;
      }
      byPath.set(path, entry);
    });

    // Join to the editorial record. Without it the numbers are page paths;
    // with it they are articles, with a pillar and an age.
    let articles = [];
    let noUrl = [];
    if (records) {
      {
        // Published articles with no WP_Public_URL cannot be measured at all —
        // there is no path to attribute traffic to. Name them instead of dropping
        // them silently, since the fix is one empty Airtable cell.
        // Only the published ones: a draft has no URL because it has no page yet,
        // which is correct and not worth reporting.
        noUrl = records
          .filter(
            (r) =>
              !r.fields.WP_Public_URL &&
              /pubblic|publish|live/i.test(String(r.fields.Status || ""))
          )
          .map((r) => ({ title: r.fields.Title || r.id, status: r.fields.Status }));
        articles = records
          .filter((r) => r.fields.WP_Public_URL)
          .map((r) => {
            const path = toPath(r.fields.WP_Public_URL);
            const t = byPath.get(path);
            if (t) t.matched = true;
            return {
              title: r.fields.Title || path,
              url: r.fields.WP_Public_URL,
              path,
              pillar: r.fields.Pillar || null,
              status: r.fields.Status || null,
              publishedAt: r.fields.Published_At || null,
              daysLive: daysSince(r.fields.Published_At),
              views: t ? t.views : 0,
              users: t ? t.users : 0,
              views7: t ? t.views7 : 0,
              users7: t ? t.users7 : 0,
              avgEngagementSec:
                t && t.users ? Math.round(t.engagementSec / t.users) : null,
              inGa4: Boolean(t),
            };
          })
          .sort((a, b) => b.views - a.views);
      }
    }

    // Blog traffic that belongs to no article record: the index page, anything
    // published before C2 existed, or a URL that changed after publication.
    const unmatched = [...byPath.values()]
      .filter((t) => !t.matched && t.views > 0)
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
      .map((t) => ({ path: t.path, views: t.views, users: t.users }));

    // Pillar roll-up over the joined articles only — the question it answers
    // is editorial ("which pillar earns attention"), so unattributed paths
    // must not be counted into it.
    const pillars = {};
    articles.forEach((a) => {
      if (!a.pillar) return;
      const p = (pillars[a.pillar] = pillars[a.pillar] || {
        articles: 0,
        views: 0,
        users: 0,
        views7: 0,
      });
      p.articles += 1;
      p.views += a.views;
      p.users += a.users;
      p.views7 += a.views7;
    });

    const totals = [...byPath.values()].reduce(
      (acc, t) => {
        acc.views += t.views;
        acc.users += t.users;
        acc.views7 += t.views7;
        return acc;
      },
      { views: 0, users: 0, views7: 0 }
    );

    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");

    return res.status(200).json({
      configured: true,
      generatedAt: new Date().toISOString(),
      windowDays: window,
      propertyId,
      totals,
      pillars,
      articles,
      unmatched,
      noUrl, // records with a status but no URL: invisible to GA4 until filled in
      joinError, // non-null means GA4 answered but Airtable did not
      // How the question was put to GA4. When every figure is zero this is the
      // first thing to look at: it distinguishes "nobody read it" from
      // "we asked about paths that do not exist".
      filter: {
        mode: prefix ? `prefix:${prefix}` : articlePaths.length ? "articlePaths" : "wholeProperty",
        pathsAsked: articlePaths.length,
        pathsWithTraffic: byPath.size,
      },
      note:
        "Traffic is attributed by page path. GA4 date ranges end yesterday: " +
        "today's views are never included.",
    });
  } catch (err) {
    return res.status(502).json({ configured: true, error: String(err.message || err) });
  }
}

// Response example:
// {
//   "configured": true, "windowDays": 28,
//   "totals":   { "views": 412, "users": 288, "views7": 96 },
//   "pillars":  { "GEO fundamentals": { "articles": 3, "views": 210, "users": 150, "views7": 44 } },
//   "articles": [ { "title": "…", "url": "…", "path": "/blog/…", "pillar": "…",
//                   "publishedAt": "2026-08-12", "daysLive": 21,
//                   "views": 128, "users": 94, "views7": 22,
//                   "avgEngagementSec": 73, "inGa4": true } ],
//   "unmatched": [ { "path": "/blog", "views": 61, "users": 50 } ]
// }
