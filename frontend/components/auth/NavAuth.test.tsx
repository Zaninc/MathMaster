import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSupabaseBrowserClientMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => getSupabaseBrowserClientMock(),
}));

import { NavAuth } from "./NavAuth";

function mockSupabaseWithSession(session: object | null) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  };
}

describe("NavAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não renderiza nada quando o Supabase não está configurado", () => {
    getSupabaseBrowserClientMock.mockReturnValue(null);
    const { container } = render(<NavAuth variant="desktop" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra Entrar apontando para /login quando deslogado", async () => {
    getSupabaseBrowserClientMock.mockReturnValue(mockSupabaseWithSession(null));
    render(<NavAuth variant="desktop" />);

    const link = await screen.findByRole("link", { name: "Entrar" });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("mostra Dashboard apontando para /dashboard quando logado", async () => {
    getSupabaseBrowserClientMock.mockReturnValue(mockSupabaseWithSession({ user: { id: "u1" } }));
    render(<NavAuth variant="mobile" />);

    const link = await screen.findByRole("link", { name: "Dashboard" });
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("cancela a assinatura de auth no unmount", async () => {
    const supabase = mockSupabaseWithSession(null);
    getSupabaseBrowserClientMock.mockReturnValue(supabase);
    const { unmount } = render(<NavAuth variant="desktop" />);

    await screen.findByRole("link", { name: "Entrar" });
    unmount();

    await waitFor(() => {
      const { subscription } = supabase.auth.onAuthStateChange.mock.results[0]!.value.data;
      expect(subscription.unsubscribe).toHaveBeenCalled();
    });
  });
});
