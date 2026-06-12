-- Phase 14 website management and public content administration.
-- Additive public-content tables for ERP-side management.

create table if not exists public.website_pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  page_type text not null default 'content' check (page_type in ('home', 'content', 'landing', 'product', 'service', 'sector', 'contact')),
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  locale text not null default 'tr',
  summary text null,
  content text null,
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_seo_settings (
  id uuid primary key default gen_random_uuid(),
  page_id uuid null references public.website_pages(id) on delete cascade,
  route_path text not null,
  meta_title text null,
  meta_description text null,
  canonical_url text null,
  robots text not null default 'index,follow',
  og_image_path text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(route_path)
);

create table if not exists public.website_menu_items (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  path text not null,
  menu_area text not null default 'header' check (menu_area in ('header', 'footer', 'mobile')),
  parent_item_id uuid null references public.website_menu_items(id),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_media_assets (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_path text not null,
  media_type text not null default 'image' check (media_type in ('image', 'document', 'video', 'other')),
  alt_text text null,
  usage_area text null,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_forms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  form_key text not null unique,
  target_email text null,
  success_message text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid null references public.website_forms(id),
  sender_name text null,
  sender_email text null,
  sender_phone text null,
  company_name text null,
  subject text null,
  message text null,
  status text not null default 'new' check (status in ('new', 'reviewed', 'converted', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text null,
  image_path text null,
  link_url text null,
  placement text not null default 'home' check (placement in ('home', 'services', 'products', 'sectors', 'contact')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  starts_at timestamptz null,
  ends_at timestamptz null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_website_pages_status on public.website_pages(status);
create index if not exists idx_website_menu_items_area on public.website_menu_items(menu_area, is_active);
create index if not exists idx_website_media_assets_type on public.website_media_assets(media_type);
create index if not exists idx_website_form_submissions_status on public.website_form_submissions(status);
create index if not exists idx_website_banners_status on public.website_banners(status);

alter table public.website_pages enable row level security;
alter table public.website_seo_settings enable row level security;
alter table public.website_menu_items enable row level security;
alter table public.website_media_assets enable row level security;
alter table public.website_forms enable row level security;
alter table public.website_form_submissions enable row level security;
alter table public.website_banners enable row level security;

drop policy if exists "Anyone can view published website_pages" on public.website_pages;
create policy "Anyone can view published website_pages"
on public.website_pages for select
using (status = 'published');

drop policy if exists "Authenticated can manage website_pages" on public.website_pages;
create policy "Authenticated can manage website_pages"
on public.website_pages for all
to authenticated
using (true)
with check (true);

do $$
declare
  t text;
begin
  foreach t in array array[
    'website_seo_settings',
    'website_menu_items',
    'website_media_assets',
    'website_forms',
    'website_banners'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_public', t);
    execute format('create policy %I on public.%I for select using (true)', t || '_select_public', t);
    execute format('drop policy if exists %I on public.%I', t || '_manage_authenticated', t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', t || '_manage_authenticated', t);
  end loop;
end $$;

drop policy if exists "Anyone can insert website_form_submissions" on public.website_form_submissions;
create policy "Anyone can insert website_form_submissions"
on public.website_form_submissions for insert
with check (true);

drop policy if exists "Authenticated can manage website_form_submissions" on public.website_form_submissions;
create policy "Authenticated can manage website_form_submissions"
on public.website_form_submissions for all
to authenticated
using (true)
with check (true);

do $$
declare
  t text;
begin
  foreach t in array array[
    'website_pages',
    'website_seo_settings',
    'website_menu_items',
    'website_media_assets',
    'website_forms',
    'website_form_submissions',
    'website_banners'
  ]
  loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', t, t);
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.erp_set_updated_at()', t, t);
  end loop;
end $$;
