import { Settings, Box, Wrench, CheckCircle, Flame, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import gearHobbingImg from "@/assets/service-gear-hobbing.jpg";
import cncMachiningImg from "@/assets/service-cnc-machining.jpg";
import gearGrindingImg from "@/assets/service-gear-grinding.jpg";
import qualityControlImg from "@/assets/service-quality-control.jpg";
import heatTreatmentImg from "@/assets/service-heat-treatment.jpg";
import customSolutionsImg from "@/assets/service-custom-solutions.jpg";

export const Services = () => {
  const { t } = useLanguage();
  
  const services = [
    {
      icon: Settings,
      image: gearHobbingImg,
      title: t.services.gearHobbing.title,
      description: t.services.gearHobbing.description,
      badges: t.services.gearHobbing.badges
    },
    {
      icon: Box,
      image: cncMachiningImg,
      title: t.services.cncMachining.title,
      description: t.services.cncMachining.description,
      badges: t.services.cncMachining.badges
    },
    {
      icon: Wrench,
      image: gearGrindingImg,
      title: t.services.gearGrinding.title,
      description: t.services.gearGrinding.description,
      badges: t.services.gearGrinding.badges
    },
    {
      icon: CheckCircle,
      image: qualityControlImg,
      title: t.services.qualityControl.title,
      description: t.services.qualityControl.description,
      badges: t.services.qualityControl.badges
    },
    {
      icon: Flame,
      image: heatTreatmentImg,
      title: t.services.heatTreatment.title,
      description: t.services.heatTreatment.description,
      badges: t.services.heatTreatment.badges
    },
    {
      icon: Sparkles,
      image: customSolutionsImg,
      title: t.services.customSolutions.title,
      description: t.services.customSolutions.description,
      badges: t.services.customSolutions.badges
    }
  ];

  return (
    <section id="services" className="py-24 bg-navy-light">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">{t.services.title}</p>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">{t.services.heading}</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t.services.description}
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <Card 
                key={index} 
                className="bg-card border-border overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 group"
              >
                <div className="relative h-48 w-full overflow-hidden">
                  <img 
                    src={service.image} 
                    alt={service.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                  <div className="absolute bottom-4 left-4 w-12 h-12 bg-primary/90 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    <Icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                </div>
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl">{service.title}</CardTitle>
                  <CardDescription className="text-muted-foreground line-clamp-3">{service.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {service.badges.map((badge, i) => (
                      <Badge key={i} variant="secondary" className="bg-secondary/50 text-secondary-foreground hover:bg-secondary/70 transition-colors">
                        {badge}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
