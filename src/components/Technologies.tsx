import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import techHobbing from "@/assets/tech-hobbing.jpg";
import techCnc from "@/assets/tech-cnc.jpg";
import techGrinding from "@/assets/tech-grinding.jpg";
import techCmm from "@/assets/tech-cmm.jpg";

export const Technologies = () => {
  const { t } = useLanguage();
  
  const technologies = [
    {
      image: techHobbing,
      title: t.technologies.gearHobbingMachines.title,
      specs: t.technologies.gearHobbingMachines.specs
    },
    {
      image: techCnc,
      title: t.technologies.fiveAxisCnc.title,
      specs: t.technologies.fiveAxisCnc.specs
    },
    {
      image: techGrinding,
      title: t.technologies.gearGrinding.title,
      specs: t.technologies.gearGrinding.specs
    },
    {
      image: techCmm,
      title: t.technologies.cmmMeasurement.title,
      specs: t.technologies.cmmMeasurement.specs
    }
  ];

  return (
    <section id="technologies" className="py-24 bg-navy">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">{t.technologies.title}</p>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">{t.technologies.heading}</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t.technologies.description}
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          {technologies.map((tech, index) => (
            <Card key={index} className="bg-card border-border overflow-hidden hover:border-primary/50 transition-all duration-300 group">
              <div className="relative h-64 overflow-hidden">
                <img 
                  src={tech.image} 
                  alt={tech.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
              </div>
              <CardContent className="p-6">
                <h3 className="text-2xl font-bold mb-4">{tech.title}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {tech.specs.map((spec, i) => (
                    <Badge key={i} variant="secondary" className="bg-secondary/50 text-secondary-foreground justify-start">
                      {spec}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
