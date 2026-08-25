# Database Generation Retirement Plan (Phase 6)

Status: **PLANNING ONLY. No destructive migration may be executed from this document without explicit human sign-off AND a verified staging rehearsal.**

Method per generation: identify canonical → stop new writes to legacy → migrate readers → compatibility views if needed → verify parity → mark deprecated → only then prepare (not execute) a DROP migration.

---

## Generation map

### GEN-CUSTOMER-1 `stakeholders` → canonical: `parties`

| Aspect | Detail |
|---|---|
| Created | ERP core era (`manual/erp_core_schema.sql` era; seed_erp_mock.sql still targets stakeholders) |
| Browser refs | 6 (all inside features slated for consolidation; none in routed public/site code) |
| Reads | admin suite dashboards, legacy import previews (`previewLegacyCustomerImport`), seed |
| Writes | `importLegacyCustomersToStakeholders` (erpApi — admin-suite-only consumer) |
| Production authority | NO — `parties` is declared canonical by `manual/erp_core_schema.sql` ("Legacy customer_full/customers_full tables remain intact") and CRM screens run on parties |
| Replacement | `parties` (+ `party_notes`) with external_source/external_id mapping columns |
| Retirement requirements | 1) prove zero live readers outside dead admin suite (Phase 11 removes them together); 2) reconcile any stakeholder rows absent from parties via one guarded backfill (upsert-only, idempotent); 3) re-point `seed_erp_mock.sql`; 4) then prepare DROP migration |

### GEN-CUSTOMER-0 `customer_full` / `customers_full` / `customer_profile` → canonical: `parties`

| Aspect | Detail |
|---|---|
| Created | Pre-Lovable rebuild era (quotation system used customer_profile) |
| Browser refs | customer_profile ×1 (orphaned quotation feature); customer_full/customers_full ×0 direct — bridged by `services/customerFullService.ts` dual-read with dedupe |
| Writes | customerFullService "sync-to-parties" migration helpers (parties is write target ✓) |
| Production authority | NO |
| Replacement | parties |
| Retirement requirements | Phase 7 removes quotation feature (customer_profile's last reader); customerFullService collapses to parties-only reads; verify parity on the four reconciliation contacts; then DROP migration for all three tables |

### GEN-QUOTE-1 `quotations` family → canonical: `quotes` family

| Aspect | Detail |
|---|---|
| Tables | quotations, quote_lines (legacy sense), quote_customers, quote_history_entries + `erp_quotation_links` bridge |
| Created | Legacy quotation feature (unrouted since the sales-quotes module landed 2026-08-14) |
| Browser refs | quotations ×6, erp_quotation_links ×2 — ALL inside orphaned `features/quotation/**` |
| Writes | none reachable from any route (feature unrouted; verified import graph) |
| Production authority | NO — `sales_quotes_module` migrations (20260814120000+) declare quotes family "entirely local… never written to Parasut", with grants fixed 2026-08-15 and number sequences via security-definer |
| Historical data | MUST BE PRESERVED. Old quotations may reference real customers/deals. Never dropped blindly. |
| Replacement | quotes/quote_lines/quote_customers/quote_history_entries (+ next_quote_number security-definer) |
| Retirement requirements | 1) Phase 7 deletes orphaned UI; 2) data archival decision by business owner (export to storage bucket vs keep tables read-only); 3) sales_orders.source_quotation_id still references old quotations → column must be kept or backfilled to new ids BEFORE any drop; 4) DROP migration prepared for review only |

### GEN-SHOP `orders` vs GEN-ERP `sales_orders` — NOT duplicates

`orders` = storefront checkout orders (commerce-checkout/webhooks/payment-*). `sales_orders` = ERP production orders. Different lifecycles; commerce-checkout rollback deletes both only because an order creates a linked sales_order. **No consolidation planned.** Documented here to prevent a future "cleanup" from merging them.

### GEN-PARASUT-1 `public.parasut_*` → canonical: schema `parasut` (Phase 13)

| Aspect | Detail |
|---|---|
| Created | 20260613194043 (public mirror gen-1) |
| Superseded by | 20260713120000 (dedicated `parasut` schema, "does not depend on any public.parasut_* tables"); integration.sync_runs moved 20260716090000 |
| Readers/writers | NONE in current engine (parasut-sync-run imports were rewritten onto the new schema; no-unbounded-select allowlist references only parasut-schema paths) |
| Dropped? | NEVER dropped in any migration — dead duplicate tables persist in prod |
| Retirement requirements | Phase 13 verification checklist before preparing (NOT executing) the drop |

### AUTH generations (already resolved)
admin_users / allowed_emails / is_email_allowed → replaced by erp_users + private.erp_user_has_any_permission (20260614061645), legacy tables dropped FAIL-CLOSED in 20260614064406, phase-25 policies rewritten. Closed.

---

## Execution order (when approved)

1. **Phase 11 first** (dead-code removal): eliminates the last readers of stakeholders-platform surfaces and the entire legacy quotation UI. Re-run the browser-reference counts in this document afterwards.
2. **GEN-QUOTE-1 archival**: business owner confirms retention approach; export if required.
3. **GEN-CUSTOMER backfill parity check**: row-level diff stakeholders↔parties on dev restore; upsert-only reconciliation script under `scripts/` with dry-run default.
4. **Prepare migration files** `2026MMDD000000_retire_public_parasut_gen1.sql` (Phase 13) and quote/stakeholder retirements — each with: pre-condition DO-block asserting zero dependencies (pg_depend/policies/RPCs), archive-to-side-table step, and the DROP guarded behind that assertion.
5. **Never auto-apply**: these files stay in `supabase/migrations/` unapplied until a signed-off staging→prod window (see deployment-and-rollback.md).

## Parity verification requirements (before ANY drop)
- Row counts equal between legacy and canonical (or documented delta = archived rows).
- For customers: trl_balance-bearing entities reconciled to the cent against the authoritative Paraşüt statement path for the 4 golden contacts + spot-checked sample.
- For quotes: every historical quotation number resolvable (print/PDF regeneration must not 404).
