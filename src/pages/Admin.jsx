import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import Navbar from "../components/layout/Navbar";
import AppointmentTable from "../components/admin/AppointmentTable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import AvailabilityManager from "../components/admin/AvailabilityManager";
import { Card } from "@/components/ui/card";
import { CalendarDays, Clock, CheckCircle2, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Admin() {
  const [statusFilter, setStatusFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: () => base44.entities.Appointment.list("date"),
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 px-6" dir="rtl">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8">ניהול</h1>

          <Tabs defaultValue="appointments">
            <TabsList className="mb-6">
              <TabsTrigger value="appointments">תורים</TabsTrigger>
              <TabsTrigger value="availability">זמינות</TabsTrigger>
            </TabsList>

            <TabsContent value="appointments">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {statCards.map((s) => (
                  <Card key={s.label} className="p-5">
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
                <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                  <TabsList>
                    <TabsTrigger value="all">הכל</TabsTrigger>
                    <TabsTrigger value="pending">ממתינים</TabsTrigger>
                    <TabsTrigger value="confirmed">מאושרים</TabsTrigger>
                    <TabsTrigger value="completed">הושלמו</TabsTrigger>
                    <TabsTrigger value="cancelled">בוטלו</TabsTrigger>
                  </TabsList>
                </Tabs>
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
          </Tabs>
        </div>
      </main>
    </div>
  );
}