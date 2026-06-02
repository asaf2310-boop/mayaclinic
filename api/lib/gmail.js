import nodemailer from "nodemailer";

export function getClinicName() {
  return process.env.MAYA_CLINIC_NAME || "הקליניקה של מאיה";
}

export function isEmailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function createTransport() {
  if (!isEmailConfigured()) {
    throw new Error("Gmail is not configured");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export async function sendEmail({ to, subject, html }) {
  const fromName = getClinicName();
  const fromAddress = process.env.GMAIL_USER;

  const transport = createTransport();
  await transport.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject,
    html,
  });
}
