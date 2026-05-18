import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Allow both admin calls and scheduled automation calls
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  // Get all appointments scheduled for tomorrow that are pending or confirmed
  const allAppointments = await base44.asServiceRole.entities.Appointment.list();
  const tomorrowAppointments = allAppointments.filter(
    (apt) => apt.date === tomorrowStr && ["pending", "confirmed"].includes(apt.status || "pending")
  );

  const results = [];

  for (const apt of tomorrowAppointments) {
    if (!apt.patient_email) {
      results.push({ id: apt.id, status: "skipped", reason: "no email" });
      continue;
    }

    const emailBody = `
שלום ${apt.patient_name},

תזכורת: מחר, ${apt.date.split("-").reverse().join("/")} בשעה ${apt.time}, קבעת תור לטיפול: ${apt.treatment_name}.

נשמח לראותך!
אם אינך יכול/ה להגיע, אנא צור/י איתנו קשר מראש.

בברכה,
הקליניקה
    `.trim();

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: apt.patient_email,
      subject: `תזכורת: תור מחר בשעה ${apt.time} - ${apt.treatment_name}`,
      body: emailBody,
    });

    results.push({ id: apt.id, patient: apt.patient_name, status: "sent" });
  }

  return Response.json({
    date_checked: tomorrowStr,
    appointments_found: tomorrowAppointments.length,
    results,
  });
});