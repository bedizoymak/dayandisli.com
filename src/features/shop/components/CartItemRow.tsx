import { Plus, Minus, Trash2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CartItem } from '../types';
import { formatPrice } from '../utils';
import { Link } from 'react-router-dom';

interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}

export function CartItemRow({ item, onUpdateQuantity, onRemove }: CartItemRowProps) {
  const lineTotal = item.price * item.quantity;

  return (
    <div className="flex gap-4 p-4 bg-card border border-border rounded-lg">
      {/* Image */}
      <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingCart className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <Link to={`/shop/${item.slug}`} className="font-semibold text-foreground hover:text-primary block">
          {item.name}
        </Link>
        <p className="text-sm text-muted-foreground mt-1">
          Birim Fiyat: {formatPrice(item.price, item.currency)}
        </p>

        <div className="flex items-center justify-between mt-3">
          {/* Quantity Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <span className="w-10 text-center font-medium">{item.quantity}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
              disabled={item.quantity >= item.stockQuantity}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Line Total */}
          <div className="text-right">
            <p className="text-lg font-bold text-primary">
              {formatPrice(lineTotal, item.currency)}
            </p>
          </div>
        </div>
      </div>

      {/* Remove Button */}
      <Button
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive self-start"
        onClick={() => onRemove(item.productId)}
      >
        <Trash2 className="w-5 h-5" />
      </Button>
    </div>
  );
}
