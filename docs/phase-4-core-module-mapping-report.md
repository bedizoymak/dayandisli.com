# Phase 4 Core ERP Module Mapping Report

## Objective

Phase 4 defines the complete ERP information architecture before advanced workflow implementation. This phase is documentation and architecture focused. No new complex business logic, duplicate backend structures, role filtering, or schema changes were introduced.

## Source Inventory

Reviewed implementation sources:

- Application registry: `src/features/erp/apps/applicationRegistry.ts`
- ERP route map: `src/features/erp/index.tsx`
- Domain route gate: `src/App.tsx`
- Legacy admin routes: `src/features/admin/index.tsx`
- ERP data access layer: `src/features/erp/shared/erpApi.ts`
- Finance/cari services: `src/services/partiesService.ts`, `src/services/financeService.ts`
- E-commerce API: `src/features/shop/api.ts`
- Supabase migrations and manual SQL:
  - `supabase/migrations/20251208092932_b7d45e49-989a-4ea1-a451-45de4f44dffd.sql`
  - `supabase/migrations/20260517110000_admin_users_auth.sql`
  - `supabase/migrations/20260517153000_erp_core_schema.sql`
  - `supabase/migrations/20260517230000_erp_phase2_phase3_readiness.sql`
  - `supabase/migrations/20260518093000_erp_phase5_audit_purchasing.sql`
  - `supabase/migrations/20260518143000_erp_phase6_workflow_notifications.sql`
  - `supabase/manual/erp_core_schema.sql`
  - `supabase/manual/erp_customer_supplier_finance_schema.sql`

## Complete ERP Module Tree

### 1. Web Sitesi

Purpose: public website content, catalog visibility, media, forms, and SEO management.

Submodules and pages:

- Genel Bakış
  - current route: `/dashboard`
  - current status: reused ERP dashboard as temporary management overview
- Ürünler
  - current route: `/admin/urunler`
  - current status: legacy admin product catalog exists
- Medya
  - current route: `/documents`
  - current status: ERP document metadata screen exists
- SEO
  - proposed future route: `/apps/website/seo`
  - current status: missing
- Formlar
  - proposed future route: `/apps/website/formlar`
  - current status: missing

Tables:

- `products`
- `product_images`
- `documents`
- `settings`
- future: website pages/forms/seo tables if dynamic content is required

Reuse:

- Public site pages and localized content remain under `dayandisli.com`.
- Product and media management reuse existing Supabase tables.

### 2. E-Ticaret

Purpose: online product catalog, customer orders, checkout, and commerce operations.

Submodules and pages:

- Ürünler
  - current route: `/admin/urunler`
  - status: legacy admin product management exists
- Kategoriler
  - proposed route: `/apps/commerce/kategoriler`
  - status: missing dedicated screen; category currently exists as product field
- Siparişler
  - current route: `/admin/siparisler`
  - status: legacy admin order management exists
- Müşteriler
  - current route: `/crm` or `/musteriler`
  - status: ERP customer/cari pages exist
- Kampanyalar
  - proposed route: `/apps/commerce/kampanyalar`
  - status: missing

Tables:

- `products`
- `product_images`
- `orders`
- `order_items`
- `order_counter`
- `stakeholders`
- legacy customer tables where used by import/compatibility workflows

Reuse:

- `src/features/shop/api.ts` is the public storefront API.
- Legacy admin order/product screens should be wrapped or replaced later, not duplicated.

### 3. Müşteri İlişkileri

Purpose: companies, contacts, customer/supplier/subcontractor relationship management, future lead and opportunity handling.

Submodules and pages:

- Paydaşlar
  - current route: `/crm`
  - status: ERP stakeholder list/form exists
- Müşteriler
  - current routes: `/musteriler`, `/musteriler/yeni`, `/musteriler/:id`, `/musteriler/:id/duzenle`
  - status: ERP customer directory/detail/form exists
- Tedarikçiler
  - current routes: `/tedarikciler`, `/tedarikciler/yeni`, `/tedarikciler/:id`, `/tedarikciler/:id/duzenle`
  - status: ERP supplier directory/detail/form exists
- Aktiviteler
  - proposed route: `/apps/crm/aktiviteler`
  - status: missing
- Fırsatlar
  - proposed route: `/apps/crm/firsatlar`
  - status: missing
- Aday Müşteriler
  - proposed route: `/apps/crm/adaylar`
  - status: missing

Tables:

- `stakeholders`
- `parties`
- `party_notes`
- `financial_transactions`
- `payment_documents`
- legacy: `customer_profile`, `customers_full`
- future: leads, opportunities, activities, contact persons if not modeled inside `stakeholders`

Reuse:

- `listStakeholders`, `createStakeholder`, `updateStakeholder`
- legacy import helpers: `previewLegacyCustomerImport`, `importLegacyCustomersToStakeholders`
- finance/cari pages in `src/pages/erp`

### 4. Satış

Purpose: quotation-to-order lifecycle, sales order tracking, customer sales records, and sales reporting.

Submodules and pages:

- Teklifler
  - current route: `/teklifler`
  - status: ERP quotation list exists
- Yeni Teklif
  - current route: `/teklifler/yeni`
  - status: existing quotation builder embedded in ERP layout
- Satış Siparişleri
  - current routes: `/siparisler`, `/siparisler/:id`, `/sales-orders`, `/sales-orders/:id`
  - status: ERP sales order list/detail exists
- Müşteriler
  - current route: `/musteriler`
  - status: exists
- Satış Raporları
  - current route: `/reports`
  - status: summary exists; dedicated sales reporting missing

Tables:

- `quotations`
- `erp_quotation_links`
- `sales_orders`
- `sales_order_items`
- `stakeholders`
- `erp_audit_logs`
- `erp_notifications`

Reuse:

- `listERPQuotationsFromExistingTable`
- `convertQuotationToSalesOrder`
- `listSalesOrders`, `createSalesOrder`, `updateSalesOrder`
- `createWorkOrderFromSalesOrder` for downstream production.

### 5. Faturalama

Purpose: sales/purchase invoices, payment connection, invoice status, and operational billing view.

Submodules and pages:

- Faturalar
  - current route: `/invoices`
  - status: ERP invoice list/create support exists
- Ödemeler
  - current route: `/payments`
  - status: ERP payment list/create support exists
- Finans Bağlantısı
  - current route: `/finans`
  - status: finance summary exists
- Fatura Detayları
  - proposed route: `/invoices/:id`
  - status: missing

Tables:

- `invoices`
- `payments`
- `financial_accounts`
- `stakeholders`
- `sales_orders`
- `purchase_orders`

Reuse:

- `listInvoices`, `createInvoice`
- `listPayments`, `createPayment`
- finance summary pages.

### 6. Muhasebe

Purpose: cari finance, account movements, cash/bank tracking, payment documents, and finance reports.

Submodules and pages:

- Finans Özeti
  - current route: `/finans`
  - status: exists
- Finans Hareketleri
  - current routes: `/finans/hareketler`, `/finans/hareketler/yeni`, `/finans/hareketler/:id`
  - status: exists
- Ödemeler
  - current route: `/finans/odemeler`
  - status: exists
- Çekler ve Senetler
  - current route: `/finans/cekler`
  - status: exists
- Finans Raporları
  - current route: `/finans/raporlar`
  - status: exists

Tables:

- `financial_transactions`
- `payment_documents`
- `parties`
- `financial_accounts`
- `invoices`
- `payments`

Reuse:

- `src/services/financeService.ts`
- `src/components/erp/finance/*`
- ERP finance pages under `src/pages/erp`.

### 7. Gider Yönetimi

Purpose: expense/payment outflows, vendor costs, documents, and expense reporting.

Submodules and pages:

- Gider Ödemeleri
  - current route: `/payments`
  - status: generic payment list exists
- Finans Hareketi
  - current route: `/finans/hareketler/yeni`
  - status: generic transaction form exists
- Tedarikçi Giderleri
  - current route: `/tedarikciler`
  - status: suppliers exist; dedicated expense workflow missing
- Gider Raporları
  - current route: `/reports`
  - status: generic reports exist
- Gider Belgeleri
  - proposed route: `/apps/expenses/belgeler`
  - status: missing

Tables:

- `payments`
- `financial_transactions`
- `payment_documents`
- `invoices`
- `documents`
- `stakeholders` or `parties`

Reuse:

- Existing finance and document modules should be reused.
- No separate expense backend should be created until a real data need exists.

### 8. Stok Yönetimi

Purpose: material/product inventory, stock movements, critical stock, purchase/production integration.

Submodules and pages:

- Stok Kartları
  - current routes: `/inventory`, `/inventory/:id`
  - status: ERP inventory list/detail exists
- Stok Hareketleri
  - current route: `/inventory-movements`
  - status: exists
- Kritik Stok
  - proposed route: `/apps/inventory/kritik-stok`
  - status: can be derived from existing inventory; dedicated screen missing
- Satın Alma Bağlantısı
  - current route: `/purchase-orders`
  - status: exists
- Üretim Tüketimi
  - proposed route: `/apps/inventory/uretim-tuketimi`
  - status: missing

Tables:

- `inventory_items`
- `inventory_movements`
- `purchase_orders`
- `purchase_order_items`
- `work_orders`
- `sales_order_items`
- `products`

Reuse:

- `listInventoryItems`, `createInventoryItem`, `updateInventoryItem`
- `listInventoryMovements`, `createInventoryMovement`
- purchase receiving logic updates inventory movements.

### 9. Satın Alma

Purpose: supplier purchasing, purchase orders, receiving, supplier relationships, and purchasing reports.

Submodules and pages:

- Satın Alma Paneli
  - current route: `/purchasing`
  - status: exists
- Satın Alma Siparişleri
  - current routes: `/purchase-orders`, `/purchase-orders/:id`
  - status: exists
- Tedarikçiler
  - current route: `/tedarikciler`
  - status: exists
- Teslim Alma
  - current status: item receive helper exists through `receivePurchaseOrderItem`
  - proposed route: `/apps/purchasing/teslim-alma`
- Satın Alma Raporları
  - current route: `/reports`
  - status: generic reports exist

Tables:

- `purchase_orders`
- `purchase_order_items`
- `stakeholders`
- `inventory_items`
- `inventory_movements`
- `erp_audit_logs`
- `erp_notifications`

Reuse:

- `listPurchaseOrders`, `createPurchaseOrder`, `updatePurchaseOrder`
- `listPurchaseOrderItems`, `createPurchaseOrderItem`
- `receivePurchaseOrderItem`.

### 10. Üretim

Purpose: production planning, work orders, routes, operations, subcontracting, and shop-floor readiness.

Submodules and pages:

- Üretim Paneli
  - current route: `/production`
  - status: exists
- İş Emirleri
  - current routes: `/work-orders`, `/work-orders/:id`
  - status: exists
- Operasyonlar
  - current status: embedded inside work order operations
  - proposed route: `/apps/production/operasyonlar`
- Rotalar
  - current route: `/routes`
  - status: exists
- Fason İşler
  - current routes: `/subcontracting`, `/subcontracting/:id`
  - status: exists
- Dişli Hesaplama
  - current route: `/calculator`
  - status: exists

Tables:

- `sales_orders`
- `work_orders`
- `work_order_operations`
- `production_routes`
- `production_route_steps`
- `machines`
- `subcontracting_jobs`
- `quality_reports`
- `employee_time_entries`
- `documents`

Reuse:

- `createWorkOrderFromSalesOrder`
- `createOperationsFromRoute`
- `updateWorkOrderOperationStatus`
- existing calculator routes.

### 11. Kalite Yönetimi

Purpose: quality reports, measurements, inspection status, and production release quality checks.

Submodules and pages:

- Kalite Raporları
  - current routes: `/quality`, `/quality/:id`
  - status: exists
- Ölçümler
  - current status: quality measurements API exists; UI appears inside detail workflow
  - proposed route: `/apps/quality/olcumler`
- Bekleyen Kontroller
  - current route: `/work-orders`
  - status: derived from work order status; dedicated screen missing
- Kalite Belgeleri
  - current route: `/documents`
  - status: exists

Tables:

- `quality_reports`
- `quality_measurements`
- `work_orders`
- `sales_orders`
- `employees`
- `documents`

Reuse:

- `listQualityReports`, `createQualityReport`, `updateQualityReport`
- `listQualityMeasurements`, `createQualityMeasurement`.

### 12. Bakım Yönetimi

Purpose: planned machine maintenance, failure tasks, responsible employee, and maintenance status.

Submodules and pages:

- Bakım Görevleri
  - current route: `/maintenance`
  - status: exists
- Makineler
  - current route: `/routes` as temporary machine-connected area
  - status: machines table exists; dedicated machine page missing
- Bakım Planı
  - proposed route: `/apps/maintenance/plan`
  - status: missing
- Arıza Kayıtları
  - proposed route: `/apps/maintenance/arizalar`
  - status: partially represented by maintenance task type/status; dedicated screen missing

Tables:

- `maintenance_tasks`
- `machines`
- `employees`
- `documents`

Reuse:

- `listMaintenanceTasks`, `createMaintenanceTask`, `updateMaintenanceTask`
- machine references from production routes.

### 13. Tamir Yönetimi

Purpose: repair work intake, repair work orders, post-repair quality, and repair-related maintenance records.

Submodules and pages:

- Tamir İş Emirleri
  - current route: `/work-orders`
  - status: reused production work orders
- Bakım ve Arıza
  - current route: `/maintenance`
  - status: reused maintenance tasks
- Kalite Kontrol
  - current route: `/quality`
  - status: reused quality reports
- Tamir Kabul
  - proposed route: `/apps/repair/kabul`
  - status: missing
- Tamir Raporları
  - proposed route: `/apps/repair/raporlar`
  - status: missing

Tables:

- `work_orders`
- `maintenance_tasks`
- `quality_reports`
- `quality_measurements`
- `stakeholders`
- `documents`

Reuse:

- Do not create duplicate repair tables initially.
- Use work order type/category if future schema adds classification.

### 14. İnsan Kaynakları

Purpose: employee records, time entries, documents, assignments, and future HR processes.

Submodules and pages:

- Personeller
  - current route: `/hr`
  - status: exists
- Çalışma Süreleri
  - current route: `/time-entries`
  - status: exists
- İzin Yönetimi
  - proposed route: `/apps/hr/izinler`
  - status: missing
- İşe Alım
  - proposed route: `/apps/hr/ise-alim`
  - status: missing
- Performans
  - proposed route: `/apps/hr/performans`
  - status: missing
- Personel Belgeleri
  - proposed route: `/apps/hr/belgeler`
  - status: can reuse `documents`; dedicated screen missing

Tables:

- `employees`
- `employee_time_entries`
- `employee_assets`
- `documents`
- `work_order_operations`
- future: leave requests, recruitment candidates, performance reviews

Reuse:

- `listEmployees`, `createEmployee`, `updateEmployee`
- `listEmployeeTimeEntries`, `createEmployeeTimeEntry`.

### 15. Raporlar

Purpose: management KPIs, finance, production, inventory, purchasing, quality, maintenance, and audit summaries.

Submodules and pages:

- Yönetim Raporları
  - current route: `/reports`
  - status: exists
- Finans Raporları
  - current route: `/finans/raporlar`
  - status: exists
- Üretim Raporları
  - proposed route: `/apps/reports/uretim`
  - status: partially covered by `/reports`
- Stok Raporları
  - proposed route: `/apps/reports/stok`
  - status: partially covered by `/reports`
- Kalite Raporları
  - current route: `/quality`
  - status: operational list exists
- Denetim Kayıtları
  - proposed route: `/apps/reports/denetim`
  - status: API exists; dedicated report screen missing

Tables:

- `sales_orders`
- `work_orders`
- `inventory_items`
- `inventory_movements`
- `purchase_orders`
- `quality_reports`
- `maintenance_tasks`
- `shipments`
- `financial_accounts`
- `erp_audit_logs`
- `erp_notifications`

Reuse:

- `getERPReportSummary`
- `getERPDashboardMetrics`
- `getERPDashboardActivity`
- `listRecentAuditLogs`.

### 16. Ayarlar

Purpose: ERP configuration, auth status, database readiness, numbering, permissions, and technical administration.

Submodules and pages:

- ERP Ayarları
  - current routes: `/settings`, `/ayarlar`
  - status: exists
- Veritabanı Durumu
  - current route: `/dashboard`
  - status: `ERPDatabaseStatusWidget` exists
- Kullanıcılar ve Roller
  - proposed route: `/apps/settings/kullanicilar`
  - status: tables exist; dedicated management screen missing
- Numaralandırma
  - proposed route: `/apps/settings/numaralandirma`
  - status: table/function exists; screen missing
- SQL Düzenleyici
  - current route: `/admin/sql-editor`
  - status: legacy technical screen exists

Tables:

- `settings`
- `allowed_emails`
- `admin_users`
- `erp_users`
- `erp_number_sequences`
- `erp_audit_logs`
- `erp_notifications`

Reuse:

- `getERPDatabaseStatus`
- `getCurrentERPUser`
- `getNextERPNumber`.

## Route Architecture

Current ERP entry routes:

- `/login`: ERP login, redirects successful auth to `/apps`
- `/apps`: ERP application hub
- `/apps/:appId`: ERP application shell
- `/admin/*`: legacy admin route family, protected and retained
- `/dashboard`: ERP dashboard
- `/*`: ERP module route owner through `ERPRoutes`

Current ERP module routes:

- CRM/cari: `/crm`, `/musteriler`, `/tedarikciler`, `/stakeholders/:id`
- Sales: `/teklifler`, `/teklifler/yeni`, `/siparisler`, `/siparisler/:id`, `/sales-orders`, `/sales-orders/:id`
- Finance/accounting: `/finans`, `/finans/hareketler`, `/finans/hareketler/yeni`, `/finans/hareketler/:id`, `/finans/odemeler`, `/finans/cekler`, `/finans/raporlar`, `/finance`, `/invoices`, `/payments`
- Production: `/production`, `/work-orders`, `/work-orders/:id`, `/routes`, `/subcontracting`, `/subcontracting/:id`, `/calculator`
- Inventory/purchasing: `/inventory`, `/inventory/:id`, `/inventory-movements`, `/purchasing`, `/purchase-orders`, `/purchase-orders/:id`
- HR: `/hr`, `/time-entries`
- Logistics: `/logistics`, `/shipments/:id`
- Quality/maintenance: `/quality`, `/quality/:id`, `/maintenance`
- Documents/notifications/reports/settings: `/documents`, `/notifications`, `/reports`, `/settings`, `/ayarlar`, `/bildirimler`, `/gorevler`, `/notlar`

Recommended route direction:

- Keep `/apps` and `/apps/:appId` as shell routes.
- Attach future submodule pages below application shells only when they need a distinct IA-owned screen.
- Keep existing operational routes as canonical until a migration plan exists.
- Avoid duplicating existing data screens under new paths without redirects or shared components.

## Supabase Table Mapping

| Area | Tables |
| --- | --- |
| Auth and access | `settings`, `allowed_emails`, `admin_users`, `erp_users` |
| Website and catalog | `products`, `product_images`, `documents`, `settings` |
| E-commerce | `products`, `product_images`, `orders`, `order_items`, `order_counter` |
| CRM/cari | `stakeholders`, `parties`, `party_notes`, `financial_transactions`, `payment_documents`, legacy `customer_profile`, legacy `customers_full` |
| Sales | `quotations`, `erp_quotation_links`, `sales_orders`, `sales_order_items`, `stakeholders` |
| Production | `machines`, `production_routes`, `production_route_steps`, `work_orders`, `work_order_operations`, `subcontracting_jobs` |
| Inventory | `inventory_items`, `inventory_movements`, `products`, `purchase_order_items`, `sales_order_items` |
| Purchasing | `purchase_orders`, `purchase_order_items`, `stakeholders`, `inventory_items`, `inventory_movements` |
| Finance/accounting | `financial_accounts`, `invoices`, `payments`, `financial_transactions`, `payment_documents`, `parties`, `stakeholders` |
| HR | `employees`, `employee_time_entries`, `employee_assets` |
| Logistics | `shipments`, `shipment_items`, `sales_orders`, `stakeholders` |
| Quality | `quality_reports`, `quality_measurements`, `work_orders`, `sales_orders`, `employees` |
| Maintenance/repair | `maintenance_tasks`, `machines`, `employees`, `work_orders`, `quality_reports` |
| Documents | `documents` |
| Notifications and audit | `erp_notifications`, `erp_audit_logs` |
| Numbering | `erp_number_sequences` |
| Reports | read-only summaries across ERP operational tables |

## Implementation Status Matrix

| Application | Current status | Primary existing routes | Primary reusable implementation |
| --- | --- | --- | --- |
| Web Sitesi | Partial | `/admin/urunler`, `/documents`, `/dashboard` | legacy admin catalog, ERP documents |
| E-Ticaret | Partial | `/admin/siparisler`, `/admin/urunler`, public shop routes | `src/features/shop/api.ts`, legacy admin tables |
| Müşteri İlişkileri | Implemented baseline | `/crm`, `/musteriler`, `/tedarikciler` | stakeholder and party services |
| Satış | Implemented baseline | `/teklifler`, `/teklifler/yeni`, `/siparisler` | quotation and sales order API |
| Faturalama | Partial | `/invoices`, `/payments` | invoice/payment API |
| Muhasebe | Implemented baseline | `/finans/*` | finance service and finance components |
| Gider Yönetimi | Partial | `/payments`, `/finans/hareketler/yeni`, `/reports` | finance/payment API |
| Stok Yönetimi | Implemented baseline | `/inventory`, `/inventory-movements` | inventory API |
| Satın Alma | Implemented baseline | `/purchasing`, `/purchase-orders` | purchasing API |
| Üretim | Implemented baseline | `/production`, `/work-orders`, `/routes`, `/subcontracting`, `/calculator` | production/work order API |
| Kalite Yönetimi | Implemented baseline | `/quality` | quality API |
| Bakım Yönetimi | Implemented baseline | `/maintenance` | maintenance API |
| Tamir Yönetimi | Architecture only | `/work-orders`, `/maintenance`, `/quality` | reused production/maintenance/quality |
| İnsan Kaynakları | Implemented baseline | `/hr`, `/time-entries` | employee API |
| Raporlar | Implemented baseline | `/reports`, `/finans/raporlar` | report summary APIs |
| Ayarlar | Partial | `/settings`, `/ayarlar`, `/admin/sql-editor` | settings/database/user helpers |

## Missing Modules Matrix

| Application | Missing or incomplete modules |
| --- | --- |
| Web Sitesi | SEO, forms, dynamic content management, public media library |
| E-Ticaret | categories screen, campaigns, customer commerce profile, order detail workflow |
| Müşteri İlişkileri | leads, opportunities, activities, contact person management |
| Satış | sales reports, customer sales history, approval workflow |
| Faturalama | invoice detail, invoice PDF/send flow, invoice-to-payment reconciliation |
| Muhasebe | account chart, cash/bank detail, reconciliation, official accounting export |
| Gider Yönetimi | expense documents, expense categories, approval workflow |
| Stok Yönetimi | critical stock page, warehouse locations, reservations, production consumption |
| Satın Alma | receiving screen, supplier price history, purchase reports |
| Üretim | operation board, capacity planning, BOM/material planning |
| Kalite Yönetimi | measurement dashboard, nonconformance workflow, calibration tracking |
| Bakım Yönetimi | machine registry page, maintenance calendar, failure classification |
| Tamir Yönetimi | repair intake, repair quote/order type, repair reports |
| İnsan Kaynakları | leave management, recruitment, performance, HR documents |
| Raporlar | dedicated module reports, audit report UI, export scheduling |
| Ayarlar | user/role management, numbering management, permission matrix UI |

## Legacy Feature Mapping

| Legacy feature | Current location | Target IA owner |
| --- | --- | --- |
| Admin product catalog | `/admin/urunler` | Web Sitesi and E-Ticaret |
| Admin shop orders | `/admin/siparisler` | E-Ticaret |
| Admin quotations | `/admin/teklifler` | Satış, with preference for `/teklifler` |
| Admin media | `/admin/medya` | Web Sitesi and Dokümanlar |
| Admin finance summary | `/admin/finans` | Muhasebe and Raporlar |
| Admin operations summaries | `/admin/uretim`, `/admin/stok`, `/admin/kalite`, `/admin/cariler` | ERP-native module dashboards |
| SQL editor | `/admin/sql-editor` | Ayarlar technical administration |
| Legacy customer tables | `customer_profile`, `customers_full` | Müşteri İlişkileri import/compatibility layer |
| Public shop API | `src/features/shop/api.ts` | E-Ticaret |
| Quotation builder | `src/features/quotation` | Satış |
| Calculator | `src/calculator` | Üretim |
| Kargo page | `/kargo` | Logistics/sevkiyat support, currently outside app catalog |

## ERP Consistency Notes

- Application and module names in the ERP registry are Turkish.
- Existing user-facing ERP labels are mostly Turkish after Phases 1-3.
- Technical URL paths can remain English while visible labels stay Turkish.
- Code identifiers, table names, comments, docs, and commit messages remain English as requested.

## Risks

- `/admin` still owns product, order, media, and SQL/editor functionality. This is intentional preservation, but it keeps legacy routing alive.
- There are two finance/cari models: newer ERP tables (`stakeholders`, `financial_accounts`, `invoices`, `payments`) and older cari tables (`parties`, `financial_transactions`, `payment_documents`). Future work must choose ownership boundaries carefully.
- `orders` and `sales_orders` represent different flows. E-commerce order conversion to ERP sales order is not yet fully formalized.
- `products` and `inventory_items` overlap conceptually. Catalog product and stock item ownership should remain separate until a linking model is designed.
- Some migrations are named as later phases, but they are already present locally. The architecture should map to actual tables rather than phase names.
- Supabase RLS and Data API exposure must be verified before expanding module writes.

## Recommendations

- Keep `/apps` as the only ERP home and use application shells as the navigation starting point.
- Build future screens as shared components mounted from canonical ERP routes, then link from application shells.
- Avoid creating new tables for missing modules until existing tables are proven insufficient.
- Introduce explicit relationships before cross-domain automation:
  - e-commerce `orders` -> ERP `sales_orders`
  - `products` -> `inventory_items`
  - repair intake -> `work_orders`
  - expense documents -> `payments`/`financial_transactions`/`documents`
- Convert remaining `/admin` pages into ERP-native wrappers before deleting legacy routes.
- Create a permission matrix document before implementing role-based visibility.

## Proposed Phase 5 Scope

Recommended Phase 5: ERP-native module wrappers for remaining legacy admin dependencies.

Scope:

- Create ERP-native product/catalog wrapper that reuses existing product admin logic.
- Create ERP-native e-commerce order wrapper that reuses existing order admin logic.
- Create ERP-native media/document wrapper that routes through `documents`.
- Add architecture-only redirect strategy from `/admin/*` to ERP-owned routes where safe.
- Do not delete `/admin/*` yet.
- Do not add role filtering yet.
- Continue Turkish UI audit for deep module screens.

## Validation

- `npm run build` must pass before commit.
