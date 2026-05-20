function decodeSlug(value = "") {
  return decodeURIComponent(String(value || ""))
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "");
}

function displayNameFromSlug(slug) {
  const known = {
    karin: "קארין",
    michal: "מיכל",
  };

  if (known[slug]) return known[slug];
  if (!slug) return "הדמו";

  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function slugFromHost(host = "") {
  const hostname = String(host).toLowerCase().split(":")[0];
  if (!hostname.endsWith(".vercel.app")) return "";

  const firstPart = hostname.split(".")[0] || "";
  if (!firstPart.includes("-demo")) return "";

  return decodeSlug(firstPart.replace(/-demo.*$/, ""));
}

export default function handler(req, res) {
  const rawClient = req.query?.client;
  const clientSlug = Array.isArray(rawClient) ? rawClient[0] : rawClient;

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${proto}://${host}`;
  const hostSlug = slugFromHost(host);
  const slug = decodeSlug(clientSlug) || hostSlug;

  const demoRoot = process.env.VITE_DEMO_URL?.replace(/\/$/, "") || baseUrl;
  const shareUrl = slug ? `${baseUrl}/share/${slug}` : `${baseUrl}/`;
  const rawRedirectPath = Array.isArray(req.query?.to) ? req.query.to[0] : req.query?.to;
  const redirectPath = String(rawRedirectPath || "/").startsWith("/")
    ? String(rawRedirectPath || "/")
    : "/";
  const redirectTarget = `${demoRoot}${redirectPath}`;
  const imageUrl = `${demoRoot}/demo-icon.svg`;
  const clientLabel = displayNameFromSlug(slug);

  const title = `הקליניקה של ${clientLabel}`;
  const description = "מערכת דמו לקביעת תורים וניהול קליניקה";

  const html = `<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${shareUrl}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />
    <meta http-equiv="refresh" content="0; url=${redirectTarget}" />
  </head>
  <body>
    <p>מעביר לדמו...</p>
  </body>
</html>`;

  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("cache-control", "public, max-age=0, s-maxage=60");
  res.status(200).send(html);
}
