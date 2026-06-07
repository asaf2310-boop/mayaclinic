import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { CalendarPlus } from "lucide-react";
import { ContactChannelIcon } from "@/lib/contactIcons";

export default function HeroSection() {
  return (
    <section dir="rtl" className="bg-[#f7f3ee] flex flex-col items-center pt-6 pb-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-xl relative"
      >
        <img
          src="https://media.base44.com/images/public/69ff3dea5e105013fde56ce0/7b5b000ca_540deb67-55c0-480f-8866-aa82c12e3a62.jpg"
          alt="מאיה - מטפלת"
          className="w-full h-auto object-cover"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-8 bg-gradient-to-t from-black/40 to-transparent">
          <p className="text-2xl font-bold text-white text-center">קביעת תור בפתח תקווה</p>
          <p className="text-lg font-semibold text-white mt-1" dir="ltr">
            מאיה — 054-9000301
          </p>
        </div>
      </motion.div>

      {/* CTA Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="w-full max-w-lg mt-6"
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <Link to="/book" className="flex-1">
            <Button className="w-full gap-2 rounded-xl text-base h-12 bg-[#1a3a5c] hover:bg-[#1a3a5c]/90">
              <CalendarPlus className="w-5 h-5" />
              קביעת תור
            </Button>
          </Link>
          <a href="tel:0549000301" className="flex-1" aria-label="התקשרי עכשיו לקליניקה">
            <Button
              variant="outline"
              className="w-full gap-3 rounded-xl text-base h-12 border-[#2eb88a] text-[#2eb88a] hover:bg-[#2eb88a]/10"
            >
              <ContactChannelIcon channel="phone" size="sm" decorative />
              התקשרי עכשיו
            </Button>
          </a>
        </div>
      </motion.div>
    </section>
  );
}