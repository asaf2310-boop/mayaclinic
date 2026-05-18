import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ADMIN_EMAIL = "Ofirbabyinfo@gmail.com";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const apt = payload.data;
    if (!apt) {
      return Response.json({ error: "No appointment data" }, { status: 400 });
    }

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: ADMIN_EMAIL,
      subject: `תור חדש נקבע - ${apt.patient_name}`,
      body: `
שלום מאיה,

תור חדש נקבע!

👤 שם: ${apt.patient_name}
📞 טלפון: ${apt.patient_phone}
💆 טיפול: ${apt.treatment_name}
📅 תאריך: ${apt.date}
🕐 שעה: ${apt.time}
${apt.notes ? `📝 הערות: ${apt.notes}` : ""}

בהצלחה!
      `.trim(),
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});