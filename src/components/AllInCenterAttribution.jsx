import React from "react";
import { ExternalLink } from "lucide-react";

const ALLINCENTER_URL = "https://www.allincenter.co.il/appointment-management";

/**
 * Subtle clinic-site attribution: Hebrew copy + crawlable AllInCenter link.
 */
export default function AllInCenterAttribution({ className = "" }) {
  return (
    <p
      className={`mx-auto max-w-full px-4 text-center text-[13px] leading-relaxed sm:text-sm ${className}`.trim()}
      dir="rtl"
    >
      <span className="text-[var(--ofir-6b746f,#6B746F)]">
        מערכת ניהול התורים פותחה על ידי{" "}
      </span>
      <a
        href={ALLINCENTER_URL}
        className="inline-flex items-center gap-1 align-baseline font-medium text-[var(--ofir-4f6f5f,#4F6F5F)] underline-offset-2 transition-colors hover:text-[var(--ofir-5d7f6d,#5D7F6D)] hover:underline"
        dir="ltr"
      >
        <span>AllInCenter</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
        <span className="sr-only">(קישור חיצוני)</span>
      </a>
    </p>
  );
}
