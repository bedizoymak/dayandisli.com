import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Award } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import heroBg from "@/assets/hero-bg.jpg";

export const Hero = () => {
  const { t } = useLanguage();
  
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/95 to-navy/80" />
      </div>
      
      <div className="container relative z-10 mx-auto px-6 py-32">
        <div className="max-w-4xl">
          <Badge variant="secondary" className="mb-6 bg-secondary/80 text-secondary-foreground border border-border/50 backdrop-blur-sm">
            <Award className="w-4 h-4 mr-2" />
            {t.hero.badge}
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            {t.hero.title}{" "}
            <span className="text-primary">{t.hero.titleHighlight}</span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
            {t.hero.description}
          </p>
          
          <div className="flex flex-wrap gap-4 mb-12">

  {/* Teklif Alın */}
  <Button
    size="lg"
    onClick={() => {
      const element = document.getElementById("contact-form");
      if (element) {
        const headerOffset = 80;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({ top: offsetPosition, behavior: "smooth" });
      }
    }}
    className="bg-primary hover:bg-primary/90 text-primary-foreground"
  >
    {t.hero.getQuote}
    <ArrowRight className="ml-2 w-5 h-5" />
  </Button>

  {/* Ürünlerimiz */}
  <Button
    size="lg"
    variant="outline"
    onClick={() =>
      document.getElementById("products")?.scrollIntoView({ behavior: "smooth" })
    }
    className="border-border bg-secondary/50 text-foreground hover:bg-secondary"
  >
    {t.hero.ourProducts}
  </Button>

</div>
          
          <div className="grid grid-cols-3 gap-8 max-w-2xl">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">25+</div>
              <div className="text-muted-foreground">{t.hero.yearsExperience}</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">500+</div>
              <div className="text-muted-foreground">{t.hero.completedProjects}</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">99.8%</div>
              <div className="text-muted-foreground">{t.hero.qualityRate}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
