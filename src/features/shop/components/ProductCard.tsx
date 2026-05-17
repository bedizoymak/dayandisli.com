import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Eye } from 'lucide-react';
import { ProductWithImages } from '../types';
import { formatPrice, truncateText } from '../utils';
import { useCart } from '../CartContext';
import { useToast } from '@/hooks/use-toast';

interface ProductCardProps {
  product: ProductWithImages;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const { toast } = useToast();

  const handleAddToCart = () => {
    if (!product.in_stock || product.stock_quantity < 1) {
      toast({
        title: 'Stokta Yok',
        description: 'Bu ürün şu anda stokta bulunmamaktadır.',
        variant: 'destructive',
      });
      return;
    }

    addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      imageUrl: product.primary_image || null,
      stockQuantity: product.stock_quantity,
      currency: product.currency,
    });

    toast({
      title: 'Sepete Eklendi',
      description: `${product.name} sepetinize eklendi.`,
    });
  };

  return (
    <Card className="group overflow-hidden bg-card border-border hover:border-primary/50 transition-all duration-300">
      {/* Product Image */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        {product.primary_image ? (
          <img
            src={product.primary_image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ShoppingCart className="w-12 h-12" />
          </div>
        )}

        {/* Stock badge */}
        {!product.in_stock || product.stock_quantity < 1 ? (
          <Badge variant="destructive" className="absolute top-2 right-2">
            Stokta Yok
          </Badge>
        ) : product.stock_quantity < 5 ? (
          <Badge variant="secondary" className="absolute top-2 right-2 bg-yellow-500/20 text-yellow-500">
            Son {product.stock_quantity} Adet
          </Badge>
        ) : null}

        {/* Category badge */}
        {product.category && (
          <Badge variant="secondary" className="absolute top-2 left-2">
            {product.category}
          </Badge>
        )}
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Product Name */}
        <h3 className="font-semibold text-lg text-foreground line-clamp-2 min-h-[3.5rem]">
          {product.name}
        </h3>

        {/* Description */}
        {product.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {truncateText(product.description, 80)}
          </p>
        )}

        {/* SKU */}
        {product.sku && (
          <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
        )}

        {/* Price */}
        <p className="text-xl font-bold text-primary">
          {formatPrice(product.price, product.currency)}
        </p>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleAddToCart}
            disabled={!product.in_stock || product.stock_quantity < 1}
            className="flex-1"
            size="sm"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Sepete Ekle
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={`/shop/${product.slug}`}>
              <Eye className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
