# Phase 14 Website Management and Public Content Administration Report

## Objective

Phase 14 adds ERP-side website management for `dayandisli.com` public content without breaking the existing public website.

The implementation is additive: current public React pages continue to render as before, while Supabase-backed content administration records are now available for future dynamic rendering.

## Website Management Architecture

Implemented ERP screen:

- `src/features/erp/website/WebsiteManagementPage.tsx`

ERP Web Sitesi app screens:

- Sayfalar
- SEO Ayarları
- Menü Yönetimi
- Medya Kütüphanesi
- Formlar
- Bannerlar
- Yayın Durumu

All visible ERP UI text is Turkish.

## Supabase Content Model

Created migration:

- `supabase/migrations/20260601145932_phase14_website_management_public_content.sql`

New tables:

- `website_pages`
- `website_seo_settings`
- `website_menu_items`
- `website_media_assets`
- `website_forms`
- `website_form_submissions`
- `website_banners`

Business/public content data is stored in Supabase. Media uploads may continue to use public media paths; the ERP stores metadata and usage records.

## Public Site Safety

The existing public site remains intact:

- No public route was removed.
- No existing public component was replaced.
- CMS records are prepared for future dynamic rendering but are not yet required by the public website runtime.

This avoids breaking `dayandisli.com` while creating the ERP-side administration foundation.

## ERP API Updates

Updated:

- `src/features/erp/shared/erpApi.ts`
- `src/features/erp/shared/types.ts`

Added API coverage for:

- Website pages
- SEO settings
- Menu items
- Media assets
- Form definitions
- Form submissions
- Banners

## Application Integration

Updated:

- `src/features/erp/apps/applicationRegistry.ts`
- `src/features/erp/index.tsx`
- `src/features/erp/shared/permissions.ts`

Routes added:

- `/website`
- `/website/seo`
- `/website/menuler`
- `/website/medya`
- `/website/formlar`
- `/website/bannerlar`
- `/website/yayin`

The Web Sitesi app now uses ERP CMS routes instead of legacy admin placeholders.

## Publishing Model

Pages support:

- Draft
- Review
- Published
- Archived

Banners support:

- Draft
- Published
- Archived

The `Yayın Durumu` screen centralizes page publishing visibility.

## SEO Model

SEO settings support:

- Page linkage
- Route path
- Meta title
- Meta description
- Canonical URL
- Robots value
- Open Graph image path
- Active/passive status

## Menu and Media Model

Menu items support:

- Header, footer, and mobile areas
- Parent menu foundation
- Sort order
- Active/passive status

Media assets support:

- File name
- File path
- Media type
- Alt text
- Usage area
- Public/private metadata flag

## Forms Model

Forms support:

- Form key
- Target email
- Success message
- Active/passive status

Submissions support:

- Sender data
- Subject/message
- Status tracking
- Future CRM conversion path

## Validation

Command run:

```bash
npm run build
```

Result:

- Build succeeded.
- Existing Browserslist warning remains.
- Existing `pdfjs-dist` eval warning remains.
- Existing jsPDF dynamic/static import warning remains from the reporting/export foundation.
- Existing large chunk warning remains.

## Risks

- Public pages do not yet consume the CMS tables, so content changes in ERP will not affect the public website until a future rendering integration phase.
- RLS is permissive for authenticated ERP management and public select where appropriate; production hardening should revisit policies.
- Media upload itself is still not implemented in this screen, only metadata registration.
- Form submissions require public forms to be wired to Supabase submission tables in a future phase.
- SEO settings are stored but not yet injected into public route metadata.

## Recommendations

- Add dynamic public rendering gradually, page by page, with fallbacks to existing static content.
- Wire contact forms to `website_form_submissions` after spam protection and validation are defined.
- Add media upload integration through Supabase Storage or the existing public media workflow.
- Add preview mode for draft content before publishing.
- Add audit logging for publish/unpublish actions.
- Harden RLS before non-admin content editors are added.

## Proposed Phase 15 Scope

Recommended Phase 15: Public CMS Rendering and Preview Integration.

Suggested scope:

- Read `website_pages`, `website_menu_items`, `website_banners`, and SEO settings on public routes.
- Add fallback rendering to protect existing pages.
- Add preview mode for draft content.
- Connect contact forms to `website_form_submissions`.
- Add media upload and selection workflow.

