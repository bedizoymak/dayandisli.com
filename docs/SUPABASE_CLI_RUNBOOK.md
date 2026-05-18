# Supabase CLI Runbook

Bu dokuman DAYAN Disli ERP projesinde Supabase CLI durumunu kontrol etmek, migration durumunu okumak ve kontrollu mock seed verisini elle uygulamak icin hazirlandi.

## Durum Kontrolleri

CLI surumunu kontrol et:

```powershell
supabase --version
```

Komut PATH icinde bulunmuyorsa, npm projesinde lokal CLI paketi var mi diye kurulum yapmadan kontrol et:

```powershell
npx --no-install supabase --version
```

Proje dosyalarini kontrol et:

```powershell
Get-Content supabase\config.toml
Get-ChildItem supabase\migrations
Get-ChildItem supabase\functions
Test-Path supabase\seed.sql
```

## Proje Link Kontrolu

Once proje listesini ve lokal stack durumunu oku:

```powershell
supabase projects list
supabase status
```

Linked project ref dosyasini kontrol et:

```powershell
Get-Content supabase\.temp\project-ref
```

Sadece CLI erisilebilir, dogru hesaba login olunmus ve proje henuz dogru ref'e bagli degilse link calistir:

```powershell
supabase link --project-ref meauutjsnnggzcigyvfp
```

Access token, database password, service role key veya `.env` icerigini terminale yazdirma.

## Migration Durumu

Migration durumunu sadece oku:

```powershell
supabase migration list
```

Uygulamadan once dry-run disinda remote migration komutu calistirma:

```powershell
supabase db push --linked --dry-run
```

## Guvenli Komutlar

Bu komutlar okuma veya dry-run amaclidir:

```powershell
supabase --version
supabase projects list
supabase status
supabase migration list
supabase db push --linked --dry-run
```

## Kacinilacak Tehlikeli Komutlar

Production veya canli proje uzerinde calistirma:

```powershell
supabase db reset
supabase db reset --linked
supabase db reset --db-url <production-url>
supabase db push --linked
supabase db push --include-seed --linked
```

Ek kurallar:
- Do NOT run `supabase db reset` on production.
- Do NOT run destructive migrations.
- Do NOT expose access tokens.
- Do NOT commit `.env`.
- Do NOT store passwords in seed files.
- Do NOT create fake auth users in seed files.

## Mock Seed Stratejisi

Kontrollu ERP mock verisi su dosyada tutulur:

```text
supabase/seed_erp_mock.sql
```

Bu dosya:
- Sabit UUID kullanir.
- `on conflict (id) do update` ile idempotenttir.
- Sifre, token, service key veya fake auth user icermez.
- `delete`, `truncate`, `drop`, `reset` komutu icermez.
- Mock satirlari `[MOCK]` isaretiyle ayirir.

Bu dosya bilerek `supabase/seed.sql` olarak adlandirilmadi ve `config.toml` icine otomatik seed yolu olarak eklenmedi. Boylece `supabase start`, `supabase db reset` veya `supabase db push --include-seed` gibi komutlar tarafindan yanlislikla otomatik calistirilmaz.

Supabase dokumanlarina gore `supabase/seed.sql` ilk `supabase start` ve her `supabase db reset` sonrasinda calisir; bu nedenle production akisi icin otomatik seed yerine manuel ve onayli uygulama kullanilir.

## Seed'i Elle Uygulama

On kosullar:
- Dogru proje ref'i kontrol edildi.
- `supabase migration list` ile ERP migration'larinin remote tarafta uygulanmis oldugu goruldu.
- Bu islem icin acik onay verildi.
- Database URL sadece mevcut terminal oturumunda tutuluyor, dosyaya yazilmiyor.

PowerShell ile manuel uygulama:

```powershell
psql "$env:SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f .\supabase\seed_erp_mock.sql
```

Alternatif olarak Supabase Dashboard SQL Editor icinde `supabase/seed_erp_mock.sql` icerigi elle calistirilabilir.

## Seed Dogrulama

Seed sonrasinda SQL Editor veya psql ile:

```sql
select count(*) from public.stakeholders where notes ilike '%[MOCK]%';
select count(*) from public.sales_orders where notes ilike '%[MOCK]%';
select count(*) from public.work_orders where notes ilike '%[MOCK]%';
select count(*) from public.subcontracting_jobs where notes ilike '%[MOCK]%';
select count(*) from public.quality_reports where notes ilike '%[MOCK]%';
select count(*) from public.shipments where notes ilike '%[MOCK]%';
select count(*) from public.purchase_orders where notes ilike '%[MOCK]%';
select count(*) from public.erp_notifications where title ilike '%[MOCK]%';
```

ERP UI kontrolleri:
- `/erp/dashboard`
- `/erp/sales-orders`
- `/erp/work-orders`
- `/erp/subcontracting`
- `/erp/quality`
- `/erp/logistics`
- `/erp/purchase-orders`
- `/erp/notifications`
