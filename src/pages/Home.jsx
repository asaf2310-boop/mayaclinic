import React from "react";
import Navbar from "../components/layout/Navbar";
import HeroSection from "../components/home/HeroSection";
import TreatmentsSection from "../components/home/TreatmentsSection";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-16">
        <HeroSection />
        <TreatmentsSection />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10 px-6 text-center" dir="rtl">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} הקליניקה. כל הזכויות שמורות.
        </p>
      </footer>
    </div>
  );
}