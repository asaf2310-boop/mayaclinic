import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { CheckCircle2, Circle } from "lucide-react";

const STATUS_MAP = {
  pending: { label: "ממתין", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  confirmed: { label: "מאושר", className: "bg-primary/10 text-primary border-primary/20" },
  cancelled: { label: "בוטל", className: "bg-destructive/10 text-destructive border-destructive/20" },
  completed: { label: "הושלם", className: "bg-green-100 text-green-800 border-green-200" },
};

export default function AppointmentTable({ appointments, onStatusChange, onPaidChange }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="text-right">מטופל</TableHead>
            <TableHead className="text-right">טלפון</TableHead>
            <TableHead className="text-right">טיפול</TableHead>
            <TableHead className="text-right">תאריך</TableHead>
            <TableHead className="text-right">שעה</TableHead>
            <TableHead className="text-right">שילם</TableHead>
            <TableHead className="text-right">סטטוס</TableHead>
            <TableHead className="text-right">הערות</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                אין תורים עדיין
              </TableCell>
            </TableRow>
          ) : (
            appointments.map((apt) => (
              <TableRow key={apt.id} className="hover:bg-muted/20">
                <TableCell className="font-medium">{apt.patient_name}</TableCell>
                <TableCell dir="ltr" className="text-left">{apt.patient_phone}</TableCell>
                <TableCell>{apt.treatment_name}</TableCell>
                <TableCell>{apt.date ? format(new Date(apt.date), "dd/MM/yyyy") : "-"}</TableCell>
                <TableCell>{apt.time}</TableCell>
                <TableCell>
                  <button
                    onClick={() => onPaidChange(apt.id, !apt.paid)}
                    className="flex items-center gap-1.5 text-sm font-medium transition-colors"
                  >
                    {apt.paid
                      ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                      : <Circle className="w-5 h-5 text-muted-foreground/40" />
                    }
                    <span className={apt.paid ? "text-green-600" : "text-muted-foreground"}>
                      {apt.paid ? "שילם" : "לא שילם"}
                    </span>
                  </button>
                </TableCell>
                <TableCell>
                  <Select
                    value={apt.status || "pending"}
                    onValueChange={(val) => onStatusChange(apt.id, val)}
                  >
                    <SelectTrigger className="w-28 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_MAP).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                  {apt.notes || "-"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}