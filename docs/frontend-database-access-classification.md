# Frontend Database-Access Classification (Phase 5C)

Scope: all `.from("<table>")` access from `src/**` (84 distinct tables, counted 2026-08-25).
Boundary principle: **the browser may read/write what RLS can make safe (A/B). Anything privileged, authoritative-financial, or transactional (C/D/E) belongs behind a service layer** — an Edge Function or a server module composed there.

Verified boundary that already holds: **zero** `.from("parasut…")` calls in `src/**`. The Paraşüt mirror and the authoritative customer statement are reachable only through the `parasut-api` Edge Function. This is enforced by convention + tests on the backend side; Phase 15 adds a frontend-side guard.

## Categories

| Cat | Definition | Policy |
|---|---|---|
| A | Catalog/CMS reads, own-session reads; strong RLS; worst case = stale/wrong UI text | Keep in browser |
| B | Business-critical CRUD of the tenant's own operational rows; RLS-scoped; correctness matters but no cross-table atomicity | Keep, migrate gradually to feature APIs (already the pattern) |
| C | Privileged administration (users, memberships, platform ops) | Move behind service layer before any multi-admin rollout |
| D | Financial-authoritative / Paraşüt data | Forbidden from browser — verified 0 today |
| E | Cross-table transactional workflows | Must run in one place with rollback (Edge Function); browser calls the workflow, not the tables |

## Classification of all 84 tables

### A — keep in browser (reads, catalog/CMS/public)
website_pages(4), website_menu_items(4), website_forms(4), website_form_submissions(3), website_seo_settings(3), website_banners(3), website_media_assets(3), shop_categories(5), shop_campaigns(3), settings(2), machines(1), warehouses(3), documents(3), party_notes(1)

### B — keep, feature-API pattern continues (tenant's own operational rows)
work_orders(9), sales_orders(8), sales_order_items(2), production_routes(3), production_route_steps(5), work_order_operations(5), subcontracting_jobs(7), inventory_items(6), inventory_movements(4), shipments(7), shipment_items(2), quality_reports(7), quality_measurements(2), maintenance_tasks(5), purchase_orders(7), purchase_order_items(3), crm_leads(5), crm_opportunities(4), crm_tasks(3), crm_activities(2), employees(3), employee_time_entries(2), hr_departments(3), hr_positions(3), hr_leave_requests(3), hr_onboarding_tasks(3), hr_recruitment_candidates(3), parties(6), quotes(7), quote_lines(3), quote_customers(2), quote_history_entries(2), products(6)

### C — privileged: service-layer candidates (deferred until multi-admin is real)
erp_users(6) — browser currently resolves its own user row (read) via shared/auth.ts ✓; admin writes exist only inside dead admin suite → dies with Phase 11
company_memberships(4), companies(3), company_branches(3) — same: live code only reads scope context; writers are admin-suite-only
platform_metrics(2)/events(2)/alerts(4), scheduled_job_runs(3), automation_rules(2)/executions(3) — consumed by erpApi platform section = admin-suite-only → dies with Phase 11

### D — financial/Paraşüt authoritative
parasut.* schema — **0 browser references (verified)**. Authoritative statements flow exclusively: browser → `parasut-api` (`fetchAuthoritativeStatement`, fail-closed) → screen/print parity.

Local financial tables touched from the browser: invoices(3), payments(3), financial_accounts(3), financial_transactions(5), accounting_entries(1), payment_refund_operations(2), payment_provider_events/health/reconciliation_logs(1 each).
These are ERP-local ledgers (NOT the Paraşüt mirror). They stay B-class for now under two hard conditions, re-audited each phase:
1. No browser code computes balances presented as authoritative without going through the authoritative path (customer statements already do; finance screens show ERP-local records).
2. Any future change that turns these into balance-of-record writes must move to C/E first.

### E — transactional workflows (must be single-writer)
orders(8)+order_items(4): checkout path already goes through `commerce-checkout` Edge Function (validate → reserve → create → rollback). The browser `orders` hits that remain are read paths + the dead shop UI (flag OFF).
convertShopOrderToSalesOrder (erpApi) — multi-table conversion; currently reachable only from dead admin/shop surfaces. When shop goes live it must become an Edge Function first.
payment-create/refund/webhook — already Edge Functions ✓.

## Legacy-generation tables (cross-reference Phase 6/7/8)
quotations(6), customer_profile(1), erp_quotation_links(2) — legacy quote system (orphaned UI, Phase 7)
stakeholders(6) — pre-parties generation (Phase 8)
All legacy reads/writes sit inside features slated for consolidation or removal; no NEW consumers may appear (Phase 15 guard).

## Near-term moves (justified, queued)
None executed in this phase — behavior preservation outranks purity. The classification's immediate effect:
- erpApi.ts's remaining surface shrinks to the dead admin consumer (Phase 11 deletes both together).
- New-feature rule (documented, enforced by review + Phase 15 guards): new table access must be A or go through a service layer.
