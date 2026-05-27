import { WhyUs } from "@/components/WhyUs";
import { Stats } from "@/components/Stats";
import { CTA } from "@/components/CTA";
import { PublicPageLayout } from "./PublicPageLayout";

const Hakkimizda = () => {
  return (
    <PublicPageLayout>
      <WhyUs />
      <Stats />
      <CTA />
    </PublicPageLayout>
  );
};

export default Hakkimizda;
