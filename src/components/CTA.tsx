import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Clock, PackageCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export const CTA = () => {
  const { t } = useLanguage();

  const scrollToContact = () => {
    const element = document.getElementById("contact-form");
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  return (
    <section className="py-24 bg-navy-light">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            {t.cta.heading}
          </h2>
          <p className="text-xl text-muted-foreground mb-12">
            {t.cta.description}
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <Badge variant="secondary" className="bg-secondary text-secondary-foreground px-6 py-2">
              <FileText className="w-4 h-4 mr-2" />
              {t.cta.freeConsultation}
            </Badge>
            <Badge variant="secondary" className="bg-secondary text-secondary-foreground px-6 py-2">
              <Clock className="w-4 h-4 mr-2" />
              {t.cta.quickQuote}
            </Badge>
            <Badge variant="secondary" className="bg-secondary text-secondary-foreground px-6 py-2">
              <PackageCheck className="w-4 h-4 mr-2" />
              {t.cta.sampleProduction}
            </Badge>
          </div>
          
          <Button 
            size="lg" 
            onClick={scrollToContact}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 py-6"
          >
            {t.cta.contactNow}
          </Button>
        </div>
      </div>
    </section>
  );
};
