import { resolvePublicOrigin } from "../../server/pelecard.js";

/**
 * Pelecard GoodURL / ErrorURL landing page.
 * With FeedbackOnTop=True this loads in the top window, then redirects
 * the shopper to the SPA success / failure pages.
 */
function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function collectParams(req) {
  const query = req.query || {};
  const params = {};
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) params[key] = value[0];
    else if (value != null) params[key] = String(value);
  }
  return params;
}

export default async function handler(req, res) {
  const params = collectParams(req);
  const outcome = String(params.outcome || "").toLowerCase();
  const statusCode = String(params.PelecardStatusCode || "").trim();
  const isSuccess = outcome === "good" && (!statusCode || statusCode === "000");
  const bookingRef = String(params.ref || params.ParamX || params.UserKey || "").trim();
  const origin = resolvePublicOrigin(req);

  const redirectPath = isSuccess
    ? `/payment/success?ref=${encodeURIComponent(bookingRef)}`
    : `/payment/failure?ref=${encodeURIComponent(bookingRef)}&code=${encodeURIComponent(statusCode || "error")}`;
  const redirectUrl = origin ? `${origin}${redirectPath}` : redirectPath;

  const payload = {
    source: "pelecard-return",
    ok: isSuccess,
    outcome: isSuccess ? "good" : "error",
    bookingRef,
    redirectUrl,
    pelecardStatusCode: statusCode,
    pelecardTransactionId: String(params.PelecardTransactionId || ""),
    confirmationKey: String(params.ConfirmationKey || ""),
    approvalNo: String(params.ApprovalNo || ""),
    paramX: String(params.ParamX || ""),
    userKey: String(params.UserKey || ""),
  };

  const title = isSuccess ? "התשלום התקבל" : "התשלום לא הושלם";
  const message = isSuccess
    ? "מעבירים לדף האישור…"
    : "מעבירים לדף השגיאה…";

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="0;url=${escapeHtml(redirectUrl)}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --heading: #2F3B34;
      --muted: #6B746F;
      --primary: #5D7F6D;
      --border: #E8ECE8;
      --ok: #2F6B4F;
      --err: #9B2C2C;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: "Heebo", system-ui, sans-serif;
      background:
        linear-gradient(160deg, rgba(247, 248, 246, 0.98) 0%, #ffffff 45%, #f0f4f1 100%);
      color: var(--heading);
      -webkit-font-smoothing: antialiased;
    }
    .box {
      text-align: center;
      padding: 1.75rem 1.5rem;
      max-width: 22rem;
      width: calc(100% - 2rem);
      border: 1px solid var(--border);
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.05);
    }
    .icon {
      width: 52px;
      height: 52px;
      margin: 0 auto 0.85rem;
      border-radius: 16px;
      display: grid;
      place-items: center;
      font-size: 1.4rem;
      font-weight: 700;
    }
    .ok .icon { background: #F0F4F1; color: var(--ok); }
    .err .icon { background: #FCE8E8; color: var(--err); }
    h1 {
      margin: 0 0 0.45rem;
      font-size: 1.25rem;
      font-weight: 700;
    }
    p {
      margin: 0;
      color: var(--muted);
      line-height: 1.55;
      font-size: 0.95rem;
    }
    .ok h1 { color: var(--ok); }
    .err h1 { color: var(--err); }
    a {
      display: inline-block;
      margin-top: 1rem;
      color: var(--primary);
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="box ${isSuccess ? "ok" : "err"}">
    <div class="icon" aria-hidden="true">${isSuccess ? "✓" : "!"}</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <a href="${escapeHtml(redirectUrl)}">המשך</a>
  </div>
  <script>
    (function () {
      var payload = ${JSON.stringify(payload)};
      var target = ${JSON.stringify(redirectUrl)};
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(payload, "*");
        }
      } catch (e) {}
      try {
        if (window.top && window.top !== window) {
          window.top.location.replace(target);
          return;
        }
      } catch (e) {}
      window.location.replace(target);
    })();
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(html);
}
