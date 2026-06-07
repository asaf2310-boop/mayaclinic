export const WHATSAPP_LOGO = "/icons/whatsapp-logo.svg";
export const PHONE_LOGO = "/icons/phone-logo.svg";

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

export function ContactChannelIcon({ channel, size = "md", className = "", decorative = false }) {
  const src = channel === "whatsapp" ? WHATSAPP_LOGO : PHONE_LOGO;
  const label = channel === "whatsapp" ? "וואטסאפ" : "טלפון";

  return (
    <img
      src={src}
      alt={decorative ? "" : label}
      aria-hidden={decorative || undefined}
      className={`block shrink-0 object-contain ${sizeClasses[size]} ${className}`}
      width={size === "lg" ? 48 : size === "md" ? 40 : 32}
      height={size === "lg" ? 48 : size === "md" ? 40 : 32}
      draggable={false}
    />
  );
}
