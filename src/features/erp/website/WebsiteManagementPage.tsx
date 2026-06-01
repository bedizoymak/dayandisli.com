import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { FormSection } from "@/components/erp/FormSection";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { ERPLayout } from "../layout/ERPLayout";
import {
  createWebsiteBanner,
  createWebsiteForm,
  createWebsiteMediaAsset,
  createWebsiteMenuItem,
  createWebsitePage,
  createWebsiteSEOSetting,
  listWebsiteBanners,
  listWebsiteForms,
  listWebsiteFormSubmissions,
  listWebsiteMediaAssets,
  listWebsiteMenuItems,
  listWebsitePages,
  listWebsiteSEOSettings,
  updateWebsiteFormSubmission,
  updateWebsiteMenuItem,
  updateWebsitePage,
} from "../shared/erpApi";
import { formatDateTime } from "../shared/formatters";
import {
  WebsiteBanner,
  WebsiteForm,
  WebsiteFormSubmission,
  WebsiteMediaAsset,
  WebsiteMenuArea,
  WebsiteMenuItem,
  WebsitePage,
  WebsitePageStatus,
  WebsiteSEOSetting,
} from "../shared/types";
import { useToast } from "@/hooks/use-toast";

const PAGE_STATUS_LABELS: Record<WebsitePageStatus, string> = {
  draft: "Taslak",
  review: "İncelemede",
  published: "Yayında",
  archived: "Arşiv",
};

const MENU_AREA_LABELS: Record<WebsiteMenuArea, string> = {
  header: "Üst Menü",
  footer: "Alt Menü",
  mobile: "Mobil Menü",
};

const SUBMISSION_STATUS_LABELS = {
  new: "Yeni",
  reviewed: "İncelendi",
  converted: "CRM'e Aktarıldı",
  archived: "Arşiv",
} as const;

function tone(status: string) {
  if (["published", "active", "converted", "reviewed"].includes(status)) return "success" as const;
  if (["draft", "review", "new"].includes(status)) return "warning" as const;
  if (["archived"].includes(status)) return "muted" as const;
  return "default" as const;
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function WebsiteManagementPage() {
  const { toast } = useToast();
  const [pages, setPages] = useState<WebsitePage[]>([]);
  const [seo, setSeo] = useState<WebsiteSEOSetting[]>([]);
  const [menuItems, setMenuItems] = useState<WebsiteMenuItem[]>([]);
  const [media, setMedia] = useState<WebsiteMediaAsset[]>([]);
  const [forms, setForms] = useState<WebsiteForm[]>([]);
  const [submissions, setSubmissions] = useState<WebsiteFormSubmission[]>([]);
  const [banners, setBanners] = useState<WebsiteBanner[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pageForm, setPageForm] = useState({ title: "", slug: "", page_type: "content", summary: "" });
  const [seoForm, setSeoForm] = useState({ page_id: "", route_path: "", meta_title: "", meta_description: "" });
  const [menuForm, setMenuForm] = useState({ label: "", path: "", menu_area: "header" as WebsiteMenuArea, sort_order: "0" });
  const [mediaForm, setMediaForm] = useState({ file_name: "", file_path: "", media_type: "image", alt_text: "", usage_area: "" });
  const [formForm, setFormForm] = useState({ name: "", form_key: "", target_email: "", success_message: "" });
  const [bannerForm, setBannerForm] = useState({ title: "", subtitle: "", image_path: "", link_url: "", placement: "home" });

  const load = async () => {
    const [pageResult, seoResult, menuResult, mediaResult, formResult, submissionResult, bannerResult] = await Promise.all([
      listWebsitePages(),
      listWebsiteSEOSettings(),
      listWebsiteMenuItems(),
      listWebsiteMediaAssets(),
      listWebsiteForms(),
      listWebsiteFormSubmissions(),
      listWebsiteBanners(),
    ]);
    const firstError = [pageResult, seoResult, menuResult, mediaResult, formResult, submissionResult, bannerResult].find((result) => result.error)?.error ?? null;
    setError(firstError);
    setPages(pageResult.data);
    setSeo(seoResult.data);
    setMenuItems(menuResult.data);
    setMedia(mediaResult.data);
    setForms(formResult.data);
    setSubmissions(submissionResult.data);
    setBanners(bannerResult.data);
    if (firstError) toast({ title: "Web Sitesi", description: firstError, variant: "destructive" });
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (action: Promise<{ error: string | null }>, message: string) => {
    const result = await action;
    if (result.error) {
      toast({ title: "Hata", description: result.error, variant: "destructive" });
      return false;
    }
    toast({ title: "Kaydedildi", description: message });
    await load();
    return true;
  };

  const createPage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ok = await save(createWebsitePage({
      title: pageForm.title,
      slug: pageForm.slug || slugify(pageForm.title),
      page_type: pageForm.page_type as WebsitePage["page_type"],
      summary: pageForm.summary || null,
    }), "Sayfa oluşturuldu.");
    if (ok) setPageForm({ title: "", slug: "", page_type: "content", summary: "" });
  };

  return (
    <ERPLayout title="Web Sitesi">
      <PageHeader title="Web Sitesi Yönetimi" description="dayandisli.com sayfaları, SEO, menü, medya, formlar, bannerlar ve yayın durumunu ERP üzerinden yönetin." />

      {error ? <MigrationNotice message={error} /> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Summary title="Sayfalar" value={pages.length} />
        <Summary title="Yayındaki Sayfalar" value={pages.filter((page) => page.status === "published").length} />
        <Summary title="Medya" value={media.length} />
        <Summary title="Form Kayıtları" value={submissions.length} />
      </div>

      <Tabs defaultValue="pages" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="pages">Sayfalar</TabsTrigger>
          <TabsTrigger value="seo">SEO Ayarları</TabsTrigger>
          <TabsTrigger value="menu">Menü Yönetimi</TabsTrigger>
          <TabsTrigger value="media">Medya Kütüphanesi</TabsTrigger>
          <TabsTrigger value="forms">Formlar</TabsTrigger>
          <TabsTrigger value="banners">Bannerlar</TabsTrigger>
          <TabsTrigger value="publishing">Yayın Durumu</TabsTrigger>
        </TabsList>

        <TabsContent value="pages" className="space-y-4">
          <FormSection title="Yeni Sayfa" description="Public site için yönetilebilir sayfa kaydı oluşturun.">
            <form className="grid gap-3 md:grid-cols-5" onSubmit={createPage}>
              <Input required placeholder="Sayfa başlığı *" value={pageForm.title} onChange={(event) => setPageForm((current) => ({ ...current, title: event.target.value, slug: current.slug || slugify(event.target.value) }))} />
              <Input placeholder="SEO adresi" value={pageForm.slug} onChange={(event) => setPageForm((current) => ({ ...current, slug: event.target.value }))} />
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={pageForm.page_type} onChange={(event) => setPageForm((current) => ({ ...current, page_type: event.target.value }))}>
                <option value="home">Ana Sayfa</option>
                <option value="content">İçerik</option>
                <option value="service">Hizmet</option>
                <option value="product">Ürün</option>
                <option value="sector">Sektör</option>
                <option value="contact">İletişim</option>
              </select>
              <Input placeholder="Özet" value={pageForm.summary} onChange={(event) => setPageForm((current) => ({ ...current, summary: event.target.value }))} />
              <Button type="submit">Sayfa Ekle</Button>
            </form>
          </FormSection>
          <DataTable data={pages} rowKey={(row) => row.id} columns={[
            { key: "title", header: "Sayfa", render: (row) => <div><p className="font-medium">{row.title}</p><p className="text-xs text-muted-foreground">/{row.slug}</p></div> },
            { key: "type", header: "Tür", render: (row) => row.page_type },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={PAGE_STATUS_LABELS[row.status]} tone={tone(row.status)} /> },
            { key: "updated", header: "Güncelleme", render: (row) => formatDateTime(row.updated_at ?? row.created_at) },
            { key: "action", header: "İşlem", render: (row) => <select className="h-9 rounded-md border bg-background px-2 text-xs" value={row.status} onChange={(event) => save(updateWebsitePage(row.id, { status: event.target.value as WebsitePageStatus, published_at: event.target.value === "published" ? new Date().toISOString() : row.published_at }), "Sayfa durumu güncellendi.")}>{Object.entries(PAGE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> },
          ]} />
        </TabsContent>

        <TabsContent value="seo" className="space-y-4">
          <FormSection title="SEO Kaydı" description="Sayfa ve rota bazlı arama görünürlüğü ayarlarını hazırlayın.">
            <form className="grid gap-3 md:grid-cols-5" onSubmit={async (event) => {
              event.preventDefault();
              const ok = await save(createWebsiteSEOSetting({ page_id: seoForm.page_id || null, route_path: seoForm.route_path, meta_title: seoForm.meta_title || null, meta_description: seoForm.meta_description || null }), "SEO kaydı oluşturuldu.");
              if (ok) setSeoForm({ page_id: "", route_path: "", meta_title: "", meta_description: "" });
            }}>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={seoForm.page_id} onChange={(event) => setSeoForm((current) => ({ ...current, page_id: event.target.value }))}><option value="">Sayfa bağlantısı</option>{pages.map((page) => <option key={page.id} value={page.id}>{page.title}</option>)}</select>
              <Input required placeholder="/rota" value={seoForm.route_path} onChange={(event) => setSeoForm((current) => ({ ...current, route_path: event.target.value }))} />
              <Input placeholder="Meta başlık" value={seoForm.meta_title} onChange={(event) => setSeoForm((current) => ({ ...current, meta_title: event.target.value }))} />
              <Input placeholder="Meta açıklama" value={seoForm.meta_description} onChange={(event) => setSeoForm((current) => ({ ...current, meta_description: event.target.value }))} />
              <Button type="submit">SEO Ekle</Button>
            </form>
          </FormSection>
          <DataTable data={seo} rowKey={(row) => row.id} columns={[
            { key: "route", header: "Rota", render: (row) => row.route_path },
            { key: "title", header: "Meta Başlık", render: (row) => row.meta_title || "-" },
            { key: "description", header: "Meta Açıklama", render: (row) => row.meta_description || "-" },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={row.is_active ? "Aktif" : "Pasif"} tone={row.is_active ? "success" : "muted"} /> },
          ]} />
        </TabsContent>

        <TabsContent value="menu" className="space-y-4">
          <FormSection title="Menü Öğesi" description="Üst, alt ve mobil menü bağlantılarını yönetin.">
            <form className="grid gap-3 md:grid-cols-5" onSubmit={async (event) => {
              event.preventDefault();
              const ok = await save(createWebsiteMenuItem({ label: menuForm.label, path: menuForm.path, menu_area: menuForm.menu_area, sort_order: Number(menuForm.sort_order || 0) }), "Menü öğesi oluşturuldu.");
              if (ok) setMenuForm({ label: "", path: "", menu_area: "header", sort_order: "0" });
            }}>
              <Input required placeholder="Etiket *" value={menuForm.label} onChange={(event) => setMenuForm((current) => ({ ...current, label: event.target.value }))} />
              <Input required placeholder="/adres *" value={menuForm.path} onChange={(event) => setMenuForm((current) => ({ ...current, path: event.target.value }))} />
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={menuForm.menu_area} onChange={(event) => setMenuForm((current) => ({ ...current, menu_area: event.target.value as WebsiteMenuArea }))}>{Object.entries(MENU_AREA_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <Input type="number" value={menuForm.sort_order} onChange={(event) => setMenuForm((current) => ({ ...current, sort_order: event.target.value }))} />
              <Button type="submit">Menü Ekle</Button>
            </form>
          </FormSection>
          <DataTable data={menuItems} rowKey={(row) => row.id} columns={[
            { key: "label", header: "Etiket", render: (row) => row.label },
            { key: "path", header: "Adres", render: (row) => row.path },
            { key: "area", header: "Alan", render: (row) => MENU_AREA_LABELS[row.menu_area] },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={row.is_active ? "Aktif" : "Pasif"} tone={row.is_active ? "success" : "muted"} /> },
            { key: "action", header: "İşlem", render: (row) => <Button size="sm" variant="outline" onClick={() => save(updateWebsiteMenuItem(row.id, { is_active: !row.is_active }), "Menü durumu güncellendi.")}>{row.is_active ? "Pasifleştir" : "Aktifleştir"}</Button> },
          ]} />
        </TabsContent>

        <TabsContent value="media" className="space-y-4">
          <FormSection title="Medya Kaydı" description="Dosya yükleme public medya kütüphanesinde kalabilir; burada kayıt ve kullanım alanı yönetilir.">
            <form className="grid gap-3 md:grid-cols-5" onSubmit={async (event) => {
              event.preventDefault();
              const ok = await save(createWebsiteMediaAsset({ ...mediaForm, media_type: mediaForm.media_type as WebsiteMediaAsset["media_type"], alt_text: mediaForm.alt_text || null, usage_area: mediaForm.usage_area || null }), "Medya kaydı oluşturuldu.");
              if (ok) setMediaForm({ file_name: "", file_path: "", media_type: "image", alt_text: "", usage_area: "" });
            }}>
              <Input required placeholder="Dosya adı *" value={mediaForm.file_name} onChange={(event) => setMediaForm((current) => ({ ...current, file_name: event.target.value }))} />
              <Input required placeholder="Dosya yolu *" value={mediaForm.file_path} onChange={(event) => setMediaForm((current) => ({ ...current, file_path: event.target.value }))} />
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={mediaForm.media_type} onChange={(event) => setMediaForm((current) => ({ ...current, media_type: event.target.value }))}><option value="image">Görsel</option><option value="document">Doküman</option><option value="video">Video</option><option value="other">Diğer</option></select>
              <Input placeholder="Alt metin" value={mediaForm.alt_text} onChange={(event) => setMediaForm((current) => ({ ...current, alt_text: event.target.value }))} />
              <Button type="submit">Medya Ekle</Button>
            </form>
          </FormSection>
          <DataTable data={media} rowKey={(row) => row.id} emptyMessage="Medya kaydı bulunamadı" columns={[
            { key: "name", header: "Dosya", render: (row) => row.file_name },
            { key: "path", header: "Yol", render: (row) => row.file_path },
            { key: "type", header: "Tür", render: (row) => row.media_type },
            { key: "alt", header: "Alt Metin", render: (row) => row.alt_text || "-" },
          ]} />
        </TabsContent>

        <TabsContent value="forms" className="space-y-4">
          <FormSection title="Form Tanımı" description="Public formların hedef ve başarı mesajı temelini yönetin.">
            <form className="grid gap-3 md:grid-cols-5" onSubmit={async (event) => {
              event.preventDefault();
              const ok = await save(createWebsiteForm({ ...formForm, target_email: formForm.target_email || null, success_message: formForm.success_message || null }), "Form tanımı oluşturuldu.");
              if (ok) setFormForm({ name: "", form_key: "", target_email: "", success_message: "" });
            }}>
              <Input required placeholder="Form adı *" value={formForm.name} onChange={(event) => setFormForm((current) => ({ ...current, name: event.target.value }))} />
              <Input required placeholder="Form anahtarı *" value={formForm.form_key} onChange={(event) => setFormForm((current) => ({ ...current, form_key: event.target.value }))} />
              <Input placeholder="Hedef e-posta" value={formForm.target_email} onChange={(event) => setFormForm((current) => ({ ...current, target_email: event.target.value }))} />
              <Input placeholder="Başarı mesajı" value={formForm.success_message} onChange={(event) => setFormForm((current) => ({ ...current, success_message: event.target.value }))} />
              <Button type="submit">Form Ekle</Button>
            </form>
          </FormSection>
          <DataTable data={submissions} rowKey={(row) => row.id} emptyMessage="Form kaydı bulunamadı" columns={[
            { key: "sender", header: "Gönderen", render: (row) => <div><p>{row.sender_name || "-"}</p><p className="text-xs text-muted-foreground">{row.sender_email || row.sender_phone || "-"}</p></div> },
            { key: "subject", header: "Konu", render: (row) => row.subject || "-" },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={SUBMISSION_STATUS_LABELS[row.status]} tone={tone(row.status)} /> },
            { key: "date", header: "Tarih", render: (row) => formatDateTime(row.created_at) },
            { key: "action", header: "İşlem", render: (row) => <select className="h-9 rounded-md border bg-background px-2 text-xs" value={row.status} onChange={(event) => save(updateWebsiteFormSubmission(row.id, { status: event.target.value as WebsiteFormSubmission["status"] }), "Form durumu güncellendi.")}>{Object.entries(SUBMISSION_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> },
          ]} />
        </TabsContent>

        <TabsContent value="banners" className="space-y-4">
          <FormSection title="Banner" description="Ana sayfa ve public alanlar için banner kayıtları oluşturun.">
            <form className="grid gap-3 md:grid-cols-6" onSubmit={async (event) => {
              event.preventDefault();
              const ok = await save(createWebsiteBanner({ ...bannerForm, subtitle: bannerForm.subtitle || null, image_path: bannerForm.image_path || null, link_url: bannerForm.link_url || null }), "Banner oluşturuldu.");
              if (ok) setBannerForm({ title: "", subtitle: "", image_path: "", link_url: "", placement: "home" });
            }}>
              <Input required placeholder="Başlık *" value={bannerForm.title} onChange={(event) => setBannerForm((current) => ({ ...current, title: event.target.value }))} />
              <Input placeholder="Alt başlık" value={bannerForm.subtitle} onChange={(event) => setBannerForm((current) => ({ ...current, subtitle: event.target.value }))} />
              <Input placeholder="Görsel yolu" value={bannerForm.image_path} onChange={(event) => setBannerForm((current) => ({ ...current, image_path: event.target.value }))} />
              <Input placeholder="Bağlantı" value={bannerForm.link_url} onChange={(event) => setBannerForm((current) => ({ ...current, link_url: event.target.value }))} />
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={bannerForm.placement} onChange={(event) => setBannerForm((current) => ({ ...current, placement: event.target.value }))}><option value="home">Ana Sayfa</option><option value="services">Hizmetler</option><option value="products">Ürünler</option><option value="sectors">Sektörler</option><option value="contact">İletişim</option></select>
              <Button type="submit">Banner Ekle</Button>
            </form>
          </FormSection>
          <DataTable data={banners} rowKey={(row) => row.id} columns={[
            { key: "title", header: "Banner", render: (row) => <div><p className="font-medium">{row.title}</p><p className="text-xs text-muted-foreground">{row.subtitle || "-"}</p></div> },
            { key: "placement", header: "Alan", render: (row) => row.placement },
            { key: "image", header: "Görsel", render: (row) => row.image_path || "-" },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={row.status === "published" ? "Yayında" : row.status === "draft" ? "Taslak" : "Arşiv"} tone={tone(row.status)} /> },
          ]} />
        </TabsContent>

        <TabsContent value="publishing">
          {pages.length === 0 ? <EmptyState title="Yayın kaydı yok" description="Sayfa ve banner kayıtları oluşturuldukça yayın durumu burada izlenecektir." /> : (
            <DataTable data={pages} rowKey={(row) => row.id} columns={[
              { key: "page", header: "İçerik", render: (row) => row.title },
              { key: "status", header: "Yayın Durumu", render: (row) => <StatusBadge label={PAGE_STATUS_LABELS[row.status]} tone={tone(row.status)} /> },
              { key: "published", header: "Yayın Tarihi", render: (row) => row.published_at ? formatDateTime(row.published_at) : "-" },
              { key: "summary", header: "Özet", render: (row) => row.summary || "-" },
            ]} />
          )}
        </TabsContent>
      </Tabs>
    </ERPLayout>
  );
}

function Summary({ title, value }: { title: string; value: number }) {
  return (
    <div className="erp-surface rounded-lg p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
