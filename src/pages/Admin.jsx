import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import Navbar from "../components/layout/Navbar";
import AppointmentTable from "../components/admin/AppointmentTable";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import AvailabilityManager from "../components/admin/AvailabilityManager";
import RevenueReport from "../components/admin/RevenueReport";
import CustomerManagement from "../components/admin/CustomerManagement";
import { Card } from "@/components/ui/card";
import { BarChart3, CalendarCheck, CalendarDays, CheckCircle2, Clock, Settings2, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getClinicSite } from "@/lib/clinicSite";

export default function Admin() {
  const clinicSite = getClinicSite();
  const [activeAdminTab, setActiveAdminTab] = useState("appointments");
  const [statusFilter, setStatusFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: () => base44.entities.Appointment.list("date"),
  });

  const { data: treatments = [] } = useQuery({
    queryKey: ["treatments"],
    queryFn: () => base44.entities.Treatment.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Appointment.update(id, data),
    onSuccess: (updatedAppointment) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      if (updatedAppointment?.date) {
        queryClient.invalidateQueries({ queryKey: ["appointments-for-date", updatedAppointment.date] });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Appointment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-for-date"] });
    },
  });

  const filteredAppointments = (statusFilter === "all"
    ? appointments
    : appointments.filter((a) => a.status === statusFilter)
  ).sort((a, b) => {
    const dateCompare = (a.date || "").localeCompare(b.date || "");
    if (dateCompare !== 0) return dateCompare;
    return (a.time || "").localeCompare(b.time || "");
  });

  const stats = {
    total: appointments.length,
    pending: appointments.filter((a) => a.status === "pending").length,
    confirmed: appointments.filter((a) => a.status === "confirmed").length,
    completed: appointments.filter((a) => a.status === "completed").length,
  };

  const statCards = [
    { label: "סה״כ תורים", value: stats.total, icon: CalendarDays, color: "text-foreground" },
    { label: "ממתינים", value: stats.pending, icon: Clock, color: "text-yellow-600" },
    { label: "מאושרים", value: stats.confirmed, icon: Users, color: "text-primary" },
    { label: "הושלמו", value: stats.completed, icon: CheckCircle2, color: "text-green-600" },
  ];

  const adminTabs = [
    { value: "appointments", label: "תורים", icon: CalendarCheck },
    { value: "availability", label: "זמינות", icon: Settings2 },
    { value: "customers", label: "לקוחות", icon: Users },
    { value: "revenue", label: "דוח הכנסות", icon: BarChart3 },
  ];

  const statusTabs = [
    { value: "all", label: "הכל" },
    { value: "pending", label: "ממתינים" },
    { value: "confirmed", label: "מאושרים" },
    { value: "completed", label: "הושלמו" },
    { value: "cancelled", label: "בוטלו" },
  ];

  return (
    <div
      className={`min-h-screen ${
        clinicSite ? "bg-gradient-to-tr from-[#f3f7f4] via-[#edf3ee] to-[#e6ece7]" : "bg-background"
      }`}
    >
      <Navbar />
      <main className="relative pt-24 pb-16 px-6" dir="rtl">
        {clinicSite && (
          <>
            <div className="pointer-events-none absolute left-0 top-24 h-[280px] w-[280px] rounded-full bg-[#e1eae2] blur-[130px]" />
            <div className="pointer-events-none absolute right-0 top-40 h-[320px] w-[320px] rounded-full bg-[#d7e4dc] blur-[140px]" />
          </>
        )}
        <div className="relative max-w-6xl mx-auto">
          <h1 className={`text-3xl font-bold mb-8 ${clinicSite ? "text-[#1a2e28]" : "text-foreground"}`}>
            ניהול
          </h1>

          <Tabs value={activeAdminTab} onValueChange={setActiveAdminTab} dir="rtl">
            <div
              className={`mb-8 grid w-full grid-cols-1 gap-3 rounded-2xl border p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-4 ${
                clinicSite
                  ? "border-white/70 bg-white/75 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
                  : "border-border/60 bg-card"
              }`}
              role="tablist"
              aria-label="ניווט אדמין"
            >
              {adminTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={activeAdminTab === tab.value}
                  onClick={() => setActiveAdminTab(tab.value)}
                  className={`flex h-16 w-full items-center justify-center gap-2 rounded-xl border px-4 text-base font-semibold transition-all duration-300 ${
                    activeAdminTab === tab.value
                      ? clinicSite
                        ? "border-transparent bg-gradient-to-r from-[#416d5c] to-[#2f5245] text-white shadow-[0_10px_25px_rgba(65,109,92,0.2)]"
                        : "border-primary/30 bg-primary text-primary-foreground shadow-md"
                      : clinicSite
                        ? "border-transparent bg-white/40 text-[#1a2e28] hover:bg-white/60"
                        : "border-transparent bg-muted/40 text-foreground hover:border-primary/20 hover:bg-muted"
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            <TabsContent value="appointments">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {statCards.map((s) => (
                  <Card
                    key={s.label}
                    className={`p-5 ${clinicSite ? "border-white/70 bg-white/75 shadow-[0_4px_12px_rgba(0,0,0,0.02)] backdrop-blur-xl" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                        <s.icon className={`w-5 h-5 ${s.color}`} />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{s.value}</p>
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="mb-6">
                <div className="flex w-full flex-wrap justify-end gap-2 rounded-xl bg-muted/50 p-2 sm:w-fit" role="tablist" aria-label="סינון סטטוס תורים">
                  {statusTabs.map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setStatusFilter(tab.value)}
                      className={`min-w-24 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        statusFilter === tab.value
                          ? "bg-background text-foreground shadow"
                          : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {isLoading ? (
                <Skeleton className="h-64 rounded-xl" />
              ) : (
                <AppointmentTable
                  appointments={filteredAppointments}
                  onStatusChange={(id, status) => updateMutation.mutate({ id, data: { status } })}
                  onPaidChange={(id, paid) => updateMutation.mutate({ id, data: { paid } })}
                  onUpdate={(id, data) => updateMutation.mutate({ id, data })}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  isMutating={updateMutation.isPending || deleteMutation.isPending}
                />
              )}
            </TabsContent>

            <TabsContent value="availability">
              <div className="max-w-2xl">
                <p className="text-muted-foreground mb-6">בחרי את הימים והשעות שבהם את זמינה לטיפולים. המטופלים יראו רק שעות פנויות.</p>
                <AvailabilityManager />
              </div>
            </TabsContent>

            <TabsContent value="customers">
              {isLoading ? (
                <Skeleton className="h-64 rounded-xl" />
              ) : (
                <CustomerManagement appointments={appointments} />
              )}
            </TabsContent>

            <TabsContent value="revenue">
              {isLoading ? (
                <Skeleton className="h-64 rounded-xl" />
              ) : (
                <RevenueReport appointments={appointments} treatments={treatments} />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}