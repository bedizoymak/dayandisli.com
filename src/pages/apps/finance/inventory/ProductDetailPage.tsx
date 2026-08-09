import { useParams } from "react-router-dom";
import { ProductDetailPage as ProductDetailView } from "@/features/finance/OperationsPages";
import { usePageTitle } from "@/features/erp-shell/usePageTitle";

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  usePageTitle(productId ? `Ürün ${productId}` : "Ürün Bulunamadı");
  return <ProductDetailView productId={productId} />;
}
