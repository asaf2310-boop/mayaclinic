import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import {
  getGmailCredentials,
  isGmailCredentialsConfigured,
} from "./gmailCredentials.js";

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

export function applyMeridianVerifiedNotes(existingNotes, meridianId) {
  const id = normalizeMeridianTreatmentId(meridianId);
  const verificationNote = `מזהה טיפול מרידיאן שאומת: ${id}`;
  const cleaned = String(existingNotes || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/ממתין לאימות/.test(line))
    .filter((line) => !/מזהה טיפול מרידיאן שאומת/.test(line));
  cleaned.push(verificationNote);
  return cleaned.join("\n");
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

function maskEmail(email) {
  const value = String(email || "").trim();
  const at = value.indexOf("@");
  if (at <= 1) return value ? "***" : "";
  return `${value.slice(0, 2)}***${value.slice(at)}`;
}

function createImapClient() {
  const { user, pass } = getGmailCredentials();
  const host = process.env.GMAIL_IMAP_HOST || "imap.gmail.com";
  const port = Number(process.env.GMAIL_IMAP_PORT || 993);

  return {
    user,
    client: new ImapFlow({
      host,
      port,
      secure: true,
      auth: { user, pass },
      logger: false,
      connectionTimeout: 20_000,
      greetingTimeout: 16_000,
      socketTimeout: 30_000,
    }),
  };
}

function hasGmailRawSearch(client) {
  try {
    return Boolean(client.serverInfo?.capabilities?.has?.("X-GM-EXT-1")
      || client.capabilities?.has?.("X-GM-EXT-1"));
  } catch {
    return false;
  }
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

  if (hasGmailRawSearch(client)) {
    queries.push({
      gmraw: `from:meridian-medicine.com ${treatmentId} newer_than:${Math.max(1, lookbackDays)}d`,
    });
    queries.push({
      gmraw: `from:info@meridian-medicine.com ${treatmentId}`,
    });
    queries.push({
      gmraw: `${treatmentId} from:meridian-medicine.com`,
    });
  }

  // Avoid BODY / Hebrew SUBJECT searches — Gmail often replies BAD / "Command failed".
  queries.push({ since, from: "meridian-medicine.com" });
  queries.push({ since, from: "info@meridian-medicine.com" });
  queries.push({ since, from: "meridian" });

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

export function classifyImapError(error, stage = "scan") {
  const raw = String(error?.responseText || error?.message || error || "");
  const lower = raw.toLowerCase();
  const { user } = getGmailCredentials();

  if (
    lower.includes("invalid credentials") ||
    lower.includes("authenticationfailed") ||
    lower.includes("authentication failed") ||
    (lower.includes("auth") && lower.includes("fail")) ||
    lower.includes("login failed") ||
    (stage === "connect" && lower.includes("command failed"))
  ) {
    return {
      code: "imap_auth",
      message:
        "ההתחברות למייל הקליניקה נכשלה. בדקו ב־Vercel ש־GMAIL_USER ו־GMAIL_APP_PASSWORD שייכים לאותו חשבון (סיסמת אפליקציה בלי רווחים)",
      detail: raw.slice(0, 180),
      user: maskEmail(user),
    };
  }

  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("connect")) {
    return {
      code: "imap_timeout",
      message: "לא ניתן להתחבר ל־Gmail כרגע. נסו שוב בעוד רגע",
      detail: raw.slice(0, 180),
      user: maskEmail(user),
    };
  }

  if (lower.includes("command failed") || /\bbad\b/i.test(raw)) {
    return {
      code: "imap_command",
      message: "חיפוש במייל נכשל בשרת Gmail. נסו שוב, ואם זה חוזר — צרו סיסמת אפליקציה חדשה ב־Google",
      detail: raw.slice(0, 180),
      user: maskEmail(user),
    };
  }

  return {
    code: "imap_error",
    message: "לא ניתן לסרוק כרגע את מייל הקליניקה לאימות מרידיאן",
    detail: raw.slice(0, 180),
    user: maskEmail(user),
  };
}

function toThrownImapError(error, stage) {
  const classified = classifyImapError(error, stage);
  const wrapped = new Error(classified.message);
  wrapped.status = 503;
  wrapped.code = classified.code;
  wrapped.detail = classified.detail;
  wrapped.user = classified.user;
  wrapped.cause = error;
  return wrapped;
}

/**
 * Admin/diagnostic: verify IMAP login works with current env credentials.
 */
export async function probeMeridianMailbox() {
  if (!isGmailCredentialsConfigured()) {
    return {
      ok: false,
      code: "not_configured",
      message: "GMAIL_USER / GMAIL_APP_PASSWORD חסרים בשרת",
      user: "",
    };
  }

  const { user, client } = createImapClient();
  try {
    await client.connect();
    const mailboxes = await resolveMailboxPaths(client);
    return {
      ok: true,
      code: "ok",
      message: "התחברות IMAP הצליחה",
      user: maskEmail(user),
      mailboxes,
      gmailRaw: hasGmailRawSearch(client),
    };
  } catch (error) {
    const classified = classifyImapError(error, "connect");
    return {
      ok: false,
      ...classified,
    };
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

  if (!isGmailCredentialsConfigured()) {
    const error = new Error("תיבת המייל של הקליניקה לא מוגדרת לאימות מרידיאן");
    error.status = 503;
    error.code = "not_configured";
    throw error;
  }

  const lookbackDays = Number(
    options.lookbackDays || process.env.MERIDIAN_EMAIL_LOOKBACK_DAYS || DEFAULT_LOOKBACK_DAYS
  );
  const since = lookbackSinceDate(lookbackDays);
  const { client } = createImapClient();

  try {
    await client.connect();
  } catch (error) {
    console.error("[meridianEmail] connect failed:", error?.message || error);
    throw toThrownImapError(error, "connect");
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
    throw toThrownImapError(error, "scan");
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
