const KNOWN_LABELS = {
  michal: "מיכל",
  karin: "קארין",
  karinshinanit: "קארין",
  yael: "יעל",
  noa: "נועה",
  shiran: "שירן",
  dana: "דנה",
};

function slugFromHostname(hostname = "") {
  const host = String(hostname).toLowerCase().split(":")[0];

  const singleWordMatch = /^([a-z0-9]+)-demo\.vercel\.app$/.exec(host);
  if (singleWordMatch) return singleWordMatch[1];

  if (host.includes("karinshinanit-demo")) return "karinshinanit";
  if (host.includes("mayaclinic-demo")) return "karin";

  return "";
}

function labelFromSlug(slug) {
  if (!slug) return "הדמו";
  if (KNOWN_LABELS[slug]) return KNOWN_LABELS[slug];

  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function getDemoBrand(hostname = typeof window !== "undefined" ? window.location.hostname : "") {
  const slug = slugFromHostname(hostname);
  const clientLabel = labelFromSlug(slug);
  const clinicTitle = `הקליניקה של ${clientLabel}`;

  return {
    slug,
    clientLabel,
    clinicTitle,
    isClientAlias: Boolean(slug) && slug !== "karinshinanit" && slug !== "karin",
  };
}
