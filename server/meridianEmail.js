import { ImapFlow } from "imapflow";
import { isEmailConfigured } from "./gmail.js";

const MERIDIAN_FROM_HINTS = ["meridian-medicine.com", "meridian"];
const MERIDIAN_SUBJECT_HINTS = ["מטופל אישר", "מרידיאן", "meridian"];
const DEFAULT_LOOKBACK_DAYS = 14;

export function normalizeMeridianTreatmentId(raw) {
  return String(raw || "").replace(/\D/g, "");
}

export function isValidMeridianTreatmentId(raw) {
  const id = normalizeMeridianTreatmentId(raw);
  return id.length >= 6 && id.length <= 20;
}

function includesAny(haystack, needles) {
  const text = String(haystack || "").toLowerCase();
  return needles.some((needle) => text.includes(String(needle).toLowerCase()));
}

function bodyContainsTreatmentId(body, treatmentId) {
  const id = normalizeMeridianTreatmentId(treatmentId);
  if (!id) return false;
  const text = String(body || "");
  if (!text.includes(id)) return false;
  const labeled = new RegExp(
    `מזהה\\s*הטיפול\\s*שאושר\\s*[:：]?\\s*${id}`
  );
  return labeled.test(text) || text.includes(id);
}

/**
 * Pure check used by IMAP search + unit tests.
 */
export function emailMatchesMeridianTreatment(
  { from = "", subject = "", text = "", html = "" } = {},
  treatmentId
) {
  if (!isValidMeridianTreatmentId(treatmentId)) return false;

  const fromOk = includesAny(from, MERIDIAN_FROM_HINTS);
  if (!fromOk) return false;

  const body = `${text || ""}\n${html || ""}`;
  if (!bodyContainsTreatmentId(body, treatmentId)) return false;

  // Subject is a strong signal but not required if from+body match.
  const subjectOk = includesAny(subject, MERIDIAN_SUBJECT_HINTS);
  return subjectOk || body.includes("מזהה הטיפול שאושר");
}

function lookbackSinceDate(days = DEFAULT_LOOKBACK_DAYS) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - Number(days || DEFAULT_LOOKBACK_DAYS));
  since.setUTCHours(0, 0, 0, 0);
  return since;
}

function extractEnvelopeAddress(envelope) {
  const from = envelope?.from || [];
  return from
    .map((item) => {
      const name = String(item?.name || "").trim();
      const address = String(item?.address || "").trim();
      if (name && address) return `${name} <${address}>`;
      return address || name;
    })
    .filter(Boolean)
    .join(", ");
}

async function searchMailboxForTreatmentId(client, mailbox, treatmentId, since) {
  let lock;
  try {
    lock = await client.getMailboxLock(mailbox);
  } catch {
    return null;
  }

  try {
    const uids = await client.search(
      {
        since,
        body: treatmentId,
      },
      { uid: true }
    );

    if (!uids?.length) return null;

    // Newest first — confirmation emails are typically recent.
    const ordered = [...uids].sort((a, b) => b - a).slice(0, 25);

    for await (const message of client.fetch(
      ordered,
      {
        uid: true,
        envelope: true,
        source: true,
      },
      { uid: true }
    )) {
      const from = extractEnvelopeAddress(message.envelope);
      const subject = String(message.envelope?.subject || "");
      const source = message.source
        ? Buffer.isBuffer(message.source)
          ? message.source.toString("utf8")
          : String(message.source)
        : "";

      if (
        emailMatchesMeridianTreatment(
          { from, subject, text: source, html: source },
          treatmentId
        )
      ) {
        return {
          mailbox,
          uid: message.uid,
          from,
          subject,
          date: message.envelope?.date || null,
        };
      }
    }
  } finally {
    lock.release();
  }

  return null;
}

/**
 * Scan Maya's Gmail inbox (IMAP) for a Meridian confirmation with this treatment ID.
 */
export async function findMeridianTreatmentEmail(treatmentId, options = {}) {
  const id = normalizeMeridianTreatmentId(treatmentId);
  if (!isValidMeridianTreatmentId(id)) {
    const error = new Error("מזהה טיפול לא תקין");
    error.status = 400;
    throw error;
  }

  if (!isEmailConfigured()) {
    const error = new Error("תיבת המייל של הקליניקה לא מוגדרת לאימות מרידיאן");
    error.status = 503;
    throw error;
  }

  const host = process.env.GMAIL_IMAP_HOST || "imap.gmail.com";
  const port = Number(process.env.GMAIL_IMAP_PORT || 993);
  const lookbackDays = Number(
    options.lookbackDays || process.env.MERIDIAN_EMAIL_LOOKBACK_DAYS || DEFAULT_LOOKBACK_DAYS
  );
  const since = lookbackSinceDate(lookbackDays);

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    logger: false,
  });

  await client.connect();
  try {
    const mailboxes = ["INBOX", "[Gmail]/All Mail"];
    for (const mailbox of mailboxes) {
      const match = await searchMailboxForTreatmentId(client, mailbox, id, since);
      if (match) return match;
    }
    return null;
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore logout errors */
    }
  }
}
