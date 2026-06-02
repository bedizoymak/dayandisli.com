# Phase 18 Dynamic CMS, Public Website Integration and Shop Readiness Report

Date: 2026-06-02

Scope: Connect ERP-managed website content and e-commerce foundations to the public-facing platform without introducing a second CMS, replacing Supabase, launching checkout, or building mobile apps.

## Executive Summary

Phase 18 activates the ERP CMS and shop foundations created in Phase 13 and Phase 14. Public website navigation, CMS pages, banners, SEO metadata, media references, and forms now read from Supabase-managed ERP records where available. The existing public website remains intact through fallbacks and additive routes.

Implemented:

- Added a public CMS data layer that reads `website_pages`, `website_menu_items`, `website_banners`, `website_seo_settings`, `website_forms`, `website_form_submissions`, `website_media_assets`, and CRM lead foundations.
- Added dynamic public CMS route rendering under `/sayfa/*`.
- Added dynamic header menu loading from ERP menu records with existing static navigation as fallback.
- Added dynamic SEO metadata application for title, description, robots, Open Graph image, and canonical URL.
- Connected website form submissions to Supabase and prepared best-effort CRM lead creation.
- Connected shop category routes and product visibility to Phase 13 e-commerce structures.
- Redirected checkout routes back to `/shop` so payments and checkout are not launched in this phase.

Production readiness score for this phase: **86 / 100**

The remaining gap is not architectural wiring; it is production polish around server-rendered SEO, XML sitemap generation, anti-spam controls, CRM lead-number enforcement, richer CMS content blocks, and stricter public RLS review.

## CMS Rendering Architecture

New public CMS module:

- `src/features/public-cms/api.ts`
- `src/features/public-cms/DynamicCMSPage.tsx`
- `src/features/public-cms/SitemapPage.tsx`

Rendering flow:

```text
Browser route /sayfa/{slug}
-> DynamicCMSPage
-> getPublicCMSPage(pathname)
-> Supabase website_pages where status = published
-> related SEO, banners, menus, forms, media records
-> safe public render
```

Publication handling:

- `website_pages.status = published` is required for dynamic public page visibility.
- Draft, review, and archived pages are not returned by the public CMS page query.
- Missing or unpublished dynamic pages render a Turkish public not-found state instead of exposing ERP data or showing a blank page.
- Banner rendering requires `website_banners.status = published`.
- Banner `starts_at` and `ends_at` are checked client-side before rendering.

Content rendering:

- Page content is rendered as plain paragraphs.
- No `dangerouslySetInnerHTML` is used.
- This avoids XSS exposure from CMS content at the cost of not yet supporting rich CMS blocks.

## Public Website Integration

Routes added or adjusted:

| Route | Status | Purpose |
|---|---|---|
| `/sayfa/*` | Added | Dynamic ERP-managed CMS pages |
| `/site-haritasi` | Added | Public sitemap foundation from active ERP menu records |
| `/shop` | Existing, enhanced | Public product listing |
| `/shop/kategori/:categorySlug` | Added | Public category listing foundation |
| `/shop/:slug` | Existing | Public product detail |
| `/checkout/*` | Redirected | Checkout intentionally not launched |

Navigation:

- `src/components/Navigation.tsx` now loads active header menu items from `website_menu_items`.
- Existing Turkish static navigation remains as a fallback when no CMS menu records exist.
- This keeps the current public website usable while allowing ERP-managed menu activation.

Authorization boundary:

- ERP management routes remain behind `ProtectedRoute` and ERP route guards.
- Public CMS routes only read public CMS tables through Supabase policies.
- Public content rendering does not import ERP shell or management screens.
- No ERP administration route was exposed to public routing.

## SEO Implementation

SEO data source:

- `website_seo_settings`

Implemented client-side metadata:

- `document.title`
- `meta[name="description"]`
- `meta[name="robots"]`
- `meta[property="og:title"]`
- `meta[property="og:description"]`
- `meta[property="og:image"]`
- `link[rel="canonical"]`

Current behavior:

- SEO records are matched by `page_id` or `route_path`.
- If SEO records are missing, page title and summary are used as fallback metadata.
- The sitemap foundation page `/site-haritasi` reads active menu records.

Remaining SEO gap:

- This is still SPA/client-side SEO. Crawlers that do not execute JavaScript may not see final metadata.
- XML sitemap generation is not yet implemented.
- Server-side rendering, static pre-rendering, or edge-rendered metadata should be evaluated in Phase 19.

## Form Workflow Architecture

Implemented public workflow:

```text
Website Form
-> website_forms lookup by form_key
-> website_form_submissions insert
-> best-effort crm_leads insert
-> future CRM lead conversion workflow
```

Connected forms:

- Existing public contact form now stores submissions in Supabase after the current contact email function succeeds.
- Dynamic CMS pages can render the active ERP-managed form associated with the page slug or the first active form record.

Submission storage:

- `website_form_submissions` stores sender name, email, phone, company, subject, message, and status.
- Anonymous insert is allowed by the Phase 14 RLS policy.

CRM integration:

- `submitWebsiteForm` attempts to create a CRM lead with source `website`.
- CRM lead creation is best-effort and does not block the stored website submission.
- The existing ERP CRM API creates `lead_no` through `next_erp_number`; the public form path should be hardened in Phase 19 with an RPC/server function so CRM lead numbering is guaranteed without pulling ERP internals into the public bundle.

## Media Integration

Media sources:

- `website_media_assets`
- `website_banners.image_path`
- `website_seo_settings.og_image_path`
- Existing public media library paths

Implemented:

- Added `resolveMediaUrl` helper for Supabase/public media paths.
- Dynamic CMS banners render ERP-managed image paths.
- Open Graph image metadata can use ERP-managed SEO image paths.
- Static public website images remain available as fallbacks and were not removed.

Remaining media gap:

- There is no responsive image transformation layer yet.
- Alt text from `website_media_assets` is available in the data model but not fully mapped into every public render path.
- Future public pages should prefer media asset records over hardcoded image references where content is CMS-owned.

## Shop Readiness Status

Shop routes:

```text
/shop
/shop/kategori/:categorySlug
/shop/:slug
```

Implemented:

- Public product listing uses existing `products` and `product_images`.
- Public product detail only returns products where `is_shop_visible = true`.
- Category listing now reads active `shop_categories` when present.
- Category filtering resolves either a `shop_category_id` UUID or a category slug/name.
- Checkout routes redirect to `/shop`; payments and checkout are intentionally not launched.

ERP relationship prepared:

```text
E-Commerce Order
-> Sales Order
-> Stock
-> Invoice
-> Collection
```

Current status:

- Product listing, category listing, and product detail are ready for public catalog browsing.
- Cart code remains present from the existing shop foundation, but checkout/payment launch remains blocked by route redirect.
- No fake shop data was introduced.

## Supabase Mapping

| Capability | Supabase tables/functions | Phase 18 usage |
|---|---|---|
| Dynamic CMS pages | `website_pages` | Public page lookup by slug, published status only |
| SEO metadata | `website_seo_settings` | Title, description, robots, OG image, canonical |
| Navigation | `website_menu_items` | Active header menu loading and sitemap foundation |
| Banners | `website_banners` | Published banner rendering with date-window checks |
| Media | `website_media_assets` | Public media inventory loaded for page context |
| Forms | `website_forms` | Active form lookup by form key/page slug |
| Form submissions | `website_form_submissions` | Public submission storage |
| CRM leads | `crm_leads` | Best-effort lead creation foundation |
| Shop categories | `shop_categories` | Active category list and slug-to-ID filtering |
| Products | `products` | Public catalog visibility through `is_shop_visible` |
| Product images | `product_images` | Public listing/detail images |
| Orders/cart/payment tables | `orders`, `order_items`, `shop_carts`, `shop_cart_items`, `shop_payment_statuses` | Existing foundation retained; checkout not launched |

RLS observations:

- `website_pages` has public select only for `status = published`.
- `website_menu_items`, `website_forms`, `website_banners`, `website_media_assets`, and `website_seo_settings` have public select policies from Phase 14.
- `website_form_submissions` allows anonymous insert by design.
- Shop category public read is expected for catalog browsing.
- Public insert policies need rate limiting and abuse controls before production marketing traffic.

## Files Modified

| File | Purpose |
|---|---|
| `src/features/public-cms/api.ts` | Public CMS Supabase data access, SEO metadata, form submission workflow, media URL helpers |
| `src/features/public-cms/DynamicCMSPage.tsx` | Dynamic CMS page rendering, banners, content, forms, Turkish not-found state |
| `src/features/public-cms/SitemapPage.tsx` | Sitemap foundation from active ERP menu records |
| `src/App.tsx` | Public CMS, sitemap, shop category, product detail, and checkout redirect routing |
| `src/components/Navigation.tsx` | ERP-managed public menu loading with static fallback |
| `src/components/ContactForm.tsx` | Contact form submission storage in Supabase |
| `src/features/shop/api.ts` | Shop visibility filtering and active category mapping |
| `src/features/shop/pages/ShopPage.tsx` | Category route parameter support |
| `docs/phase-18-dynamic-cms-public-website-integration-report.md` | Phase 18 implementation report |

## Validation

Build command:

```text
npm run build
```

Result:

- Build passed.
- Existing warnings remain:
  - Browserslist/caniuse-lite database is outdated.
  - `pdfjs-dist` emits an eval warning.
  - Some generated chunks remain larger than 500 kB.

No database migration was added in Phase 18 because the required CMS and shop tables already exist from Phase 13 and Phase 14.

## Risks

| Risk | Severity | Notes |
|---|---:|---|
| Client-side SEO only | High | Metadata is applied after SPA execution; SSR/pre-rendering is needed for stronger crawler support. |
| Public form spam | High | Anonymous inserts are required for forms, but rate limiting, captcha/honeypot, and abuse monitoring are not yet implemented. |
| CRM lead numbering | Medium | Public form lead creation is best-effort; lead-number generation should move to a database RPC or server function. |
| Broad public CMS select policies | Medium | Public read is expected, but sensitive CMS fields should be reviewed before production. |
| Rich CMS content not supported | Medium | Content renders as plain paragraphs only; block rendering is future work. |
| Media optimization missing | Medium | No responsive image transformations or CDN-aware variants are implemented yet. |
| Checkout code remains present | Medium | Checkout routes redirect, but legacy cart/order code still exists and should remain disabled until payment readiness. |
| Category data dependency | Low | Shop category pages need real `shop_categories` and product/category mappings to be useful. |

## Recommendations

- Add server-side or pre-rendered metadata for public CMS pages.
- Generate a real XML sitemap from published pages and active menu records.
- Add public form anti-spam controls before production marketing traffic.
- Replace best-effort CRM lead insert with an RPC or Edge Function that creates website leads with a valid `lead_no`.
- Add a CMS block renderer for headings, sections, buttons, media, and forms without using unsafe HTML rendering.
- Map `website_media_assets.alt_text` consistently into public images.
- Review public RLS policies for every CMS and shop table before launch.
- Keep checkout/payment routes disabled until payment reconciliation, order lifecycle, tax, and security checks are completed.

## Proposed Phase 19 Scope

Recommended Phase 19: **Public Launch Hardening, SEO Pre-rendering and Lead Conversion**

Suggested scope:

- Server-side or static pre-rendering strategy for public CMS pages.
- XML sitemap and robots.txt generation from published CMS records.
- Public form spam protection and rate limiting.
- Website form to CRM lead RPC/Edge Function with guaranteed lead numbering.
- CMS block rendering system.
- Public image optimization and alt-text enforcement.
- Public shop catalog polish without enabling checkout.
- Final launch checklist for `dayandisli.com` and future `shop.dayandisli.com`.
