import { Button } from "@/components/ui/button";
import { ContactChannelIcon } from "@/lib/contactIcons";
import { buildWhatsAppUrl } from "@/lib/customers";
import { getClinicSite } from "@/lib/clinicSite";
import { clinicContactBtn, clinicTextMuted } from "@/lib/clinicUi";

const defaultContactBtn =
  "flex h-auto min-h-[96px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-input bg-transparent px-4 py-3 text-center text-sm font-medium leading-none shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground";

export default function BookingContact() {
  const clinicSite = getClinicSite();
  const clinicPhone = clinicSite?.clinicPhone ?? "0549000301";
  const whatsappUrl = buildWhatsAppUrl(clinicPhone);

  return (
    <div className="space-y-3 border-t border-[#E8ECE8] pt-5">
      <p className={`text-center text-sm ${clinicSite ? clinicTextMuted : "text-muted-foreground"}`}>
        צריכים עזרה? צרו קשר
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <Button
          asChild
          variant="outline"
          className={clinicSite ? clinicContactBtn : defaultContactBtn}
        >
          <a href={`tel:${clinicPhone}`} aria-label="התקשרות לקליניקה">
            <ContactChannelIcon channel="phone" size="md" decorative />
            <span>התקשרות</span>
          </a>
        </Button>
        {whatsappUrl && (
          <Button
            asChild
            variant="outline"
            className={clinicSite ? clinicContactBtn : defaultContactBtn}
          >
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
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
