# ERP Migration Runbook

## 1. Amaç
Bu doküman DAYAN Dişli ERP tablolarının Supabase üzerinde güvenli şekilde uygulanması, doğrulanması ve production route testlerinin yapılması için hazırlanmıştır.

## 2. Migration Dosyaları
- `supabase/migrations/20251208092932_b7d45e49-989a-4ea1-a451-45de4f44dffd.sql`
- `supabase/migrations/20260517110000_admin_users_auth.sql`
- `supabase/migrations/20260517153000_erp_core_schema.sql`
- `supabase/migrations/20260517230000_erp_phase2_phase3_readiness.sql`
- `supabase/migrations/20260518093000_erp_phase5_audit_purchasing.sql`
- `supabase/migrations/20260518143000_erp_phase6_workflow_notifications.sql`

## 3. Oluşturulan ERP Tabloları
ERP migration seti şu ana veri alanlarını ekler: `erp_users`, `stakeholders`, `erp_quotation_links`, `sales_orders`, `sales_order_items`, `machines`, `production_routes`, `production_route_steps`, `work_orders`, `work_order_operations`, `subcontracting_jobs`, `documents`, `inventory_items`, `inventory_movements`, `measuring_tools`, `financial_accounts`, `invoices`, `payments`, `employees`, `employee_time_entries`, `employee_assets`, `shipments`, `shipment_items`, `quality_reports`, `quality_measurements`, `maintenance_tasks`, `erp_number_sequences`.

## 4. RLS Davranışı
Yeni ERP operasyon tablolarında RLS aktiftir.

Authenticated kullanıcılar için:
- `select` açık
- `insert` açık
- `update` açık

Varsayılan olarak delete policy eklenmez. Silme yerine `status` veya `is_active` alanları kullanılmalıdır.

## 5. Manuel Supabase SQL Uygulama Adımları
1. Supabase Dashboard içinde ilgili production project açılır.
2. SQL Editor ekranında migration dosyaları kronolojik sırayla kontrol edilir.
3. Production üzerinde daha önce uygulanmış migration varsa tekrar çalıştırılmaz.
4. Yeni additive migration `20260517230000_erp_phase2_phase3_readiness.sql` uygulanır.
5. SQL çalıştırıldıktan sonra aşağıdaki doğrulama sorguları kullanılır.

## 6. Doğrulama SQL
```sql
select table_name
from information_schema.tables
where table_schema = 'public'
and table_name in (
  'erp_users',
  'stakeholders',
  'sales_orders',
  'sales_order_items',
  'machines',
  'production_routes',
  'production_route_steps',
  'work_orders',
  'work_order_operations',
  'subcontracting_jobs',
  'inventory_items',
  'inventory_movements',
  'invoices',
  'payments',
  'shipments',
  'quality_reports',
  'maintenance_tasks',
  'erp_number_sequences'
)
order by table_name;
```

```sql
select count(*) from public.stakeholders;
select count(*) from public.sales_orders;
select count(*) from public.work_orders;
select count(*) from public.inventory_items;
select count(*) from public.machines;
select count(*) from public.erp_number_sequences;
```

## 7. Route Kontrolleri
Migration sonrası şu route'lar açılmalı ve beyaz ekrana düşmemelidir:
- `/erp`
- `/erp/dashboard`
- `/erp/crm`
- `/erp/quotations`
- `/erp/sales-orders`
- `/erp/work-orders`
- `/erp/routes`
- `/erp/subcontracting`
- `/erp/inventory`
- `/erp/inventory-movements`
- `/erp/logistics`
- `/erp/quality`
- `/erp/maintenance`
- `/erp/documents`
- `/erp/notifications`
- `/erp/reports`

## 8. Rollback Uyarısı
Bu migration seti additive tasarlanmıştır. Production verisi içeren tabloları drop etmek veya kayıt silmek rollback yöntemi olarak kullanılmamalıdır. Geri dönüş gerekiyorsa önce veritabanı yedeği alınmalı ve yalnızca yeni eklenen metadata/policy değişiklikleri kontrollü şekilde ele alınmalıdır.

## 9. Bilinen Sınırlar
- Dosya yükleme sadece metadata seviyesindedir.
- Ön muhasebe çift taraflı muhasebe defteri değildir.
- Üretim planlama kapasite/MRP seviyesinde değildir.
- Rota adım silme UI'da özellikle kapalı tutulmuştur.
- Sipariş/iş emri dönüşümlerinde veri ilişkisi opsiyoneldir; eksik ID'ler akışı durdurmaz.

## 10. Sonraki Fazlar
- Detay sayfaları ve kayıt geçmişi
- Rol bazlı yetki matrisi
- Teknik resim storage bucket entegrasyonu
- Sevk irsaliyesi PDF çıktısı
- Kalite ölçüm satırları için gelişmiş form
- İş emri operasyon süre raporları
- Stok rezervasyon ve satın alma ihtiyaç takibi

## 11. Phase 5 Ek Tablolar
Phase 5 migration dosyası:
- `supabase/migrations/20260518093000_erp_phase5_audit_purchasing.sql`

Eklenen tablolar:
- `erp_audit_logs`
- `purchase_orders`
- `purchase_order_items`

Bu migration additive tasarlanmıştır. Mevcut production tabloları silinmez veya değiştirilmez.

## 12. Phase 5 Doğrulama SQL
```sql
select table_name
from information_schema.tables
where table_schema = 'public'
and table_name in (
  'erp_audit_logs',
  'purchase_orders',
  'purchase_order_items'
)
order by table_name;
```

```sql
select count(*) from public.erp_audit_logs;
select count(*) from public.purchase_orders;
select count(*) from public.purchase_order_items;
```

## 13. Phase 5 Manuel Testler
- CRM ekranından paydaş oluştur.
- Satış siparişi oluştur ve iş emrine dönüştür.
- İş emri durumunu güncelle ve audit timeline kontrol et.
- Satın alma siparişi oluştur.
- Satın alma siparişine kalem ekle.
- Satın alma kalemini teslim al ve stok giriş hareketini kontrol et.
- Stok hareketi oluştur.
- Kalite sonucu güncelle.
- Sevkiyat oluştur ve durumunu güncelle.
- Raporlar ekranından CSV dışa aktarım dene.
 
## 14. Phase 6 Akış ve Bildirim Testleri
Phase 6 migration dosyası:
- `supabase/migrations/20260518143000_erp_phase6_workflow_notifications.sql`

Eklenen/bağlanan alanlar:
- `erp_notifications`
- `quality_reports.work_order_operation_id`
- `subcontracting_jobs.work_order_operation_id`

Manuel testler:
- Tekliften sipariş oluştur.
- Siparişten iş emri oluştur.
- İş emrine rota uygula ve bir operasyonu tamamla.
- Operasyon satırından kalite raporu oluştur.
- Operasyon satırından fason kaydı oluştur.
- Sevkiyat durumunu `delivered` yap ve ilgili siparişin `closed` olduğunu kontrol et.
- `/erp/notifications` ekranında yeni bildirimleri ve okundu işaretleme akışını kontrol et.
