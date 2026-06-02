import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import Navbar from "../components/layout/Navbar";
import TreatmentSelector from "../components/booking/TreatmentSelector";
import BookingForm from "../components/booking/BookingForm";
import BookingSuccess from "../components/booking/BookingSuccess";
import PaymentStep from "../components/booking/PaymentStep";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { filterTreatmentsForClinic, getClinicSite } from "@/lib/clinicSite";
import { sendBookingConfirmationEmail } from "@/api/bookingEmail";

export default function Book() {
  const [selectedTreatment, setSelectedTreatment] = useState(null);
  const [pendingFormData, setPendingFormData] = useState(null);
  const [bookedAppointment, setBookedAppointment] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clinicSite = getClinicSite();

  const { data: treatments = [], isLoading } = useQuery({
    queryKey: ["treatments"],
    queryFn: () => base44.entities.Treatment.list(),
  });

  const visibleTreatments = useMemo(
    () => filterTreatmentsForClinic(treatments, clinicSite),
    [treatments, clinicSite]
  );

  useEffect(() => {
    if (!visibleTreatments.length || selectedTreatment) return;

    if (clinicSite?.defaultTreatmentName) {
      const preferred = visibleTreatments.find(
        (treatment) => String(treatment?.name || "").trim() === clinicSite.defaultTreatmentName
      );
      if (preferred) {
        setSelectedTreatment(preferred);
        return;
      }
    }

    setSelectedTreatment(visibleTreatments[0]);
  }, [clinicSite, selectedTreatment, visibleTreatments]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const rows = data.appointments.map((appointment) => ({
        patient_name: data.patient_name,
        patient_phone: data.patient_phone,
        patient_email: data.patient_email,
        notes: data.notes,
        marketing_consent: Boolean(data.marketing_consent),
        treatment_id: data.treatment_id,
        treatment_name: data.treatment_name,
        treatment_price: selectedTreatment?.price,
        date: appointment.date,
        time: appointment.time,
      }));

      if (typeof base44.entities.Appointment.bulkCreate === "function") {
        return base44.entities.Appointment.bulkCreate(rows);
      }

      return Promise.all(rows.map((row) => base44.entities.Appointment.create(row)));
    },
    onSuccess: (data) => {
      const createdAppointments = Array.isArray(data) ? data : [data];
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      createdAppointments.forEach((appointment) => {
        queryClient.invalidateQueries({ queryKey: ["appointments-for-date", appointment?.date] });
      });
      setBookedAppointment({
        appointments: createdAppointments,
        treatment_name: selectedTreatment?.name,
        treatment_price: selectedTreatment?.price,
      });
      setPendingFormData(null);

      sendBookingConfirmationEmail(
        createdAppointments.map((appointment) => appointment?.id).filter(Boolean)
      );
    },
    onError: (error) => {
      const message = String(error?.message || "");
      const isTimeConflict = message.includes("appointment_time_conflict");

      toast({
        title: isTimeConflict ? "השעה כבר לא זמינה" : "לא ניתן לאשר את התור",
        description: isTimeConflict
          ? "נבחר תור אחר בטווח של פחות משעה. חזרו לבחירת שעה אחרת."
          : "נסו שוב בעוד רגע או צרו קשר טלפוני.",
        variant: "destructive",
      });
    },
  });

  const handleFormSubmit = (formData) => {
    setPendingFormData(formData);
  };

  const handleConfirmAfterPayment = () => {
    createMutation.mutate(pendingFormData);
  };

  const handleReset = () => {
    setSelectedTreatment(null);
    setPendingFormData(null);
    setBookedAppointment(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 px-6" dir="rtl">
        <div className="max-w-2xl mx-auto">
          {bookedAppointment ? (
            <BookingSuccess appointment={bookedAppointment} onReset={handleReset} />
          ) : pendingFormData ? (
            <PaymentStep
              formData={pendingFormData}
              treatment={selectedTreatment}
              onConfirm={handleConfirmAfterPayment}
              onBack={() => setPendingFormData(null)}
              isSubmitting={createMutation.isPending}
            />
          ) : (
            <>
              <div className="text-center mb-10">
                <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">קביעת תור</h1>
                <p className="text-muted-foreground text-lg">
                  {clinicSite ? "בחרו תאריך ושעה נוחים לטיפול" : "בחרו טיפול, תאריך ושעה נוחים"}
                </p>
              </div>

              <div className="space-y-8">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 rounded-xl" />
                    ))}
                  </div>
                ) : visibleTreatments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    אין טיפולים זמינים כרגע
                  </div>
                ) : (
                  <>
                    {visibleTreatments.length === 1 ? (
                      <Card className="p-4">
                        <p className="text-sm text-muted-foreground">הטיפול שלך</p>
                        <p className="mt-1 text-xl font-bold">{visibleTreatments[0].name}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {visibleTreatments[0].duration_minutes} דקות · ₪{visibleTreatments[0].price}
                        </p>
                      </Card>
                    ) : (
                      <TreatmentSelector
                        treatments={visibleTreatments}
                        selectedId={selectedTreatment?.id}
                        onSelect={setSelectedTreatment}
                      />
                    )}

                    <div className="h-px bg-border" />

                    <BookingForm
                      selectedTreatment={selectedTreatment}
                      onSubmit={handleFormSubmit}
                      isSubmitting={false}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}