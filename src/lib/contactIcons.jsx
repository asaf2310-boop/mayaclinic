import { Phone } from "lucide-react";

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

const pixelSize = {
  sm: 32,
  md: 40,
  lg: 48,
};

function WhatsAppMark({ className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} {...props}>
      <path
        fill="currentColor"
        d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.45 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01m-7.01 15.24h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c.02 4.54-3.68 8.23-8.24 8.23m4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42h-.48c-.17 0-.43.06-.66.31-.22.25-.87.85-.87 2.07s.89 2.4 1.01 2.56c.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.07-.1-.22-.16-.47-.28"
      />
    </svg>
  );
}

export function ContactChannelIcon({ channel, size = "md", className = "", decorative = false }) {
  const label = channel === "whatsapp" ? "וואטסאפ" : "טלפון";
  const box = pixelSize[size] || pixelSize.md;
  const isWhatsApp = channel === "whatsapp";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl ${
        isWhatsApp ? "bg-[#25D366] text-white" : "bg-[#5D7F6D] text-white"
      } ${sizeClasses[size]} ${className}`}
      style={{ width: box, height: box }}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label}
      role={decorative ? undefined : "img"}
    >
      {isWhatsApp ? (
        <WhatsAppMark className="!h-[62%] !w-[62%] !max-h-none !max-w-none !size-[62%]" />
      ) : (
        <Phone className="!h-[58%] !w-[58%] !max-h-none !max-w-none !size-[58%]" strokeWidth={2.2} />
      )}
    </span>
  );
}
