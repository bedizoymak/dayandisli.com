import { Award, Clock, Users, DollarSign, HeadphonesIcon, Globe } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import qualityStandardsImg from "@/assets/why-us/quality-standards.jpg";
import fastDeliveryImg from "@/assets/why-us/fast-delivery.jpg";
import expertTeamImg from "@/assets/why-us/expert-team.jpg";
import competitivePricesImg from "@/assets/why-us/competitive-prices.jpg";
import afterSalesSupportImg from "@/assets/why-us/after-sales-support.jpg";
import internationalExperienceImg from "@/assets/why-us/international-experience.jpg";

export const WhyUs = () => {
  const { t } = useLanguage();
  
  const reasons = [
    {
      icon: Award,
      image: qualityStandardsImg,
      title: t.whyUs.highQuality.title,
      description: t.whyUs.highQuality.description
    },
    {
      icon: Clock,
      image: fastDeliveryImg,
      title: t.whyUs.fastDelivery.title,
      description: t.whyUs.fastDelivery.description
    },
    {
      icon: Users,
      image: expertTeamImg,
      title: t.whyUs.expertTeam.title,
      description: t.whyUs.expertTeam.description
    },
    {
      icon: DollarSign,
      image: competitivePricesImg,
      title: t.whyUs.competitivePrices.title,
      description: t.whyUs.competitivePrices.description
    },
    {
      icon: HeadphonesIcon,
      image: afterSalesSupportImg,
      title: t.whyUs.afterSalesSupport.title,
      description: t.whyUs.afterSalesSupport.description
    },
    {
      icon: Globe,
      image: internationalExperienceImg,
      title: t.whyUs.internationalExperience.title,
      description: t.whyUs.internationalExperience.description
    }
  ];

  return (
    <section className="py-24 bg-navy">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">{t.whyUs.title}</p>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">{t.whyUs.heading}</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t.whyUs.description}
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reasons.map((reason, index) => {
            const Icon = reason.icon;
            return (
              <Card 
                key={index} 
                className="bg-card border-border hover:border-primary/50 transition-all duration-300 relative overflow-hidden group"
              >
                {/* Background image with subtle opacity */}
                <div className="absolute inset-0 overflow-hidden rounded-lg">
                  <img 
                    src={reason.image} 
                    alt=""
                    className="w-full h-full object-cover opacity-[0.38] group-hover:opacity-[0.50] transition-opacity duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-card/60" />
                </div>
                
                {/* Content */}
                <CardHeader className="relative z-10">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{reason.title}</CardTitle>
                  <CardDescription className="text-muted-foreground">{reason.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
