# ERP Yetki Tasarımı

Bu doküman DAYAN Dişli ERP arayüzündeki rol farkındalığını açıklar.

## Roller
- `admin`: Tüm ERP modüllerini yönetir.
- `planner`: Sipariş, üretim, rota ve iş emri planlama işlemlerini yönetir.
- `operator`: İş emri ve operasyon durumlarını günceller.
- `finance`: Finans, fatura, ödeme ve satın alma ekranlarında işlem yapar.
- `viewer`: Temel ERP ekranlarını görüntüler, yazma aksiyonları arayüzde kısıtlanır.

## Önemli Güvenlik Notu
Frontend rol kontrolü tek başına güvenlik sınırı değildir. Kesin yetkilendirme için Supabase RLS politikaları ve backend kontrolleri gerekir.

## Davranış
- Rol sorgusu başarısız olursa uygulama çökmez.
- Authenticated kullanıcılar temel ERP sayfalarını görüntüleyebilir.
- Admin tüm yetkilere sahiptir.
- Viewer için yazma aksiyonları gizlenir veya pasif hale getirilir.

## Kullanılan Yardımcılar
- `getCurrentERPUser()`
- `hasRole()`
- `canManageERP()`
- `canEditProduction()`
- `canEditFinance()`
- `canViewReports()`
