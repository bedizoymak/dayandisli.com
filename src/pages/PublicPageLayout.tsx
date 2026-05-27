import { ReactNode } from "react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

type PublicPageLayoutProps = {
  children?: ReactNode;
  mainClassName?: string;
};

export const PublicPageLayout = ({ children, mainClassName = "pt-20" }: PublicPageLayoutProps) => {
  return (
    <div className="min-h-screen bg-navy text-foreground">
      <Navigation />
      {children && <main className={mainClassName}>{children}</main>}
      <Footer />
      <WhatsAppButton />
    </div>
  );
};
