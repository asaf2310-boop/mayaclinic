import { getPelecardConfig } from "../lib/pelecard.js";

/** Lightweight public flag — does not expose credentials. */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { configured, gatewayBase, maxPayments, minPayments } = getPelecardConfig();
  res.status(200).json({
    configured,
    gatewayBase,
    maxPayments,
    minPayments,
  });
}
