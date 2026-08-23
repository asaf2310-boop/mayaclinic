import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import Navbar from "../components/layout/Navbar";
import TreatmentSelector from "../components/booking/TreatmentSelector";
import BookingForm from "../components/booking/BookingForm";
import BookingContact from "../components/booking/BookingContact";
import PaymentStep from "../components/booking/PaymentStep";
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
  const bookingChannel = isMoment
    ? getClinicSite()?.momentBooking?.channel || "movement"
    : "";

  const [selectedTreatment, setSelectedTreatment] = useState(null);
  const [pendingFormData, setPendingFormData] = useState(null);
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
  }, [paymentMethod]);

  useEffect(() => {
    if (!visibleTreatments.length || selectedTreatment) return;

    if (visibleTreatments.length === 1) {
      setSelectedTreatment(visibleTreatments[0]);
      return;
    }

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
  }, [clinicSite, isMoment, selectedTreatment, visibleTreatments]);

  const handleFormSubmit = (formData) => {
    setPendingFormData({
      ...formData,
      hide_price: isMoment,
      booking_channel: isMoment ? bookingChannel : "standard",
      treatment_price: isMoment ? null : formData.treatment_price,
    });
  };

  const pageTitle = isMoment
    ? clinicSite?.momentBooking?.pageTitle || "קביעת תור — לקוחות מובמנט"
    : "קביעת תור";
  const pageSubtitle = isMoment
    ? clinicSite?.momentBooking?.pageSubtitle || "כל תור 45 דקות"
    : paymentMethod === "meridian"
      ? "בחרו תאריך ושעה · לאחר ההזמנה הזינו מזהה טיפול ממרידיאן"
      : clinicSite
        ? "בחרו תאריך ושעה נוחים לטיפול"
        : "בחרו טיפול, תאריך ושעה נוחים";

  const hidePrices = isMoment || paymentMethod === "meridian";

  return (
    <div
      className={`min-h-screen ${pendingFormData ? "overflow-visible" : "overflow-x-hidden"} ${clinicSite ? `page-background ${clinicPageGradient} clinic-page-enter font-sans` : "bg-background"}`}
    >
      <Navbar />
      <main className="relative px-4 pb-12 pt-20 sm:px-6 sm:pb-16 sm:pt-24" dir="rtl">
        <div className={`relative mx-auto w-full max-w-2xl ${pendingFormData ? "overflow-visible" : "overflow-x-hidden"} ${clinicSite ? clinicFadeIn : ""}`}>
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
                <p className={clinicSite ? clinicBookPageSubtitle : "text-lg text-muted-foreground"}>
                  {pageSubtitle}
                </p>
              </div>

              <div
                className={`space-y-8 ${
                  clinicSite ? clinicGlassPanel : ""
                }`}
              >
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
                    {visibleTreatments.length === 1 ? (
                      <Card
                        className={`p-5 ${
                          clinicSite
                            ? clinicGlassCard
                            : ""
                        }`}
                      >
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

                    <div className={`h-px ${clinicSite ? "bg-[#E8ECE8]" : "bg-border"}`} />

                    <BookingForm
                      selectedTreatment={selectedTreatment}
                      onSubmit={handleFormSubmit}
                      isSubmitting={false}
                      requireEmail={isMoment || paymentMethod === "meridian"}
                    />
                  </>
                )}

                {!isLoading && <BookingContact />}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
