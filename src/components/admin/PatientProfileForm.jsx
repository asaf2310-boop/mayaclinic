import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FUNDING_SOURCE_OPTIONS,
  GENDER_OPTIONS,
  HMO_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  PATIENT_TYPE_OPTIONS,
  PREFERRED_CONTACT_OPTIONS,
  SESSION_LOCATION_OPTIONS,
  emptyPatientProfileFields,
  normalizeProfileFields,
} from "@/lib/patientProfiles";
import { clinicFormInput, clinicFormLabel } from "@/lib/clinicUi";

function ProfileField({ label, children, className = "" }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label className={clinicFormLabel}>{label}</Label>
      {children}
    </div>
  );
}

function ProfileSelect({ label, value, onValueChange, options, placeholder, inputClass }) {
  return (
    <ProfileField label={label}>
      <Select value={value || undefined} onValueChange={onValueChange}>
        <SelectTrigger className={inputClass || clinicFormInput}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent dir="rtl">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </ProfileField>
  );
}

/**
 * Owns local form state so typing does not re-render the patient page chrome
 * (stats, sidebar history, contact actions).
 */
export default function PatientProfileForm({
  formId = "patient-profile-form",
  initialProfile,
  customer,
  onSubmit,
  cardClass = "",
  inputClass = "",
}) {
  const [form, setForm] = useState(() =>
    initialProfile ? normalizeProfileFields(initialProfile) : emptyPatientProfileFields()
  );

  useEffect(() => {
    setForm(
      initialProfile ? normalizeProfileFields(initialProfile) : emptyPatientProfileFields()
    );
  }, [initialProfile]);

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const fieldInputClass = inputClass || clinicFormInput;

  return (
    <form
      id={formId}
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form);
      }}
    >
      <Card className={`p-5 ${cardClass}`}>
        <h2 className="mb-4 text-lg font-semibold">פרטים אישיים</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ProfileSelect
            label="מגדר"
            value={form.gender}
            onValueChange={(value) => setField("gender", value)}
            options={GENDER_OPTIONS}
            placeholder="בחר/י מגדר"
            inputClass={fieldInputClass}
          />
          <ProfileSelect
            label="מצב משפחתי"
            value={form.maritalStatus}
            onValueChange={(value) => setField("maritalStatus", value)}
            options={MARITAL_STATUS_OPTIONS}
            placeholder="בחר/י מצב"
            inputClass={fieldInputClass}
          />
          <ProfileField label="תאריך לידה">
            <Input
              type="date"
              value={form.birthDate}
              onChange={(event) => setField("birthDate", event.target.value)}
              className={fieldInputClass}
            />
          </ProfileField>
          <ProfileField label="עיסוק">
            <Input
              value={form.occupation}
              onChange={(event) => setField("occupation", event.target.value)}
              placeholder="לדוגמה: מורה, מהנדס/ת"
              className={fieldInputClass}
            />
          </ProfileField>
          <ProfileSelect
            label="סוג מטופל"
            value={form.patientType}
            onValueChange={(value) => setField("patientType", value)}
            options={PATIENT_TYPE_OPTIONS}
            placeholder="בחר/י סוג"
            inputClass={fieldInputClass}
          />
          <ProfileSelect
            label="קופת חולים"
            value={form.hmo}
            onValueChange={(value) => setField("hmo", value)}
            options={HMO_OPTIONS}
            placeholder="בחר/י קופה"
            inputClass={fieldInputClass}
          />
          <ProfileField label="ביטוח משלים" className="sm:col-span-2">
            <Input
              value={form.insurance}
              onChange={(event) => setField("insurance", event.target.value)}
              placeholder="שם חברת ביטוח / פוליסה (אופציונלי)"
              className={fieldInputClass}
            />
          </ProfileField>
        </div>
      </Card>

      <Card className={`p-5 ${cardClass}`}>
        <h2 className="mb-4 text-lg font-semibold">פרטי קשר</h2>
        <div className="mb-4 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
          <p className="font-medium">{customer?.name}</p>
          <p className="mt-1 text-muted-foreground">{customer?.phone || "אין טלפון"}</p>
          <p className="text-muted-foreground" dir="ltr">
            {customer?.email || "אין אימייל"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            פרטי קשר מעודכנים מתורים. לעריכה — עדכנו בתור הבא.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ProfileField label="עיר">
            <Input
              value={form.city}
              onChange={(event) => setField("city", event.target.value)}
              className={fieldInputClass}
            />
          </ProfileField>
          <ProfileField label="מיקוד">
            <Input
              value={form.zip}
              onChange={(event) => setField("zip", event.target.value)}
              className={fieldInputClass}
            />
          </ProfileField>
          <ProfileField label="כתובת" className="sm:col-span-2">
            <Input
              value={form.address}
              onChange={(event) => setField("address", event.target.value)}
              className={fieldInputClass}
            />
          </ProfileField>
          <ProfileSelect
            label="אמצעי קשר מועדף"
            value={form.preferredContact}
            onValueChange={(value) => setField("preferredContact", value)}
            options={PREFERRED_CONTACT_OPTIONS}
            placeholder="בחר/י אמצעי"
            inputClass={fieldInputClass}
          />
          <ProfileField label="איש קשר לחירום — שם">
            <Input
              value={form.emergencyContactName}
              onChange={(event) => setField("emergencyContactName", event.target.value)}
              className={fieldInputClass}
            />
          </ProfileField>
          <ProfileField label="איש קשר לחירום — טלפון">
            <Input
              value={form.emergencyContactPhone}
              onChange={(event) => setField("emergencyContactPhone", event.target.value)}
              className={fieldInputClass}
              dir="ltr"
            />
          </ProfileField>
        </div>
      </Card>

      <Card className={`p-5 ${cardClass}`}>
        <h2 className="mb-4 text-lg font-semibold">רקע רפואי / טיפולי</h2>
        <ProfileField label="רקע קל (אלרגיות, טיפולים קודמים, מגבלות)">
          <Textarea
            value={form.medicalBackground}
            onChange={(event) => setField("medicalBackground", event.target.value)}
            rows={4}
            placeholder="מידע רלוונטי לטיפול — לא תיק רפואי מלא"
            className={fieldInputClass}
          />
        </ProfileField>
      </Card>

      <Card className={`p-5 ${cardClass}`}>
        <h2 className="mb-4 text-lg font-semibold">הערות מטפל</h2>
        <div className="grid gap-4">
          <ProfileField label="הערות קליטה">
            <Textarea
              value={form.intakeNotes}
              onChange={(event) => setField("intakeNotes", event.target.value)}
              rows={3}
              placeholder="סיבת הפנייה, ציפיות, הקשר ראשוני"
              className={fieldInputClass}
            />
          </ProfileField>
          <ProfileField label="מטרות טיפול">
            <Textarea
              value={form.treatmentGoals}
              onChange={(event) => setField("treatmentGoals", event.target.value)}
              rows={3}
              placeholder="מטרות לטווח קצר וארוך"
              className={fieldInputClass}
            />
          </ProfileField>
          <ProfileField label="הערות מתמשכות">
            <Textarea
              value={form.continuousNotes}
              onChange={(event) => setField("continuousNotes", event.target.value)}
              rows={5}
              placeholder="תיעוד שוטף — התקדמות, תצפיות, המלצות"
              className={fieldInputClass}
            />
          </ProfileField>
          <div className="grid gap-4 sm:grid-cols-2">
            <ProfileSelect
              label="מיקום מפגש"
              value={form.sessionLocation}
              onValueChange={(value) => setField("sessionLocation", value)}
              options={SESSION_LOCATION_OPTIONS}
              placeholder="בחר/י מיקום"
              inputClass={fieldInputClass}
            />
            <ProfileField label="זמנים מועדפים">
              <Input
                value={form.preferredTimes}
                onChange={(event) => setField("preferredTimes", event.target.value)}
                placeholder="לדוגמה: בוקר, ימי ראשון"
                className={fieldInputClass}
              />
            </ProfileField>
          </div>
        </div>
      </Card>

      <Card className={`p-5 ${cardClass}`}>
        <h2 className="mb-1 text-lg font-semibold">מימון</h2>
        <p className="mb-4 text-sm text-muted-foreground">אופציונלי — לניהול פנימי בקליניקה</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ProfileSelect
            label="מקור מימון"
            value={form.fundingSource}
            onValueChange={(value) => setField("fundingSource", value)}
            options={FUNDING_SOURCE_OPTIONS}
            placeholder="בחר/י מקור"
            inputClass={fieldInputClass}
          />
          <ProfileField label="מחיר למפגש (₪)">
            <Input
              type="number"
              min="0"
              value={form.sessionPrice}
              onChange={(event) => setField("sessionPrice", event.target.value)}
              placeholder="320"
              className={fieldInputClass}
            />
          </ProfileField>
        </div>
      </Card>
    </form>
  );
}
