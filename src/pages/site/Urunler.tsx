import { Products } from "@/components/Products";
import { CTA } from "@/components/CTA";
import { PublicPageLayout } from "@/pages/PublicPageLayout";

const Urunler = () => {
  return (
    <PublicPageLayout>
      <Products />
      <CTA />
    </PublicPageLayout>
  );
};

export default Urunler;
