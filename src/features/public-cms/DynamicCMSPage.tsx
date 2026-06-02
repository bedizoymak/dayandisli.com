import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PublicPageLayout } from "@/pages/PublicPageLayout";
import { useToast } from "@/hooks/use-toast";
import { applySEOMetadata, getPublicCMSPage, PublicCMSPageData, resolveMediaUrl, submitWebsiteForm } from "./api";

function paragraphs(content: string | null) {
  return (content ?? "")
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function DynamicCMSPage() {
  const location = useLocation();
  const { toast } = useToast();
  const [data, setData] = useState<PublicCMSPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ sender_name: "", sender_email: "", sender_phone: "", company_name: "", subject: "", message: "" });

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPublicCMSPage(location.pathname)
      .then((result) => {
        if (!active) return;
        setData(result);
        if (result) applySEOMetadata(result.seo, result.page.title, result.page.summary);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [location.pathname]);

  const primaryBanner = data?.banners[0];
  const imageUrl = useMemo(() => resolveMediaUrl(primaryBanner?.image_path), [primaryBanner?.image_path]);
  const activeForm = data?.forms.find((item) => item.form_key === data.page.slug) ?? data?.forms[0] ?? null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await submitWebsiteForm({ ...form, formKey: activeForm?.form_key ?? data?.page.slug });
      toast({
        title: "Form gönderildi",
        description: activeForm?.success_message || "Talebiniz alındı. En kısa sürede sizinle iletişime geçeceğiz.",
      });
      setForm({ sender_name: "", sender_email: "", sender_phone: "", company_name: "", subject: "", message: "" });
    } catch {
      toast({ title: "Gönderim hatası", description: "Form gönderilemedi. Lütfen tekrar deneyin.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PublicPageLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PublicPageLayout>
    );
  }

  if (!data) {
    return (
      <PublicPageLayout mainClassName="pt-20">
        <section className="mx-auto flex min-h-[55vh] max-w-3xl flex-col items-center justify-center px-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Dayan Dişli</p>
          <h1 className="mt-3 text-4xl font-bold text-white md:text-5xl">Sayfa bulunamadı</h1>
          <p className="mt-4 text-base leading-7 text-white/70">Aradığınız sayfa yayında değil veya ERP Web Sitesi kayıtlarında bulunamadı.</p>
          <Button asChild className="mt-8">
            <Link to="/">Ana Sayfaya Dön</Link>
          </Button>
        </section>
      </PublicPageLayout>
    );
  }

  return (
    <PublicPageLayout mainClassName="pt-20">
      <section className="relative overflow-hidden border-b border-white/10 bg-navy-lighter">
        {imageUrl ? (
          <img src={imageUrl} alt={primaryBanner?.title || data.page.title} className="absolute inset-0 h-full w-full object-cover opacity-35" loading="eager" />
        ) : null}
        <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-primary">Dayan Dişli</p>
          <h1 className="max-w-3xl text-4xl font-bold text-white md:text-6xl">{primaryBanner?.title || data.page.title}</h1>
          {(primaryBanner?.subtitle || data.page.summary) ? (
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/80">{primaryBanner?.subtitle || data.page.summary}</p>
          ) : null}
          {primaryBanner?.link_url ? (
            <Button asChild className="mt-8">
              <Link to={primaryBanner.link_url}>Detayları İncele</Link>
            </Button>
          ) : null}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-14 lg:grid-cols-[1fr_340px]">
        <article className="rounded-xl border border-white/10 bg-white/5 p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-white">{data.page.title}</h2>
          <div className="mt-6 space-y-5 text-base leading-8 text-white/75">
            {paragraphs(data.page.content).length > 0 ? (
              paragraphs(data.page.content).map((paragraph) => <p key={paragraph}>{paragraph}</p>)
            ) : (
              <p>{data.page.summary || "Bu sayfanın içeriği ERP Web Sitesi uygulamasından yönetilir."}</p>
            )}
          </div>
        </article>

        {activeForm ? (
          <aside className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-lg font-semibold text-white">{activeForm.name}</h3>
            <p className="mt-2 text-sm text-white/65">Bilgilerinizi bırakın, ekibimiz sizinle iletişime geçsin.</p>
            <form onSubmit={submit} className="mt-5 space-y-3">
              <Input required placeholder="Ad Soyad" value={form.sender_name} onChange={(event) => setForm((current) => ({ ...current, sender_name: event.target.value }))} />
              <Input required type="email" placeholder="E-posta" value={form.sender_email} onChange={(event) => setForm((current) => ({ ...current, sender_email: event.target.value }))} />
              <Input placeholder="Telefon" value={form.sender_phone} onChange={(event) => setForm((current) => ({ ...current, sender_phone: event.target.value }))} />
              <Input placeholder="Firma" value={form.company_name} onChange={(event) => setForm((current) => ({ ...current, company_name: event.target.value }))} />
              <Input placeholder="Konu" value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} />
              <Textarea required placeholder="Mesajınız" className="min-h-28" value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} />
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Gönder
              </Button>
            </form>
          </aside>
        ) : null}
      </section>
    </PublicPageLayout>
  );
}
