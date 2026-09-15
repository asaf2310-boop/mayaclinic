import React, { useEffect } from "react";
import { bookingBasePath, bookingUrl } from "@/lib/bookingMount";
import "./ofir-booking.css";

const WEBSITE_HOME = "https://www.ofirbaby.com/";

export function OfirBookingHeader() {
  return (
    <header className="ofir-booking-header" dir="rtl">
      <a className="ofir-booking-brand" href={WEBSITE_HOME}>
        <img src={bookingUrl("/ofirbaby-logo.png")} width="46" height="48" alt="" />
        <span><strong>אופיר – מרכז טיפול הוליסטי</strong><small>OfirBaby</small></span>
      </a>
      <a className="ofir-back-home" href={WEBSITE_HOME}>חזרה לאתר</a>
    </header>
  );
}

export default function OfirBookingShell({ children }) {
  useEffect(() => {
    if (!bookingBasePath) return;
    document.body.classList.add("ofirbaby-booking");
    return () => document.body.classList.remove("ofirbaby-booking");
  }, []);
  if (!bookingBasePath) return children;
  return <>{children}<footer className="ofir-booking-footer" dir="ltr">Powered by AllInCenter</footer></>;
}
