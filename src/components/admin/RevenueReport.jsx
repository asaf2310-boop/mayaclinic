import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Receipt, TrendingUp, CalendarDays } from "lucide-react";

const ALL_TREATMENTS = "__all__";

const currency = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

const monthFormatter = new Intl.DateTimeFormat("he-IL", {
  month: "long",
  year: "numeric",
});

const getMonthKey = (date) => String(date || "").slice(0, 7);

const getMonthLabel = (monthKey) => {
  if (!monthKey) return "-";
  return monthFormatter.format(new Date(`${monthKey}-01T00:00:00`));
};

const getAppointmentPrice = (appointment, treatmentPriceByName) => {
  const storedPrice = Number(appointment.treatment_price);
  if (Number.isFinite(storedPrice) && storedPrice > 0) return storedPrice;

  const fallbackPrice = Number(treatmentPriceByName.get(appointment.treatment_name));
  return Number.isFinite(fallbackPrice) ? fallbackPrice : 0;
};

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

function exportRowsToExcel(rows, summary) {
  const htmlRows = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.monthLabel)}</td>
      <td>${escapeHtml(row.treatmentName)}</td>
      <td>${row.appointmentsCount}</td>
      <td>${row.paidAppointmentsCount}</td>
      <td>${currency.format(row.revenue)}</td>
    </tr>
  `).join("");

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
      </head>
      <body dir="rtl">
        <h2>דוח הכנסות</h2>
        <p>סה"כ הכנסות: ${currency.format(summary.totalRevenue)}</p>
        <p>תורים ששולמו: ${summary.totalPaidAppointments}</p>
        <table border="1">
          <thead>
            <tr>
              <th>חודש</th>
              <th>טיפול</th>
              <th>סה"כ תורים</th>
              <th>תורים ששולמו</th>
              <th>הכנסות</th>
            </tr>
          </thead>
          <tbody>${htmlRows}</tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `revenue-report-${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function RevenueReport({ appointments, treatments }) {
  const [treatmentFilter, setTreatmentFilter] = useState(ALL_TREATMENTS);

  const treatmentPriceByName = useMemo(() => {
    return new Map(treatments.map((treatment) => [treatment.name, treatment.price]));
  }, [treatments]);

  const treatmentOptions = useMemo(() => {
    const names = new Set([
      ...treatments.map((treatment) => treatment.name).filter(Boolean),
      ...appointments.map((appointment) => appointment.treatment_name).filter(Boolean),
    ]);
    return Array.from(names).sort((a, b) => a.localeCompare(b, "he"));
  }, [appointments, treatments]);

  const reportRows = useMemo(() => {
    const grouped = new Map();

    appointments
      .filter((appointment) => appointment.date && appointment.status !== "cancelled")
      .filter((appointment) => treatmentFilter === ALL_TREATMENTS || appointment.treatment_name === treatmentFilter)
      .forEach((appointment) => {
        const monthKey = getMonthKey(appointment.date);
        const treatmentName = appointment.treatment_name || "ללא טיפול";
        const groupKey = `${monthKey}__${treatmentName}`;
        const current = grouped.get(groupKey) || {
          monthKey,
          monthLabel: getMonthLabel(monthKey),
          treatmentName,
          appointmentsCount: 0,
          paidAppointmentsCount: 0,
          revenue: 0,
        };

        current.appointmentsCount += 1;

        if (appointment.paid) {
          current.paidAppointmentsCount += 1;
          current.revenue += getAppointmentPrice(appointment, treatmentPriceByName);
        }

        grouped.set(groupKey, current);
      });

    return Array.from(grouped.values()).sort((a, b) => {
      const monthCompare = b.monthKey.localeCompare(a.monthKey);
      if (monthCompare !== 0) return monthCompare;
      return a.treatmentName.localeCompare(b.treatmentName, "he");
    });
  }, [appointments, treatmentFilter, treatmentPriceByName]);

  const summary = useMemo(() => {
    return reportRows.reduce((acc, row) => ({
      totalRevenue: acc.totalRevenue + row.revenue,
      totalAppointments: acc.totalAppointments + row.appointmentsCount,
      totalPaidAppointments: acc.totalPaidAppointments + row.paidAppointmentsCount,
    }), {
      totalRevenue: 0,
      totalAppointments: 0,
      totalPaidAppointments: 0,
    });
  }, [reportRows]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">דוח הכנסות</h2>
          <p className="text-sm text-muted-foreground">חישוב לפי תורים שסומנו כשולמו בלבד.</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={treatmentFilter} onValueChange={setTreatmentFilter}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="סינון לפי טיפול" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TREATMENTS}>כל הטיפולים</SelectItem>
              {treatmentOptions.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            onClick={() => exportRowsToExcel(reportRows, summary)}
            disabled={reportRows.length === 0}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            יצוא לאקסל
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">סה"כ הכנסות</p>
              <p className="text-2xl font-bold">{currency.format(summary.totalRevenue)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <Receipt className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">תורים ששולמו</p>
              <p className="text-2xl font-bold">{summary.totalPaidAppointments}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-5 h-5 text-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">סה"כ תורים בדוח</p>
              <p className="text-2xl font-bold">{summary.totalAppointments}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card">
        {reportRows.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">אין נתונים להצגה</div>
        ) : (
          <div className="divide-y divide-border/60" role="table" aria-label="דוח הכנסות חודשי לפי טיפול">
            <div className="hidden bg-muted/40 p-4 text-sm font-semibold text-muted-foreground md:grid md:grid-cols-5">
              <div>חודש</div>
              <div>טיפול</div>
              <div>סה"כ תורים</div>
              <div>תורים ששולמו</div>
              <div>הכנסות</div>
            </div>
            {reportRows.map((row) => (
              <div key={`${row.monthKey}-${row.treatmentName}`} className="grid gap-3 p-5 md:grid-cols-5 md:items-center">
                <div>
                  <p className="text-xs text-muted-foreground md:hidden">חודש</p>
                  <p className="font-semibold">{row.monthLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground md:hidden">טיפול</p>
                  <p className="font-semibold">{row.treatmentName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground md:hidden">סה"כ תורים</p>
                  <p className="font-semibold">{row.appointmentsCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground md:hidden">תורים ששולמו</p>
                  <p className="font-semibold">{row.paidAppointmentsCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground md:hidden">הכנסות</p>
                  <p className="text-lg font-bold text-green-700">{currency.format(row.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
