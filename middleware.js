const SKIP_SLUGS = new Set(["karinshinanit", "mayaclinic"]);

function clientSlugFromHost(host = "") {
  const hostname = String(host).split(":")[0].toLowerCase();
  const match = /^([a-z0-9]+)-demo\.vercel\.app$/.exec(hostname);
  if (!match) return "";
  const slug = match[1];
  return SKIP_SLUGS.has(slug) ? "" : slug;
}

export default function middleware(request) {
  const url = new URL(request.url);
  const slug = clientSlugFromHost(request.headers.get("host") || "");
  if (!slug) return;

  const isRoot = url.pathname === "/";
  const isShortLetter = url.pathname === `/${slug.charAt(0)}`;
  if (!isRoot && !isShortLetter) return;

  const target = new URL(`/api/share/${slug}`, url.origin);
  target.search = url.search;

  return Response.rewrite(target);
}

export const config = {
  matcher: ["/"],
};
