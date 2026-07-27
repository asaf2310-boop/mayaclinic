const DEFAULT_GATEWAY = "https://gateway20.pelecard.biz";

export function getPelecardConfig() {
  const terminal = String(process.env.PELECARD_TERMINAL || "").trim();
  const user = String(process.env.PELECARD_USER || "").trim();
  const password = String(process.env.PELECARD_PASSWORD || "").trim();
  const gatewayBase = String(process.env.PELECARD_GATEWAY_BASE || DEFAULT_GATEWAY)
    .trim()
    .replace(/\/$/, "");

  const maxPayments = Math.max(1, Number(process.env.PELECARD_MAX_PAYMENTS) || 1);
  const minPayments = Math.max(1, Number(process.env.PELECARD_MIN_PAYMENTS) || 1);

  return {
    terminal,
    user,
    password,
    gatewayBase,
    maxPayments,
    minPayments: Math.min(minPayments, maxPayments),
    configured: Boolean(terminal && user && password),
  };
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
  paramX = "",
  userKey = "",
  customerIdField = "optional",
  cardHolderName = "hide",
  cvv2Field = "optional",
  emailField = "hide",
  telField = "hide",
  topText = "",
  bottomText = "",
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
    FeedbackOnTop: "False",
    UseBuildInFeedbackPage: "False",
    MaxPayments: String(config.maxPayments),
    MinPayments: String(config.minPayments),
    MinPaymentsForCredit: "7",
    FirstPayment: "auto",
    ShopNo: "001",
    ParamX: String(paramX || "").slice(0, 120),
    ShowXParam: "False",
    AddHolderNameToXParam: "False",
    CssURL: `${config.gatewayBase}/Content/Css/variant-he-1.css`,
    LogoURL: `${config.gatewayBase}/Content/images/Pelecard.png`,
    ShowConfirmationCheckbox: "False",
    HiddenPelecardLogo: "False",
    AccessibilityMode: "True",
    TakeIshurPopUp: "False",
  };

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
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim();
  if (!host) return "";
  return `${proto}://${host}`;
}
