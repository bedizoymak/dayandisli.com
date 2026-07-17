import { PageHeader } from "@/components/erp/PageHeader";
import { ParasutMissingResourceState } from "../components/ParasutStateViews";

export function MissingResourcePage({ title, message }: { title: string; message: string }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description="Bu ekran mevcut Paraşüt aynasında karşılığı olmayan bir kaynağa bağlıdır." />
      <ParasutMissingResourceState message={message} />
    </div>
  );
}
