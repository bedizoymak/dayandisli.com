import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import sectorAutomotive from "@/assets/sector-automotive.jpg";
import sectorDefense from "@/assets/sector-defense.jpg";
import sectorConstruction from "@/assets/sector-construction.jpg";
import sectorMarine from "@/assets/sector-marine.jpg";
import sectorEnergy from "@/assets/sector-energy.jpg";
import sectorAutomation from "@/assets/sector-automation.jpg";

export const Sectors = () => {
  const { t } = useLanguage();
  
  const sectors = [
    {
      image: sectorAutomotive,
      title: t.sectors.automotive.title,
      description: t.sectors.automotive.description
    },
    {
      image: sectorDefense,
      title: t.sectors.defense.title,
      description: t.sectors.defense.description
    },
    {
      image: sectorConstruction,
      title: t.sectors.construction.title,
      description: t.sectors.construction.description
    },
    {
      image: sectorMarine,
      title: t.sectors.marine.title,
      description: t.sectors.marine.description
    },
    {
      image: sectorEnergy,
      title: t.sectors.energy.title,
      description: t.sectors.energy.description
    },
    {
      image: sectorAutomation,
      title: t.sectors.automation.title,
      description: t.sectors.automation.description
    }
  ];

  return (
    <section id="sectors" className="py-24 bg-navy">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">{t.sectors.title}</p>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">{t.sectors.heading}</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t.sectors.description}
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {sectors.map((sector, index) => (
            <Card key={index} className="bg-card border-border overflow-hidden hover:border-primary/50 transition-all duration-300 group">
              <div className="relative h-48 overflow-hidden">
                <img 
                  src={sector.image} 
                  alt={sector.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
              </div>
              <CardHeader>
                <CardTitle className="text-2xl">{sector.title}</CardTitle>
                <CardDescription className="text-muted-foreground">{sector.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
