import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, ShoppingCart, Plus, Minus, Package, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CartDrawer, ProductCard } from '../components';
import { fetchProductBySlug, fetchRelatedProducts } from '../api';
import { ProductWithImages } from '../types';
import { formatPrice } from '../utils';
import { useCart } from '../CartContext';
import { useToast } from '@/hooks/use-toast';

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<ProductWithImages | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<ProductWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  
  const { addItem } = useCart();
  const { toast } = useToast();

  useEffect(() => {
    if (!slug) return;

    const loadProduct = async () => {
      setLoading(true);
      try {
        const fetchedProduct = await fetchProductBySlug(slug);
        setProduct(fetchedProduct);
        if (fetchedProduct) {
          setSelectedImage(fetchedProduct.primary_image || null);
          setQuantity(1);
          // Fetch related products
          const related = await fetchRelatedProducts(fetchedProduct.category, fetchedProduct.id);
          setRelatedProducts(related);
        }
      } catch (error) {
        console.error('Error loading product:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [slug]);

  const handleAddToCart = () => {
    if (!product) return;
    
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
    }, quantity);

    toast({
      title: 'Sepete Eklendi',
      description: `${quantity}x ${product.name} sepetinize eklendi.`,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-navy/95 backdrop-blur-sm border-b border-border">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button asChild variant="ghost" size="icon">
                  <Link to="/shop">
                    <ArrowLeft className="h-5 w-5" />
                  </Link>
                </Button>
                <h1 className="text-xl font-bold text-foreground">Ürün Bulunamadı</h1>
              </div>
              <CartDrawer />
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-20 text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg text-muted-foreground mb-4">Aradığınız ürün bulunamadı.</p>
          <Button asChild>
            <Link to="/shop">Ürünlere Dön</Link>
          </Button>
        </main>
      </div>
    );
  }

  const isInStock = product.in_stock && product.stock_quantity > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-navy/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="icon">
                <Link to="/shop">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <h1 className="text-xl font-bold text-foreground truncate max-w-[200px] md:max-w-none">
                {product.name}
              </h1>
            </div>
            <CartDrawer />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Product Detail */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Images */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="aspect-square rounded-lg overflow-hidden bg-muted">
              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <ShoppingCart className="w-20 h-20" />
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {product.images.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(img.image_url)}
                    className={`w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                      selectedImage === img.image_url
                        ? 'border-primary'
                        : 'border-transparent hover:border-primary/50'
                    }`}
                  >
                    <img
                      src={img.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Category & SKU */}
            <div className="flex flex-wrap gap-2">
              {product.category && (
                <Badge variant="secondary">{product.category}</Badge>
              )}
              {product.brand && (
                <Badge variant="outline">{product.brand}</Badge>
              )}
            </div>

            {/* Name */}
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {product.name}
            </h1>

            {/* SKU */}
            {product.sku && (
              <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
            )}

            {/* Stock Status */}
            <div className="flex items-center gap-2">
              {isInStock ? (
                <>
                  <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30">
                    <Check className="w-3 h-3 mr-1" />
                    Stokta
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    ({product.stock_quantity} adet mevcut)
                  </span>
                </>
              ) : (
                <Badge variant="destructive">Stokta Yok</Badge>
              )}
            </div>

            {/* Price */}
            <p className="text-3xl font-bold text-primary">
              {formatPrice(product.price, product.currency)}
            </p>

            {/* Quantity & Add to Cart */}
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-4">
                {/* Quantity Selector */}
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">Adet:</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={!isInStock}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="w-12 text-center font-semibold">{quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                      disabled={!isInStock || quantity >= product.stock_quantity}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Add to Cart Button */}
                <Button
                  onClick={handleAddToCart}
                  disabled={!isInStock}
                  className="w-full"
                  size="lg"
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  {isInStock ? 'Sepete Ekle' : 'Stokta Yok'}
                </Button>
              </CardContent>
            </Card>

            {/* Description */}
            {product.description && (
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-foreground">Açıklama</h2>
                <p className="text-muted-foreground whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="mt-12 space-y-6">
            <h2 className="text-2xl font-bold text-foreground">Benzer Ürünler</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((relatedProduct) => (
                <ProductCard key={relatedProduct.id} product={relatedProduct} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
