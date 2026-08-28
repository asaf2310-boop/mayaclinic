import React, { useState } from "react";
import { CheckCircle2, Copy, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { clinicGlassPanel, clinicTextHeading, clinicTextMuted, clinicHeroCtaBtn } from "@/lib/clinicUi";

export default function GiftVoucherSuccess({ voucher }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(voucher.code); setCopied(true); };
  const shareUrl = typeof window === "undefined" ? "" : `${window.location.origin}/gift/card?${new URLSearchParams({ code: voucher.code, name: voucher.recipientName || "", greeting: voucher.greeting || "", quantity: String(voucher.treatmentsTotal) })}`;
  const shareWhatsApp = () => {
    const greeting = voucher.greeting ? `\n\n${voucher.greeting}` : "";
    const text = `היי ${voucher.recipientName || ""}, מחכה לך שובר מתנה ל-${voucher.treatmentsTotal} ${voucher.treatmentsTotal === 1 ? "טיפול" : "טיפולים"}.${greeting}\n\nלצפייה בשובר: ${shareUrl}`;
    let phone = String(voucher.recipientPhone || "").replace(/\D/g, "");
    if (phone.startsWith("0")) phone = `972${phone.slice(1)}`;
    const target = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(target, "_blank", "noopener,noreferrer");
  };
  return <section className={`${clinicGlassPanel} p-6 text-center sm:p-10`} dir="rtl">
    <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-[#5D7F6D]" />
    <h1 className={`text-2xl font-bold ${clinicTextHeading}`}>שובר המתנה מוכן</h1>
    <p className={`mt-2 ${clinicTextMuted}`}>שלחנו את פרטי השובר אל {voucher.purchaserEmail}{voucher.sendToRecipient && voucher.recipientEmail ? ` וגם אל ${voucher.recipientEmail}` : ""}</p>
    <div className="my-7 rounded-2xl border border-[#D5E0D8] bg-white/80 p-5">
      <div className="font-mono text-3xl font-black tracking-wider text-[#2F3E35]">{voucher.code}</div>
      <button type="button" onClick={copy} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#5D7F6D]"><Copy className="h-4 w-4" />{copied ? "הועתק" : "העתקת המספר"}</button>
    </div>
    <p className={clinicTextMuted}>{voucher.treatmentsTotal} טיפולים · ₪{voucher.amountIls}</p>
    {voucher.sendToWhatsapp&&<div className="mt-5 rounded-2xl border border-[#25D366]/25 bg-[#F0FFF5] p-4"><p className="mb-3 text-sm font-medium text-[#246B3E]">לשליחת השובר ב־WhatsApp לחץ כאן</p><button type="button" onClick={shareWhatsApp} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3.5 font-bold text-white hover:bg-[#20bd5a]"><MessageCircle className="h-5 w-5"/>פתיחת WhatsApp ושליחת השובר</button></div>}
    <Link to="/book" className={`${clinicHeroCtaBtn} mt-7`}>לקביעת תור</Link>
  </section>;
}
