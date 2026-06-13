# DAYAN DISLI ERP — ENGINEERING CONSTITUTION

Version: 1.1

This document defines the permanent engineering rules for DAYAN DISLI ERP.

All developers, AI agents, Codex sessions, and automation tools MUST strictly follow this constitution.

Violation of this document is considered an architectural defect.

---

# 1. PROJECT PRINCIPLES

DAYAN DISLI ERP is a long-term industrial ERP platform for gear manufacturing and machining operations.

The primary goals are:

* Stability
* Scalability
* Maintainability
* Auditability
* Clear domain boundaries
* Zero duplicate business records
* Educational architecture clarity

The project must also teach how frontend, backend, database tables, APIs, migrations, and integrations work together.

---

# 2. DEVELOPMENT ORDER

NEVER start with frontend.

Every feature MUST follow this order:

1. Business Analysis
2. Domain Selection
3. Database Design
4. Migration
5. RLS Design
6. API Implementation
7. Frontend Implementation
8. Testing
9. Demo Validation

Frontend-first development is forbidden.

---

# 3. DATABASE RULES

Database is the single source of truth.

Schema changes MUST be implemented through migrations.

Never modify production schema manually from dashboard.

Always use:

migration → commit → deploy

Migration-first development is mandatory.

---

# 4. PRODUCTION MODEL

The current environment is considered:

LIVE DEVELOPMENT ENVIRONMENT

Production modifications are allowed.

However destructive operations require explicit approval.

---

# 5. DESTRUCTIVE OPERATIONS

The following actions REQUIRE owner approval:

* DROP TABLE
* DROP COLUMN
* TRUNCATE TABLE
* Unfiltered DELETE
* Disabling RLS
* Irreversible migrations
* Large data migrations

Default behavior:

Prefer additive changes over destructive changes.

---

# 6. ZERO DOWNTIME PRINCIPLE

Schema changes should be backward compatible whenever possible.

Preferred sequence:

nullable
→ backfill
→ not null

Avoid breaking changes.

---

# 7. PARASUT INTEGRATION RULES

Paraşüt integration is READ-ONLY.

Allowed:

* OAuth authentication
* Token refresh
* GET requests
* Read-only discovery
* Read-only mirror import
* Sanitized sample generation
* Local analysis

Forbidden unless the owner explicitly changes this constitution:

* POST to Paraşüt
* PUT to Paraşüt
* PATCH to Paraşüt
* DELETE to Paraşüt
* Creating contacts in Paraşüt
* Updating contacts in Paraşüt
* Creating invoices in Paraşüt
* Updating invoices in Paraşüt
* Creating payments in Paraşüt
* Updating payments in Paraşüt
* Any Paraşüt write operation

Paraşüt is the official accounting source.

DAYAN DISLI ERP is the operational, analytical, and extended business system.

Sync direction:

Paraşüt → DAYAN ERP only.

---

# 8. PARASUT MIRROR LAYER

Paraşüt data MUST first be stored in mirror tables.

Mirror tables must preserve Paraşüt structure as closely as possible.

Examples:

* parasut_contacts
* parasut_products
* parasut_sales_invoices
* parasut_sales_invoice_details
* parasut_purchase_bills
* parasut_purchase_bill_details
* parasut_payments
* parasut_accounts
* parasut_warehouses
* parasut_categories
* parasut_tags

Mirror tables are not ERP business-domain tables.

Mirror tables represent external source data.

ERP business logic must not be forced into Paraşüt mirror tables.

Each mirror table should generally contain:

* id
* parasut_id
* parasut_company_id
* resource_type
* attributes jsonb
* relationships jsonb
* included jsonb
* raw_payload jsonb
* source_created_at
* source_updated_at
* synced_at
* payload_hash
* created_at
* updated_at

The exact columns may be adjusted after inspecting official Paraşüt resource structures.

---

# 9. ERP DOMAIN LAYER

ERP domain tables are separate from Paraşüt mirror tables.

ERP domain tables represent DAYAN DISLI business reality.

ERP may contain:

* official records from Paraşüt
* unofficial customer records
* internal operational records
* manufacturing records
* production records
* non-accounting financial analysis
* custom reports
* ERP-only metadata

ERP domain examples:

* stakeholders
* sales_orders
* production_orders
* inventory_items
* financial_movements
* quality_records
* subcontracting_records

External system mirror tables preserve external system structure.

ERP domain tables preserve ERP business structure.

---

# 10. OFFICIAL AND UNOFFICIAL DATA RULE

Paraşüt records are official records.

ERP may also contain unofficial records.

Official Paraşüt records should be marked as:

* source_system = parasut
* official_record = true
* external_id = Paraşüt resource ID

ERP-created internal records may be marked as:

* source_system = internal
* official_record = false
* external_id = null

ERP is the superset.

Paraşüt is only one official subset.

---

# 11. DOMAIN API ARCHITECTURE

The following architecture MUST be preserved:

* crmApi.ts
* salesApi.ts
* inventoryApi.ts
* productionApi.ts

erpApi.ts exists only as a compatibility facade.

New business logic SHOULD NOT be added to erpApi.ts.

Paraşüt HTTP operations must live in a dedicated server-side integration adapter.

Browser code must never access Paraşüt credentials.

---

# 12. AUTHENTICATION ARCHITECTURE

The authentication flow MUST remain:

ERPAuthProvider
→ ProtectedRoute
→ Domain APIs
→ Supabase

Do not bypass authentication.

Do not bypass permission checks.

---

# 13. TYPESCRIPT QUALITY

TypeScript errors allowed:

0

Build status:

PASSING

CI status:

PASSING

No feature may degrade system quality.

---

# 14. TESTING RULES

Every feature SHOULD include:

* Unit tests
* Integration tests when required
* Regression tests when required

Existing tests must not break.

---

# 15. CRM MASTER DATA RULES

Partner records are the master data of CRM.

A company may simultaneously be:

* Customer
* Supplier
* Subcontractor

Duplicate company records are forbidden.

Example:

ABC Steel Ltd.

is_customer = true
is_supplier = true

This must remain a single company record.

---

# 16. CRM NAVIGATION

CRM consists of three primary categories:

1. Partners
2. Customers
3. Suppliers

Turkish UI labels:

1. Paydaşlar
2. Müşteriler
3. Tedarikçiler

Definitions:

Partners:
All companies.

Customers:
Partners where is_customer = true.

Suppliers:
Partners where is_supplier = true.

A company may belong to multiple categories.

---

# 17. ERP DATA OWNERSHIP

Every module must define ownership clearly.

Examples:

CRM owns partners.

Sales references CRM.

Production references Sales.

Inventory references Production.

Paraşüt mirror tables own raw external snapshots only.

ERP domain tables own operational business meaning.

Cross-domain duplication is forbidden.

---

# 18. UI RULES

All user-facing UI MUST be Turkish.

Examples:

* Buttons
* Labels
* Menus
* Validation messages
* Notifications
* Table headers
* Forms
* Empty states
* Error messages

Internal code, comments, migrations, documentation, and prompts MUST be English.

---

# 19. LANGUAGE RULES

Developer prompts:
English only.

Database naming:
English only.

API naming:
English only.

Source code:
English only.

Technical documentation:
English only.

End-user UI:
Turkish only.

---

# 20. CODING STYLE

Prefer:

* Explicit naming
* Small functions
* Reusable components
* Domain separation
* Educational clarity

Avoid:

* Monolithic files
* Hidden side effects
* Duplicate code
* Undocumented assumptions

---

# 21. AI AGENT AUTHORITY

AI agents and Codex are authorized as:

Senior Full Stack Developer
Senior Database Engineer
System Architect
DevOps Engineer

AI agents may:

* Create migrations
* Modify schema
* Create RPCs
* Modify RLS
* Refactor code
* Add tests
* Deploy changes

Subject to this constitution.

Paraşüt write operations remain forbidden.

---

# 22. FINAL RULE

When uncertain:

Database first.

Architecture first.

Business first.

Mirror external systems first.

Frontend last.
