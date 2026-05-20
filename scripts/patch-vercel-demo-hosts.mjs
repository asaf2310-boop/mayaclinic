import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientsPath = path.join(root, "demo-clients.json");
const vercelPath = path.join(root, "vercel.json");

const config = JSON.parse(fs.readFileSync(clientsPath, "utf8"));
const vercel = JSON.parse(fs.readFileSync(vercelPath, "utf8"));

const clients = config.clients ?? [];

const clientRewrites = clients.flatMap((slug) => {
  const host = `${String(slug).toLowerCase()}-demo.vercel.app`;
  return [
    {
      source: "/",
      has: [{ type: "host", value: host }],
      destination: `/api/share/${String(slug).toLowerCase()}`,
    },
  ];
});

const tailRewrites = [
  {
    source: "/share/:client",
    destination: "/api/share/:client",
  },
  {
    source: "/((?!api|assets|landing-).*)",
    destination: "/index.html",
  },
];

vercel.rewrites = [...clientRewrites, ...tailRewrites];

fs.writeFileSync(vercelPath, `${JSON.stringify(vercel, null, 2)}\n`);

console.log(
  `Patched vercel.json with ${clientRewrites.length} static landing rule(s).`
);
