# DAYAN DISLI ERP — ENGINEERING CONSTITUTION

Version: 2.0

This document defines the permanent engineering rules for DAYAN DISLI ERP.

All developers, AI agents, Codex sessions, automation tools, and future integrations MUST strictly follow this constitution.

Violation of this constitution is considered an architectural defect.

---

# 1. PROJECT PRINCIPLES

DAYAN DISLI ERP is a long-term industrial ERP platform for gear manufacturing and machining operations.

Primary goals:

* Stability
* Scalability
* Maintainability
* Auditability
* Clear domain boundaries
* Zero duplicate business records
* Educational architecture clarity

The project must teach:

* Frontend architecture
* Backend architecture
* Database design
* API design
* Integration patterns
* Testing strategies
* Deployment strategies

---

# 2. DEVELOPMENT ORDER

NEVER start with frontend.

Every feature MUST follow:

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

Schema changes MUST use migrations.

Never manually edit production schema.

Always follow:

migration → validate → commit → deploy

Migration-first development is mandatory.

---

# 4. PRODUCTION MODEL

Current environment:

LIVE DEVELOPMENT ENVIRONMENT

Production modifications are allowed.

Destructive operations require owner approval.

---

# 5. DESTRUCTIVE OPERATIONS

Require explicit owner approval:

* DROP TABLE
* DROP COLUMN
* TRUNCATE TABLE
* Unfiltered DELETE
* Disabling RLS
* Irreversible migrations
* Large data migrations

Prefer additive changes.

---

# 6. ZERO DOWNTIME PRINCIPLE

Prefer:

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
* Sanitized analysis

Forbidden:

* POST
* PUT
* PATCH
* DELETE
* Contact creation
* Contact update
* Invoice creation
* Invoice update
* Payment creation
* Payment update
* Any Paraşüt write operation

Sync direction:

Paraşüt → DAYAN ERP only

DAYAN ERP is the superset.

Paraşüt is one official subset.

---

# 8. MIRROR-FIRST ARCHITECTURE

External systems MUST be mirrored first.

ERP domains come later.

Rule:

Mirror first.
ERP later.

Never design ERP around external APIs.

---

# 9. PARASUT MIRROR LAYER

Mirror tables preserve Paraşüt structure.

Mirror tables are NOT ERP domain tables.

Mirror examples:

* parasut_contacts
* parasut_products
* parasut_sales_invoices
* parasut_sales_invoice_details
* parasut_purchase_bills
* parasut_purchase_bill_details
* parasut_payments
* parasut_accounts

Mirror tables own raw snapshots only.

---

# 10. ERP DOMAIN LAYER

ERP domain tables represent business reality.

Examples:

* stakeholders
* sales_orders
* production_orders
* inventory_items
* financial_movements
* quality_records
* subcontracting_records

ERP may contain:

* official records
* unofficial records
* analytics
* custom metadata

---

# 11. OFFICIAL / UNOFFICIAL DATA

Official records:

source_system = parasut
official_record = true

Internal records:

source_system = internal
official_record = false

ERP is always the superset.

---

# 12. DOMAIN API ARCHITECTURE

Preserve:

* crmApi.ts
* salesApi.ts
* inventoryApi.ts
* productionApi.ts

erpApi.ts is compatibility only.

---

# 13. AUTHENTICATION FLOW

Required flow:

ERPAuthProvider
→ ProtectedRoute
→ Domain APIs
→ Supabase

Never bypass authentication.

Never bypass permissions.

---

# 14. TYPESCRIPT QUALITY

Allowed TypeScript errors:

0

CI must remain passing.

Build must remain passing.

---

# 15. TESTING RULES

Every feature should include:

* Unit tests
* Integration tests
* Regression tests

Existing tests must not break.

---

# 16. CRM RULES

A company may be:

* Customer
* Supplier
* Subcontractor

Duplicate companies are forbidden.

---

# 17. DATA OWNERSHIP

CRM owns partners.

Sales references CRM.

Production references Sales.

Inventory references Production.

Mirror tables own external snapshots.

ERP tables own business meaning.

Cross-domain duplication is forbidden.

---

# 18. UI RULES

ALL user-facing UI MUST be Turkish.

Includes:

* Menus
* Buttons
* Forms
* Notifications
* Errors
* Tables
* Empty states

Only frontend UI may be Turkish.

---

# 19. LANGUAGE RULES

English only:

* Prompts
* Code
* Comments
* Documentation
* Result files
* Reports
* QA outputs
* Manifest files
* Console summaries
* AI outputs

Turkish allowed ONLY for:

User-facing frontend UI.

Any Turkish outside UI is a constitution violation.

---

# 20. AI COMMUNICATION MODE

AI responses should be concise.

Avoid unnecessary explanations.

During phase execution:

Review quickly.
Advance quickly.

---

# 21. MICRO-PHASE STRATEGY

Prefer micro-phases.

Target:

* 5–10 files
* Single architectural goal
* 5–15 minutes runtime

Large phases should be split:

Phase 4A
Phase 4B
Phase 4C

etc.

---

# 22. PHASE GOVERNANCE

Every phase must have:

* Objective
* Scope
* Validation
* Result file
* Export folder
* Manifest

---

# 23. PHASE COMPLETION CRITERIA

A phase is incomplete if:

* Documentation missing
* Result file missing
* Validation missing
* Export missing
* Manifest missing

---

# 24. PHASE RESULT FILES

Each phase MUST create:

docs/phase-results/PHASE_X_RESULT.md

Without result file:

Phase is incomplete.

---

# 25. FLAT EXPORT RULE

Export folder must be flat.

No subdirectories allowed.

Repository paths become filenames:

docs/file.md

becomes

docs__file.md

---

# 26. CURRENT PHASE DELTA EXPORT

Export ONLY files created or modified during the current phase.

Repository-wide git diff export is forbidden.

Previous phase files must not be exported unless modified again.

---

# 27. EXPORT LOCATION

Default export path:

C:\Users\Bediz\Desktop\dayandisli_diff_files_all\phase_X

Each phase gets its own folder.

---

# 28. MANIFEST RULES

Each export folder must contain:

_MANIFEST.md

Must include:

* Phase name
* Export path
* Exported files
* Original paths
* Reasons
* Validation results
* Safety confirmation

---

# 29. SECRET SAFETY

Never export:

* .env
* tokens
* passwords
* API keys
* service-role keys

Never print secrets.

---

# 30. LOCAL-FIRST VALIDATION

Always validate locally first.

Never validate against production first.

Reject production automatically when required.

---

# 31. PRODUCTION SAFETY

Production reference:

meauutjsnnggzcigyvfp

Production name:

dayandisli.com

When local validation is required:

Production access must be rejected.

---

# 32. HUMAN APPROVAL GATES

Owner approval required for:

* destructive operations
* production-impacting changes
* external write integrations

---

# 33. PHASE AUTOMATION READINESS

Future automation should support:

* phase runner
* result generation
* QA generation
* export generation

Automation must preserve this constitution.

---

# 34. AI AGENT AUTHORITY

AI agents act as:

* Senior Full Stack Developer
* Senior Database Engineer
* System Architect
* DevOps Engineer

Subject to this constitution.

---

# 35. FINAL RULE

When uncertain:

Database first.

Architecture first.

Business first.

Mirror external systems first.

Frontend last.
