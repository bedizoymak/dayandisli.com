# Phase 11 HR and Organization Foundation Report

## Objective

Phase 11 builds the HR and organization foundation that will later support department permissions, employee records, attendance, leave, onboarding, and user-to-employee relationships.

The implementation extends the existing ERP HR model instead of creating a second employee or authentication model.

## HR Architecture

The HR foundation now uses one operational HR surface with Turkish tabs:

- Çalışanlar
- Departmanlar
- Pozisyonlar
- Devam Takibi
- İzin Yönetimi
- İşe Alım
- Oryantasyon

Implemented in:

- `src/features/erp/hr/EmployeesPage.tsx`

The page loads all HR foundation data together so employee, department, position, manager, ERP user, leave, candidate, and onboarding relationships can be viewed from one coherent HR workspace.

## Organization Structure

New organization tables:

- `hr_departments`
- `hr_positions`

Department foundation:

- Department name and code
- Parent department relationship
- Department manager relationship
- Active/passive status
- Notes

Position foundation:

- Position title and code
- Department linkage
- Reports-to position relationship
- Active/passive status
- Notes

This prepares future department permissions, organization charts, reporting paths, and approval routing.

## Employee Records

The existing `employees` table is reused and extended.

Supported in the UI:

- Create employee
- View employee list
- Search employees
- Filter by status
- Employee status changes
- Department linkage
- Position linkage
- Manager linkage
- ERP user linkage foundation

Added employee fields in the migration:

- `employee_no`
- `status`
- `department_id`
- `position_id`
- `manager_employee_id`
- `erp_user_id`

The old text fields `department` and `role` remain for compatibility with existing screens and data.

## Attendance and Leave Foundation

Attendance:

- Reuses existing `employee_time_entries`
- Supports employee, date, regular hours, overtime hours, and notes
- Displayed under `Devam Takibi`

Leave:

- Adds `hr_leave_requests`
- Supports employee, leave type, date range, status, approver foundation, and notes
- Statuses are approval-ready: draft, pending, approved, rejected, cancelled

No advanced approval chain was implemented in this phase.

## Recruitment and Onboarding

Recruitment:

- Adds `hr_recruitment_candidates`
- Supports candidate contact data, department, position, source, status, and notes
- Statuses: new, screening, interview, offer, hired, rejected

Onboarding:

- Adds `hr_onboarding_tasks`
- Supports employee or candidate linkage, responsible employee, due date, status, and notes
- Statuses: open, in progress, completed, cancelled

## Supabase Table Mapping

Existing tables reused:

- `employees`
- `employee_time_entries`
- `erp_users`

New tables:

- `hr_departments`
- `hr_positions`
- `hr_leave_requests`
- `hr_recruitment_candidates`
- `hr_onboarding_tasks`

Migration created:

- `supabase/migrations/20260601143710_phase11_hr_organization_foundation.sql`

API helpers added in:

- `src/features/erp/shared/erpApi.ts`

Types added in:

- `src/features/erp/shared/types.ts`

## Screens Implemented

HR application registry now exposes:

- Çalışanlar
- Departmanlar
- Pozisyonlar
- Devam Takibi
- İzin Yönetimi
- İşe Alım
- Oryantasyon
- Çalışma Süreleri

Routes added:

- `/hr`
- `/hr/departmanlar`
- `/hr/pozisyonlar`
- `/hr/devam`
- `/hr/izinler`
- `/hr/ise-alim`
- `/hr/oryantasyon`

These route aliases currently render the unified HR foundation screen.

## User-to-Employee Linkage Strategy

The HR foundation links employees to ERP users through:

- `employees.erp_user_id -> erp_users.id`

This keeps Supabase Auth and `erp_users` as the identity and authorization model while allowing HR records to become the operational employee profile.

Future permission decisions can use:

- ERP role from `erp_users`
- Employee link from `employees.erp_user_id`
- Department from `employees.department_id`
- Position from `employees.position_id`
- Manager chain from `employees.manager_employee_id`

No advanced permission logic was implemented in Phase 11.

## Authorization Relationship

The HR application permissions were expanded with HR module permission keys:

- `hr.departments`
- `hr.positions`
- `hr.attendance`
- `hr.leave`
- `hr.recruitment`
- `hr.onboarding`

These keys are available to the centralized permission catalog from Phase 10 and can be used for future module/page-level control.

## Validation

Command run:

```bash
npm run build
```

Result:

- Build succeeded.
- Existing Vite large chunk warning remains.
- Existing `pdfjs-dist` eval warning remains.
- Existing Browserslist data warning remains.

## Risks

- New Supabase tables may require explicit Data API grants or RLS policies depending on project settings.
- Frontend HR permissions are prepared, but database-level RLS enforcement is still a future phase.
- The unified HR screen is efficient for the foundation, but high-volume HR usage may later need separate detail pages.
- Employee-to-user linking depends on correct ERP user records existing before assignment.
- Attendance is intentionally basic and does not yet include shift calendars, absence rules, payroll calculations, or overtime approval.
- Leave requests are approval-ready but do not yet execute approval workflows.

## Recommendations

- Add RLS policies for HR tables before broader real-user rollout.
- Add employee detail/edit pages when HR data becomes dense.
- Add audit logging for employee, department, position, leave, and onboarding changes.
- Add department and position selectors to authorization screens in a later permission phase.
- Add validation for overlapping leave requests and duplicate employee numbers.
- Add import/export once real HR data migration begins.

## Proposed Phase 12 Scope

Recommended Phase 12: Reporting, Audit, and RLS Hardening Foundation.

Suggested scope:

- RLS policy pass for ERP and HR tables.
- Audit log integration for user, role, permission, and HR changes.
- Basic operational reporting shell for HR, finance, production, sales, and inventory.
- Department-aware permission planning.
- Route-to-permission test coverage.

