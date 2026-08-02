import assert from "node:assert/strict";
import {
  emailMatchesMeridianTreatment,
  isValidMeridianTreatmentId,
  normalizeMeridianTreatmentId,
} from "../server/meridianEmail.js";

assert.equal(normalizeMeridianTreatmentId("750445114"), "750445114");
assert.equal(normalizeMeridianTreatmentId(" 750-445-114 "), "750445114");
assert.equal(isValidMeridianTreatmentId("750445114"), true);
assert.equal(isValidMeridianTreatmentId("123"), false);

const sample = {
  from: "אתר המטפלים הגדול בישראל - Meridian <info@meridian-medicine.com>",
  subject: "מטופל אישר את הטיפול בקליניקה - אתר מרידיאן",
  text: `מטופל אישר את הטיפול בקליניקה - תוכל לראות את הטיפול בהיסטוריית הטיפולים באזור האישי שלך באתר
מזהה הטיפול שאושר: 750445114
שם המטופל: ודים סיניסקין
ובהצלחה בטיפול!`,
};

assert.equal(emailMatchesMeridianTreatment(sample, "750445114"), true);
assert.equal(emailMatchesMeridianTreatment(sample, "999999999"), false);
assert.equal(
  emailMatchesMeridianTreatment(
    { ...sample, from: "someone@example.com" },
    "750445114"
  ),
  false
);

console.log("meridian email helpers: ok");
