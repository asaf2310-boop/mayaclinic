function normalizePayboxUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function getPayboxPaymentDetails(payboxLink, amount) {
  const value = Math.round(Number(amount) || 0);
  const amountDisplay = `₪${value.toLocaleString("he-IL")}`;
  const url = normalizePayboxUrl(payboxLink);
  const isConfigured = Boolean(url);

  return {
    amount: value,
    amountDisplay,
    url,
    isConfigured,
    instructionText: isConfigured
      ? "ייפתח קישור תשלום ישיר ב־PayBox."
      : "קישור PayBox לא הוגדר.",
    clipboardText: isConfigured ? url : "",
  };
}

export function buildDynamicPayboxUrl(phone, amount) {
  return `https://payboxapp.page.link/?link=https://payboxapp.com/pay?to%3D${phone}%26amount%3D${amount}&apn=com.paybox.www&isi=1163995014&ibi=com.paybox.app`;
}

export async function copyText(text) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function openUrlInPayboxContext(url) {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);

  if (isMobile) {
    window.location.href = url;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function openPayboxLink(payboxLink) {
  const details = getPayboxPaymentDetails(payboxLink);
  if (!details.isConfigured) {
    return { opened: false, missingConfig: true, ...details };
  }

  openUrlInPayboxContext(details.url);
  return { opened: true, ...details };
}
