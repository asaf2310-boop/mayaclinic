import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Gift, Loader2, Lock, Minus, Plus } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { getClinicSite } from "@/lib/clinicSite";
import { getClinicTenantId } from "@/lib/tenant";
import { fetchPelecardStatus, initGiftVoucherSession, isPelecardReturnMessage } from "@/lib/pelecard";
import { GIFT_VOUCHER_UNIT_ILS } from "@/lib/giftVoucher";
import { clinicGlassPanel, clinicPageGradient, clinicTextHeading, clinicTextMuted } from "@/lib/clinicUi";

export default function GiftVoucher() {
  const clinic = getClinicSite(); const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1); const [form, setForm] = useState({ name: "", phone: "", email: "", recipientName: "", recipientEmail: "", recipientPhone: "", sendToRecipient: false, sendToWhatsapp: false, greeting: "" });
  const [configured, setConfigured] = useState(null); const [loading, setLoading] = useState(false); const [url, setUrl] = useState(""); const [error, setError] = useState("");
  useEffect(() => { fetchPelecardStatus().then((x) => setConfigured(Boolean(x.configured))); }, []);
  useEffect(() => { const fn = (event) => { if (!isPelecardReturnMessage(event)) return; const d=event.data; const token=d.sessionToken?`&token=${encodeURIComponent(d.sessionToken)}`:""; navigate(d.ok?`/payment/success?ref=${encodeURIComponent(d.bookingRef||"")}${token}`:`/payment/failure?ref=${encodeURIComponent(d.bookingRef||"")}${token}`); }; window.addEventListener("message",fn); return()=>window.removeEventListener("message",fn); }, [navigate]);
  async function submit(event) { event.preventDefault(); setError(""); if (!form.name.trim() || !form.phone.trim() || !form.recipientName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) || (form.sendToRecipient && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.recipientEmail)) || (form.sendToWhatsapp && form.recipientPhone.replace(/\D/g, "").length < 9)) { setError("נא למלא את כל שדות החובה ולוודא שפרטי הקשר תקינים"); return; } setLoading(true); try { const s=await initGiftVoucherSession({ quantity, purchaser_name:form.name, purchaser_phone:form.phone, purchaser_email:form.email, recipient_name:form.recipientName, recipient_email:form.recipientEmail, recipient_phone:form.recipientPhone, send_to_recipient:form.sendToRecipient, send_to_whatsapp:form.sendToWhatsapp, greeting:form.greeting, tenant_id:getClinicTenantId()||clinic?.id||"maya" }); setUrl(s.url); } catch(e) { setError(e.message); } finally { setLoading(false); } }
  return <div className={`min-h-screen page-background ${clinicPageGradient} !bg-[#EFE7DA] bg-[radial-gradient(circle_at_top_right,rgba(255,250,240,0.78),transparent_42%),linear-gradient(145deg,#F3EDE3_0%,#EAE0D2_52%,#F1E9DE_100%)]`}><Navbar/><main className="mx-auto max-w-2xl px-4 pb-16 pt-24" dir="rtl">
    {!url && <form onSubmit={submit} className={`${clinicGlassPanel} !bg-[#F8F1E7]/95 p-5 shadow-[0_18px_50px_rgba(100,80,58,0.13)] sm:p-9`}>
      <Link to="/" className={`mb-5 inline-flex items-center gap-2 text-sm ${clinicTextMuted}`}><ArrowRight className="h-4 w-4"/>חזרה</Link>
      <Gift className="mx-auto h-12 w-12 text-[#5D7F6D]"/><h1 className={`mt-3 text-center text-3xl font-bold ${clinicTextHeading}`}>שובר מתנה לטיפולים</h1>
      <p className={`mt-2 text-center ${clinicTextMuted}`}>מתנה של זמן, רוגע וטיפול — ₪250 לטיפול</p>
      <div className="my-7 flex items-center justify-center gap-5"><button type="button" aria-label="הפחתה" onClick={()=>setQuantity(q=>Math.max(1,q-1))} disabled={quantity===1} className="rounded-full border p-3"><Minus/></button><div className="min-w-20 text-center"><strong className="text-4xl">{quantity}</strong><div className={clinicTextMuted}>טיפולים</div></div><button type="button" aria-label="הוספה" onClick={()=>setQuantity(q=>Math.min(10,q+1))} disabled={quantity===10} className="rounded-full border p-3"><Plus/></button></div>
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-[#D9C6A9] bg-gradient-to-br from-[#F4E6CF] via-[#EEDCC0] to-[#E7D1AE] px-5 py-4 shadow-[0_10px_28px_rgba(139,106,65,0.16)]">
        <div className="pointer-events-none absolute -left-8 -top-10 h-24 w-24 rounded-full bg-white/35 blur-2xl" />
        <div className="relative flex items-center justify-between gap-4">
          <span className="text-sm font-semibold text-[#755F45]">סה״כ לתשלום</span>
          <span className="text-2xl font-black tabular-nums text-[#4D3D2C]">₪{quantity*GIFT_VOUCHER_UNIT_ILS}</span>
        </div>
      </div>
      <div className="space-y-3">{[["name","שם המזמין","text"],["phone","טלפון המזמין","tel"],["email","אימייל המזמין","email"],["recipientName","שם המטופל","text"]].map(([key,label,type])=><label key={key} className="block"><span className="mb-1 block text-sm font-medium">{label} <span className="text-[#A85745]" aria-hidden="true">*</span><span className="sr-only">שדה חובה</span></span><input required type={type} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} className="w-full rounded-xl border border-[#D5E0D8] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#5D7F6D]/30"/></label>)}
        <div className="pt-2"><h2 className={`text-lg font-bold ${clinicTextHeading}`}>איך תרצו להעביר את השובר למטופל?</h2><p className={`mt-1 text-sm ${clinicTextMuted}`}>אפשר לבחור אפשרות אחת או את שתיהן</p></div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#D5E0D8] bg-white/70 p-4"><input type="checkbox" checked={form.sendToRecipient} onChange={e=>setForm({...form,sendToRecipient:e.target.checked})} className="mt-1 h-4 w-4 accent-[#5D7F6D]"/><span><strong className="block">לשלוח את השובר למטופל במייל</strong><small className={clinicTextMuted}>לאחר אישור התשלום המטופל יקבל את הקוד, הברכה ופרטי המימוש</small></span></label>
        {form.sendToRecipient&&<label className="block"><span className="mb-1 block text-sm font-medium">אימייל המטופל</span><input required type="email" value={form.recipientEmail} onChange={e=>setForm({...form,recipientEmail:e.target.value})} className="w-full rounded-xl border border-[#D5E0D8] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#5D7F6D]/30"/></label>}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#D5E0D8] bg-white/70 p-4"><input type="checkbox" checked={form.sendToWhatsapp} onChange={e=>setForm({...form,sendToWhatsapp:e.target.checked})} className="mt-1 h-4 w-4 accent-[#25D366]"/><span><strong className="block">להכין שליחה למטופל ב־WhatsApp</strong><small className={clinicTextMuted}>לאחר התשלום ייפתח כפתור לשליחת קישור השובר והברכה</small></span></label>
        {form.sendToWhatsapp&&<label className="block"><span className="mb-1 block text-sm font-medium">טלפון המטופל ל־WhatsApp</span><input required type="tel" inputMode="tel" value={form.recipientPhone} onChange={e=>setForm({...form,recipientPhone:e.target.value})} placeholder="050-0000000" className="w-full rounded-xl border border-[#D5E0D8] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#5D7F6D]/30"/></label>}
        <label className="block"><span className="mb-1 block text-sm font-medium">ברכה למטופל <span className={clinicTextMuted}>(לא חובה)</span></span><textarea value={form.greeting} onChange={e=>setForm({...form,greeting:e.target.value.slice(0,500)})} rows="4" placeholder="כתבו כאן ברכה אישית שתצורף לשובר" className="w-full resize-none rounded-xl border border-[#D5E0D8] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#5D7F6D]/30"/><span className={`mt-1 block text-left text-xs ${clinicTextMuted}`}>{form.greeting.length}/500</span></label>
      </div>
      {error&&<p className="mt-4 text-center text-sm text-red-700">{error}</p>}<button disabled={loading||configured!==true} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#5D7F6D] px-5 py-4 font-bold text-white disabled:opacity-50">{loading?<Loader2 className="animate-spin"/>:<Lock className="h-5 w-5"/>}לתשלום מאובטח</button>
    </form>}
    {url&&<div className="overflow-hidden rounded-2xl bg-white shadow-xl"><iframe title="תשלום מאובטח" src={url} className="h-[min(920px,calc(100dvh-8rem))] min-h-[640px] w-full" /></div>}
  </main></div>;
}
