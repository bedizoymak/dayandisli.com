# Reusable Admin Panel Blueprint

Source repository: `akinalinsaat.com` current codebase  
Blueprint target: reuse this admin architecture for another website, for example `dayandisli.com`  
Audit date: 2026-06-01

This document describes the admin panel as it exists in the current repository. It is based on inspected source files, routes, PHP endpoints, API client methods, and MySQL schema files.

## 1. Admin Panel Overview

The admin panel is a React/Vite single page application served with a PHP/MySQL API layer.

Core stack:

- Frontend framework: React 18 + Vite
- Routing: `react-router-dom`
- Data access: `fetch()` wrappers in `src/lib/apiClient.ts`
- Admin auth: PHP sessions through `public_html/api/auth.php`
- Backend: standalone PHP endpoints under `public_html/api/admin/`
- Database: MySQL through PDO in `public_html/api/db.php`
- UI primitives: local shadcn/Radix-style components under `src/components/ui/`
- Icons: `lucide-react`
- Charts: `recharts`
- Drag/drop: `@dnd-kit/*`
- PDF export: `pdfmake`
- CSV export: generated in browser from `src/lib/finance.ts`

Top-level admin shell:

- Route layout: `src/components/admin/AdminLayout.tsx`
- Login page: `src/pages/admin/AdminAuth.tsx`
- Route registration: `src/App.tsx`
- API client/types: `src/lib/apiClient.ts`, `src/lib/apiTypes.ts`
- Shared admin UI: `src/components/admin/AdminPage.tsx`

The admin route tree is protected client-side by `useAuth()` and server-side by `require_admin()` in every admin PHP endpoint. Client-side route protection is not the source of authority; PHP session checks are.

## 2. Full Sidebar / Navigation Structure

The sidebar is defined in `src/components/admin/AdminLayout.tsx` as `NAV_GROUPS`.

Current order:

| Group | Item | Route | Icon |
| --- | --- | --- | --- |
| Genel | Genel Bakış | `/admin` | `LayoutDashboard` |
| Genel | Finans Özeti | `/admin/finans-dashboard` | `BarChart3` |
| Proje Yönetimi | Projeler | `/admin/projeler` | `FolderKanban` |
| Proje Yönetimi | Medya | `/admin/medya` | `ImageIcon` |
| Cari ve Tahsilat | Müşteriler | `/admin/musteriler` | `Users` |
| Cari ve Tahsilat | Tahsilatlar | `/admin/tahsilatlar` | `Wallet` |
| Cari ve Tahsilat | Ödeme Planları | `/admin/odeme-planlari` | `CalendarClock` |
| Finans | Giderler | `/admin/giderler` | `Receipt` |
| Finans | Gider Kartları | `/admin/gider-kartlari` | `Tags` |
| Finans | Raporlar | `/admin/raporlar` | `FileBarChart` |
| Personel | Personeller | `/admin/personeller` | `HardHat` |
| Operasyon | İletişim Talepleri | `/admin/talepler` | `Inbox` |
| Operasyon | Bildirimler | `/admin/bildirimler` | `Bell` |
| Sistem | Ayarlar | `/admin/ayarlar` | `Settings` |
| Sistem | SQL Editor | `/admin/sql-editor` | `Database` |

Active state styling is the `NavLink` class logic in `src/components/admin/AdminLayout.tsx`. It applies the accent background/ring when `isActive` is true.

Page breadcrumb/title metadata is in the same file as `PAGE_META`. It covers list pages, edit/detail pages, finance statement pages, and `/admin` exact matching.

## 3. Every Admin Page and Its Purpose

Routes are registered in `src/App.tsx`.

| Route | Component | Purpose |
| --- | --- | --- |
| `/admin/giris` | `src/pages/admin/AdminAuth.tsx` | Admin login screen. |
| `/admin` | `src/pages/admin/AdminDashboard.tsx` | General dashboard. |
| `/admin/projeler` | `src/pages/admin/AdminProjects.tsx` | Project list and project actions. |
| `/admin/projeler/yeni` | `src/pages/admin/AdminProjectEdit.tsx` | New project form. |
| `/admin/projeler/:id` | `src/pages/admin/AdminProjectEdit.tsx` | Edit existing project. |
| `/admin/projeler/:id/finans` | `src/pages/admin/AdminProjectFinance.tsx` | Project financial statement wrapper. |
| `/admin/musteriler` | `src/pages/admin/AdminCustomers.tsx` | Customer list and customer balance overview. |
| `/admin/musteriler/yeni` | `src/pages/admin/AdminCustomerEdit.tsx` | New customer form. |
| `/admin/musteriler/:id` | `src/pages/admin/AdminCustomerDetail.tsx` | Customer detail view. |
| `/admin/musteriler/:id/duzenle` | `src/pages/admin/AdminCustomerEdit.tsx` | Edit customer form. |
| `/admin/musteriler/:id/finans` | `src/pages/admin/AdminCustomerFinance.tsx` | Customer financial statement wrapper. |
| `/admin/personeller` | `src/pages/admin/AdminEmployees.tsx` | Personnel cards. |
| `/admin/personeller/:id/finans` | `src/pages/admin/AdminEmployeeFinance.tsx` | Personnel financial statement wrapper. |
| `/admin/odeme-planlari` | `src/pages/admin/AdminPaymentPlans.tsx` | Payment plan tracking. |
| `/admin/tahsilatlar` | `src/pages/admin/AdminCollections.tsx` | Payment collection records. |
| `/admin/giderler` | `src/pages/admin/AdminExpenses.tsx` | Expense records. |
| `/admin/gider-kartlari` | `src/pages/admin/AdminExpenseCards.tsx` | Reusable expense cards. |
| `/admin/gider-kartlari/:id/finans` | `src/pages/admin/AdminExpenseCardFinance.tsx` | Expense card financial statement wrapper. |
| `/admin/finans-dashboard` | `src/pages/admin/AdminFinance.tsx` | Finance summary dashboard. |
| `/admin/medya` | `src/pages/admin/AdminMedia.tsx` | Media library. |
| `/admin/talepler` | `src/pages/admin/AdminContacts.tsx` | Contact request management. |
| `/admin/bildirimler` | `src/pages/admin/AdminNotifications.tsx` | Notification center. |
| `/admin/raporlar` | `src/pages/admin/AdminReports.tsx` | Report tabs and exports. |
| `/admin/ayarlar` | `src/pages/admin/AdminSettings.tsx` | Site settings and push notification controls. |
| `/admin/sql-editor` | `src/pages/admin/AdminSqlEditor.tsx` | Admin SQL editor. |

Finance statement wrappers:

- `src/pages/admin/AdminProjectFinance.tsx`
- `src/pages/admin/AdminCustomerFinance.tsx`
- `src/pages/admin/AdminEmployeeFinance.tsx`
- `src/pages/admin/AdminExpenseCardFinance.tsx`

All four wrappers render the reusable statement engine in:

- `src/components/admin/finance/FinancialStatementPage.tsx`

## 4. Forms, Tables, Filters, and Actions

### Login

File: `src/pages/admin/AdminAuth.tsx`

Fields:

- `email`
- `password`

Behavior:

- Calls `loginAdmin()` from `src/lib/apiClient.ts`.
- Redirects to `/admin` on successful admin session.
- Shows an unauthorized screen if a session exists but role is not `admin`.

Backend:

- `POST /api/admin/login.php`
- `GET /api/admin/me.php`
- `POST /api/admin/logout.php`

### General Dashboard

File: `src/pages/admin/AdminDashboard.tsx`

Widgets:

- `Aktif Projeler`
- `Toplam Tahsilat`
- `Toplam Gider`
- `Net Durum`
- `Beklenen Tahsilat`
- `Vadesi Geçen Alacak`
- `Bu Ay Tahsilat`
- `Bu Ay Gider`
- `Bu Ay Net Durum`

Sections:

- `Takip Gerektirenler`
- `Son Hareketler`
- `Proje Durumu`
- `Aylık Finans Özeti`

Actions:

- `Yeni Proje` links to `/admin/projeler/yeni`
- `Tahsilat Ekle` links to `/admin/tahsilatlar?yeni=1`
- `Raporları Gör` links to `/admin/raporlar`

Backend:

- `GET /api/admin/dashboard.php`

Tables used:

- `ak_projects`
- `ak_contact_requests`
- `ak_notifications`
- `ak_customers`
- `ak_payments`
- `ak_expenses`
- `ak_payment_plans`
- `ak_financial_entries`

### Projects

List file: `src/pages/admin/AdminProjects.tsx`  
Edit file: `src/pages/admin/AdminProjectEdit.tsx`  
Import/export helper: `src/features/admin/projects/projectImportExport.ts`

List filters:

- Search by title, location, project type.
- Project type filter from `PROJECT_TYPES` in `src/lib/projects.ts`.
- Project status filter from `PROJECT_STATUSES` in `src/lib/projects.ts`.
- Publish state filter: all, published, draft.

List metrics:

- `Toplam Proje`
- `Aktif Projeler`
- `Yayındaki Projeler`
- `Taslak Projeler`

List actions:

- View public project: `/projelerimiz/:slug`
- Open finance statement: `/admin/projeler/:id/finans`
- Edit project: `/admin/projeler/:id`
- Toggle publish state.
- Duplicate project.
- Delete project with `confirm()`.
- Drag/drop reorder using `@dnd-kit`.
- JSON export/import with schema `akinal-projects-export-v1`.

Project form fields:

- `title`
- `slug`
- `short_description`
- `detailed_description`
- `project_type`
- `project_status`
- `city`
- `district`
- auto-generated read-only `location`
- `start_year`
- `delivery_year`
- `land_area`
- `construction_area`
- `apartment_count`
- `floor_count`
- `block_count`
- `cover_image_url`
- `is_featured`
- `is_published`
- `sort_order`
- `seo_title`
- `seo_description`

Project form behavior:

- Slug is auto-generated from title until manually edited.
- Province/district data comes from `src/lib/turkeyLocations.ts`.
- `location` is generated from `district + city`.
- Legacy `location` is preserved when `city`/`district` are absent.
- Invalid city/district combinations are blocked.
- Cover image is required before save.
- Gallery images are uploaded and stored in `ak_project_images`.
- Single image upload opens `ImageCropDialog`.
- Multiple image upload stores files directly.
- Gallery supports drag/drop ordering.
- Gallery image can be set as cover.

Backend:

- `GET/POST/PATCH/DELETE /api/admin/projects.php`
- `GET/POST/PATCH/DELETE /api/admin/project-images.php`
- `POST /api/admin/upload-project-image.php`

Tables:

- `ak_projects`
- `ak_project_images`

Upload path:

- `/uploads/project-images/`

### Media Library

File: `src/pages/admin/AdminMedia.tsx`

Data sources:

- Project gallery rows from `ak_project_images`.
- Project cover images from `ak_projects.cover_image_url`.
- Image-like site settings fields from `ak_site_settings`.
- Filesystem images under `/uploads/project-images/`.

Search fields:

- Title
- Alt text
- Filename
- Image URL
- Project title
- Source label

Card fields:

- Preview image.
- Filename/display name.
- Source label:
  - `Project gallery`
  - `Project cover`
  - `Site setting`
  - `Uploaded file`
  - `Yükleme`
- URL copy button.
- Delete button only when deletable.
- `Kullanımda` badge for protected media.

Deletion rules:

- Protected images cannot be hard-deleted directly.
- Project cover and site setting images must be removed from their owning project/setting first.
- Files under `/uploads/project-images/` can be deleted when safe.
- DB rows in `ak_project_images` are deleted when the media item maps to a gallery row.

Backend:

- `GET/DELETE /api/admin/media.php`
- `POST /api/admin/media-upload.php`

Tables/files:

- `ak_project_images`
- `ak_projects`
- `ak_site_settings`
- `/uploads/project-images/`

### Customers

List file: `src/pages/admin/AdminCustomers.tsx`  
Form file: `src/pages/admin/AdminCustomerEdit.tsx`  
Detail file: `src/pages/admin/AdminCustomerDetail.tsx`  
Quick create component: `src/components/admin/QuickCreateCustomerButton.tsx`

List filters:

- Search by customer name, phone, email.
- Customer type from `CUSTOMER_TYPES`.
- Customer status from `CUSTOMER_STATUSES`.
- Project filter.
- Balance filter: all, balance exists, balance clear.

List metrics:

- `Toplam Müşteri`
- `Toplam Tahsilat`
- `Bekleyen Tahsilat`
- `Bakiyesi Kapanan`

List actions:

- CSV export.
- New customer.
- View customer detail.
- Edit customer.
- Open customer finance statement.
- Delete customer with confirmation.
- WhatsApp quick link when `whatsapp` exists.

Customer form fields:

- `customer_type`
- `status`
- `full_name`
- `company_name`
- `phone`
- `whatsapp`
- `email`
- `tax_or_identity_number`
- `address`
- `city`
- `district`
- linked project checkboxes
- `notes`

Validation:

- `phone` is required.
- `company_name` is required for `Firma`.
- `full_name` is required for non-`Firma`.

Customer detail tabs:

- `Genel Bilgiler`
- `Ödeme Planı`
- `Tahsilatlar`
- `Giderler`
- `Notlar`
- `Belgeler`

Customer detail actions:

- Back to customer list.
- WhatsApp link.
- Edit customer.
- Add payment plan by linking to `/admin/odeme-planlari?musteri=:id`.
- Add collection by linking to `/admin/tahsilatlar?musteri=:id`.
- Add/delete notes.

Backend:

- `GET/POST/PATCH/DELETE /api/admin/customers.php`

Tables:

- `ak_customers`
- `ak_customer_projects`
- `ak_customer_notes`
- `ak_payment_plans`
- `ak_payments`
- `ak_expenses`
- `ak_documents`
- `ak_projects`

### Payment Plans

File: `src/pages/admin/AdminPaymentPlans.tsx`

Filters:

- Customer.
- Project.
- Status.
- Period: all, overdue, upcoming 30 days.

Metrics:

- `Brüt Plan Tutarı`
- `Ödenen Tutar`
- `Kalan Tutar`
- `Geciken Tutar`

Form fields:

- `customer_id`
- `project_id`
- `title`
- `amount`
- `due_date`
- `status`
- `description`
- `notes`

Behavior:

- Quick-create customer is available inside the dialog.
- Status is derived from payments with `derivePlanStatus()` in `src/lib/finance.ts`.
- WhatsApp reminder link is shown when customer has WhatsApp.
- CSV export is available.

Backend:

- `GET/POST/PATCH/DELETE /api/admin/payment-plans.php`

Tables:

- `ak_payment_plans`
- `ak_customers`
- `ak_projects`
- `ak_payments`

### Collections / Tahsilatlar

File: `src/pages/admin/AdminCollections.tsx`

Filters:

- Customer.
- Project.
- From date.
- To date.

Metrics:

- `Toplam Tahsilat`
- `Bu Ay Tahsilat`
- `Müşteri Sayısı`
- `Proje Sayısı`

Form fields:

- `customer_id`
- `project_id`
- `payment_plan_id`
- `amount`
- `payment_date`
- `payment_method`
- `description`
- `document_url`

Behavior:

- Query string `?musteri=:id` preselects customer.
- Query string `?yeni=1` opens new payment dialog.
- Selecting a payment plan can auto-fill the project.
- Upload accepts images/PDF through `uploadAdminPaymentDocument()`.
- Creating/updating/deleting a payment recalculates the linked payment plan status in `public_html/api/admin/payments.php`.
- CSV export is available.

Backend:

- `GET/POST/PATCH/DELETE /api/admin/payments.php`
- `POST /api/admin/upload-payment-document.php`

Tables:

- `ak_payments`
- `ak_customers`
- `ak_projects`
- `ak_payment_plans`

Upload path:

- `/uploads/payment-documents/`

### Finance Summary

File: `src/pages/admin/AdminFinance.tsx`

Sections:

- Explanation band for `Tahsilatlar`, `Ödeme Planları`, `Giderler`, `Finans Hareketleri`.
- Summary stat cards:
  - `Gerçekleşen Gelir`
  - `Planlanan Gelir`
  - `Gerçekleşen Gider`
  - `Planlanan Gider`
  - `Net Durum`
  - `Bu Ay Beklenen Tahsilat`
  - `Bu Ay Gerçekleşen Gelir`
  - `Bu Ay Gerçekleşen Gider`
- Charts:
  - `Genel Finans Dağılımı`
  - `Ödeme Durumu Dağılımı`
- `Proje Bazlı Finans Durumu`
- `Yaklaşan Ödemeler (30 Gün)`
- `Geciken Ödemeler`

Behavior:

- Combines `ak_financial_entries` with legacy `ak_payments` and `ak_expenses` converted into synthetic financial entries.
- Uses TRY display in this summary page through `formatTRY()`.
- CSV summary export is available.
- WhatsApp reminder links are available for upcoming/overdue payment plans.

Backend:

- `GET /api/admin/finance-summary.php`

Tables:

- `ak_payment_plans`
- `ak_payments`
- `ak_expenses`
- `ak_financial_entries`
- `ak_customers`
- `ak_projects`

### Financial Statements

Core file: `src/components/admin/finance/FinancialStatementPage.tsx`

Wrapper pages:

- `src/pages/admin/AdminProjectFinance.tsx`
- `src/pages/admin/AdminCustomerFinance.tsx`
- `src/pages/admin/AdminEmployeeFinance.tsx`
- `src/pages/admin/AdminExpenseCardFinance.tsx`

Supported statement kinds:

- `project`
- `customer`
- `employee`
- `expense`

Filters:

- Search.
- Date from/to.
- Direction.
- Status.
- Currency.
- Group.
- Card type.
- Project filter where applicable.

Finance form fields:

- `project_id`
- `entry_date`
- `card_type`
- `customer_id`
- `employee_id`
- `expense_card_id`
- `title`
- `description`
- `amount`
- `currency_tag`
- `group_tag`
- `direction`
- `status`
- `document_url`

Supported tags:

- Currencies: `TRY`, `USD`, `EUR`
- Groups: `Resmi`, `Gayri Resmi`
- Directions: `Gelir`, `Gider`
- Statuses: `Planlandı`, `Gerçekleşti`, `İptal`
- Card types: `customer`, `employee`, `expense`

Behavior:

- Multi-currency totals are shown per currency.
- Project/customer/personnel/expense-card ledgers use the same endpoint and component.
- Charts are hidden behind real empty states when there is no data.
- Quick-create customer is available where customer card selection is used.

Backend:

- `GET/POST/PATCH/DELETE /api/admin/financial-statement.php`

Tables:

- `ak_financial_entries`
- `ak_projects`
- `ak_customers`
- `ak_employees`
- `ak_expense_cards`
- `ak_payments`
- `ak_expenses`

### Expenses / Giderler

File: `src/pages/admin/AdminExpenses.tsx`

Filters:

- Project.
- Category.
- Date from/to.

Metrics:

- `Toplam Gider`
- `Bu Ay Gider`
- `Proje Sayısı`
- `Kategori Sayısı`

Form fields:

- `project_id`
- `customer_id`
- `title`
- `category`
- `amount`
- `expense_date`
- `description`
- `document_url`

Behavior:

- Optional customer relation.
- Quick-create customer.
- Quick-create expense category with `src/components/admin/QuickCreateExpenseCategoryButton.tsx`.
- Upload accepts images/PDF through `uploadAdminExpenseDocument()`.
- CSV export is available.

Backend:

- `GET/POST/PATCH/DELETE /api/admin/expenses.php`
- `POST /api/admin/upload-expense-document.php`

Tables:

- `ak_expenses`
- `ak_customers`
- `ak_projects`

Upload path:

- `/uploads/expense-documents/`

### Expense Cards / Gider Kartları

File: `src/pages/admin/AdminExpenseCards.tsx`

Filters:

- Search by name/category.
- Status.

Metrics:

- `Toplam Gider Kartı`
- `Aktif`
- `Kategori`

Form fields:

- `name`
- `category`
- `status`
- `description`

Actions:

- Create.
- Edit.
- Delete with confirmation.
- Open expense-card finance statement: `/admin/gider-kartlari/:id/finans`.

Backend:

- `GET/POST/PATCH/DELETE /api/admin/expense-cards.php`

Table:

- `ak_expense_cards`

### Personnel / Personeller

File: `src/pages/admin/AdminEmployees.tsx`

Filters:

- Search by name, phone, role.
- Status.

Metrics:

- `Toplam Personel`
- `Aktif`
- `Pasif`

Form fields:

- `full_name`
- `phone`
- `role`
- `status`
- `notes`

Actions:

- Create.
- Edit.
- Delete with confirmation.
- Open personnel finance statement: `/admin/personeller/:id/finans`.

Backend:

- `GET/POST/PATCH/DELETE /api/admin/employees.php`

Table:

- `ak_employees`

### Contact Requests

File: `src/pages/admin/AdminContacts.tsx`

Filters:

- Search.
- Status.

Statuses:

- `Yeni`
- `Arandı`
- `Teklif Verildi`
- `Tamamlandı`

Actions:

- Expand/collapse request detail.
- Call phone number via `tel:`.
- Send email via `mailto:`.
- Update status.
- Delete request with confirmation.

Backend:

- `GET/PATCH/DELETE /api/admin/contact-requests.php`
- Public source endpoint: `POST /api/contact-request.php`

Tables:

- `ak_contact_requests`
- `ak_notifications` for contact-form notification creation.

### Notifications

Page file: `src/pages/admin/AdminNotifications.tsx`  
Bell file: `src/components/admin/NotificationBell.tsx`  
Hook: `src/hooks/useNotifications.ts`

Notification page filters:

- Type.
- Priority.
- Unread-only checkbox.
- Text search by title/message.

Page actions:

- Mark all as read.
- Delete one notification.
- Delete all notifications with confirmation dialog:
  - `Tüm bildirimleri silmek istediğinize emin misiniz?`

Dropdown behavior:

- Header bell fetches latest 5 notifications.
- Shows title, message, created date, and unread state.
- Empty state: `Henüz bildirim bulunmuyor`
- Clicking unread notification marks it read and emits `ADMIN_NOTIFICATIONS_CHANGED_EVENT`.

Backend:

- `GET/PATCH/DELETE /api/admin/notifications.php`

Tables:

- `ak_notifications`
- `ak_payment_plans` for generated payment reminder notifications.

### Reports

File: `src/pages/admin/AdminReports.tsx`  
Data hook: `src/hooks/useFinanceData.ts`

Report tabs:

- `Proje Finans Raporu`
- `Müşteri Ödeme Raporu`
- `Tahsilat Raporu`
- `Gider Raporu`
- `Genel Finans Özeti`
- `Vadesi Geçen Ödemeler`

Quick presets:

- `Genel Finans Özeti`
- `Vadesi Geçen Ödemeler`
- `Proje Finans Raporu`

Export behavior:

- CSV via `exportCSV()` in `src/lib/finance.ts`.
- PDF via `exportPDF()` in `src/lib/finance.ts`.
- PDF uses `pdfmake/build/pdfmake` and `pdfmake/build/vfs_fonts`.
- Filenames are dated by `datedDownloadName()`.
- CSV includes UTF-8 BOM and semicolon delimiters.

Report filters:

- Project Finance: date from/to, project.
- Customer Payment: customer, project, status.
- Collections: date from/to, project, customer, payment method.
- Expenses: date from/to, project, category.
- Overdue: project, customer, delay bucket, date from/to.

Backend:

- `GET /api/admin/reports.php`

Tables:

- `ak_customers`
- `ak_payment_plans`
- `ak_payments`
- `ak_expenses`
- `ak_financial_entries`
- `ak_projects`
- `ak_customer_projects`
- `ak_contact_requests`

### Site Settings

File: `src/pages/admin/AdminSettings.tsx`  
Push panel: `src/components/admin/AdminPushNotificationsPanel.tsx`

Sections:

- `Firma Bilgileri`
- `İletişim ve Satış Kanalları`
- `Ana Sayfa Hero Alanı`
- `Sosyal Medya`
- `SEO Ayarları`
- `Admin Bildirimleri`
- Map/status preview panels

Fields:

- `company_name`
- `footer_description`
- `favicon_url`
- `phone`
- `whatsapp_number`
- `email`
- `address`
- `whatsapp_message`
- `hero_title`
- `hero_subtitle`
- `instagram_url`
- `facebook_url`
- `linkedin_url`
- `seo_title`
- `seo_description`
- `map_embed_url`

Behavior:

- Shows field-level helper text from `FIELD_HELPERS`.
- Validates required company/phone/WhatsApp fields.
- Validates email shape.
- Warns for URL fields not starting with `http://` or `https://`.
- Warns if `favicon_url` does not start with `/`, `http://`, or `https://`.
- Shows Google result preview and sitelinks target preview.
- Shows WhatsApp link preview.
- Favicon upload accepts ICO, PNG, SVG, WEBP.
- Favicon uploads to `/uploads/site/`.
- Admin web push controls are embedded in this page.

Backend:

- `GET/PATCH /api/admin/site-settings.php`
- `POST /api/admin/upload-site-asset.php`
- `POST /api/admin/push-subscribe.php`
- `POST /api/admin/push-unsubscribe.php`
- `POST /api/admin/send-push-test.php`

Tables:

- `ak_site_settings`
- `ak_push_subscriptions`

Upload path:

- `/uploads/site/`

### SQL Editor

Frontend file: `src/pages/admin/AdminSqlEditor.tsx`  
Backend file: `public_html/api/admin/sql-editor.php`

Behavior:

- Admin-only route: `/admin/sql-editor`
- SQL textarea with default query: `SELECT * FROM ak_projects LIMIT 20`
- One SQL statement per request.
- Allows a final trailing semicolon.
- Rejects additional unquoted statement separators.
- Detects statement type from first SQL keyword.
- Read statement types:
  - `SELECT`
  - `SHOW`
  - `DESCRIBE`
  - `DESC`
  - `EXPLAIN`
- Non-SELECT queries require confirmation checkbox.
- Destructive queries require typing `UYGULA`.
- Destructive keywords:
  - `DROP`
  - `TRUNCATE`
  - `ALTER`
- SELECT results render as a table.
- Write/schema queries render affected rows.
- Query history is stored in `localStorage` under `akinal-admin-sql-history`.
- Warning banner text:
  - `Canlı veritabanında yapılan işlemler geri alınamaz.`

Backend safety:

- Uses `require_admin()`.
- Does not return DB credentials.
- Logs executed SQL with `error_log()` including admin id/email/date/statement type/snippet.
- SQL errors return sanitized admin-facing SQLSTATE/driver messages.
- DB config values are redacted from error messages.

Backend:

- `POST /api/admin/sql-editor.php`

## 5. Dashboard Widgets

Dashboard implementation files:

- Page: `src/pages/admin/AdminDashboard.tsx`
- API method: `getAdminDashboard()` in `src/lib/apiClient.ts`
- API endpoint: `GET /api/admin/dashboard.php`
- Main tables: `ak_projects`, `ak_contact_requests`, `ak_notifications`, `ak_customers`, `ak_payments`, `ak_expenses`, `ak_payment_plans`, `ak_financial_entries`

Dashboard cards and widgets:

- Project counts:
  - `totalProjects`
  - `activeProjects`
  - `publishedProjects`
  - `draftProjects`
  - sourced from `ak_projects`
- Contact request counts:
  - `totalContactRequests`
  - `newContactRequests`
  - sourced from `ak_contact_requests`
- Notification count:
  - `unreadNotifications`
  - sourced from `ak_notifications`
- CRM and finance totals:
  - `totalCustomers`
  - `totalPayments`
  - `totalExpenses`
  - `netBalance`
  - sourced from `ak_customers`, `ak_payments`, and `ak_expenses`
- Receivable widgets:
  - overdue receivables
  - upcoming receivables
  - per-currency totals
  - sourced from `ak_payment_plans`, `ak_payments`, and `ak_financial_entries`
- Recent financial movements:
  - latest payment, expense, and manual financial entry rows
  - zero-safe empty state when no movement exists
- Monthly finance summary:
  - income and expense totals
  - per-currency handling for TRY, USD, and EUR
  - chart-ready summary values

The dashboard must remain a read-only aggregate surface. Write behavior belongs to module pages such as Tahsilatlar, Giderler, Bildirimler, and Talepler.

## 6. Finance Module Details

Finance implementation files:

- Summary page: `src/pages/admin/AdminFinance.tsx`
- Project finance wrapper: `src/pages/admin/AdminProjectFinance.tsx`
- Customer finance wrapper: `src/pages/admin/AdminCustomerFinance.tsx`
- Shared statement UI: `src/pages/admin/FinancialStatementPage.tsx`
- Collections page: `src/pages/admin/AdminCollections.tsx`
- Payment plans page: `src/pages/admin/AdminPaymentPlans.tsx`
- Expenses page: `src/pages/admin/AdminExpenses.tsx`
- Expense cards page: `src/pages/admin/AdminExpenseCards.tsx`
- Finance utilities: `src/lib/finance.ts`
- Financial entry client: `src/lib/financialEntries.ts`
- API client: `src/lib/apiClient.ts`

Finance endpoints:

- `GET /api/admin/finance-summary.php`
- `GET /api/admin/payments.php`
- `POST /api/admin/payments.php`
- `PATCH /api/admin/payments.php`
- `DELETE /api/admin/payments.php`
- `GET /api/admin/payment-plans.php`
- `POST /api/admin/payment-plans.php`
- `PATCH /api/admin/payment-plans.php`
- `DELETE /api/admin/payment-plans.php`
- `GET /api/admin/expenses.php`
- `POST /api/admin/expenses.php`
- `PATCH /api/admin/expenses.php`
- `DELETE /api/admin/expenses.php`
- `GET /api/admin/expense-cards.php`
- `POST /api/admin/expense-cards.php`
- `PATCH /api/admin/expense-cards.php`
- `DELETE /api/admin/expense-cards.php`
- `POST /api/admin/upload-payment-document.php`
- `POST /api/admin/upload-expense-document.php`
- `GET /api/admin/financial-statement.php`
- `POST /api/admin/financial-statement.php`
- `PATCH /api/admin/financial-statement.php`
- `DELETE /api/admin/financial-statement.php`

Finance tables:

- `ak_payments`
- `ak_payment_plans`
- `ak_expenses`
- `ak_expense_cards`
- `ak_financial_entries`
- `ak_projects`
- `ak_customers`
- `ak_customer_projects`

Currency behavior:

- `currency` is preserved on payment, expense, payment plan, and financial statement rows.
- TRY, USD, and EUR totals must be displayed separately when data includes multiple currencies.
- USD and EUR values must not be mixed into TRY net balance.
- UI cards use compact number formatting and wrapping constraints to avoid overflow.

Export behavior:

- CSV generation is implemented client-side in `src/lib/finance.ts`.
- PDF generation uses `pdfmake` through helpers in `src/lib/finance.ts`.
- Export filenames are dated and readable.
- Turkish text requires the configured PDF font setup in the finance export helpers.

## 7. Projects, Media, Customers, Payments, Expenses, and Personnel Modules

Projects:

- Pages: `src/pages/admin/AdminProjects.tsx`, `src/pages/admin/AdminProjectEdit.tsx`
- Endpoints: `/api/admin/projects.php`, `/api/admin/project-images.php`, `/api/admin/upload-project-image.php`
- Tables: `ak_projects`, `ak_project_images`
- Key behavior: project CRUD, publish/draft state, cover image, gallery images, sortable project lists, province/district/location handling.

Media:

- Page: `src/pages/admin/AdminMedia.tsx`
- Endpoints: `/api/admin/media.php`, `/api/admin/media-upload.php`, `/api/admin/upload-site-asset.php`
- Tables: `ak_project_images`, `ak_projects`, `ak_site_settings`
- Upload folders: `/uploads/project-images/`, `/uploads/site/`
- Key behavior: image library, drag/drop upload, copy URL, protected in-use images, safe deletion for normal uploaded files.

Customers:

- Pages: `src/pages/admin/AdminCustomers.tsx`, `src/pages/admin/AdminCustomerEdit.tsx`, `src/pages/admin/AdminCustomerDetail.tsx`, `src/pages/admin/AdminCustomerFinance.tsx`
- Endpoints: `/api/admin/customers.php`, `/api/admin/financial-statement.php`
- Tables: `ak_customers`, `ak_customer_projects`, `ak_customer_notes`, `ak_payments`, `ak_payment_plans`, `ak_financial_entries`
- Key behavior: customer CRUD, project relations, customer notes, balances, customer financial statement.

Payments and payment plans:

- Pages: `src/pages/admin/AdminCollections.tsx`, `src/pages/admin/AdminPaymentPlans.tsx`
- Endpoints: `/api/admin/payments.php`, `/api/admin/payment-plans.php`, `/api/admin/upload-payment-document.php`
- Tables: `ak_payments`, `ak_payment_plans`, `ak_customers`, `ak_projects`
- Key behavior: search/filter, status updates, document upload, quick customer creation where supported by form UI.

Expenses and expense cards:

- Pages: `src/pages/admin/AdminExpenses.tsx`, `src/pages/admin/AdminExpenseCards.tsx`
- Endpoints: `/api/admin/expenses.php`, `/api/admin/expense-cards.php`, `/api/admin/upload-expense-document.php`
- Tables: `ak_expenses`, `ak_expense_cards`, `ak_projects`
- Key behavior: expense CRUD, category/card selection, quick expense category creation, document upload.

Personnel:

- Page: `src/pages/admin/AdminEmployees.tsx`
- Endpoint: `/api/admin/employees.php`
- Tables: `ak_employees`, `ak_projects`
- Key behavior: personnel CRUD, project relation labels, empty project label when no `project_id` exists.

## 8. SQL Editor Behavior and Safety Rules

SQL Editor implementation files:

- Page: `src/pages/admin/AdminSqlEditor.tsx`
- Endpoint: `public_html/api/admin/sql-editor.php`
- Route: `/admin/sql-editor`
- Sidebar item: `SQL Editor` under `Sistem`

Behavior:

- Accepts one SQL statement per request.
- Supports `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP`, and similar MySQL statements.
- Displays a result table for `SELECT` queries.
- Displays affected row count for write queries.
- Stores query history in browser `localStorage`.
- Shows the warning banner: `Canlı veritabanında yapılan işlemler geri alınamaz.`

Safety rules:

- Admin session is required through `require_admin()`.
- Database credentials are never returned to the browser.
- Multiple statements are blocked server-side.
- Non-SELECT queries require the confirmation checkbox.
- Destructive queries such as `DROP`, `TRUNCATE`, and `ALTER` require additional text confirmation with `UYGULA`.
- SQL errors are returned as safe admin-facing messages, not raw credential or stack traces.
- Executed SQL is logged server-side when the existing logging path is available.

Replication guidance:

- Keep this page only for trusted technical administrators.
- Disable or remove it for lower-trust admin panels.
- Never expose it to public routes.

## 9. PHP API Endpoints Used

All admin endpoints are under `public_html/api/admin/` and require an admin session unless noted.

| Endpoint | Methods | Frontend callers | Main tables/files |
| --- | --- | --- | --- |
| `/api/admin/login.php` | POST | `loginAdmin()` | `ak_admin_users` |
| `/api/admin/logout.php` | POST | `logoutAdmin()` | PHP session |
| `/api/admin/me.php` | GET | `getCurrentAdmin()` | PHP session |
| `/api/admin/dashboard.php` | GET | `getAdminDashboard()` | `ak_projects`, `ak_contact_requests`, `ak_notifications`, `ak_customers`, `ak_payments`, `ak_expenses`, `ak_payment_plans`, `ak_financial_entries` |
| `/api/admin/site-settings.php` | GET, PATCH | `getAdminSiteSettings()`, `updateAdminSiteSettings()` | `ak_site_settings` |
| `/api/admin/upload-site-asset.php` | POST | `uploadAdminSiteAsset()` | `/uploads/site/` |
| `/api/admin/projects.php` | GET, POST, PATCH, DELETE | project pages/import-export | `ak_projects` |
| `/api/admin/project-images.php` | GET, POST, PATCH, DELETE | project edit/import-export | `ak_project_images` |
| `/api/admin/upload-project-image.php` | POST | project edit image upload | `/uploads/project-images/` |
| `/api/admin/media.php` | GET, DELETE | media library | `ak_project_images`, `ak_projects`, `ak_site_settings`, `/uploads/project-images/` |
| `/api/admin/media-upload.php` | POST | media library upload | `/uploads/project-images/` |
| `/api/admin/contact-requests.php` | GET, PATCH, DELETE | contact request page | `ak_contact_requests` |
| `/api/admin/customers.php` | GET, POST, PATCH, DELETE | customers/detail/edit/quick-create | `ak_customers`, `ak_customer_projects`, `ak_customer_notes`, related lookup tables |
| `/api/admin/payment-plans.php` | GET, POST, PATCH, DELETE | payment plans | `ak_payment_plans`, `ak_customers`, `ak_projects`, `ak_payments` |
| `/api/admin/payments.php` | GET, POST, PATCH, DELETE | collections | `ak_payments`, `ak_payment_plans`, `ak_customers`, `ak_projects` |
| `/api/admin/upload-payment-document.php` | POST | collections document upload | `/uploads/payment-documents/` |
| `/api/admin/finance-summary.php` | GET | finance summary | `ak_payment_plans`, `ak_payments`, `ak_expenses`, `ak_financial_entries`, `ak_customers`, `ak_projects` |
| `/api/admin/financial-statement.php` | GET, POST, PATCH, DELETE | all finance statement pages | `ak_financial_entries`, lookup tables |
| `/api/admin/expenses.php` | GET, POST, PATCH, DELETE | expenses | `ak_expenses`, `ak_customers`, `ak_projects` |
| `/api/admin/upload-expense-document.php` | POST | expenses document upload | `/uploads/expense-documents/` |
| `/api/admin/expense-cards.php` | GET, POST, PATCH, DELETE | expense cards | `ak_expense_cards` |
| `/api/admin/notifications.php` | GET, PATCH, DELETE | notification bell/page | `ak_notifications`, `ak_payment_plans` |
| `/api/admin/employees.php` | GET, POST, PATCH, DELETE | personnel | `ak_employees` |
| `/api/admin/reports.php` | GET | reports | finance/report tables |
| `/api/admin/sql-editor.php` | POST | SQL editor | arbitrary MySQL statement, admin-only |
| `/api/admin/push-subscribe.php` | POST | admin push panel | `ak_push_subscriptions` |
| `/api/admin/push-unsubscribe.php` | POST | admin push panel | `ak_push_subscriptions` |
| `/api/admin/send-push-test.php` | POST | admin push panel | `ak_push_subscriptions`, VAPID config |
| `/api/admin/push-debug.php` | GET | diagnostics only | `ak_push_subscriptions`, VAPID diagnostics |
| `/api/admin/run-demo-import.php` | POST | manual temporary importer | server-side SQL file, protected token |

Public endpoints related to admin data:

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/contact-request.php` | POST | Inserts public contact form submissions into `ak_contact_requests` and creates `ak_notifications`. |
| `/api/site-settings.php` | GET | Public site settings. |
| `/api/projects.php` | GET | Published public projects. |
| `/api/project-detail.php?slug=...` | GET | Published public project detail and gallery. |
| `/api/cookie-consent.php` | POST | Stores cookie consent rows. |
| `/api/sales-chatbot.php` | POST | Current chatbot fallback endpoint. |

## 10. MySQL Tables Used

Schema source:

- `public_html/install-schema.php`

Runtime-created table:

- `ak_push_subscriptions` is created by `public_html/api/admin/push-utils.php` through `ensure_push_subscriptions_table()`.

Tables:

| Table | Current use |
| --- | --- |
| `ak_admin_users` | Admin login and session identity. |
| `ak_profiles` | Installed by schema; not a primary current admin runtime table. |
| `ak_user_roles` | Installed by schema; current login uses `ak_admin_users.role`. |
| `ak_projects` | Public projects, admin project management, reports, finance lookups, media cover images. |
| `ak_project_images` | Project gallery images and media library project gallery rows. |
| `ak_media_library` | Installed by schema; current media page does not read it directly. |
| `ak_site_settings` | Admin settings, public settings, favicon, media site-setting image references. |
| `ak_contact_requests` | Public contact form submissions and admin contact requests page. |
| `ak_customers` | CRM, payment plans, payments, expenses, reports, finance statements. |
| `ak_customer_projects` | Customer-project many-to-many links. |
| `ak_payment_plans` | Receivables, payment reminders, dashboard, finance/report modules. |
| `ak_payments` | Collections, dashboard totals, finance summary, reports. |
| `ak_expenses` | Expenses, dashboard totals, finance summary, reports. |
| `ak_customer_notes` | Customer detail notes. |
| `ak_documents` | Customer detail document lookup. Current UI lists documents but does not include a full document upload module. |
| `ak_notifications` | Notification center, notification bell, public contact notifications, payment reminders. |
| `ak_employees` | Personnel module and personnel finance statements. |
| `ak_expense_cards` | Expense card module and expense-card finance statements. |
| `ak_financial_entries` | Multi-currency finance ledger and all statement pages. |
| `ak_cookie_consents` | Public cookie consent endpoint. |
| `ak_push_subscriptions` | Admin-only browser push notification subscriptions. |

Important table columns are defined in `public_html/install-schema.php`. Frontend TypeScript shapes are defined in `src/lib/apiTypes.ts`.

## 11. Auth and Session Requirements

Frontend:

- Hook: `src/hooks/useAuth.ts`
- Login page: `src/pages/admin/AdminAuth.tsx`
- Layout guard: `src/components/admin/AdminLayout.tsx`

Backend:

- Session helper: `public_html/api/auth.php`
- Admin helper: `public_html/api/admin/helpers.php`
- DB connection: `public_html/api/db.php`
- JSON response helpers: `public_html/api/response.php`

Session behavior:

- `start_secure_session()` sets PHP session cookies with:
  - `path: /`
  - `httponly: true`
  - `samesite: Lax`
  - `secure: true` when request is HTTPS or `HTTP_X_FORWARDED_PROTO=https`
- `set_current_admin()` regenerates session ID and stores:
  - `id`
  - `email`
  - `full_name`
  - `role`
- `require_admin()` returns 401 JSON error when no admin session exists.

Admin role rule:

- Frontend treats `admin.role === "admin"` as authorized.
- Backend endpoints only require a logged-in admin session; most endpoints do not do per-feature permission checks.

Admin login rule:

- `public_html/api/admin/login.php` queries `ak_admin_users` by `email_lower`.
- Login requires `is_active = 1`.
- Password verification uses PHP `password_verify()`.

## 12. Frontend Components and Files

Admin shell:

- `src/components/admin/AdminLayout.tsx`
- `src/components/admin/AdminPage.tsx`
- `src/components/admin/NotificationBell.tsx`

Admin support components:

- `src/components/admin/AdminPushNotificationsPanel.tsx`
- `src/components/admin/ImageCropDialog.tsx`
- `src/components/admin/QuickCreateCustomerButton.tsx`
- `src/components/admin/QuickCreateExpenseCategoryButton.tsx`
- `src/components/admin/finance/FinancialStatementPage.tsx`

Admin pages:

- `src/pages/admin/AdminAuth.tsx`
- `src/pages/admin/AdminDashboard.tsx`
- `src/pages/admin/AdminProjects.tsx`
- `src/pages/admin/AdminProjectEdit.tsx`
- `src/pages/admin/AdminProjectFinance.tsx`
- `src/pages/admin/AdminMedia.tsx`
- `src/pages/admin/AdminContacts.tsx`
- `src/pages/admin/AdminSettings.tsx`
- `src/pages/admin/AdminCustomers.tsx`
- `src/pages/admin/AdminCustomerEdit.tsx`
- `src/pages/admin/AdminCustomerDetail.tsx`
- `src/pages/admin/AdminCustomerFinance.tsx`
- `src/pages/admin/AdminEmployees.tsx`
- `src/pages/admin/AdminEmployeeFinance.tsx`
- `src/pages/admin/AdminPaymentPlans.tsx`
- `src/pages/admin/AdminCollections.tsx`
- `src/pages/admin/AdminExpenses.tsx`
- `src/pages/admin/AdminExpenseCards.tsx`
- `src/pages/admin/AdminExpenseCardFinance.tsx`
- `src/pages/admin/AdminFinance.tsx`
- `src/pages/admin/AdminNotifications.tsx`
- `src/pages/admin/AdminReports.tsx`
- `src/pages/admin/AdminSqlEditor.tsx`

Shared frontend libraries:

- `src/lib/apiClient.ts`
- `src/lib/apiTypes.ts`
- `src/lib/finance.ts`
- `src/lib/financialEntries.ts`
- `src/lib/projects.ts`
- `src/lib/turkeyLocations.ts`
- `src/lib/utils.ts`

Hooks:

- `src/hooks/useAuth.ts`
- `src/hooks/useNotifications.ts`
- `src/hooks/useFinanceData.ts`
- `src/hooks/use-toast.ts`
- `src/hooks/use-mobile.tsx`

Project import/export:

- `src/features/admin/projects/projectImportExport.ts`

Service worker:

- `public/admin-push-sw.js`

## 13. Build and Deploy Notes

Build commands:

- Development server: `npm run dev`
- Production build: `npm run build`
- Preview: `npm run preview`
- Lint script exists: `npm run lint`
- Test script exists: `npm run test`

Vite config:

- `vite.config.ts`
- Dev server host: `::`
- Dev server port: `8080`
- Alias: `@` maps to `./src`

Production static routing:

- `public/.htaccess` rewrites unknown paths to `index.html`.
- This is required for deep admin routes such as `/admin/projeler/:id`.

Security headers:

- `public/.htaccess` sets Content Security Policy.
- Current CSP allows:
  - self scripts/styles
  - Cloudflare Turnstile host
  - Google Fonts
  - Google iframe for maps
  - self worker source

Backend config:

- Copy `public_html/api/config.example.php` to `public_html/api/config.php` on the server.
- Do not commit real `config.php`.
- Required constants:
  - `DB_HOST`
  - `DB_NAME`
  - `DB_USER`
  - `DB_PASS`
- Optional/feature constants currently present:
  - `DEMO_IMPORT_TOKEN`
  - `VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT`
  - `TURNSTILE_SECRET_KEY`

Upload directories required on the web server:

- `public_html/uploads/project-images/`
- `public_html/uploads/payment-documents/`
- `public_html/uploads/expense-documents/`
- `public_html/uploads/site/`

Schema installer:

- `public_html/install-schema.php`
- It is locked behind `?confirm=INSTALL_AKINAL_SCHEMA`.
- It should be deleted from production after use.

Temporary importer:

- `public_html/api/admin/run-demo-import.php`
- Reads `public_html/migration-tools/output/import-demo-data.sql`.
- Requires admin session and `DEMO_IMPORT_TOKEN`.
- Must be deleted from production immediately after use.

## 14. What Must Be Customized for a New Site

For a new domain such as `dayandisli.com`, customize these observed site-specific areas.

Brand and content:

- Replace logo asset: `src/assets/logo.png`.
- Replace default company/site copy in `public_html/install-schema.php` seed settings.
- Update settings through `/admin/ayarlar` after first login:
  - `company_name`
  - `footer_description`
  - `phone`
  - `whatsapp_number`
  - `email`
  - `address`
  - `map_embed_url`
  - `hero_title`
  - `hero_subtitle`
  - `whatsapp_message`
  - `seo_title`
  - `seo_description`
  - `favicon_url`
  - social URLs

Domain and security:

- Set real MySQL credentials in `public_html/api/config.php`.
- Set VAPID subject for the new domain, for example `mailto:admin@dayandisli.com`.
- Generate a new VAPID public/private key pair if push notifications are used.
- Configure `TURNSTILE_SECRET_KEY` only if the contact form still uses Turnstile.
- Review `public/.htaccess` CSP if the new site loads different external services.

Data model names:

- Current table prefix is `ak_`.
- For reuse without code changes, keep the same table names.
- If table prefix changes, update every SQL reference in `public_html/api/` and every documented importer/schema file.

Public website integration:

- Public routes and pages are outside this admin blueprint, but admin settings/projects directly affect:
  - public site settings
  - public project list/detail pages
  - public contact form submissions

Visual language:

- Admin page layout is quiet, dense, operational UI.
- Keep `src/components/admin/AdminPage.tsx` as the shared page grammar for headers, metric cards, sections, and empty states.
- Keep sidebar group logic in `src/components/admin/AdminLayout.tsx`.

Finance vocabulary:

- Current labels are construction/accounting oriented:
  - `Projeler`
  - `Tahsilatlar`
  - `Ödeme Planları`
  - `Giderler`
  - `Gider Kartları`
  - `Personeller`
- For another industry, adjust visible labels and descriptions while preserving routes/API contracts if you want the fastest migration.

## 15. Step-by-Step Migration Plan to Apply This Panel to Another Domain

1. Copy the frontend/admin source structure:
   - `src/pages/admin/`
   - `src/components/admin/`
   - `src/lib/apiClient.ts`
   - `src/lib/apiTypes.ts`
   - `src/lib/finance.ts`
   - `src/lib/financialEntries.ts`
   - `src/lib/projects.ts`
   - `src/lib/turkeyLocations.ts`
   - `src/features/admin/projects/projectImportExport.ts`
   - relevant `src/components/ui/` files

2. Copy backend API structure:
   - `public_html/api/`
   - especially `public_html/api/admin/`
   - `public_html/install-schema.php`
   - `public/admin-push-sw.js` if push notifications are needed
   - `public/.htaccess`

3. Install Node dependencies from `package.json`.

4. Build locally with:
   - `npm install`
   - `npm run build`

5. Create the MySQL database on the new host.

6. Copy `public_html/api/config.example.php` to `public_html/api/config.php` on the server and set:
   - `DB_HOST`
   - `DB_NAME`
   - `DB_USER`
   - `DB_PASS`
   - optional VAPID and Turnstile constants.

7. Run schema setup:
   - Upload `public_html/install-schema.php`.
   - Open `install-schema.php?confirm=INSTALL_AKINAL_SCHEMA`.
   - Confirm all expected tables are created.
   - Delete `install-schema.php` from production after success.

8. Create the first admin user:
   - Current repository includes `public_html/create-admin-user.php`.
   - Use it only as a controlled setup tool.
   - Delete it from production after creating the admin.

9. Ensure writable upload directories exist:
   - `public_html/uploads/project-images/`
   - `public_html/uploads/payment-documents/`
   - `public_html/uploads/expense-documents/`
   - `public_html/uploads/site/`

10. Deploy built frontend assets and PHP API:
   - Vite output goes to `dist/`.
   - PHP API lives under `public_html/api/`.
   - SPA rewrite comes from `public/.htaccess`.

11. Log in to:
   - `/admin/giris`

12. Configure site settings:
   - `/admin/ayarlar`
   - Upload/favicon/logo-related settings as needed.

13. Validate admin modules in order:
   - `/admin`
   - `/admin/projeler`
   - `/admin/medya`
   - `/admin/musteriler`
   - `/admin/odeme-planlari`
   - `/admin/tahsilatlar`
   - `/admin/giderler`
   - `/admin/finans-dashboard`
   - `/admin/raporlar`
   - `/admin/sql-editor`

14. Validate public-to-admin flows:
   - Public contact form inserts into `ak_contact_requests`.
   - Public contact form creates `ak_notifications`.
   - Notification bell updates after new notifications.
   - Public projects reflect `ak_projects.is_published`.

15. Decide whether to keep advanced tools:
   - Keep `/admin/sql-editor` only for trusted technical admins.
   - Remove `run-demo-import.php` from production after import.
   - Keep `push-debug.php` only if diagnostics are acceptable in production.

16. Rebrand operational labels only after the working copy passes the full flow:
   - Sidebar labels in `src/components/admin/AdminLayout.tsx`.
   - Page descriptions in each `src/pages/admin/*.tsx`.
   - Report headings in `src/pages/admin/AdminReports.tsx`.
   - Seed/default settings in `public_html/install-schema.php`.

### Implementation Notes and Reuse Boundaries

Use existing patterns when extending:

- Add frontend API methods in `src/lib/apiClient.ts`.
- Add TypeScript response shapes in `src/lib/apiTypes.ts`.
- Add PHP endpoints under `public_html/api/admin/`.
- Start admin endpoints with:
  - `require_once __DIR__ . '/helpers.php';`
  - `require_admin();`
  - method checking through `require_method()` or explicit `$method` branching.
- Return JSON through `json_success()` and `json_error()`.
- Use prepared statements for normal CRUD endpoints.
- Use `uuid_v4()` from `public_html/api/admin/helpers.php` for new IDs.
- Keep upload endpoints restricted to server-side destination folders.

Avoid changing these contracts unless doing a coordinated migration:

- Admin route paths in `src/App.tsx`.
- API response envelope: `{ success: boolean, data?: ..., message?: ... }`.
- MySQL table names and ID shape (`CHAR(36)` UUID strings).
- Auth/session helpers in `public_html/api/auth.php`.

### Current Known Non-Admin Couplings

The admin panel is reusable, but it is connected to the public site through:

- `ak_site_settings`
- `ak_projects`
- `ak_project_images`
- `ak_contact_requests`
- `ak_notifications`
- Upload paths under `/uploads/`

If the new site has a different public frontend, keep these API contracts or write compatibility adapters.

### Minimal Replication Checklist

- [ ] `npm run build` passes.
- [ ] `public_html/api/config.php` exists on server with real DB credentials.
- [ ] `ak_admin_users` has at least one active admin with `role = admin`.
- [ ] PHP sessions work over HTTPS.
- [ ] Admin login works at `/admin/giris`.
- [ ] Admin layout loads at `/admin`.
- [ ] CRUD works for projects, customers, payment plans, payments, expenses, employees, expense cards.
- [ ] Upload directories are writable.
- [ ] PDF/CSV exports download.
- [ ] SQL Editor is accessible only to trusted admins.
- [ ] Public contact form creates contact requests and notifications.
- [ ] Production setup tools are removed after use.
