import { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProtectedRoute from "./ProtectedRoute";

const useERPAuthMock = vi.fn();

vi.mock("@/contexts/ERPAuthContext", () => ({
  useERPAuth: () => useERPAuthMock(),
}));

type AuthOverrides = Partial<{
  isLoading: boolean;
  isAuthenticated: boolean;
  isActiveAdmin: boolean;
  hasPermission: (permission?: string | null) => boolean;
}>;

function setAuthState(overrides: AuthOverrides = {}) {
  useERPAuthMock.mockReturnValue({
    isLoading: false,
    isAuthenticated: true,
    isActiveAdmin: true,
    hasPermission: () => true,
    ...overrides,
  });
}

function renderRoute(path: string, children: ReactNode = <div>Korunan içerik</div>) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>Giriş sayfası</div>} />
        <Route path="/apps" element={<div>Uygulamalar sayfası</div>} />
        <Route path="*" element={<ProtectedRoute>{children}</ProtectedRoute>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  afterEach(cleanup);

  beforeEach(() => {
    localStorage.clear();
    setAuthState();
  });

  it("shows the Turkish loading state while auth is resolving", () => {
    setAuthState({ isLoading: true });

    renderRoute("/finans");

    expect(screen.getByText("ERP yetki kontrolü yapılıyor...")).toBeInTheDocument();
    expect(screen.queryByText("Korunan içerik")).not.toBeInTheDocument();
  });

  it("redirects logged-out users to login", () => {
    setAuthState({ isAuthenticated: false, isActiveAdmin: false });

    renderRoute("/finans");

    expect(screen.getByText("Giriş sayfası")).toBeInTheDocument();
  });

  it("redirects inactive admins to login", () => {
    setAuthState({ isActiveAdmin: false });

    renderRoute("/finans");

    expect(screen.getByText("Giriş sayfası")).toBeInTheDocument();
  });

  it("redirects users without the route permission to apps", () => {
    const hasPermission = vi.fn(() => false);
    setAuthState({ hasPermission });

    renderRoute("/finans");

    expect(hasPermission).toHaveBeenCalledWith("finance.view");
    expect(screen.getByText("Uygulamalar sayfası")).toBeInTheDocument();
  });

  it("renders protected content for an active admin with permission", () => {
    const hasPermission = vi.fn(() => true);
    setAuthState({ hasPermission });

    renderRoute("/finans");

    expect(hasPermission).toHaveBeenCalledWith("finance.view");
    expect(screen.getByText("Korunan içerik")).toBeInTheDocument();
  });
});
