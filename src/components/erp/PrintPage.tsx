import { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type PrintPageProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function PrintPage({ title, subtitle, children }: PrintPageProps) {
  return (
    <section className="rounded-md border bg-card p-5 print:border-0 print:shadow-none">
      <div className="mb-4 flex items-start justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          Yazdır
        </Button>
      </div>
      <div className="hidden text-center print:block">
        <h1 className="text-xl font-bold">DAYAN Dişli</h1>
        <p className="text-sm">{title}</p>
      </div>
      {children}
    </section>
  );
}
