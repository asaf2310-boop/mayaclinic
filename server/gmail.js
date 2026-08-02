import nodemailer from "nodemailer";
import {
  getGmailCredentials,
  isGmailCredentialsConfigured,
} from "./gmailCredentials.js";

export function getClinicName() {
  return process.env.MAYA_CLINIC_NAME || "הקליניקה של מאיה";
}

export function isEmailConfigured() {
  return isGmailCredentialsConfigured();
}

function createTransport() {
  const { user, pass } = getGmailCredentials();
  if (!user || !pass) {
    throw new Error("Gmail is not configured");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export async function sendEmail({ to, subject, html }) {
  const fromName = getClinicName();
  const { user: fromAddress } = getGmailCredentials();

  const transport = createTransport();
  await transport.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject,
    html,
  });
}
