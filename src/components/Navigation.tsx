import { Menu, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Link } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useCart } from "@/features/shop/CartContext";
import { SHOP_FEATURE_ENABLED } from "@/features/shop/config";

function CartLink({ compact = false }: { compact?: boolean }) {
  const { itemCount } = useCart();

  return (
    <Link to="/cart" className="relative">
      <Button variant="ghost" size="icon">
        <ShoppingCart className="h-5 w-5" />
        {itemCount > 0 && (
          <span
            className={
              compact
                ? "absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs w-4 h-4 rounded-full flex items-center justify-center text-[10px]"
                : "absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center"
            }
          >
            {itemCount > 99 ? "99+" : itemCount}
          </span>
        )}
      </Button>
    </Link>
  );
}

export const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguage();

  const pageLinks: Array<{ to: string; label: string; end?: boolean }> = [
    { to: "/", label: t.nav.home, end: true },
    { to: "/hizmetler", label: t.nav.services },
    { to: "/teknolojiler", label: t.nav.technologies },
    { to: "/urunler", label: t.nav.products },
    { to: "/sektorler", label: t.nav.sectors },
    { to: "/iletisim", label: t.nav.contact },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-navy/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center cursor-pointer gap-3">
            <img src={`${import.meta.env.BASE_URL}logo-header.png`} alt="Dayan Disli" className="h-14 w-auto object-contain" />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {pageLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className="text-foreground hover:text-primary transition-colors"
                activeClassName="text-primary"
              >
                {link.label}
              </NavLink>
            ))}

            {SHOP_FEATURE_ENABLED && (
              <>
                <Link to="/shop" className="text-foreground hover:text-primary transition-colors">
                  {"Ma\u011faza"}
                </Link>

                <CartLink />
              </>
            )}

            <LanguageSelector />
          </div>

          <div className="md:hidden flex items-center gap-2">
            {SHOP_FEATURE_ENABLED && <CartLink compact />}

            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-foreground">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>

              <SheetContent side="right" className="w-[70%] bg-navy border-border">
                <nav className="flex flex-col gap-6 mt-8">
                  {pageLinks.map((link) => (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      end={link.end}
                      onClick={() => setIsOpen(false)}
                      className="text-lg text-foreground hover:text-primary transition-colors text-left"
                      activeClassName="text-primary"
                    >
                      {link.label}
                    </NavLink>
                  ))}

                  {SHOP_FEATURE_ENABLED && (
                    <Link
                      to="/shop"
                      onClick={() => setIsOpen(false)}
                      className="text-lg text-foreground hover:text-primary transition-colors text-left"
                    >
                      {"Ma\u011faza"}
                    </Link>
                  )}
                </nav>
              </SheetContent>
            </Sheet>

            <div className="scale-[0.7] flex items-center">
              <LanguageSelector />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
