/**
 * Pelecard GoodURL / ErrorURL landing page (loads inside the payment iframe).
 * Notifies the parent window via postMessage, then shows a short status.
 *
 * ManualIframe flow: https://gateway20.pelecard.biz/ManualIframe
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

  const payload = {
    source: "pelecard-return",
    ok: isSuccess,
    outcome: isSuccess ? "good" : "error",
    pelecardStatusCode: statusCode,
    pelecardTransactionId: String(params.PelecardTransactionId || ""),
    confirmationKey: String(params.ConfirmationKey || ""),
    approvalNo: String(params.ApprovalNo || ""),
    paramX: String(params.ParamX || ""),
    userKey: String(params.UserKey || ""),
    token: String(params.Token || ""),
  };

  const title = isSuccess ? "התשלום התקבל" : "התשלום לא הושלם";
  const message = isSuccess
    ? "אפשר לסגור את חלון התשלום — התור יאושר אוטומטית."
    : "אפשר לנסות שוב או לבחור אמצעי תשלום אחר.";

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: "Heebo", "Assistant", Arial, sans-serif;
      background: linear-gradient(160deg, #f4f7f5 0%, #e8f0ec 55%, #dfe9e3 100%);
      color: #1f2d26;
    }
    .box {
      text-align: center;
      padding: 1.5rem;
      max-width: 22rem;
    }
    h1 {
      margin: 0 0 0.5rem;
      font-size: 1.35rem;
    }
    p {
      margin: 0;
      color: #5a6b62;
      line-height: 1.5;
    }
    .ok h1 { color: #1f6b45; }
    .err h1 { color: #9b2c2c; }
  </style>
</head>
<body>
  <div class="box ${isSuccess ? "ok" : "err"}">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </div>
  <script>
    (function () {
      var payload = ${JSON.stringify(payload)};
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(payload, "*");
        }
      } catch (e) {}
    })();
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(html);
}
