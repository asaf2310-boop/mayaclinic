import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const statusLabels = { pending_payment: "ממתין לתשלום", active: "פעיל", exhausted: "מומש", cancelled: "מבוטל" };
async function loadGiftVouchers() {
  const response = await fetch("/api/admin?action=list&entity=gift_vouchers&order=-created_at&limit=500", { credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "לא ניתן לטעון את השוברים");
  return data;
}
export default function GiftVoucherManagement() {
  const { data = [], isLoading, error } = useQuery({ queryKey: ["gift-vouchers"], queryFn: loadGiftVouchers });
  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;
  if (error) return <Card className="p-6 text-center text-red-700">{error.message}</Card>;
  return <Card className="overflow-hidden" dir="rtl"><div className="border-b p-5"><h2 className="text-xl font-bold">שוברי מתנה</h2><p className="mt-1 text-sm text-muted-foreground">צפייה ברכישות, סטטוס ויתרת טיפולים</p></div><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-right text-sm"><thead className="bg-muted/50"><tr>{["קוד","מזמין","מטופל","אימייל המזמין","כמות","יתרה","סטטוס","תאריך","סכום"].map(x=><th key={x} className="p-3 font-semibold">{x}</th>)}</tr></thead><tbody>{data.map(v=><tr key={v.id} className="border-t"><td className="p-3 font-mono font-bold" dir="ltr">{v.code}</td><td className="p-3">{v.purchaser_name}<div className="text-xs text-muted-foreground" dir="ltr">{v.purchaser_phone}</div></td><td className="p-3">{v.recipient_name || "—"}<div className="text-xs text-muted-foreground" dir="ltr">{v.recipient_email || ""}</div></td><td className="p-3" dir="ltr">{v.purchaser_email}</td><td className="p-3">{v.treatments_total}</td><td className="p-3 font-bold">{v.treatments_remaining}</td><td className="p-3"><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{statusLabels[v.status] || v.status}</span></td><td className="p-3">{new Date(v.created_at).toLocaleDateString("he-IL")}</td><td className="p-3">₪{Number(v.amount_agorot/100).toLocaleString("he-IL")}</td></tr>)}{!data.length&&<tr><td colSpan="9" className="p-10 text-center text-muted-foreground">עדיין אין שוברים</td></tr>}</tbody></table></div></Card>;
}
