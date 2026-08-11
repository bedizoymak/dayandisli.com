type DisplayNameSource = {
  full_name?: string | null;
  email?: string | null;
} | null;

export function resolveDisplayName(erpUser: DisplayNameSource, isLoading: boolean): string {
  if (isLoading) return "Yükleniyor...";
  return erpUser?.full_name?.trim() || "—";
}

export function getInitials(name: string) {
  return (
    name
      .split(/[\s.@_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase("tr-TR"))
      .join("")
  );
}
