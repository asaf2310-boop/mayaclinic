import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientsPath = path.join(root, "demo-clients.json");
const publicDir = path.join(root, "public");

const config = JSON.parse(fs.readFileSync(clientsPath, "utf8"));
const clients = config.clients ?? [];

const primaryOrigin = (
  process.env.DEMO_PRIMARY_ORIGIN ??
  process.env.VITE_DEMO_URL ??
  "https://karinshinanit-demo.vercel.app"
).replace(/\/$/, "");

const KNOWN_LABELS = {
  michal: "מיכל",
  karin: "קארין",
  yael: "יעל",
  noa: "נועה",
  shiran: "שירן",
  dana: "דנה",
};

function labelFromSlug(slug) {
  if (KNOWN_LABELS[slug]) return KNOWN_LABELS[slug];
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

for (const rawSlug of clients) {
  const slug = String(rawSlug).toLowerCase().replace(/[^a-z0-9-_]/g, "");
  if (!slug) continue;

  const host = `${slug}-demo.vercel.app`;
  const clientLabel = labelFromSlug(slug);
  const title = `הקליניקה של ${clientLabel}`;
  const description = "מערכת דמו לקביעת תורים וניהול קליניקה";
  const canonicalUrl = `https://${host}/`;
  const imageUrl = `${primaryOrigin}/demo-icon.svg`;
  const redirectTarget = `${primaryOrigin}/book`;

  const html = `<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    <meta http-equiv="refresh" content="0; url=${escapeHtml(redirectTarget)}" />
  </head>
  <body>
    <p>מעביר לדמו...</p>
    <p><a href="${escapeHtml(redirectTarget)}">לחץ כאן אם לא הועברת אוטומטית</a></p>
  </body>
</html>
`;

  const filePath = path.join(publicDir, `landing-${slug}.html`);
  fs.writeFileSync(filePath, html);
  console.log(`Wrote ${filePath}`);
}
