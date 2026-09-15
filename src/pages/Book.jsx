import { bookingBasePath } from "@/lib/bookingMount";
import { Button } from "@/components/ui/button";
import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import Navbar from "../components/layout/Navbar";
import TreatmentSelector from "../components/booking/TreatmentSelector";
import BookingForm from "../components/booking/BookingForm";
import BookingErrorBoundary from "../components/booking/BookingErrorBoundary";
import BookingContact from "../components/booking/BookingContact";
import PaymentStep from "../components/booking/PaymentStep";
import MeridianVerifyStep from "../components/booking/MeridianVerifyStep";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
  filterTreatmentsForClinic,
  getClinicSite,
  getTreatmentsForBookingChannel,
  isMomentBookingChannel,
} from "@/lib/clinicSite";
import {
  clinicBookPageSubtitle,
  clinicBookPageTitle,
  clinicFadeIn,
  clinicGlassCard,
  clinicGlassPanel,
  clinicPageGradient,
  clinicTextHeading,
  clinicTextMuted,
} from "@/lib/clinicUi";

function resolvePaymentMethod(searchParams) {
  const channel = String(searchParams.get("channel") || "").trim();
  const payment = String(searchParams.get("payment") || "").trim().toLowerCase();

  if (isMomentBookingChannel(channel) || payment === "movement" || payment === "moment") {
    return "movement";
  }
  if (payment === "meridian") return "meridian";
  return "credit";
}

export default function Book() {
  const [searchParams] = useSearchParams();
  const paymentMethod = resolvePaymentMethod(searchParams);
  const isMoment = paymentMethod === "movement";
  const isMeridian = paymentMethod === "meridian";
  const bookingChannel = isMoment
    ? getClinicSite()?.momentBooking?.channel || "movement"
    : "";

  const [selectedTreatment, setSelectedTreatment] = useState(null);
  const [pendingFormData, setPendingFormData] = useState(null);
  const [meridianVerified, setMeridianVerified] = useState(null);
  const [savedFormData, setSavedFormData] = useState(null);
  const [stage, setStage] = useState("treatment");
  const clinicSite = getClinicSite();

  const { data: treatments = [], isLoading } = useQuery({
    queryKey: ["treatments"],
    queryFn: () => base44.entities.Treatment.list(),
  });

  const visibleTreatments = useMemo(() => {
    if (isMoment) {
      return getTreatmentsForBookingChannel(treatments, bookingChannel, clinicSite);
    }
    return filterTreatmentsForClinic(treatments, clinicSite);
  }, [treatments, clinicSite, isMoment, bookingChannel]);

  useEffect(() => {
    setSelectedTreatment(null);
    setPendingFormData(null);
    setMeridianVerified(null);
    setSavedFormData(null);
    setStage("treatment");
  }, [paymentMethod]);

  useEffect(() => {
    if (!visibleTreatments.length || selectedTreatment) return;
    if (isMeridian && !meridianVerified) return;

    if (visibleTreatments.length === 1) {
      setSelectedTreatment(visibleTreatments[0]);
      return;
    }

    if (bookingBasePath) return;

    if (!isMoment && clinicSite?.defaultTreatmentName) {
      const preferred = visibleTreatments.find(
        (treatment) => String(treatment?.name || "").trim() === clinicSite.defaultTreatmentName
      );
      if (preferred) {
        setSelectedTreatment(preferred);
        return;
      }
    }

    if (!isMoment) {
      setSelectedTreatment(visibleTreatments[0]);
    }
  }, [clinicSite, isMoment, isMeridian, meridianVerified, selectedTreatment, visibleTreatments]);

  const handleFormSubmit = (formData) => {
    setSavedFormData(formData);
    setPendingFormData({
      ...formData,
      hide_price: isMoment || isMeridian,
      booking_channel: isMoment ? bookingChannel : isMeridian ? "meridian" : "standard",
      treatment_price: isMoment ? null : formData.treatment_price,
      meridianTreatmentId: meridianVerified?.treatmentId || "",
      meridianVerificationToken: meridianVerified?.verificationToken || "",
    });
  };

  const pageTitle = isMoment
    ? clinicSite?.momentBooking?.pageTitle || "קביעת תור — לקוחות מובמנט"
    : isMeridian
      ? "קביעת תור — מרידיאן"
      : "קביעת תור";
  const pageSubtitle = isMoment
    ? clinicSite?.momentBooking?.pageSubtitle || ""
    : isMeridian
      ? meridianVerified
        ? "בחרו תאריך ושעה · מזהה מרידיאן אומת"
        : "תחילה אמתו את מזהה הטיפול ממרידיאן, ואז בחרו מועד"
      : clinicSite
        ? "בחרו תאריך ושעה נוחים לטיפול"
        : "בחרו טיפול, תאריך ושעה נוחים";

  const hidePrices = isMoment || isMeridian;
  const showMeridianGate = isMeridian && !meridianVerified;
  const showBookingForm = !pendingFormData && !showMeridianGate;
  const currentStep = pendingFormData
    ? 3
    : stage === "treatment"
      ? 0
      : stage === "date"
        ? 1
        : 2;

  return (
    <div
      className={`min-h-screen ${pendingFormData ? "overflow-visible" : "overflow-x-hidden"} ${clinicSite ? `page-background ${clinicPageGradient} clinic-page-enter font-sans` : "bg-background"}`}
    >
      <Navbar />
      <main className="relative px-4 pb-12 pt-20 sm:px-6 sm:pb-16 sm:pt-24" dir="rtl">
        <div className={`relative mx-auto w-full max-w-2xl ${pendingFormData ? "overflow-visible" : "overflow-x-hidden"} ${clinicSite ? clinicFadeIn : ""}`}>
          {bookingBasePath ? (
            <ol className="ofir-booking-steps" aria-label="שלבי קביעת טיפול">
              {["טיפול", "תאריך ושעה", "פרטים", "אישור"].map((label, index) => (
                <li key={label} aria-current={index === currentStep ? "step" : undefined}>
                  {index + 1}. {label}
                </li>
              ))}
            </ol>
          ) : null}
          {pendingFormData ? (
            <PaymentStep
              formData={pendingFormData}
              treatment={selectedTreatment}
              paymentMethod={paymentMethod}
              onBack={() => setPendingFormData(null)}
            />
          ) : (
            <>
              <div className="mb-10 text-center">
                <h1 className={clinicSite ? clinicBookPageTitle : "mb-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl"}>
                  {pageTitle}
                </h1>
                {pageSubtitle ? (
                  <p className={clinicSite ? clinicBookPageSubtitle : "text-lg text-muted-foreground"}>
                    {pageSubtitle}
                  </p>
                ) : null}
              </div>

              {showMeridianGate ? (
                <MeridianVerifyStep onVerified={setMeridianVerified} />
              ) : null}

              {showBookingForm ? (
                <div className={`space-y-8 ${clinicSite ? clinicGlassPanel : ""}`}>
                  {isMeridian && meridianVerified ? (
                    <div
                      className={`rounded-2xl border px-4 py-3 text-center text-sm ${
                        clinicSite
                          ? "border-[#D5E0D8] bg-[#F7FAF8]/90 text-[#2F3E35]"
                          : "border-border bg-muted/40 text-foreground"
                      }`}
                    >
                      מזהה מרידיאן אומת · ניתן לבחור מועד
                    </div>
                  ) : null}

                  {isLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-20 rounded-2xl" />
                      ))}
                    </div>
                  ) : visibleTreatments.length === 0 ? (
                    <div className={`py-12 text-center ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
                      אין טיפולים זמינים כרגע
                    </div>
                  ) : (
                    <>
                      <div hidden={Boolean(bookingBasePath && stage !== "treatment")}>
                        {visibleTreatments.length === 1 ? (
                          <Card className={`p-5 ${clinicSite ? clinicGlassCard : ""}`}>
                            <p className={`text-sm ${clinicTextMuted}`}>הטיפול שלך</p>
                            <p className={`mt-1 text-xl font-bold ${clinicTextHeading}`}>{visibleTreatments[0].name}</p>
                            <p className={`mt-2 text-sm ${clinicTextMuted}`}>
                              {hidePrices
                                ? `${visibleTreatments[0].duration_minutes} דקות`
                                : `${visibleTreatments[0].duration_minutes} דקות · ₪${visibleTreatments[0].price}`}
                            </p>
                            {visibleTreatments[0].description ? (
                              <p className={`mt-3 text-sm leading-relaxed ${clinicTextMuted}`}>
                                {visibleTreatments[0].description}
                              </p>
                            ) : null}
                          </Card>
                        ) : (
                          <TreatmentSelector
                            treatments={visibleTreatments}
                            selectedId={selectedTreatment?.id}
                            onSelect={setSelectedTreatment}
                            hidePrices={hidePrices}
                          />
                        )}
                        {bookingBasePath ? (
                          <Button
                            className="ofir-next mt-6 w-full bg-[var(--ofir-5d7f6d)] text-white"
                            disabled={!selectedTreatment}
                            onClick={() => setStage("date")}
                          >
                            המשך לבחירת מועד
                          </Button>
                        ) : null}
                      </div>

                      <div hidden={Boolean(bookingBasePath && stage === "treatment")}>
                        <div className={`h-px ${clinicSite ? "bg-[#E8ECE8]" : "bg-border"}`} />

                        <BookingErrorBoundary
                          onReset={() => {
                            setSelectedTreatment(null);
                            setPendingFormData(null);
                          }}
                        >
                          <BookingForm
                            step={bookingBasePath ? stage : "all"}
                            onStepChange={setStage}
                            initialData={savedFormData}
                            selectedTreatment={selectedTreatment}
                            onSubmit={handleFormSubmit}
                            isSubmitting={false}
                            requireEmail
                          />
                        </BookingErrorBoundary>
                      </div>
                    </>
                  )}

                  {!isLoading && <BookingContact />}
                </div>
              ) : null}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
