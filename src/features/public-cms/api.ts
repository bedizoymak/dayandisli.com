import { supabase } from "@/integrations/supabase/client";
import {
  CRMLead,
  WebsiteBanner,
  WebsiteForm,
  WebsiteFormSubmission,
  WebsiteMediaAsset,
  WebsiteMenuItem,
  WebsitePage,
  WebsiteSEOSetting,
} from "@/features/erp/shared/types";

type DbResult<T> = { data: T | null; error: unknown };

export type PublicCMSPageData = {
  page: WebsitePage;
  seo: WebsiteSEOSetting | null;
  banners: WebsiteBanner[];
  menus: WebsiteMenuItem[];
  forms: WebsiteForm[];
  media: WebsiteMediaAsset[];
};

export type WebsiteSubmissionPayload = {
  formKey?: string;
  sender_name?: string | null;
  sender_email?: string | null;
  sender_phone?: string | null;
  company_name?: string | null;
  subject?: string | null;
  message?: string | null;
};

function normalizePath(pathname: string) {
  const clean = pathname.split("?")[0].replace(/\/+$/, "");
  return clean || "/";
}

function slugFromPath(pathname: string) {
  const normalized = normalizePath(pathname);
  if (normalized === "/") return "home";
  return normalized.replace(/^\/sayfa\/?/, "").replace(/^\//, "");
}

function isCurrentlyPublished(banner: WebsiteBanner) {
  const now = Date.now();
  const starts = banner.starts_at ? new Date(banner.starts_at).getTime() : null;
  const ends = banner.ends_at ? new Date(banner.ends_at).getTime() : null;
  return banner.status === "published" && (!starts || starts <= now) && (!ends || ends >= now);
}

export function resolveMediaUrl(path?: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith("/") ? path : `/${path}`;
}

export function applySEOMetadata(seo: WebsiteSEOSetting | null, fallbackTitle: string, fallbackDescription?: string | null) {
  const title = seo?.meta_title || fallbackTitle;
  const description = seo?.meta_description || fallbackDescription || "";
  document.title = title;

  const setMeta = (selector: string, attr: "name" | "property", key: string, content: string) => {
    let element = document.head.querySelector<HTMLMetaElement>(selector);
    if (!element) {
      element = document.createElement("meta");
      element.setAttribute(attr, key);
      document.head.appendChild(element);
    }
    element.setAttribute("content", content);
  };

  setMeta('meta[name="description"]', "name", "description", description);
  setMeta('meta[property="og:title"]', "property", "og:title", title);
  setMeta('meta[property="og:description"]', "property", "og:description", description);
  if (seo?.og_image_path) setMeta('meta[property="og:image"]', "property", "og:image", resolveMediaUrl(seo.og_image_path) ?? seo.og_image_path);
  setMeta('meta[name="robots"]', "name", "robots", seo?.robots || "index,follow");

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", seo?.canonical_url || window.location.href);
}

export async function listPublicMenus(menuArea?: WebsiteMenuItem["menu_area"]) {
  let query = supabase
    .from("website_menu_items" as never)
    .select("*")
    .eq("is_active" as never, true as never)
    .order("sort_order", { ascending: true });
  if (menuArea) query = query.eq("menu_area" as never, menuArea as never);

  const { data, error } = (await query) as unknown as DbResult<WebsiteMenuItem[]>;
  if (error) return [];
  return data ?? [];
}

export async function getPublicCMSPage(pathname: string): Promise<PublicCMSPageData | null> {
  const path = normalizePath(pathname);
  const slug = slugFromPath(path);

  const pageResult = (await supabase
    .from("website_pages" as never)
    .select("*")
    .eq("slug" as never, slug as never)
    .eq("status" as never, "published" as never)
    .maybeSingle()) as unknown as DbResult<WebsitePage>;

  if (pageResult.error || !pageResult.data) return null;

  const [seoResult, bannersResult, menus, formsResult, mediaResult] = await Promise.all([
    supabase
      .from("website_seo_settings" as never)
      .select("*")
      .eq("is_active" as never, true as never)
      .or(`route_path.eq.${path},page_id.eq.${pageResult.data.id}`)
      .limit(1)
      .maybeSingle() as unknown as Promise<DbResult<WebsiteSEOSetting>>,
    supabase
      .from("website_banners" as never)
      .select("*")
      .eq("status" as never, "published" as never)
      .in("placement" as never, [pageResult.data.page_type, slug, "home"] as never)
      .order("sort_order", { ascending: true }) as unknown as Promise<DbResult<WebsiteBanner[]>>,
    listPublicMenus(),
    supabase
      .from("website_forms" as never)
      .select("*")
      .eq("is_active" as never, true as never) as unknown as Promise<DbResult<WebsiteForm[]>>,
    supabase
      .from("website_media_assets" as never)
      .select("*")
      .eq("is_public" as never, true as never) as unknown as Promise<DbResult<WebsiteMediaAsset[]>>,
  ]);

  return {
    page: pageResult.data,
    seo: seoResult.data ?? null,
    banners: (bannersResult.data ?? []).filter(isCurrentlyPublished),
    menus,
    forms: formsResult.data ?? [],
    media: mediaResult.data ?? [],
  };
}

export async function submitWebsiteForm(payload: WebsiteSubmissionPayload) {
  const formResult = payload.formKey
    ? ((await supabase
        .from("website_forms" as never)
        .select("*")
        .eq("form_key" as never, payload.formKey as never)
        .eq("is_active" as never, true as never)
        .maybeSingle()) as unknown as DbResult<WebsiteForm>)
    : { data: null, error: null };

  const submission = {
    form_id: formResult.data?.id ?? null,
    sender_name: payload.sender_name ?? null,
    sender_email: payload.sender_email ?? null,
    sender_phone: payload.sender_phone ?? null,
    company_name: payload.company_name ?? null,
    subject: payload.subject ?? formResult.data?.name ?? "Web Sitesi Formu",
    message: payload.message ?? null,
    status: "new",
  };

  const { data, error } = (await supabase
    .from("website_form_submissions" as never)
    .insert(submission as never)
    .select("*")
    .single()) as unknown as DbResult<WebsiteFormSubmission>;

  if (error) throw error;

  const leadResult = await supabase
    .from("crm_leads" as never)
    .insert({
      company_name: submission.company_name || submission.sender_name || "Web Sitesi Ziyaretçisi",
      contact_name: submission.sender_name,
      priority: "normal",
      source: "website",
      status: "new",
      email: submission.sender_email,
      phone: submission.sender_phone,
      notes: submission.message,
    } as never)
    .select("*")
    .maybeSingle() as unknown as DbResult<CRMLead>;

  return { submission: data, lead: leadResult.data ?? null, leadError: leadResult.error ?? null };
}
