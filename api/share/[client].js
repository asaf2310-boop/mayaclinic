function decodeSlug(value = "") {
  return decodeURIComponent(String(value || ""))
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "");
}

function displayNameFromSlug(slug) {
  const known = {
    karin: "קארין",
    karinshinanit: "קארין",
    michal: "מיכל",
    yael: "יעל",
    noa: "נועה",
    shiran: "שירן",
    dana: "דנה",
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
  const match = /^([a-z0-9]+)-demo\.vercel\.app$/.exec(hostname);
  if (match) return decodeSlug(match[1]);

  if (hostname.includes("karinshinanit-demo")) return "karinshinanit";
  return "";
}

export default function handler(req, res) {
  const rawClient = req.query?.client;
  const clientSlug = Array.isArray(rawClient) ? rawClient[0] : rawClient;

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${proto}://${host}`.replace(/\/$/, "");
  const hostSlug = slugFromHost(host);
  const slug = decodeSlug(clientSlug) || hostSlug;

  const query = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const sharePath = slug ? `/api/share/${slug}` : "/";
  const publicPath = slug && hostSlug === slug ? "/" : sharePath;
  const canonicalUrl = `${baseUrl}${publicPath}${query}`;
  const bookUrl = `${baseUrl}/book`;
  const imageUrl = `${baseUrl}/demo-icon.svg`;
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
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />
  </head>
  <body>
    <p>${title} — ${description}</p>
    <p><a href="${bookUrl}">לקביעת תור בדמו</a></p>
    <script>
      window.location.replace(${JSON.stringify(bookUrl)});
    </script>
  </body>
</html>`;

  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("cache-control", "public, max-age=0, s-maxage=300");
  res.status(200).send(html);
}
