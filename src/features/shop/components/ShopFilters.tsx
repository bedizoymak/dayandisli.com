import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';

interface ShopFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  categories: string[];
  inStockOnly: boolean;
  onInStockOnlyChange: (value: boolean) => void;
  sortBy: 'newest' | 'price_asc' | 'price_desc';
  onSortByChange: (value: 'newest' | 'price_asc' | 'price_desc') => void;
}

export function ShopFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  categories,
  inStockOnly,
  onInStockOnlyChange,
  sortBy,
  onSortByChange,
}: ShopFiltersProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Ürün ara..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Category Filter */}
        <div className="flex-1">
          <Select value={category} onValueChange={onCategoryChange}>
            <SelectTrigger>
              <SelectValue placeholder="Tüm Kategoriler" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Kategoriler</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sort By */}
        <div className="flex-1">
          <Select value={sortBy} onValueChange={(v) => onSortByChange(v as typeof sortBy)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">En Yeni</SelectItem>
              <SelectItem value="price_asc">Fiyat (Düşükten Yükseğe)</SelectItem>
              <SelectItem value="price_desc">Fiyat (Yüksekten Düşüğe)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* In Stock Toggle */}
        <div className="flex items-center gap-2">
          <Switch
            id="in-stock"
            checked={inStockOnly}
            onCheckedChange={onInStockOnlyChange}
          />
          <Label htmlFor="in-stock" className="text-sm cursor-pointer">
            Stokta Olanlar
          </Label>
        </div>
      </div>
    </div>
  );
}
