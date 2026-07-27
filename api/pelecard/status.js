import {
  getPelecardConfig,
  resolvePelecardCssUrl,
  DEFAULT_PELECARD_CSS_CDN,
  DEFAULT_PELECARD_LOGO_CDN,
} from "../../server/pelecard.js";

/** Lightweight public flag — does not expose credentials. */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { configured, gatewayBase, maxPayments, minPayments, cssPath } = getPelecardConfig();
  const cssUrl = resolvePelecardCssUrl("https://ofirbaby.vercel.app") || DEFAULT_PELECARD_CSS_CDN;
  res.status(200).json({
    configured,
    gatewayBase,
    maxPayments,
    minPayments,
    cssPath,
    cssUrl,
    logoUrl: DEFAULT_PELECARD_LOGO_CDN,
  });
}
