import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routerMock = { push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

const signUpMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { signUp: signUpMock },
  }),
}));

import { SignUpForm } from "./SignUpForm";

function fillForm(password = "senha-forte") {
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Theo" } });
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "theo@example.com" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
}

describe("SignUpForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejeita senha curta antes de chamar o Supabase", async () => {
    render(<SignUpForm />);

    fillForm("12345");

    expect(await screen.findByRole("alert")).toHaveTextContent("pelo menos 6 caracteres");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("envia display_name em user_metadata e navega quando já há sessão", async () => {
    signUpMock.mockResolvedValue({ data: { session: {} }, error: null });
    render(<SignUpForm />);

    fillForm();

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledWith({
        email: "theo@example.com",
        password: "senha-forte",
        options: { data: { display_name: "Theo" } },
      });
      expect(routerMock.push).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("mostra aviso de confirmação de e-mail quando signUp não devolve sessão", async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null });
    render(<SignUpForm />);

    fillForm();

    expect(await screen.findByRole("status")).toHaveTextContent("link de confirmação");
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("traduz e-mail já registrado para PT-BR", async () => {
    signUpMock.mockResolvedValue({
      data: { session: null },
      error: { message: "User already registered" },
    });
    render(<SignUpForm />);

    fillForm();

    expect(await screen.findByRole("alert")).toHaveTextContent("já tem uma conta");
  });
});
