import { ReactNode } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

type ERPModuleCardProps = {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
};

export function ERPModuleCard({ title, description, href, icon }: ERPModuleCardProps) {
  return (
    <Link to={href}>
      <Card className="h-full hover:border-primary/40 hover:bg-muted/30 transition-colors">
        <CardHeader>
          <div className="mb-3 text-primary">{icon}</div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
