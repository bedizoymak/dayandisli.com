type DisplayNameSource = {
  full_name?: string | null;
  email?: string | null;
} | null;

const LOADING_LABEL = "Yükleniyor...";

function titleCase(value: string) {
  return value.replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase("tr-TR"));
}

function emailFallback(email: string | null | undefined) {
  const prefix = email?.split("@")[0]?.replace(/[._-]+/g, " ");
  return prefix ? titleCase(prefix) : null;
}

/**
 * erp_users.full_name is the authoritative display name; the email prefix is
 * only used as a last-resort fallback when no ERP profile/full_name exists.
 */
export function resolveDisplayName(erpUser: DisplayNameSource, isLoading: boolean): string {
  if (isLoading) return LOADING_LABEL;
  return erpUser?.full_name?.trim() || emailFallback(erpUser?.email) || "Ekip Üyesi";
}

export function getInitials(name: string) {
  return (
    name
      .split(/[\s.@_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase("tr-TR"))
      .join("") || "DD"
  );
}
