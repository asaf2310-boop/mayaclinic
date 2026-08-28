import React from "react";
import { Gift, Heart, Leaf, Sparkles } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import { clinicGlassPanel, clinicHeroCtaBtn, clinicPageGradient, clinicTextHeading, clinicTextMuted } from "@/lib/clinicUi";

export default function GiftVoucherCard() {
  const [params] = useSearchParams();
  const code = String(params.get("code") || "").toUpperCase();
  const name = String(params.get("name") || "");
  const greeting = String(params.get("greeting") || "");
  const quantity = Math.max(1, Math.min(10, Number(params.get("quantity")) || 1));
  return <div className={`min-h-screen page-background ${clinicPageGradient} !bg-[#EFE7DA] bg-[radial-gradient(circle_at_top_right,rgba(255,250,240,0.78),transparent_42%),linear-gradient(145deg,#F3EDE3_0%,#EAE0D2_52%,#F1E9DE_100%)]`}><Navbar/><main className="mx-auto max-w-xl px-4 pb-16 pt-24" dir="rtl"><section className={`${clinicGlassPanel} relative overflow-hidden border border-[#E1D5C5] !bg-[#F8F1E7]/95 p-2 shadow-[0_24px_70px_rgba(86,68,48,0.18)]`}>
    <div className="relative overflow-hidden rounded-[24px] border border-[#D7E4DB] bg-gradient-to-br from-[#FBFDFB] via-[#F0F6F2] to-[#E5EFE8] px-6 py-9 text-center sm:px-10 sm:py-12">
      <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-[#A8C4B4]/25 blur-2xl"/><div className="pointer-events-none absolute -bottom-14 -right-10 h-44 w-44 rounded-full bg-[#D7BFAE]/20 blur-2xl"/>
      <Sparkles className="absolute left-7 top-7 h-6 w-6 text-[#B28D6C]/60"/><Leaf className="absolute bottom-8 right-7 h-8 w-8 rotate-12 text-[#7F9B8A]/50"/>
      <div className="relative"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#C8D9CE] bg-white/80 shadow-[0_10px_30px_rgba(93,127,109,0.15)]"><Gift className="h-10 w-10 text-[#5D7F6D]"/></div><p className={`mt-5 text-xs font-bold tracking-[0.28em] ${clinicTextMuted}`}>GIFT VOUCHER</p><h1 className={`mt-3 text-3xl font-black leading-tight sm:text-4xl ${clinicTextHeading}`}>{name ? `מתנה ל${name}` : "מתנה במיוחד בשבילך"}</h1>
      <div className="mx-auto my-5 flex items-center justify-center gap-2 text-[#B28D6C]"><span className="h-px w-12 bg-[#B28D6C]/40"/><Heart className="h-4 w-4 fill-[#B28D6C]/20"/><span className="h-px w-12 bg-[#B28D6C]/40"/></div>
      {greeting&&<p className="mx-auto my-6 max-w-md whitespace-pre-line rounded-2xl border border-white/70 bg-white/55 p-5 text-lg leading-8 text-[#34473B] shadow-sm">{greeting}</p>}
      <div className="my-7 rounded-2xl border border-[#C8D9CE] bg-white/75 p-5 shadow-[inset_0_1px_0_white]"><p className={`mb-2 text-xs font-semibold tracking-wide ${clinicTextMuted}`}>מספר השובר</p><div className="font-mono text-3xl font-black tracking-[0.12em] text-[#2F3E35]" dir="ltr">{code}</div><div className="mx-auto mt-4 w-fit rounded-full bg-[#5D7F6D] px-4 py-1.5 text-sm font-bold text-white">{quantity} {quantity === 1 ? "טיפול" : "טיפולים"}</div></div>
      <p className={`mx-auto mb-7 max-w-sm text-sm leading-6 ${clinicTextMuted}`}>לקביעת תור בוחרים טיפול ומועד, ובעמוד התשלום מזינים את מספר השובר.</p><Link to="/book" className={clinicHeroCtaBtn}>לקביעת תור</Link></div>
    </div>
  </section></main></div>;
}
