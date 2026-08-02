import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
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

function sourceToText(source) {
  if (!source) return "";
  if (Buffer.isBuffer(source)) return source.toString("utf8");
  return String(source);
}

async function resolveMailboxPaths(client) {
  const paths = new Set(["INBOX"]);
  try {
    const boxes = await client.list();
    for (const box of boxes || []) {
      const path = String(box?.path || "").trim();
      if (!path) continue;
      if (box.specialUse === "\\All" || /all mail|כל הדואר/i.test(path)) {
        paths.add(path);
      }
    }
  } catch (error) {
    console.warn("[meridianEmail] list mailboxes failed:", error?.message || error);
  }
  return [...paths];
}

async function searchUids(client, treatmentId, since, lookbackDays) {
  const queries = [];

  if (client.capabilities?.has?.("X-GM-EXT-1")) {
    queries.push({
      gmraw: `from:meridian-medicine.com ${treatmentId} newer_than:${Math.max(1, lookbackDays)}d`,
    });
    queries.push({
      gmraw: `from:info@meridian-medicine.com ${treatmentId}`,
    });
    queries.push({
      gmraw: `"${treatmentId}" from:meridian`,
    });
  }

  // Avoid BODY searches — Gmail often replies BAD / "Command failed".
  queries.push({ since, from: "meridian-medicine.com" });
  queries.push({ since, from: "meridian" });
  queries.push({ since, subject: "מרידיאן" });

  const seen = new Set();
  const uids = [];

  for (const query of queries) {
    try {
      const found = await client.search(query, { uid: true });
      for (const uid of found || []) {
        if (!seen.has(uid)) {
          seen.add(uid);
          uids.push(uid);
        }
      }
      if (uids.length) break;
    } catch (error) {
      console.warn(
        "[meridianEmail] search failed:",
        JSON.stringify(query),
        error?.message || error
      );
    }
  }

  return uids;
}

async function searchMailboxForTreatmentId(
  client,
  mailbox,
  treatmentId,
  since,
  lookbackDays
) {
  let lock;
  try {
    lock = await client.getMailboxLock(mailbox);
  } catch (error) {
    console.warn(
      "[meridianEmail] open mailbox failed:",
      mailbox,
      error?.message || error
    );
    return null;
  }

  try {
    const uids = await searchUids(client, treatmentId, since, lookbackDays);
    if (!uids.length) return null;

    // Newest first — confirmation emails are typically recent.
    const ordered = [...uids].sort((a, b) => b - a).slice(0, 40);

    for await (const message of client.fetch(
      ordered,
      {
        uid: true,
        envelope: true,
        source: true,
      },
      { uid: true }
    )) {
      const envelopeFrom = extractEnvelopeAddress(message.envelope);
      const envelopeSubject = String(message.envelope?.subject || "");
      const source = sourceToText(message.source);

      let from = envelopeFrom;
      let subject = envelopeSubject;
      let text = source;
      let html = "";

      try {
        const parsed = await simpleParser(source);
        from = parsed.from?.text || envelopeFrom;
        subject = parsed.subject || envelopeSubject;
        text = String(parsed.text || "");
        html = String(parsed.html || "");
        // Keep raw source as fallback for IDs that survive encoding oddly.
        if (!text.includes(treatmentId) && !html.includes(treatmentId)) {
          text = `${text}\n${source}`;
        }
      } catch (parseError) {
        console.warn(
          "[meridianEmail] mail parse failed:",
          parseError?.message || parseError
        );
      }

      if (
        emailMatchesMeridianTreatment(
          { from, subject, text, html },
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
  } catch (error) {
    console.warn(
      "[meridianEmail] mailbox scan failed:",
      mailbox,
      error?.message || error
    );
  } finally {
    lock.release();
  }

  return null;
}

function toUserFacingImapError(error) {
  const message = String(error?.message || error || "");
  const lower = message.toLowerCase();

  if (
    lower.includes("invalid credentials") ||
    lower.includes("authentication") ||
    (lower.includes("auth") && lower.includes("fail"))
  ) {
    return "לא ניתן להתחבר לתיבת המייל של הקליניקה (התחברות נכשלה)";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "חיפוש במייל ארך יותר מדי. נסו שוב בעוד רגע";
  }
  if (lower.includes("command failed") || lower.includes("bad")) {
    return "חיפוש במייל נכשל. בדקו שה־IMAP מופעל בחשבון Gmail של הקליניקה";
  }

  return "לא ניתן לסרוק כרגע את מייל הקליניקה לאימות מרידיאן";
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
    connectionTimeout: 20_000,
    greetingTimeout: 16_000,
    socketTimeout: 30_000,
  });

  try {
    await client.connect();
  } catch (error) {
    console.error("[meridianEmail] connect failed:", error?.message || error);
    const wrapped = new Error(toUserFacingImapError(error));
    wrapped.status = 503;
    wrapped.cause = error;
    throw wrapped;
  }

  try {
    const mailboxes = await resolveMailboxPaths(client);
    for (const mailbox of mailboxes) {
      const match = await searchMailboxForTreatmentId(
        client,
        mailbox,
        id,
        since,
        lookbackDays
      );
      if (match) return match;
    }
    return null;
  } catch (error) {
    console.error("[meridianEmail] scan failed:", error?.message || error);
    const wrapped = new Error(toUserFacingImapError(error));
    wrapped.status = 503;
    wrapped.cause = error;
    throw wrapped;
  } finally {
    try {
      await client.logout();
    } catch {
      try {
        client.close();
      } catch {
        /* ignore */
      }
    }
  }
}
