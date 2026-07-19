import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routerMock = { push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

const signInWithPasswordMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { signInWithPassword: signInWithPasswordMock },
  }),
}));

import { LoginForm } from "./LoginForm";

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "theo@example.com" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-secreta" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("desabilita o submit enquanto os campos estão vazios", () => {
    render(<LoginForm />);
    expect(screen.getByRole("button", { name: "Entrar" })).toBeDisabled();
  });

  it("faz login e navega para o dashboard no sucesso", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    render(<LoginForm />);

    fillAndSubmit();

    await waitFor(() => {
      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        email: "theo@example.com",
        password: "senha-secreta",
      });
      expect(routerMock.refresh).toHaveBeenCalled();
      expect(routerMock.push).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("traduz credenciais inválidas para PT-BR e não navega", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    render(<LoginForm />);

    fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha incorretos.");
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("usa mensagem genérica para erro desconhecido", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: { message: "some internal supabase detail" },
    });
    render(<LoginForm />);

    fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível entrar agora. Tente novamente."
    );
  });
});
