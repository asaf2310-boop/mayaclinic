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
    <p style="font-size:16px;line-height:1.6;">התור שלך נקבע בהצלחה. להלן הפרטים:</p>
    ${formatAppointmentsTable(appointments)}
    <p style="font-size:15px;line-height:1.6;margin-top:16px;">נשמח לראותך בזמן. לשינוי או ביטול, צרו קשר עם הקליניקה.</p>`;

  return {
    subject: `אישור תור — ${clinicName}`,
    html: baseLayout({ title: "אישור קביעת תור", bodyHtml, clinicName }),
  };
}

export function buildReminderEmail({ patientName, appointments, clinicName }) {
  const bodyHtml = `
    <p style="font-size:16px;line-height:1.6;">שלום ${escapeHtml(patientName || "יקיר/ה")},</p>
    <p style="font-size:16px;line-height:1.6;">תזכורת: מחר יש לך תור ב${escapeHtml(clinicName)}.</p>
    ${formatAppointmentsTable(appointments)}
    <p style="font-size:15px;line-height:1.6;margin-top:16px;">מחכים לראותך!</p>`;

  return {
    subject: `תזכורת לתור מחר — ${clinicName}`,
    html: baseLayout({ title: "תזכורת לתור", bodyHtml, clinicName }),
  };
}
