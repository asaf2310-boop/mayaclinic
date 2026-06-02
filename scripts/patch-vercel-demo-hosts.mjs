import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientsPath = path.join(root, "demo-clients.json");
const vercelPath = path.join(root, "vercel.json");

const config = JSON.parse(fs.readFileSync(clientsPath, "utf8"));
const vercel = JSON.parse(fs.readFileSync(vercelPath, "utf8"));

const clients = config.clients ?? [];

const clientRootRoutes = clients.flatMap((slug) => {
  const host = `${String(slug).toLowerCase()}-demo.vercel.app`;
  const client = String(slug).toLowerCase();
  const shareDest = `/api/share/${client}`;

  return [
    {
      src: "/",
      has: [{ type: "host", value: host }],
      dest: shareDest,
    },
    {
      src: `/${client.charAt(0)}`,
      has: [{ type: "host", value: host }],
      dest: shareDest,
    },
  ];
});

const tailRoutes = [
  {
    src: "/share/(.*)",
    dest: "/api/share/$1",
  },
  {
    handle: "filesystem",
  },
  {
    src: "/(.*)",
    dest: "/index.html",
  },
];

vercel.routes = [...clientRootRoutes, ...tailRoutes];
delete vercel.redirects;
delete vercel.rewrites;
delete vercel.framework;

fs.writeFileSync(vercelPath, `${JSON.stringify(vercel, null, 2)}\n`);

console.log(
  `Patched vercel.json with ${clientRootRoutes.length} client route(s) (root + short letter).`
);
