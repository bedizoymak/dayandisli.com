import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";

type ERPErrorBoundaryProps = {
  children: ReactNode;
};

type ERPErrorBoundaryState = {
  hasError: boolean;
};

export class ERPErrorBoundary extends Component<ERPErrorBoundaryProps, ERPErrorBoundaryState> {
  state: ERPErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ERP runtime error", { error, componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background p-6 text-foreground">
          <div className="mx-auto flex max-w-xl flex-col gap-4 rounded-lg border bg-card p-6 shadow-lg shadow-black/10">
            <div>
              <h1 className="text-xl font-semibold">Beklenmeyen Hata</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Sayfa yüklenirken bir sorun oluştu. İşlemi yeniden deneyebilir veya giriş ekranına dönebilirsiniz.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => window.location.reload()}>Yeniden Dene</Button>
              <Button variant="outline" onClick={() => window.location.assign("/login")}>Girişe Dön</Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
