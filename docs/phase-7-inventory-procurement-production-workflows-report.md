# Phase 7 Inventory, Procurement and Production Workflows Report

Date: 2026-06-01  
Scope: operational ERP backbone for inventory, procurement, and production.  
Constraints followed: no permissions phase, no advanced reporting, no AI/automation, no duplicate tables, no fake data.

## Implemented Workflows

### Inventory

Implemented or strengthened operational inventory workflows:

- Product/stock card creation through the existing `inventory_items` table.
- Product/stock card editing on the inventory detail page.
- Product/stock card viewing through list and detail routes.
- Search by code/name.
- Filters by product group, warehouse/location, and stock status.
- Current stock visibility.
- Minimum stock tracking.
- Stock status badges for normal and minimum-below items.
- Product group summary derived from `inventory_items.item_type`.
- Warehouse summary derived from `inventory_items.location`.
- Stock count worklist using current system stock and a link to correction movements.
- Movement history remains available through stock detail and stock movement screens.

### Procurement

Implemented or strengthened procurement workflows:

- Supplier list reusing existing `stakeholders` records with supplier/subcontractor/both types.
- Purchase request worklist derived from inventory items at or below minimum stock.
- Approval-ready purchase request structure using status/readiness indicators without adding permissions.
- Quote collection view using draft purchase orders.
- Purchase order lifecycle view reusing `purchase_orders`.
- Purchase order detail flow still supports line items and receiving.
- Receiving purchase order lines creates stock entry movements through the existing ERP API.
- Supplier performance foundation derived from existing purchase orders.
- Search and status filters on the procurement hub.
- Notes remain on purchase orders and are displayed in quote collection.

### Production

Implemented or strengthened production workflows:

- Production order overview using existing `work_orders`.
- Production planning board for planned, in-progress, quality-waiting, and late work.
- Work center overview using existing `machines`.
- Operation overview using existing `work_order_operations`.
- Production status summary by work order status.
- Production history for completed work orders.
- Work order material consumption foundation using existing `inventory_movements`.
- Production tracking remains tied to operation status updates.

## Screens Created

No brand-new route was created. Existing ERP screens were expanded in place:

- `src/features/erp/inventory/InventoryPage.tsx`
  - Added tabs for products, product groups, warehouses, stock count, and minimum stock levels.

- `src/features/erp/purchasing/PurchasingPage.tsx`
  - Rebuilt as procurement hub with suppliers, purchase requests, quote collection, orders, and supplier performance.

- `src/features/erp/production/ProductionPage.tsx`
  - Rebuilt as production hub with orders, planning, work centers, operations, statuses, and history.

## Screens Reused

- `/inventory`
- `/inventory/:id`
- `/inventory-movements`
- `/purchasing`
- `/purchase-orders`
- `/purchase-orders/:id`
- `/production`
- `/work-orders`
- `/work-orders/:id`
- `/routes`
- `/tedarikciler`
- `/stakeholders/:id`

## Supabase Table Mapping

### Inventory

- `inventory_items`
  - Product cards, product groups via `item_type`, warehouse/location via `location`, current stock, minimum stock.

- `inventory_movements`
  - Stock entry, stock output, return, correction, reservation foundation.
  - Work order consumption uses `source_type = 'work_order'` and `source_id = work_orders.id`.
  - Purchase receiving already uses `source_type = 'purchase_order'`.

### Procurement

- `stakeholders`
  - Supplier records where `type` is `supplier`, `subcontractor`, or `both`.

- `purchase_orders`
  - Purchase request/quote/order lifecycle foundation.
  - Draft records represent quote collection/request-ready state.

- `purchase_order_items`
  - Purchase order line items.
  - Receiving line items creates stock movement entries through existing API logic.

### Production

- `work_orders`
  - Production order lifecycle and status tracking.

- `work_order_operations`
  - Operation tracking and production history.

- `machines`
  - Work centers.

- `production_routes`
  - Route templates.

- `production_route_steps`
  - Operation templates for route application.

- `subcontracting_jobs`
  - Existing production/fason relationship.

- `quality_reports`
  - Existing quality handoff relationship.

## Workflow Diagrams

### Inventory Flow

```text
Stok Kartı
  -> Stok Hareketi
  -> Mevcut Stok Güncellemesi
  -> Minimum Stok Kontrolü
  -> Satın Alma İhtiyacı
```

### Procurement Flow

```text
Minimum Stok İhtiyacı
  -> Satın Alma Talebi Görünümü
  -> Teklif Toplama / Taslak Sipariş
  -> Satın Alma Siparişi
  -> Teslim Alma
  -> Stok Girişi
  -> Stok
```

### Production Flow

```text
Stok
  -> Üretim Emri
  -> Operasyon Takibi
  -> Malzeme Tüketimi
  -> Üretim Durumu
  -> Mamul Stok Hazırlığı
```

### ERP Relationship Flow

```text
Satın Alma
  -> Stok Girişi
  -> Stok

Stok
  -> Üretim Emri
  -> Üretim

Üretim
  -> Mamul Stok
```

## Inventory Flow Details

- Users create stock/product cards in `/inventory`.
- Current stock and minimum stock are visible in list, group, warehouse, and detail views.
- Stock movements are created in `/inventory-movements`.
- Stock count uses the same correction movement path instead of adding a second count model.
- Work order material consumption creates stock output movements tied to the work order.

## Procurement Flow Details

- Suppliers are reused from `stakeholders`.
- Minimum-below inventory items are surfaced as purchase request candidates.
- Draft purchase orders represent quote collection and approval-ready preparation.
- Purchase orders move through the existing status lifecycle:
  - draft
  - sent
  - partially_received
  - received
  - cancelled
- Receiving a purchase order line creates stock entry in `inventory_movements`.

## Production Flow Details

- Production orders reuse `work_orders`.
- Operations reuse `work_order_operations`.
- Work centers reuse `machines`.
- Route templates reuse `production_routes` and `production_route_steps`.
- Material consumption posts `inventory_movements` records with work order source metadata.
- Finished-good stock entry is documented as ready through the same movement structure, but automatic posting is not implemented yet.

## Files Modified

- `src/features/erp/inventory/InventoryPage.tsx`
- `src/features/erp/inventory/InventoryItemForm.tsx`
- `src/features/erp/details/ERPDetailPages.tsx`
- `src/features/erp/purchasing/PurchasingPage.tsx`
- `src/features/erp/production/ProductionPage.tsx`
- `src/features/erp/production/WorkOrderForm.tsx`
- `src/features/erp/production/WorkOrderOperations.tsx`
- `src/features/erp/production/WorkOrdersPage.tsx`
- `docs/phase-7-inventory-procurement-production-workflows-report.md`

## Remaining Gaps

- Purchase requests do not yet have a dedicated table; they are currently derived from minimum stock.
- Quote collection does not yet support multiple supplier offers per request.
- Supplier performance is derived from purchase order status, not delivery scoring or quality scoring.
- Stock count does not yet have count sessions, count approvals, or variance reports.
- Multi-warehouse is represented through `inventory_items.location`, not a dedicated warehouses table.
- Finished-good stock entry is not automatically posted when a work order is completed.
- Material requirements/BOM are not implemented yet.
- Production costing is not implemented yet.
- Lot, serial number, and barcode support are not implemented yet.

## Risks

- Current Supabase generated types are still stale from Phase 6 findings, so ERP APIs continue to rely on casts for many ERP tables.
- Deriving purchase requests from minimum stock is intentionally simple, but a dedicated request table will be needed before approval workflows.
- Work center overview loads operations for the first 50 work orders to avoid heavy unbounded queries in the current API shape.
- Inventory location strings are flexible; inconsistent spelling can split warehouse summaries.
- Automatic mamul stock entry needs a clear business rule before implementation to avoid duplicate stock.

## Recommendations

- Add a real `purchase_requests` table when approval workflows are started.
- Add a `warehouses` table before multi-warehouse transfer workflows.
- Add BOM/material requirement tables before automatic material planning.
- Add finished-good receipt action on work order completion after stock rules are approved.
- Regenerate Supabase types before deeper data-layer refactors.
- Keep `/admin` out of new operational workflow work; continue building under ERP modules.

## Proposed Phase 8 Scope

Recommended Phase 8: operational document depth and controlled workflow transitions.

Suggested scope:

- Dedicated purchase request table and request-to-order conversion.
- Quote comparison records for multiple supplier offers.
- Warehouse master data and warehouse transfer movement.
- Finished-good receipt action from completed work orders.
- Basic BOM/material requirement foundation.
- Stock count session table with variance posting.
- Continue Turkish UI audit.

Deferred beyond Phase 8:

- Role/permission filtering.
- Advanced reporting.
- AI/automation.
- Full production costing.
- Lot/serial/barcode implementation.

## Validation

Command:

```bash
npm run build
```

Result:

- Passed.

Known warnings remain:

- Browserslist/caniuse-lite data is stale.
- `pdfjs-dist` eval warning.
- Main bundle exceeds Vite's 500 kB chunk warning threshold.

