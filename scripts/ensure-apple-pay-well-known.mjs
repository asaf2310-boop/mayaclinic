#!/usr/bin/env node
/**
 * Ensure Apple Pay domain-association files land in dist/.well-known
 * (Vite usually copies public/, but we force it so Apple never hits the SPA).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "public", ".well-known");
const distDir = path.join(root, "dist", ".well-known");

const names = [
  "apple-developer-merchantid-domain-association.txt",
  "apple-developer-merchantid-domain-association",
];

if (!fs.existsSync(srcDir)) {
  console.warn("[apple-pay] public/.well-known missing — skip copy");
  process.exit(0);
}

fs.mkdirSync(distDir, { recursive: true });

let copied = 0;
for (const name of names) {
  const from = path.join(srcDir, name);
  if (!fs.existsSync(from)) continue;
  const content = fs.readFileSync(from);
  if (!content.length) {
    console.warn(`[apple-pay] ${name} is empty — Apple verification will fail until content is added`);
    continue;
  }
  fs.writeFileSync(path.join(distDir, name), content);
  copied += 1;
  console.log(`[apple-pay] copied ${name} (${content.length} bytes)`);
}

if (!copied) {
  console.warn(
    "[apple-pay] No domain-association file with content found. Paste Pelecard's txt into public/.well-known/"
  );
}
