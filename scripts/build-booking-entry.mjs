import { readFile, writeFile } from "node:fs/promises";

// A second HTML entry shares the existing bundle. Original URLs keep working.
const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const bookingHtml = html
  .replace(/<html[^>]*>/, '<html lang="he" dir="rtl">')
  .replace(/<link[^>]+rel="manifest"[^>]*>/g, "")
  .replace(/((?:src|href)=")\/(?!\/)/g, '$1/booking/')
  .replace(/<title>.*?<\/title>/, "<title>קביעת טיפול | OfirBaby</title>")
  .replace("</head>", '<meta name="robots" content="noindex, nofollow" /><meta name="ofirbaby-booking-version" content="2" /></head>');
await writeFile(new URL("../dist/booking-entry.html", import.meta.url), bookingHtml);
