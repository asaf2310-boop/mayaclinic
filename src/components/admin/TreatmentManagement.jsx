import React, { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { getClinicSite } from "@/lib/clinicSite";
import {
  clinicGlassCard,
  clinicOutlineBtn,
  clinicPrimaryBtn,
  clinicTextHeading,
  clinicTextMuted,
} from "@/lib/clinicUi";

const emptyForm = {
  name: "",
  description: "",
  duration_minutes: "60",
  price: "",
  paybox_link: "",
  icon: "",
};

function toFormState(treatment) {
  if (!treatment) return { ...emptyForm };
  return {
    name: treatment.name || "",
    description: treatment.description || "",
    duration_minutes: String(treatment.duration_minutes ?? treatment.duration ?? 60),
    price: treatment.price != null ? String(treatment.price) : "",
    paybox_link: treatment.paybox_link || "",
    icon: treatment.icon || "",
  };
}

function buildPayload(form) {
  const duration = Number.parseInt(form.duration_minutes, 10);
  const price = Number.parseFloat(form.price);

  if (!form.name.trim()) throw new Error("missing_name");
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("invalid_duration");
  if (!Number.isFinite(price) || price < 0) throw new Error("invalid_price");

  const payload = {
    name: form.name.trim(),
    description: form.description.trim() || null,
    duration_minutes: duration,
    price,
    icon: form.icon.trim() || null,
  };

  const paybox = form.paybox_link.trim();
  payload.paybox_link = paybox || null;

  return payload;
}

export default function TreatmentManagement({ treatments = [] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const clinicSite = getClinicSite();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const sortedTreatments = useMemo(
    () =>
      [...treatments].sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || ""), "he")
      ),
    [treatments]
  );

  const openCreate = () => {
    setEditingTreatment(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (treatment) => {
    setEditingTreatment(treatment);
    setForm(toFormState(treatment));
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (payload) => base44.entities.Treatment.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treatments"] });
      setDialogOpen(false);
      toast({ title: "הטיפול נוסף בהצלחה" });
    },
    onError: () => {
      toast({ title: "לא ניתן לשמור את הטיפול", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => base44.entities.Treatment.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treatments"] });
      setDialogOpen(false);
      toast({ title: "הטיפול עודכן" });
    },
    onError: (error) => {
      const message = String(error?.message || "");
      const missingPayboxColumn =
        message.includes("paybox_link") &&
        (message.includes("column") || message.includes("PGRST204"));
      const tenantBlocked =
        message.includes("treatment_update_blocked") ||
        (message.includes("tenant_id") && message.includes("X-Clinic-Tenant-Id"));
      toast({
        title: "לא ניתן לעדכן את הטיפול",
        description: missingPayboxColumn
          ? "חסרה עמודת paybox_link ב-Supabase — הריצי supabase/treatments-paybox.sql."
          : tenantBlocked
            ? "בדקי ש-VITE_CLINIC_TENANT_ID=maya מוגדר ב-Vercel ושהטיפול שייך ל-tenant maya."
            : undefined,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Treatment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treatments"] });
      setDeleteTarget(null);
      toast({ title: "הטיפול נמחק" });
    },
    onError: () => {
      toast({ title: "לא ניתן למחוק את הטיפול", variant: "destructive" });
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (event) => {
    event.preventDefault();
    let payload;
    try {
      payload = buildPayload(form);
    } catch (error) {
      const messages = {
        missing_name: "יש להזין שם טיפול",
        invalid_duration: "משך הטיפול חייב להיות מספר חיובי",
        invalid_price: "יש להזין מחיר תקין",
      };
      toast({
        title: messages[error.message] || "נתונים לא תקינים",
        variant: "destructive",
      });
      return;
    }

    if (editingTreatment?.id) {
      updateMutation.mutate({ id: editingTreatment.id, payload });
      return;
    }
    createMutation.mutate(payload);
  };

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const defaultPayboxHint = clinicSite?.payboxLink
    ? "אם ריק — ייעשה שימוש בקישור PayBox הכללי של הקליניקה."
    : "קישור PayBox ישיר לתשלום על טיפול זה (אופציונלי).";

  return (
    <div dir="rtl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className={clinicSite ? clinicTextMuted : "text-muted-foreground"}>
            ניהול סוגי טיפולים, מחיר וקישור PayBox לכל טיפול. טיפולים שמופיעים כאן יוצגו ללקוחות בקביעת תור.
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreate}
          className={clinicSite ? clinicPrimaryBtn : ""}
        >
          <Plus className="h-4 w-4" />
          הוספת טיפול
        </Button>
      </div>

      {sortedTreatments.length === 0 ? (
        <Card className={`p-8 text-center ${clinicSite ? clinicGlassCard : ""}`}>
          <p className={clinicSite ? clinicTextMuted : "text-muted-foreground"}>
            אין טיפולים במערכת. הוסיפי טיפול ראשון או המתיני לטעינת נתוני ברירת מחדל.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedTreatments.map((treatment) => (
            <Card
              key={treatment.id}
              className={`p-5 ${clinicSite ? clinicGlassCard : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {treatment.icon ? (
                      <span className="text-xl" aria-hidden>
                        {treatment.icon}
                      </span>
                    ) : null}
                    <h3 className={`text-lg font-semibold ${clinicSite ? clinicTextHeading : "text-foreground"}`}>
                      {treatment.name}
                    </h3>
                  </div>
                  {treatment.description ? (
                    <p className={`text-sm ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
                      {treatment.description}
                    </p>
                  ) : null}
                  <p className={`text-sm font-medium ${clinicSite ? clinicTextHeading : "text-foreground"}`}>
                    {treatment.duration_minutes ?? treatment.duration} דקות · ₪{treatment.price}
                  </p>
                  <p className={`break-all text-xs ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
                    PayBox:{" "}
                    {treatment.paybox_link ? (
                      <a
                        href={treatment.paybox_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        {treatment.paybox_link}
                      </a>
                    ) : (
                      <span>ברירת מחדל של הקליניקה</span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(treatment)}
                    className={clinicSite ? clinicOutlineBtn : ""}
                  >
                    <Pencil className="h-4 w-4" />
                    עריכה
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(treatment)}
                  >
                    <Trash2 className="h-4 w-4" />
                    מחיקה
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>{editingTreatment ? "עריכת טיפול" : "טיפול חדש"}</DialogTitle>
            <DialogDescription className="text-right">
              הגדרת שם, משך, מחיר וקישור תשלום PayBox (אופציונלי).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="treatment-name">שם הטיפול</Label>
              <Input
                id="treatment-name"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="treatment-description">תיאור</Label>
              <Textarea
                id="treatment-description"
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={3}
                dir="rtl"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="treatment-duration">משך (דקות)</Label>
                <Input
                  id="treatment-duration"
                  type="number"
                  min={1}
                  value={form.duration_minutes}
                  onChange={(e) => updateField("duration_minutes", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="treatment-price">מחיר (₪)</Label>
                <Input
                  id="treatment-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(e) => updateField("price", e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="treatment-paybox">קישור PayBox</Label>
              <Input
                id="treatment-paybox"
                type="url"
                value={form.paybox_link}
                onChange={(e) => updateField("paybox_link", e.target.value)}
                placeholder="https://links.payboxapp.com/..."
                dir="ltr"
                className="text-left"
              />
              <p className="text-xs text-muted-foreground">{defaultPayboxHint}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="treatment-icon">אייקון (אופציונלי)</Label>
              <Input
                id="treatment-icon"
                value={form.icon}
                onChange={(e) => updateField("icon", e.target.value)}
                placeholder="🌿"
                maxLength={8}
              />
            </div>
            <DialogFooter className="gap-2 sm:justify-start">
              <Button
                type="submit"
                disabled={isSaving}
                className={clinicSite ? clinicPrimaryBtn : ""}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingTreatment ? "שמירת שינויים" : "הוספת טיפול"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                ביטול
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle>למחוק את הטיפול?</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              {deleteTarget?.name
                ? `הטיפול "${deleteTarget.name}" יוסר מקביעת התורים. תורים קיימים יישמרו ללא קישור לטיפול זה.`
                : "הטיפול יוסר מקביעת התורים."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-start">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget?.id && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              מחיקה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
