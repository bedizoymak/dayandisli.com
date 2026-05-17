import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Loader2, ShoppingCart, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductCard, ShopFilters, CartDrawer } from '../components';
import { fetchProducts, fetchCategories } from '../api';
import { ProductWithImages } from '../types';
import { useDebounce } from '@/hooks/use-mobile';

const ITEMS_PER_PAGE = 12;

export function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<ProductWithImages[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);

  // Filter states
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [inStockOnly, setInStockOnly] = useState(searchParams.get('inStock') === 'true');
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc'>(
    (searchParams.get('sort') as 'newest' | 'price_asc' | 'price_desc') || 'newest'
  );

  const debouncedSearch = useDebounce(search, 300);

  // Load categories once
  useEffect(() => {
    fetchCategories().then(setCategories);
  }, []);

  // Load products when filters change
  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      setOffset(0);
      try {
        const { products: fetchedProducts, count } = await fetchProducts({
          search: debouncedSearch || undefined,
          category: category !== 'all' ? category : undefined,
          inStockOnly,
          sortBy,
          limit: ITEMS_PER_PAGE,
          offset: 0,
        });
        setProducts(fetchedProducts);
        setTotalCount(count);
      } catch (error) {
        console.error('Error loading products:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();

    // Update URL params
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (category !== 'all') params.set('category', category);
    if (inStockOnly) params.set('inStock', 'true');
    if (sortBy !== 'newest') params.set('sort', sortBy);
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, category, inStockOnly, sortBy, setSearchParams]);

  // Load more handler
  const loadMore = async () => {
    setLoadingMore(true);
    const newOffset = offset + ITEMS_PER_PAGE;
    try {
      const { products: moreProducts } = await fetchProducts({
        search: debouncedSearch || undefined,
        category: category !== 'all' ? category : undefined,
        inStockOnly,
        sortBy,
        limit: ITEMS_PER_PAGE,
        offset: newOffset,
      });
      setProducts((prev) => [...prev, ...moreProducts]);
      setOffset(newOffset);
    } catch (error) {
      console.error('Error loading more products:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const hasMore = products.length < totalCount;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-navy/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="icon">
                <Link to="/">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <h1 className="text-xl font-bold text-foreground">Ürünler</h1>
            </div>
            <CartDrawer />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <ShopFilters
          search={search}
          onSearchChange={setSearch}
          category={category}
          onCategoryChange={setCategory}
          categories={categories}
          inStockOnly={inStockOnly}
          onInStockOnlyChange={setInStockOnly}
          sortBy={sortBy}
          onSortByChange={setSortBy}
        />

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {totalCount} ürün bulundu
          </p>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <ShoppingCart className="w-16 h-16 mb-4" />
            <p className="text-lg">Ürün bulunamadı</p>
            <Button
              variant="link"
              onClick={() => {
                setSearch('');
                setCategory('all');
                setInStockOnly(false);
                setSortBy('newest');
              }}
            >
              Filtreleri Temizle
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center pt-6">
                <Button onClick={loadMore} disabled={loadingMore} variant="outline" size="lg">
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Yükleniyor...
                    </>
                  ) : (
                    'Daha Fazla Yükle'
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
