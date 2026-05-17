-- =============================================
-- SETTINGS TABLE (for auth toggle)
-- =============================================
CREATE TABLE IF NOT EXISTS public.settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  auth_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default settings row
INSERT INTO public.settings (id, auth_enabled) VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read settings
CREATE POLICY "Anyone can read settings"
ON public.settings FOR SELECT
USING (true);

-- =============================================
-- ALLOWED EMAILS TABLE (for whitelist)
-- =============================================
CREATE TABLE IF NOT EXISTS public.allowed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read allowed emails
CREATE POLICY "Authenticated users can read allowed_emails"
ON public.allowed_emails FOR SELECT
TO authenticated
USING (true);

-- Insert default allowed email
INSERT INTO public.allowed_emails (email) VALUES ('bedizoymak1@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- =============================================
-- IS_EMAIL_ALLOWED FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.is_email_allowed(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.allowed_emails WHERE email = check_email
  );
END;
$$;

-- =============================================
-- E-COMMERCE: PRODUCTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  sku TEXT UNIQUE,
  price NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  in_stock BOOLEAN NOT NULL DEFAULT true,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  brand TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Anyone can view products (public shop)
CREATE POLICY "Anyone can view products"
ON public.products FOR SELECT
USING (true);

-- Only authenticated can insert/update/delete
CREATE POLICY "Authenticated can insert products"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update products"
ON public.products FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated can delete products"
ON public.products FOR DELETE
TO authenticated
USING (true);

-- Index for slug lookups
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);

-- =============================================
-- E-COMMERCE: PRODUCT_IMAGES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Anyone can view product images
CREATE POLICY "Anyone can view product_images"
ON public.product_images FOR SELECT
USING (true);

-- Only authenticated can manage images
CREATE POLICY "Authenticated can insert product_images"
ON public.product_images FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update product_images"
ON public.product_images FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated can delete product_images"
ON public.product_images FOR DELETE
TO authenticated
USING (true);

-- Index for product_id lookups
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images(product_id);

-- =============================================
-- E-COMMERCE: ORDERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  customer_name TEXT NOT NULL,
  company_name TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  notes TEXT,
  subtotal NUMERIC(12,2) NOT NULL,
  tax_total NUMERIC(12,2) NOT NULL,
  grand_total NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Authenticated can view orders
CREATE POLICY "Authenticated can view orders"
ON public.orders FOR SELECT
TO authenticated
USING (true);

-- Authenticated can insert orders (checkout)
CREATE POLICY "Authenticated can insert orders"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (true);

-- Authenticated can update orders (admin status change)
CREATE POLICY "Authenticated can update orders"
ON public.orders FOR UPDATE
TO authenticated
USING (true);

-- Anonymous users can insert orders (guest checkout)
CREATE POLICY "Anyone can insert orders"
ON public.orders FOR INSERT
WITH CHECK (true);

-- Index for order_number
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- =============================================
-- E-COMMERCE: ORDER_ITEMS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  quantity INTEGER NOT NULL,
  line_total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Authenticated can view order items
CREATE POLICY "Authenticated can view order_items"
ON public.order_items FOR SELECT
TO authenticated
USING (true);

-- Anyone can insert order items (with order)
CREATE POLICY "Anyone can insert order_items"
ON public.order_items FOR INSERT
WITH CHECK (true);

-- Index for order_id
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- =============================================
-- ORDER NUMBER COUNTER TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.order_counter (
  id INTEGER PRIMARY KEY DEFAULT 1,
  year INTEGER NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0
);

-- Insert initial counter
INSERT INTO public.order_counter (id, year, counter) VALUES (1, EXTRACT(YEAR FROM now())::INTEGER, 0)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.order_counter ENABLE ROW LEVEL SECURITY;

-- Anyone can read counter
CREATE POLICY "Anyone can read order_counter"
ON public.order_counter FOR SELECT
USING (true);

-- Anyone can update counter
CREATE POLICY "Anyone can update order_counter"
ON public.order_counter FOR UPDATE
USING (true);

-- =============================================
-- GENERATE NEXT ORDER NUMBER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year INTEGER;
  next_counter INTEGER;
  order_num TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM now())::INTEGER;
  
  -- Update counter and get new value
  UPDATE public.order_counter
  SET 
    counter = CASE WHEN year = current_year THEN counter + 1 ELSE 1 END,
    year = current_year
  WHERE id = 1
  RETURNING counter INTO next_counter;
  
  -- If no row was updated, insert one
  IF next_counter IS NULL THEN
    INSERT INTO public.order_counter (id, year, counter) VALUES (1, current_year, 1)
    ON CONFLICT (id) DO UPDATE SET counter = order_counter.counter + 1, year = current_year
    RETURNING counter INTO next_counter;
  END IF;
  
  -- Format: DYN-2025-0001
  order_num := 'DYN-' || current_year::TEXT || '-' || LPAD(next_counter::TEXT, 4, '0');
  
  RETURN order_num;
END;
$$;

-- =============================================
-- UPDATE TIMESTAMP TRIGGER FOR PRODUCTS
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
BEFORE UPDATE ON public.settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();