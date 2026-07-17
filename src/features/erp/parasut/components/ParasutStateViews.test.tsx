import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ParasutEmptyState,
  ParasutErrorState,
  ParasutLoadingState,
  ParasutMissingResourceState,
  ParasutPermissionDeniedState,
} from "./ParasutStateViews";

describe("Paraşüt state views", () => {
  it("renders the empty state with the provided description", () => {
    render(<ParasutEmptyState description="Senkronize edilmiş kayıt bulunmuyor." />);
    expect(screen.getByText("Senkronize edilmiş kayıt bulunmuyor.")).toBeInTheDocument();
  });

  it("renders the error state message and an accessible alert role", () => {
    render(<ParasutErrorState message="Beklenmeyen bir hata oluştu." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Beklenmeyen bir hata oluştu.");
  });

  it("renders a retry action when onRetry is provided", () => {
    render(<ParasutErrorState message="Hata" onRetry={() => {}} />);
    expect(screen.getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
  });

  it("renders the loading state with an accessible status role", () => {
    render(<ParasutLoadingState label="Yükleniyor..." />);
    expect(screen.getByRole("status")).toHaveTextContent("Yükleniyor...");
  });

  it("renders the missing-resource message for nav items with no mirrored table", () => {
    render(<ParasutMissingResourceState message="Bu veri kaynağı mevcut Paraşüt aynasında bulunmuyor." />);
    expect(screen.getByText("Bu veri kaynağı mevcut Paraşüt aynasında bulunmuyor.")).toBeInTheDocument();
  });

  it("renders the permission-denied state", () => {
    render(<ParasutPermissionDeniedState />);
    expect(screen.getByText("Bu alana erişim yetkiniz yok")).toBeInTheDocument();
  });
});
