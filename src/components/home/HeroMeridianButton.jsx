import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { clinicHeroMeridianBtn, clinicHeroMeridianIconRing } from "@/lib/clinicUi";

/** Meridian hero CTA → regular booking with Meridian payment step. */
export default function HeroMeridianButton({ link }) {
  if (!link) return null;

  const title = link.title || link.label;
  const subtitle = link.subtitle;

  return (
    <Link
      to="/book?payment=meridian"
      className={clinicHeroMeridianBtn}
      dir="rtl"
    >
      <span className={clinicHeroMeridianIconRing} aria-hidden="true">
        <ShieldCheck className="h-5 w-5 text-white/95 sm:h-6 sm:w-6 md:h-7 md:w-7" strokeWidth={1.5} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-right sm:gap-1">
        {title && (
          <span className="text-[13px] font-semibold leading-snug text-white sm:text-base">
            {title}
          </span>
        )}
        {subtitle && (
          <span className="text-[11px] font-medium leading-snug text-white/85 sm:text-[13px]">
            {subtitle}
          </span>
        )}
      </span>
    </Link>
  );
}
