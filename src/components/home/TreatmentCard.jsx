import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Banknote } from "lucide-react";
import { motion } from "framer-motion";

export default function TreatmentCard({ treatment, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Card className="group relative overflow-hidden p-6 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 border-border/60 hover:border-primary/20 bg-card">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-l from-primary/60 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <div className="flex flex-col gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-2xl">
            {treatment.icon || "✦"}
          </div>
          
          <div>
            <h3 className="text-xl font-bold text-foreground mb-2">{treatment.name}</h3>
            {treatment.description && (
              <p className="text-muted-foreground text-sm leading-relaxed">{treatment.description}</p>
            )}
          </div>

          <div className="flex items-center gap-4 mt-2">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 font-normal">
              <Clock className="w-3.5 h-3.5" />
              {treatment.duration_minutes} דקות
            </Badge>
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 font-normal">
              <Banknote className="w-3.5 h-3.5" />
              ₪{treatment.price}
            </Badge>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}