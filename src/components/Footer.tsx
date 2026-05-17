import { Settings, Mail, Phone, MapPin, Linkedin, Facebook, Twitter, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactForm } from "@/components/ContactForm";
import { useLanguage } from "@/contexts/LanguageContext";

export const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer id="contact" className="bg-navy border-t border-border scroll-mt-20">
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* LEFT COLUMN - Company Info */}
          <div className="space-y-8">
            {/* Logo and Title */}
            <div className="flex items-center gap-3">
  <img
    src="/logo-header.png"   // Header’da hangi dosyayı kullanıyorsan onu yaz
    alt="Dayan Dişli Logo"
    className="h-16 w-auto"
  />
</div>


            {/* Description */}
            <p className="text-muted-foreground leading-relaxed">
              {t.footer.companyDescription}
            </p>

            

            {/* Phone & Email */}
<div className="space-y-4">

  {/* Phone */}
  <div className="flex items-start gap-3">
    <Phone className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-1">
        {t.footer.phone}
      </h3>
      <a
        href="tel:+90212XXXXXXX"
        className="text-muted-foreground text-sm hover:text-primary transition-colors"
      >
        +90 212 *** ** **
      </a>
    </div>
  </div>

  {/* Email */}
  <div className="flex items-start gap-3">
    <Mail className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-1">
        {t.footer.email}
      </h3>
      <a
        href="mailto:info@dayandisli.com"
        className="text-muted-foreground text-sm hover:text-primary transition-colors"
      >
        info@dayandisli.com
      </a>
    </div>
  </div>

</div>


            {/* Address */}
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Adres</h3>
                <p className="text-muted-foreground text-sm">{t.footer.address}</p>
              </div>
            </div>

            {/* Google Maps */}
            <div className="w-full">
              <iframe
                src="https://www.google.com/maps?q=41.092849,28.796529&hl=tr&z=16&output=embed"
                width="100%"
                className="h-[160px] md:h-[220px] rounded-xl border-0"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Dayan Dişli Location"
              />
            </div>

            {/* Social Media */}
            <div className="flex gap-3 hidden">
              <Button variant="outline" size="icon" className="border-border hover:bg-secondary hover:border-primary">
                <Linkedin className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="border-border hover:bg-secondary hover:border-primary">
                <Facebook className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="border-border hover:bg-secondary hover:border-primary">
                <Twitter className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="border-border hover:bg-secondary hover:border-primary">
                <Instagram className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-muted-foreground text-sm text-center">
  © {new Date().getFullYear()} {t.footer.company}. {t.footer.allRightsReserved}
</p>


          </div>

          {/* RIGHT COLUMN - Contact Form */}
          <div id="contact-form" className="scroll-mt-24">
            <h2 className="text-2xl font-bold mb-6 text-foreground">{t.contactForm.heading}</h2>
            <ContactForm />
          </div>
        </div>
      </div>
    </footer>
  );
};
