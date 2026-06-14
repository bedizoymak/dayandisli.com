import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: fromMock },
}));

import { resolveERPUserForAuthUser } from "./auth";

function queryResult(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.is.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  return builder;
}

describe("resolveERPUserForAuthUser", () => {
  beforeEach(() => fromMock.mockReset());

  it("prefers the auth user UUID linkage", async () => {
    const linkedUser = { id: "erp-1", auth_user_id: "auth-1", email: "user@example.com", is_active: true };
    const linkedQuery = queryResult({ data: linkedUser, error: null });
    fromMock.mockReturnValue(linkedQuery);

    await expect(resolveERPUserForAuthUser({ id: "auth-1", email: "user@example.com" })).resolves.toEqual({
      data: linkedUser,
      error: null,
    });
    expect(linkedQuery.eq).toHaveBeenCalledWith("auth_user_id", "auth-1");
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it("uses normalized email only for an unlinked transitional row", async () => {
    const linkedQuery = queryResult({ data: null, error: null });
    const emailUser = { id: "erp-1", auth_user_id: null, email: "user@example.com", is_active: true };
    const emailQuery = queryResult({ data: emailUser, error: null });
    fromMock.mockReturnValueOnce(linkedQuery).mockReturnValueOnce(emailQuery);

    await expect(resolveERPUserForAuthUser({ id: "auth-1", email: "USER@EXAMPLE.COM" })).resolves.toEqual({
      data: emailUser,
      error: null,
    });
    expect(emailQuery.eq).toHaveBeenCalledWith("email", "user@example.com");
    expect(emailQuery.is).toHaveBeenCalledWith("auth_user_id", null);
  });

  it("returns no ERP user instead of creating an implicit viewer", async () => {
    fromMock
      .mockReturnValueOnce(queryResult({ data: null, error: null }))
      .mockReturnValueOnce(queryResult({ data: null, error: null }));

    await expect(resolveERPUserForAuthUser({ id: "auth-1", email: "missing@example.com" })).resolves.toEqual({
      data: null,
      error: null,
    });
  });

  it("stops when the linked lookup fails", async () => {
    const error = new Error("RLS denied");
    fromMock.mockReturnValue(queryResult({ data: null, error }));

    await expect(resolveERPUserForAuthUser({ id: "auth-1", email: "user@example.com" })).resolves.toEqual({
      data: null,
      error,
    });
    expect(fromMock).toHaveBeenCalledTimes(1);
  });
});
