# DAYAN Disli — Teklif ve Yönetim Sistemi

## Kisa Açiklama
Bu proje, DAYAN Disli için gelistirilmis modern, web tabanli bir teklif ve operasyon yönetim sistemidir. Uygulama; müsteri/sirket bilgileri, teklif üretimi, PDF çiktisi ve yönetim süreçlerini güvenli bir mimariyle tek noktada birlestirir.

Üretim ortami: https://dayandisli.com

## Özellikler
- Güvenli giris (email/password)
- Admin yetkilendirme
- Müsteri/sirket bilgi yönetimi
- Teklif olusturma ve düzenleme
- PDF teklif üretimi
- Son teklifler geçmisi
- Supabase veritabani entegrasyonu
- GitHub Actions ile production dagitimi

## Teknoloji Yigini
- React
- Vite
- TypeScript
- Supabase
- Tailwind CSS / shadcn-ui
- GitHub Actions

## Mimari Genel Bakis
Sistem, istemci tarafinda React + Vite tabanli bir frontend ile çalisir. Frontend, kimlik dogrulama ve veri islemleri için Supabase servisleriyle iletisim kurar. `main` branch’ine yapilan degisiklikler GitHub Actions pipeline’i üzerinden üretim ortamina otomatik olarak dagitilir.

Akis özeti:
Frontend (React/Vite) -> Supabase (Auth + DB) -> GitHub Actions -> Production

## Ortam Degiskenleri
Asagidaki degerleri `.env` dosyanizda placeholder olarak tanimlayin:

```env
VITE_SUPABASE_PROJECT_ID=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

## Lokal Gelistirme
```bash
npm install
npm run dev
npm run build
```

## Deployment
`main` branch’ine push islemi yapildiginda GitHub Actions otomatik olarak deployment sürecini tetikler ve uygulamayi production ortama yayinlar.

## Güvenlik Notlari
- Repoya gizli bilgi (secret) commit edilmemelidir.
- Kimlik dogrulama Supabase Auth üzerinden yönetilir.
- Admin kontrolü uygulama tarafinda ayri yetkilendirme katmaniyla ele alinir.
- Supabase tarafinda Row Level Security (RLS) politikalari zorunlu olarak yapilandirilmalidir.

## Proje Durumu
Production aktif, gelistirme devam ediyor.

## Maintainer
Eclipse Engineering & IT Solutions
