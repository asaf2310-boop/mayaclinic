const DEFAULT_GATEWAY = "https://gateway20.pelecard.biz";

/**
 * Pelecard ignores CssURL/LogoURL that are not on their gateway domain
 * (verified against live PaymentGW HTML — always fell back to variant-he-1).
 * Use a built-in Hebrew variant closest to the clinic look:
 * he-3 = modern blue full-width button (not the default orange he-1).
 */
export const DEFAULT_PELECARD_CSS_CDN =
  "https://gateway20.pelecard.biz/Content/Css/variant-he-3.css";

export const DEFAULT_PELECARD_LOGO_CDN =
  "https://gateway20.pelecard.biz/Content/images/Pelecard.png";

/** Optional merchant CSS — only applied when Pelecard accepts external CssURL. */
export const CLINIC_PELECARD_CSS_CDN =
  "https://cdn.jsdelivr.net/gh/asaf2310-boop/mayaclinic@main/public/payment/clinic-v4.css";

export const CLINIC_PELECARD_LOGO_CDN =
  "https://cdn.jsdelivr.net/gh/asaf2310-boop/mayaclinic@main/public/maya-hero.png";

export function getPelecardConfig() {
  const terminal = String(process.env.PELECARD_TERMINAL || "").trim();
  const user = String(process.env.PELECARD_USER || "").trim();
  const password = String(process.env.PELECARD_PASSWORD || "").trim();
  const gatewayBase = String(process.env.PELECARD_GATEWAY_BASE || DEFAULT_GATEWAY)
    .trim()
    .replace(/\/$/, "");

  const maxPayments = Math.max(1, Number(process.env.PELECARD_MAX_PAYMENTS) || 1);
  const minPayments = Math.max(1, Number(process.env.PELECARD_MIN_PAYMENTS) || 1);
  const cssPath = String(process.env.PELECARD_CSS_PATH || "").trim();
  // Default logo off unless explicitly configured — Pelecard logo is not clinic branding.
  const logoPath = String(process.env.PELECARD_LOGO_PATH || process.env.PELECARD_LOGO_URL || "").trim();

  return {
    terminal,
    user,
    password,
    gatewayBase,
    maxPayments,
    minPayments: Math.min(minPayments, maxPayments),
    cssPath,
    logoPath,
    configured: Boolean(terminal && user && password),
  };
}

export function absolutePublicUrl(origin, pathOrUrl) {
  const value = String(pathOrUrl || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const base = String(origin || "").replace(/\/$/, "");
  const path = value.startsWith("/") ? value : `/${value}`;
  return base ? `${base}${path}` : path;
}

export function shekelsToAgorot(amountShekels) {
  const value = Number(amountShekels);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 100);
}

export async function pelecardPost(path, body, gatewayBase = DEFAULT_GATEWAY) {
  const url = `${String(gatewayBase).replace(/\/$/, "")}/${String(path).replace(/^\//, "")}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message =
      data?.Error?.ErrMsg ||
      data?.error ||
      data?.raw ||
      `Pelecard HTTP ${response.status}`;
    const error = new Error(String(message));
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Create a Pelecard IFrame/Redirect 2.0 payment session (PaymentGW/init).
 * Total must be in agorot (ILS * 100).
 */
export async function initPelecardPayment({
  totalAgorot,
  goodUrl,
  errorUrl,
  serverSideGoodFeedbackUrl = "",
  serverSideErrorFeedbackUrl = "",
  paramX = "",
  userKey = "",
  customerIdField = "optional",
  cardHolderName = "hide",
  cvv2Field = "Must",
  emailField = "hide",
  telField = "hide",
  topText = "",
  bottomText = "",
  publicOrigin = "",
  cssUrl = "",
  logoUrl = "",
}) {
  const config = getPelecardConfig();
  if (!config.configured) {
    const error = new Error("Pelecard is not configured");
    error.status = 503;
    throw error;
  }

  const total = String(Math.round(Number(totalAgorot) || 0));
  if (!total || total === "0") {
    const error = new Error("Invalid payment amount");
    error.status = 400;
    throw error;
  }

  const resolvedCssUrl = String(
    cssUrl ||
      resolvePelecardCssUrl(publicOrigin) ||
      DEFAULT_PELECARD_CSS_CDN
  )
    .trim()
    .split("?")[0];
  const resolvedLogoUrl = absolutePublicUrl(publicOrigin, logoUrl || config.logoPath);

  const payload = {
    terminal: config.terminal,
    user: config.user,
    password: config.password,
    GoodURL: goodUrl,
    ErrorURL: errorUrl,
    ActionType: "J4",
    Currency: "1",
    Total: total,
    FreeTotal: "False",
    CreateToken: "False",
    Language: "HE",
    CardHolderName: cardHolderName,
    CustomerIdField: customerIdField,
    Cvv2Field: cvv2Field,
    EmailField: emailField,
    TelField: telField,
    SplitCCNumber: "False",
    // Break out of iframe so the shopper lands on our success/failure pages.
    FeedbackOnTop: "True",
    FeedbackDataTransferMethod: "GET",
    UseBuildInFeedbackPage: "False",
    MaxPayments: String(config.maxPayments),
    MinPayments: String(config.minPayments),
    MinPaymentsForCredit: "7",
    FirstPayment: "auto",
    ShopNo: "001",
    ParamX: String(paramX || "").slice(0, 120),
    ShowXParam: "False",
    AddHolderNameToXParam: "False",
    // Must be a gateway20.pelecard.biz CssURL — external CssURL is silently ignored.
    CssURL: resolvedCssUrl || DEFAULT_PELECARD_CSS_CDN,
    ShowConfirmationCheckbox: "False",
    HiddenPelecardLogo: resolvedLogoUrl ? "False" : "True",
    HiddenPciLogo: "True",
    HiddenSslSeal: "True",
    AccessibilityMode: "True",
    TakeIshurPopUp: "False",
    SetFocus: "CC",
    CaptionSet: {
      cs_submit: "לתשלום",
      cs_header_payment: "תשלום מאובטח",
    },
  };

  if (resolvedLogoUrl) {
    payload.LogoURL = resolvedLogoUrl;
  }

  if (serverSideGoodFeedbackUrl) {
    payload.ServerSideGoodFeedbackURL = serverSideGoodFeedbackUrl;
  }
  if (serverSideErrorFeedbackUrl) {
    payload.ServerSideErrorFeedbackURL = serverSideErrorFeedbackUrl;
  }

  if (userKey) payload.UserKey = String(userKey).slice(0, 120);
  if (topText) payload.TopText = String(topText).slice(0, 200);
  if (bottomText) payload.BottomText = String(bottomText).slice(0, 200);

  const result = await pelecardPost("PaymentGW/init", payload, config.gatewayBase);
  const errCode = Number(result?.Error?.ErrCode ?? 0);
  if (errCode !== 0 || !result?.URL) {
    const message = result?.Error?.ErrMsg || `Pelecard init failed (${errCode})`;
    const error = new Error(message);
    error.status = 502;
    error.data = result;
    throw error;
  }

  return {
    url: result.URL,
    confirmationKey: result.ConfirmationKey || "",
    error: result.Error || null,
    totalAgorot: Number(total),
    cssUrl: resolvedCssUrl || DEFAULT_PELECARD_CSS_CDN,
    logoUrl: resolvedLogoUrl || "",
  };
}

/**
 * Validate a completed transaction with PaymentGW/ValidateByUniqueKey.
 * Returns true only when Pelecard confirms the amount/key pair.
 */
export async function validatePelecardPayment({
  confirmationKey,
  uniqueKey,
  totalAgorot,
}) {
  const config = getPelecardConfig();
  if (!config.configured) {
    const error = new Error("Pelecard is not configured");
    error.status = 503;
    throw error;
  }

  const payload = {
    ConfirmationKey: String(confirmationKey || ""),
    UniqueKey: String(uniqueKey || ""),
    TotalX100: String(Math.round(Number(totalAgorot) || 0)),
  };

  if (!payload.ConfirmationKey || !payload.UniqueKey || payload.TotalX100 === "0") {
    const error = new Error("Missing validation fields");
    error.status = 400;
    throw error;
  }

  const result = await pelecardPost(
    "PaymentGW/ValidateByUniqueKey",
    payload,
    config.gatewayBase
  );

  // Pelecard returns a truthy body (often "True"/true) on success; empty/false otherwise.
  if (result === true || result === "True" || result === "true") return true;
  if (typeof result === "string" && result.trim().toLowerCase() === "true") return true;
  if (result && typeof result === "object" && result.raw) {
    const raw = String(result.raw).trim().toLowerCase();
    if (raw === "true" || raw === '"true"') return true;
  }

  return false;
}

export function resolvePublicOrigin(req) {
  const configured = String(
    process.env.PELECARD_PUBLIC_ORIGIN ||
      process.env.PUBLIC_SITE_URL ||
      process.env.VITE_PUBLIC_SITE_URL ||
      ""
  )
    .trim()
    .replace(/\/$/, "");
  if (configured) return configured;

  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (!host) return "";

  // Prefer canonical clinic hosts when Vercel internal host is forwarded.
  if (
    host.includes("ofirbaby") ||
    host.includes("maya-clinic") ||
    host === "localhost" ||
    host === "127.0.0.1"
  ) {
    if (host.startsWith("www.")) {
      return `${proto}://${host}`;
    }
    if (host === "ofirbaby.com" || host === "ofirbaby.vercel.app") {
      return `${proto}://ofirbaby.vercel.app`;
    }
  }

  return `${proto}://${host}`;
}

export function resolvePelecardCssUrl(origin) {
  const explicit = String(process.env.PELECARD_CSS_URL || "").trim().split("?")[0];
  if (explicit) return explicit.replace(/\/$/, "");

  // Built-in Pelecard variants are the only CssURL values this terminal reliably applies.
  // PELECARD_CSS_CDN can override (e.g. variant-he-4). External merchant CSS is ignored.
  const cdn = String(process.env.PELECARD_CSS_CDN || DEFAULT_PELECARD_CSS_CDN).trim().split("?")[0];
  if (cdn) return cdn.replace(/\/$/, "");

  const config = getPelecardConfig();
  if (config.cssPath) {
    const base = String(origin || "").replace(/\/$/, "");
    if (base) return absolutePublicUrl(base, config.cssPath);
  }
  return DEFAULT_PELECARD_CSS_CDN;
}
