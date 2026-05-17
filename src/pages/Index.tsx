import { Navigation } from "@/components/Navigation";
import { Hero } from "@/components/Hero";
import { Services } from "@/components/Services";
import { Technologies } from "@/components/Technologies";
import { Products } from "@/components/Products";
import { WhyUs } from "@/components/WhyUs";
import { Stats } from "@/components/Stats";
import { Sectors } from "@/components/Sectors";
import { CTA } from "@/components/CTA";
import { Footer } from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

const Index = () => {
  return (
    <div className="min-h-screen bg-navy text-foreground">
      <Navigation />
      <Hero />
      <Services />
      <Technologies />
      <Products />
      <WhyUs />
      <Stats />
      <Sectors />
      <CTA />
      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default Index;
