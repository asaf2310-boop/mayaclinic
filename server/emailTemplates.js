function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateHe(dateStr) {
  if (!dateStr) return "-";
  const [y, m, d] = String(dateStr).split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

function formatAppointmentsTable(appointments = []) {
  const rows = appointments
    .map(
      (item) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(item.treatment_name || "-")}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${formatDateHe(item.date)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(item.time || "-")}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.treatment_price ? `₪${Number(item.treatment_price).toLocaleString("he-IL")}` : "-"}</td>
      </tr>`
    )
    .join("");

  return `
    <table dir="rtl" style="width:100%;border-collapse:collapse;margin-top:12px;">
      <thead>
        <tr style="background:#f7f3ee;">
          <th style="padding:8px;text-align:right;">טיפול</th>
          <th style="padding:8px;text-align:right;">תאריך</th>
          <th style="padding:8px;text-align:right;">שעה</th>
          <th style="padding:8px;text-align:right;">מחיר</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function formatVisitInstructionsBlock() {
  return `
    <div style="margin-top:24px;padding:20px 18px;background:linear-gradient(165deg,#f3f7f4 0%,#faf9f7 100%);border:1px solid #E8ECE8;border-radius:14px;">
      <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#2F3B34;letter-spacing:0.01em;">פרטים חשובים לפני הגעה</p>

      <div style="margin-bottom:12px;padding:14px 16px;background:#ffffff;border-radius:12px;border-right:4px solid #5D7F6D;box-shadow:0 1px 4px rgba(47,59,52,0.06);">
        <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#5D7F6D;">📍 כתובת</p>
        <p style="margin:0;font-size:15px;line-height:1.7;color:#2F3B34;">
          ישראל עידוד 8, פתח תקווה<br/>
          קומה 7, דירה 26
        </p>
      </div>

      <div style="margin-bottom:12px;padding:14px 16px;background:#ffffff;border-radius:12px;box-shadow:0 1px 4px rgba(47,59,52,0.05);">
        <p style="margin:0;font-size:15px;line-height:1.75;color:#444;">
          <span style="display:inline-block;margin-left:6px;">🌿</span>
          הטיפול מתבצע עם חלק תחתון תחת כיסוי בד
        </p>
      </div>

      <div style="margin-bottom:4px;padding:14px 16px;background:#ffffff;border-radius:12px;box-shadow:0 1px 4px rgba(47,59,52,0.05);">
        <p style="margin:0;font-size:15px;line-height:1.75;color:#444;">
          <span style="display:inline-block;margin-left:6px;">💧</span>
          מומלץ לא להתקלח אחרי הטיפול כמה שעות כדי לשמר את האפקט הטיפולי
        </p>
      </div>

      <p style="margin:18px 0 0;font-size:18px;font-weight:600;color:#5D7F6D;text-align:center;line-height:1.5;">
        נתראה 🌸
      </p>
    </div>`;
}

function baseLayout({ title, bodyHtml, clinicName }) {
  return `<!doctype html>
<html lang="he" dir="rtl">
  <head><meta charset="utf-8" /></head>
  <body style="font-family:Arial,sans-serif;background:#f7f3ee;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;">
      <h1 style="margin:0 0 8px;font-size:22px;color:#1a1a1a;">${escapeHtml(title)}</h1>
      <p style="margin:0 0 16px;color:#666;">${escapeHtml(clinicName)}</p>
      ${bodyHtml}
      <p style="margin-top:24px;font-size:13px;color:#888;">הודעה אוטומטית ממערכת קביעת התורים</p>
    </div>
  </body>
</html>`;
}

export function buildConfirmationEmail({ patientName, appointments, clinicName }) {
  const bodyHtml = `
    <p style="font-size:16px;line-height:1.6;">שלום ${escapeHtml(patientName || "יקיר/ה")},</p>
    <p style="font-size:16px;line-height:1.6;">התור שלך נקבע בהצלחה. להלן פרטי הזמנת התור:</p>
    ${formatAppointmentsTable(appointments)}
    ${formatVisitInstructionsBlock()}
    <p style="font-size:14px;line-height:1.6;margin-top:18px;color:#666;">לשינוי או ביטול, צרו קשר עם הקליניקה.</p>`;

  return {
    subject: `אישור הזמנת תור — ${clinicName}`,
    html: baseLayout({ title: "אישור הזמנת תור", bodyHtml, clinicName }),
  };
}

export function buildClinicBookingNotifyEmail({
  patientName,
  patientPhone,
  patientEmail,
  appointments,
  clinicName,
  sourceLabel = "האתר",
  extraNote = "",
}) {
  const phone = String(patientPhone || "").trim() || "—";
  const email = String(patientEmail || "").trim() || "—";
  const noteBlock = extraNote
    ? `<p style="font-size:15px;line-height:1.6;margin-top:12px;color:#444;">${escapeHtml(extraNote)}</p>`
    : "";

  const bodyHtml = `
    <p style="font-size:16px;line-height:1.6;">התקבלה הזמנת תור חדשה דרך ${escapeHtml(sourceLabel)}.</p>
    <p style="font-size:15px;line-height:1.7;margin:12px 0;">
      <strong>שם:</strong> ${escapeHtml(patientName || "—")}<br/>
      <strong>טלפון:</strong> ${escapeHtml(phone)}<br/>
      <strong>אימייל:</strong> ${escapeHtml(email)}
    </p>
    ${formatAppointmentsTable(appointments)}
    ${noteBlock}`;

  const first = appointments?.[0];
  const when = first
    ? `${formatDateHe(first.date)} ${first.time || ""}`.trim()
    : "";

  return {
    subject: when
      ? `הזמנה חדשה — ${patientName || "לקוח"} · ${when}`
      : `הזמנה חדשה — ${patientName || "לקוח"} · ${clinicName}`,
    html: baseLayout({ title: "הזמנת תור חדשה", bodyHtml, clinicName }),
  };
}

export function buildReminderEmail({ patientName, appointments, clinicName }) {
  const bodyHtml = `
    <p style="font-size:16px;line-height:1.6;">שלום ${escapeHtml(patientName || "יקיר/ה")},</p>
    <p style="font-size:16px;line-height:1.6;">תזכורת: מחר יש לך תור ב${escapeHtml(clinicName)}.</p>
    ${formatAppointmentsTable(appointments)}
    ${formatVisitInstructionsBlock()}`;

  return {
    subject: `תזכורת לתור מחר — ${clinicName}`,
    html: baseLayout({ title: "תזכורת לתור", bodyHtml, clinicName }),
  };
}

export function buildGiftVoucherEmail({ purchaserName, recipientName = "", greeting = "", code, quantity, amountIls, clinicName, bookingUrl = "" }) {
  const link = bookingUrl ? `<p style="margin-top:20px"><a href="${escapeHtml(bookingUrl)}" style="background:#5D7F6D;color:white;padding:12px 20px;border-radius:10px;text-decoration:none">לקביעת תור</a></p>` : "";
  const greetingBlock = greeting ? `<div style="margin:18px 0;padding:16px;background:#f3f7f4;border-radius:10px;white-space:pre-line">${escapeHtml(greeting)}</div>` : "";
  const bodyHtml = `<p style="font-size:16px">שלום ${escapeHtml(purchaserName)},</p><p>שובר המתנה${recipientName ? ` עבור ${escapeHtml(recipientName)}` : ""} מוכן:</p>${greetingBlock}<p dir="ltr" style="font:700 30px monospace;text-align:center;letter-spacing:2px">${escapeHtml(code)}</p><p><strong>${quantity} טיפולים</strong> · ₪${Number(amountIls).toLocaleString("he-IL")}</p><p>למימוש: קובעים תור כרגיל, ובעמוד התשלום מזינים את מספר השובר.</p>${link}`;
  return { subject: `שובר המתנה שלך — ${clinicName}`, html: baseLayout({ title: "שובר המתנה שלך", bodyHtml, clinicName }) };
}

export function buildClinicGiftVoucherNotifyEmail({ purchaserName, purchaserPhone, purchaserEmail, recipientName, recipientEmail, greeting, code, quantity, amountIls, clinicName }) {
  const bodyHtml = `<p>נרכש שובר מתנה חדש.</p><p><strong>מזמין:</strong> ${escapeHtml(purchaserName)}<br/><strong>טלפון:</strong> ${escapeHtml(purchaserPhone)}<br/><strong>אימייל:</strong> ${escapeHtml(purchaserEmail)}<br/><strong>מטופל:</strong> ${escapeHtml(recipientName || "—")}<br/><strong>אימייל המטופל:</strong> ${escapeHtml(recipientEmail || "לא נבחרה שליחה")}<br/><strong>ברכה:</strong> ${escapeHtml(greeting || "—")}<br/><strong>שובר:</strong> ${escapeHtml(code)}<br/><strong>כמות:</strong> ${quantity}<br/><strong>סכום:</strong> ₪${Number(amountIls).toLocaleString("he-IL")}</p>`;
  return { subject: `רכישת שובר מתנה — ${purchaserName}`, html: baseLayout({ title: "רכישת שובר מתנה", bodyHtml, clinicName }) };
}
