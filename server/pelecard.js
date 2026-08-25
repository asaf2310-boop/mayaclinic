const DEFAULT_GATEWAY = "https://gateway20.pelecard.biz";

/**
 * Pelecard built-in Hebrew theme with native payment-method buttons
 * (`.tab-button.pay-btn` for credit / Apple Pay / Google Pay).
 * Custom ofirbaby CssURL overrides broke wallet logo sizing.
 */
export const DEFAULT_PELECARD_CSS_CDN =
  "https://gateway20.pelecard.biz/Content/Css/variant-he-4.css";

export const DEFAULT_PELECARD_LOGO_CDN =
  "https://ofirbaby.vercel.app/maya-hero.png";

/** Optional merchant CssURL (only when allowlisted / PELECARD_CSS_CDN set). */
export const CLINIC_PELECARD_CSS_CDN =
  "https://ofirbaby.vercel.app/payment/clinic-v4.css";

export const CLINIC_PELECARD_LOGO_CDN = DEFAULT_PELECARD_LOGO_CDN;

export function getPelecardConfig() {
  const terminal = String(process.env.PELECARD_TERMINAL || "").trim();
  const user = String(process.env.PELECARD_USER || "").trim();
  const password = String(process.env.PELECARD_PASSWORD || "").trim();
  const gatewayBase = String(process.env.PELECARD_GATEWAY_BASE || DEFAULT_GATEWAY)
    .trim()
    .replace(/\/$/, "");

  const maxPayments = Math.max(1, Number(process.env.PELECARD_MAX_PAYMENTS) || 1);
  const minPayments = Math.max(1, Number(process.env.PELECARD_MIN_PAYMENTS) || 1);
  // Empty by default — use Pelecard built-in CssURL (variant-he-4).
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
    // Pelecard built-in theme — keeps native Apple Pay / Google Pay buttons.
    CssURL: resolvedCssUrl || DEFAULT_PELECARD_CSS_CDN,
    ShowConfirmationCheckbox: "False",
    HiddenPelecardLogo: resolvedLogoUrl ? "False" : "True",
    HiddenPciLogo: "True",
    HiddenSslSeal: "True",
    // AccessibilityMode enlarges controls and clips the pay button in iframe on phones.
    AccessibilityMode: "False",
    TakeIshurPopUp: "False",
    SetFocus: "CC",
    DisableZoom: "True",
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
 * Pelecard docs: ValidateByUniqueKey returns 1 on match, 0 otherwise.
 * Some gateways/libraries also return True/true.
 */
export function isPelecardValidateSuccess(result) {
  if (result === true || result === 1) return true;
  if (typeof result === "number" && result === 1) return true;
  if (typeof result === "string") {
    const raw = result.trim().toLowerCase().replace(/^"|"$/g, "");
    if (raw === "1" || raw === "true") return true;
  }
  if (result && typeof result === "object") {
    if (result.raw != null) return isPelecardValidateSuccess(result.raw);
    if (result.Result != null) return isPelecardValidateSuccess(result.Result);
    if (result.result != null) return isPelecardValidateSuccess(result.result);
  }
  return false;
}

/**
 * Validate a completed transaction with PaymentGW/ValidateByUniqueKey.
 * Returns true only when Pelecard confirms the amount/key pair.
 *
 * UniqueKey must be the UserKey from init when one was sent; otherwise
 * PelecardTransactionId. Callers may pass several candidates via uniqueKeys.
 */
export async function validatePelecardPayment({
  confirmationKey,
  uniqueKey,
  uniqueKeys = [],
  totalAgorot,
}) {
  const config = getPelecardConfig();
  if (!config.configured) {
    const error = new Error("Pelecard is not configured");
    error.status = 503;
    throw error;
  }

  const total = String(Math.round(Number(totalAgorot) || 0));
  const key = String(confirmationKey || "").trim();
  const keys = [
    ...new Set(
      [uniqueKey, ...(Array.isArray(uniqueKeys) ? uniqueKeys : [])]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    ),
  ];

  if (!key || !keys.length || total === "0") {
    const error = new Error("Missing validation fields");
    error.status = 400;
    throw error;
  }

  let lastResult = null;
  for (const candidate of keys) {
    const payload = {
      ConfirmationKey: key,
      UniqueKey: candidate,
      TotalX100: total,
    };

    const result = await pelecardPost(
      "PaymentGW/ValidateByUniqueKey",
      payload,
      config.gatewayBase
    );
    lastResult = result;

    if (isPelecardValidateSuccess(result)) return true;
  }

  if (typeof console !== "undefined") {
    console.warn(
      "[pelecard] ValidateByUniqueKey rejected",
      JSON.stringify({ confirmationKey: key.slice(0, 8), total, uniqueKeys: keys, lastResult })
    );
  }

  return false;
}

/**
 * Lookup a completed iframe transaction (auth required).
 * Used as a fallback when ValidateByUniqueKey is inconclusive.
 */
export async function getPelecardTransaction(transactionId) {
  const config = getPelecardConfig();
  if (!config.configured) {
    const error = new Error("Pelecard is not configured");
    error.status = 503;
    throw error;
  }

  const id = String(transactionId || "").trim();
  if (!id) {
    const error = new Error("Missing transaction id");
    error.status = 400;
    throw error;
  }

  return pelecardPost(
    "PaymentGW/GetTransaction",
    {
      terminal: config.terminal,
      user: config.user,
      password: config.password,
      TransactionId: id,
    },
    config.gatewayBase
  );
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
  // Explicit override only (e.g. allowlisted clinic theme).
  const explicit = String(process.env.PELECARD_CSS_URL || "").trim().split("?")[0];
  if (explicit) return explicit.replace(/\/$/, "");

  // Ignore legacy PELECARD_CSS_CDN=clinic-v4 — it overrides native wallet buttons.
  const cdn = String(process.env.PELECARD_CSS_CDN || "").trim().split("?")[0];
  if (
    cdn &&
    !/clinic-v4\.css|\/api\/pelecard\/theme|ofirbaby\.vercel\.app\/payment\//i.test(cdn)
  ) {
    return cdn.replace(/\/$/, "");
  }

  const config = getPelecardConfig();
  if (config.cssPath) {
    const path = String(config.cssPath);
    if (!/clinic-v4\.css/i.test(path)) {
      const base = String(origin || "https://ofirbaby.vercel.app").replace(/\/$/, "");
      if (base) return absolutePublicUrl(base, path);
    }
  }

  return DEFAULT_PELECARD_CSS_CDN;
}
