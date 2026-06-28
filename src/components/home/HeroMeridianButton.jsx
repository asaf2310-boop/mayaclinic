import React from "react";
import { ShieldCheck } from "lucide-react";
import { clinicHeroMeridianBtn, clinicHeroMeridianIconRing } from "@/lib/clinicUi";

export default function HeroMeridianButton({ link }) {
  if (!link?.url) return null;

  const title = link.title || link.label;
  const subtitle = link.subtitle;

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={clinicHeroMeridianBtn}
      dir="rtl"
    >
      <span className={clinicHeroMeridianIconRing} aria-hidden="true">
        <ShieldCheck className="h-6 w-6 text-white/95 md:h-7 md:w-7" strokeWidth={1.5} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center sm:items-start sm:gap-1 sm:text-right">
        {title && (
          <span className="text-sm font-semibold leading-snug text-white sm:text-base">
            {title}
          </span>
        )}
        {subtitle && (
          <span className="text-[11px] font-medium leading-snug text-white/85 sm:text-[13px]">
            {subtitle}
          </span>
        )}
      </span>
    </a>
  );
}
