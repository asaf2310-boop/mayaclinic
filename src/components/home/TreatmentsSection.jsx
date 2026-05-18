import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import TreatmentCard from "./TreatmentCard";
import { Skeleton } from "@/components/ui/skeleton";

export default function TreatmentsSection() {
  const { data: treatments = [], isLoading } = useQuery({
    queryKey: ["treatments"],
    queryFn: () => base44.entities.Treatment.list(),
  });

  if (isLoading) {
    return (
      <section className="py-20 px-6" dir="rtl">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (treatments.length === 0) return null;

  return (
    <section className="py-20 px-6 bg-muted/30" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">הטיפולים שלנו</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            מגוון טיפולים מקצועיים המותאמים אישית לצרכים שלכם
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {treatments.map((treatment, index) => (
            <TreatmentCard key={treatment.id} treatment={treatment} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}