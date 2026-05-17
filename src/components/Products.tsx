import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import prodSpur from "@/assets/prod-spur.jpg";
import prodHelical from "@/assets/prod-helical.jpg";
import prodBevel from "@/assets/prod-bevel.jpg";
import prodWorm from "@/assets/prod-worm.jpg";
import prodInternal from "@/assets/prod-internal.jpg";
import prodRack from "@/assets/prod-rack.jpg";

export const Products = () => {
  const { t } = useLanguage();
  
  const products = [
    {
      image: prodSpur,
      quality: "DIN 5-7",
      title: t.products.spurGear.title,
      specs: t.products.spurGear.specs,
      applications: t.products.spurGear.applications
    },
    {
      image: prodHelical,
      quality: "DIN 5-7",
      title: t.products.helicalGear.title,
      specs: t.products.helicalGear.specs,
      applications: t.products.helicalGear.applications
    },
    {
      image: prodBevel,
      quality: "DIN 6-8",
      title: t.products.bevelGear.title,
      specs: t.products.bevelGear.specs,
      applications: t.products.bevelGear.applications
    },
    {
      image: prodWorm,
      quality: "DIN 6-8",
      title: t.products.wormGear.title,
      specs: t.products.wormGear.specs,
      applications: t.products.wormGear.applications
    },
    {
      image: prodInternal,
      quality: "DIN 5-7",
      title: t.products.internalGear.title,
      specs: t.products.internalGear.specs,
      applications: t.products.internalGear.applications
    },
    {
      image: prodRack,
      quality: "DIN 6-8",
      title: t.products.rack.title,
      specs: t.products.rack.specs,
      applications: t.products.rack.applications
    }
  ];

  return (
    <section id="products" className="py-24 bg-navy-light">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">{t.products.title}</p>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">{t.products.heading}</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t.products.description}
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product, index) => (
            <Card key={index} className="bg-card border-border hover:border-primary/50 transition-all duration-300 group overflow-hidden">
              <div className="relative h-64 bg-muted overflow-hidden">
                <img 
                  src={product.image} 
                  alt={product.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <Badge className="absolute top-4 right-4 bg-primary text-primary-foreground">
                  {product.quality}
                </Badge>
              </div>
              <CardHeader>
                <CardTitle className="text-xl">{product.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-primary font-semibold mb-1">{t.products.technicalSpecs}</p>
                  <p className="text-muted-foreground text-sm">{product.specs}</p>
                </div>
                <div>
                  <p className="text-sm text-primary font-semibold mb-1">{t.products.applications}</p>
                  <p className="text-muted-foreground text-sm">{product.applications}</p>
                </div>
                <Button variant="outline" className="w-full border-border hover:bg-secondary">
                  {t.products.detailedInfo}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
