import { Sectors } from "@/components/Sectors";
import { CTA } from "@/components/CTA";
import { PublicPageLayout } from "@/pages/PublicPageLayout";

const Sektorler = () => {
  return (
    <PublicPageLayout>
      <Sectors />
      <CTA />
    </PublicPageLayout>
  );
};

export default Sektorler;
