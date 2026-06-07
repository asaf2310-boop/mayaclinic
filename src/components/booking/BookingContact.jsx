import { Button } from "@/components/ui/button";
import { ContactChannelIcon } from "@/lib/contactIcons";
import { buildWhatsAppUrl } from "@/lib/customers";
import { getClinicSite } from "@/lib/clinicSite";
import { clinicOutlineBtn, clinicTextMuted } from "@/lib/clinicUi";

export default function BookingContact() {
  const clinicSite = getClinicSite();
  const clinicPhone = clinicSite?.clinicPhone ?? "0549000301";
  const whatsappUrl = buildWhatsAppUrl(clinicPhone);

  return (
    <div className="space-y-3 border-t border-[#E8ECE8] pt-5">
      <p className={`text-center text-sm ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
        צריכים עזרה? צרו קשר
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          asChild
          variant="outline"
          size="lg"
          className={`flex-1 ${clinicSite ? clinicOutlineBtn : "rounded-xl"}`}
        >
          <a
            href={`tel:${clinicPhone}`}
            className="inline-flex flex-col items-center gap-2 py-1"
            aria-label="התקשרות לקליניקה"
          >
            <ContactChannelIcon channel="phone" size="md" decorative />
            <span>התקשרות</span>
          </a>
        </Button>
        {whatsappUrl && (
          <Button
            asChild
            variant="outline"
            size="lg"
            className={`flex-1 ${clinicSite ? clinicOutlineBtn : "rounded-xl"}`}
          >
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-col items-center gap-2 py-1"
              aria-label="שליחת הודעה בוואטסאפ"
            >
              <ContactChannelIcon channel="whatsapp" size="md" decorative />
              <span>וואטסאפ</span>
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
