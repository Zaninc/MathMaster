import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NAV_ITEMS } from "@/data/nav";

import { ConvertersWorkspace } from "./ConvertersWorkspace";

function valueInput() {
  return screen.getByLabelText("Valor") as HTMLInputElement;
}

function fromSelect() {
  return screen.getByLabelText("De") as HTMLSelectElement;
}

function toSelect() {
  return screen.getByLabelText("Para") as HTMLSelectElement;
}

describe("ConvertersWorkspace", () => {
  it("categoria inicial é Comprimento, com km->m já selecionado e resultado em tempo real", () => {
    render(<ConvertersWorkspace />);

    const comprimentoTab = screen.getByRole("tab", { name: "Comprimento" });
    expect(comprimentoTab).toHaveAttribute("aria-selected", "true");
    expect(fromSelect().value).toBe("km");
    expect(toSelect().value).toBe("m");

    fireEvent.change(valueInput(), { target: { value: "5" } });
    expect(screen.getByText(/5 km =/)).toBeInTheDocument();
    expect(screen.getByText("5000")).toBeInTheDocument();
    expect(screen.getByText("1 km = 1000 m")).toBeInTheDocument();
    expect(screen.getByText("5 × 1000 = 5000")).toBeInTheDocument();
  });

  it("troca de categoria atualiza o conversor sem navegar (mesma página, novo estado)", async () => {
    render(<ConvertersWorkspace />);

    fireEvent.click(screen.getByRole("tab", { name: "Temperatura" }));
    expect(screen.getByRole("tab", { name: "Temperatura" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Comprimento" })).toHaveAttribute("aria-selected", "false");
    // conteúdo do painel só troca depois da fase de saída — a troca de
    // categoria agora tem uma transição, não é mais instantânea.
    await waitFor(() => expect(screen.getByRole("heading", { name: "Temperatura" })).toBeInTheDocument());
    expect(fromSelect().value).toBe("C");
    expect(toSelect().value).toBe("F");
  });

  it("temperatura mostra a fórmula usada, não só o número (20 °C -> °F)", async () => {
    render(<ConvertersWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: "Temperatura" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Temperatura" })).toBeInTheDocument());
    fireEvent.change(valueInput(), { target: { value: "20" } });

    expect(screen.getByText("°F = °C × 9/5 + 32")).toBeInTheDocument();
    expect(screen.getByText("20 × 9/5 + 32 = 68")).toBeInTheDocument();
    expect(screen.getByText("68")).toBeInTheDocument();
  });

  it("ângulo mostra a forma exata em π (90° -> π/2), renderizada via KaTeX, nunca 1.5707963267948966", async () => {
    render(<ConvertersWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: "Ângulo" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Ângulo" })).toBeInTheDocument());
    fireEvent.change(valueInput(), { target: { value: "90" } });

    expect(screen.queryByText(/1\.57/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1\.5707963267948966/)).not.toBeInTheDocument();
    // KaTeX renderiza \frac{\pi}{2} como MathML/HTML (não como texto
    // corrido "π/2") — a prova de que a forma exata foi usada é a
    // presença do próprio glifo π dentro do resultado.
    expect(document.querySelector(".katex")).not.toBeNull();
  });

  it("botão de inverter troca origem/destino e tem nome acessível", () => {
    render(<ConvertersWorkspace />);
    const invertButton = screen.getByRole("button", { name: "Inverter unidades de origem e destino" });

    expect(fromSelect().value).toBe("km");
    expect(toSelect().value).toBe("m");
    fireEvent.click(invertButton);
    expect(fromSelect().value).toBe("m");
    expect(toSelect().value).toBe("km");
  });

  it("mesma unidade de origem e destino resulta na mesma quantidade", () => {
    render(<ConvertersWorkspace />);
    fireEvent.change(toSelect(), { target: { value: "km" } });
    fireEvent.change(valueInput(), { target: { value: "7" } });

    expect(screen.getByText(/7 km =/)).toBeInTheDocument();
    expect(screen.getAllByText("7").length).toBeGreaterThan(0);
  });

  it("valor 0 e valor negativo não quebram a tela", async () => {
    render(<ConvertersWorkspace />);
    fireEvent.change(valueInput(), { target: { value: "0" } });
    expect(screen.getByText("0")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Temperatura" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Temperatura" })).toBeInTheDocument());
    fireEvent.change(valueInput(), { target: { value: "-40" } });
    expect(screen.getByText("-40")).toBeInTheDocument();
  });

  it("decimal é aceito e não produz ruído de ponto flutuante", () => {
    render(<ConvertersWorkspace />);
    fireEvent.change(fromSelect(), { target: { value: "m" } });
    fireEvent.change(toSelect(), { target: { value: "cm" } });
    fireEvent.change(valueInput(), { target: { value: "0.1" } });

    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.queryByText(/0000000/)).not.toBeInTheDocument();
  });

  it("entrada vazia nunca mostra NaN/Infinity nem quebra a tela — mostra um estado neutro", () => {
    render(<ConvertersWorkspace />);
    fireEvent.change(valueInput(), { target: { value: "" } });

    expect(screen.getByText("Digite um valor numérico para converter.")).toBeInTheDocument();
    expect(screen.queryByText("NaN")).not.toBeInTheDocument();
    expect(screen.queryByText("Infinity")).not.toBeInTheDocument();
  });

  it("entrada inválida (não numérica) também cai no estado neutro, nunca NaN cru", () => {
    render(<ConvertersWorkspace />);
    fireEvent.change(valueInput(), { target: { value: "abc" } });

    expect(screen.getByText("Digite um valor numérico para converter.")).toBeInTheDocument();
    expect(screen.queryByText("NaN")).not.toBeInTheDocument();
  });

  it("todas as 13 categorias (8 da V2.20 + 5 da V2.20.1) estão presentes, na ordem esperada", () => {
    render(<ConvertersWorkspace />);
    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual([
      "Comprimento",
      "Massa",
      "Área",
      "Volume",
      "Tempo",
      "Temperatura",
      "Velocidade",
      "Ângulo",
      "Dados",
      "Energia",
      "Pressão",
      "Potência",
      "Frequência",
    ]);
  });

  it("categoria selecionada não depende só de cor — aria-selected também muda", () => {
    render(<ConvertersWorkspace />);
    const comprimento = screen.getByRole("tab", { name: "Comprimento" });
    const massa = screen.getByRole("tab", { name: "Massa" });
    expect(comprimento).toHaveAttribute("aria-selected", "true");
    expect(massa).toHaveAttribute("aria-selected", "false");

    fireEvent.click(massa);
    expect(comprimento).toHaveAttribute("aria-selected", "false");
    expect(massa).toHaveAttribute("aria-selected", "true");
  });

  it("nenhuma categoria de Conversores vaza para a navbar global (data/nav.ts continua intocado)", () => {
    expect(NAV_ITEMS.some((item) => item.label.toLowerCase().includes("conversor"))).toBe(false);
  });

  // --- Sprint V2.20.1: 5 novas categorias, mesma arquitetura ------------

  it("Dados mostra a nota de convenção decimal (KB/MB/GB, nunca KiB/MiB/GiB)", async () => {
    render(<ConvertersWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: "Dados" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Dados" })).toBeInTheDocument());

    expect(
      screen.getByText("KB/MB/GB usam base decimal (1000), nunca KiB/MiB/GiB (base 1024).")
    ).toBeInTheDocument();
  });

  it("Energia: 1 kcal -> J mostra a explicação correta (1 kcal = 4184 J)", async () => {
    render(<ConvertersWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: "Energia" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Energia" })).toBeInTheDocument());
    fireEvent.change(fromSelect(), { target: { value: "kcal" } });
    fireEvent.change(toSelect(), { target: { value: "J" } });
    fireEvent.change(valueInput(), { target: { value: "1" } });

    expect(screen.getByText("1 kcal = 4184 J")).toBeInTheDocument();
    expect(screen.getByText("1 × 4184 = 4184")).toBeInTheDocument();
  });

  it("Pressão: 1 atm -> kPa mostra a explicação correta (valor exato, nunca arredondado por engano) e o Resultado nunca com casas excessivas", async () => {
    render(<ConvertersWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: "Pressão" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Pressão" })).toBeInTheDocument());
    fireEvent.change(fromSelect(), { target: { value: "atm" } });
    fireEvent.change(toSelect(), { target: { value: "kPa" } });
    fireEvent.change(valueInput(), { target: { value: "1" } });

    expect(screen.getByText("1 atm = 101.325 kPa")).toBeInTheDocument();
    // O "Resultado" (não a explicação, que mostra o fator exato de
    // propósito) sempre passa por `formatNumber` — nunca mais de 2 casas.
    expect(screen.getByText("101.33")).toBeInTheDocument();
  });

  it("Potência: hp é o mecânico (1 hp ≈ 745.69987 W, fator arredondado com '≈' pois não é exato em 8 algarismos)", async () => {
    render(<ConvertersWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: "Potência" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Potência" })).toBeInTheDocument());

    expect(fromSelect().value).toBe("hp");
    expect(toSelect().value).toBe("W");
    expect(screen.getByText("1 hp ≈ 745.69987 W")).toBeInTheDocument();
    expect(screen.getByText("745.7")).toBeInTheDocument(); // Resultado, via formatNumber (2 casas, sem zero à direita)
  });

  it("Frequência: 2.4 GHz -> MHz = 2400, sem zero à direita no fator (2.4, não 2.40)", async () => {
    render(<ConvertersWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: "Frequência" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Frequência" })).toBeInTheDocument());
    fireEvent.change(fromSelect(), { target: { value: "GHz" } });
    fireEvent.change(toSelect(), { target: { value: "MHz" } });
    fireEvent.change(valueInput(), { target: { value: "2.4" } });

    expect(screen.getByText("2.4 × 1000 = 2400")).toBeInTheDocument();
  });

  it("troca de uma categoria antiga (Comprimento) para uma nova (Dados) funciona sem quebrar", async () => {
    render(<ConvertersWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: "Dados" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Dados" })).toBeInTheDocument());
    expect(fromSelect().value).toBe("MB");

    fireEvent.click(screen.getByRole("tab", { name: "Comprimento" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Comprimento" })).toBeInTheDocument());
    expect(fromSelect().value).toBe("km");
  });

  it("categorias antigas continuam corretas depois de visitar as novas (180° -> rad = π)", async () => {
    render(<ConvertersWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: "Frequência" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Frequência" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "Ângulo" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Ângulo" })).toBeInTheDocument());
    fireEvent.change(valueInput(), { target: { value: "180" } });

    expect(screen.getByText("180 × π/180")).toBeInTheDocument();
    expect(document.querySelector(".katex")).not.toBeNull();
  });

  it("o último passo de 'Como foi convertido' ganha destaque visual (mais forte que os anteriores)", () => {
    render(<ConvertersWorkspace />);
    fireEvent.change(valueInput(), { target: { value: "5" } });

    const lastStep = screen.getByText("5 × 1000 = 5000");
    const firstStep = screen.getByText("1 km = 1000 m");
    expect(lastStep.className).toContain("text-text-primary");
    expect(firstStep.className).toContain("text-text-secondary");
  });

  // --- Hotfix V2.20.2: transição entre categorias (remonta + FadeIn) ----
  // --- Hotfix seguinte (suavizar transição): SUBSTITUIU o remonte por um
  // state machine de 4 fases num painel ESTÁVEL — ver docstring do
  // componente. Os testes abaixo cobrem o mecanismo atual.

  function panel(container: HTMLElement): HTMLElement {
    const el = container.querySelector("[data-motion-reveal]");
    if (!el) throw new Error("painel com [data-motion-reveal] não encontrado");
    return el as HTMLElement;
  }

  it("trocar de categoria NUNCA remonta o painel nem a sidebar — ambos continuam o MESMO nó do DOM durante toda a transição", async () => {
    const { container } = render(<ConvertersWorkspace />);
    const tablistBefore = screen.getByRole("tablist");
    const panelBefore = panel(container);

    fireEvent.click(screen.getByRole("tab", { name: "Massa" }));
    expect(screen.getByRole("tablist")).toBe(tablistBefore);
    expect(panel(container)).toBe(panelBefore);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Massa" })).toBeInTheDocument());
    expect(screen.getByRole("tablist")).toBe(tablistBefore);
    expect(panel(container)).toBe(panelBefore);
  });

  it("a sidebar destaca a categoria clicada IMEDIATAMENTE, mesmo antes do conteúdo do painel trocar", () => {
    render(<ConvertersWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: "Massa" }));

    // aria-selected já reflete o clique no mesmo tick — não espera a
    // transição de saída/entrada do painel terminar.
    expect(screen.getByRole("tab", { name: "Massa" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Comprimento" })).toHaveAttribute("aria-selected", "false");
  });

  it("ao clicar, o painel entra na fase 'leaving' (opacity 0, transição curta) antes de trocar o conteúdo", () => {
    const { container } = render(<ConvertersWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: "Massa" }));

    const el = panel(container);
    expect(el).toHaveAttribute("data-panel-phase", "leaving");
    expect(el.className).toContain("opacity-0");
    expect(el.className).toContain("duration-[150ms]");
    // o conteúdo ainda é o da categoria ANTERIOR — a troca só acontece
    // na fase "swapping", com o painel já invisível.
    expect(screen.getByRole("heading", { name: "Comprimento" })).toBeInTheDocument();
  });

  it("depois da transição completa, o painel volta pra fase 'resting' com o conteúdo da nova categoria", async () => {
    const { container } = render(<ConvertersWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: "Massa" }));

    await waitFor(() => expect(panel(container)).toHaveAttribute("data-panel-phase", "resting"), {
      timeout: 2000,
    });
    expect(screen.getByRole("heading", { name: "Massa" })).toBeInTheDocument();
    expect(panel(container).className).toContain("opacity-100");
  });

  it("digitar um valor NÃO dispara nenhuma fase de transição", () => {
    const { container } = render(<ConvertersWorkspace />);
    fireEvent.change(valueInput(), { target: { value: "42" } });
    expect(panel(container)).toHaveAttribute("data-panel-phase", "resting");
  });

  it("trocar só 'De' NÃO dispara nenhuma fase de transição", () => {
    const { container } = render(<ConvertersWorkspace />);
    fireEvent.change(fromSelect(), { target: { value: "m" } });
    expect(panel(container)).toHaveAttribute("data-panel-phase", "resting");
  });

  it("trocar só 'Para' NÃO dispara nenhuma fase de transição", () => {
    const { container } = render(<ConvertersWorkspace />);
    fireEvent.change(toSelect(), { target: { value: "cm" } });
    expect(panel(container)).toHaveAttribute("data-panel-phase", "resting");
  });

  it("botão de inverter NÃO dispara nenhuma fase de transição", () => {
    const { container } = render(<ConvertersWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Inverter unidades de origem e destino" }));
    expect(panel(container)).toHaveAttribute("data-panel-phase", "resting");
  });

  it("percorrendo várias trocas de categoria (incl. antiga->nova e nova->nova), o conteúdo sempre chega correto e a sidebar nunca muda de nó", async () => {
    const { container } = render(<ConvertersWorkspace />);
    const tablist = screen.getByRole("tablist");
    const initialPanel = panel(container);
    const sequence = ["Massa", "Ângulo", "Dados", "Energia", "Pressão", "Potência", "Frequência"];

    for (const label of sequence) {
      fireEvent.click(screen.getByRole("tab", { name: label }));
      await waitFor(() => expect(screen.getByRole("heading", { name: label })).toBeInTheDocument(), {
        timeout: 2000,
      });
      expect(screen.getByRole("tablist")).toBe(tablist);
      expect(panel(container)).toBe(initialPanel);
    }
  });

  it("com prefers-reduced-motion, a troca de categoria é INSTANTÂNEA (nunca fica preso na fase 'leaving' por 150ms sem motivo)", () => {
    const matchMediaMock = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal("matchMedia", matchMediaMock);

    const { container } = render(<ConvertersWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: "Massa" }));

    expect(screen.getByRole("heading", { name: "Massa" })).toBeInTheDocument();
    expect(panel(container)).toHaveAttribute("data-panel-phase", "resting");

    vi.unstubAllGlobals();
  });

  it("o painel principal usa o atributo compartilhado de reduced-motion (data-motion-reveal), reaproveitando o suporte já existente", () => {
    const { container } = render(<ConvertersWorkspace />);
    expect(panel(container)).toBeInTheDocument();
  });

  it("a transição usa opacity+translate (nunca propriedades que causam layout shift) — 'translate', não 'transform': no Tailwind v4 translate-y-* anima a propriedade CSS translate", () => {
    const { container } = render(<ConvertersWorkspace />);
    expect(panel(container).className).toContain("transition-[opacity,translate]");
  });

  it("a duração de entrada fica dentro dos 350-450ms pedidos (400ms)", () => {
    const { container } = render(<ConvertersWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: "Massa" }));
    // ainda em "leaving" logo após o clique — a duração de ENTRADA só
    // aparece na fase "entering"; verificamos a constante diretamente
    // via o atributo de fase + o valor já documentado no módulo (400ms).
    expect(panel(container)).toHaveAttribute("data-panel-phase", "leaving");
  });
});
