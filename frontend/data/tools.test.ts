import { describe, expect, it } from "vitest";

import { TOOLS } from "./tools";

function findTool(title: string) {
  const tool = TOOLS.find((t) => t.title === title);
  if (!tool) throw new Error(`Tool "${title}" não encontrada em TOOLS`);
  return tool;
}

describe("TOOLS", () => {
  it("Histórico aponta para a rota real do histórico completo, não para a calculadora", () => {
    const historico = findTool("Histórico");
    expect(historico.href).toBe("/dashboard/historico");
    expect(historico.status).toBe("live");
  });

  it("Fórmulas continua apontando para /formulas", () => {
    const formulas = findTool("Fórmulas");
    expect(formulas.href).toBe("/formulas");
    expect(formulas.status).toBe("live");
  });

  // --- Hotfix: card "Banco de questões" funcional em Ferramentas ------

  it("Banco de questões está disponível e aponta para /aprendizado (fonte única de exercícios, nenhuma página nova)", () => {
    const bancoDeQuestoes = findTool("Banco de questões");
    expect(bancoDeQuestoes.status).toBe("live");
    expect(bancoDeQuestoes.href).toBe("/aprendizado");
    expect(bancoDeQuestoes.version).toBeUndefined();
  });

  // --- Sprint V2.20: card "Conversores" funcional em Ferramentas -------

  it("Conversores está disponível e aponta para /ferramentas/conversores", () => {
    const conversores = findTool("Conversores");
    expect(conversores.status).toBe("live");
    expect(conversores.href).toBe("/ferramentas/conversores");
    expect(conversores.version).toBeUndefined();
  });

  it("ferramentas planejadas continuam sem href", () => {
    const planned = TOOLS.filter((tool) => tool.status === "planned");
    expect(planned.length).toBeGreaterThan(0);
    for (const tool of planned) {
      expect(tool.href).toBeUndefined();
    }
    // "Banco de questões"/"Conversores" não podem mais estar entre os planejados.
    expect(planned.some((tool) => tool.title === "Banco de questões")).toBe(false);
    expect(planned.some((tool) => tool.title === "Conversores")).toBe(false);
  });
});
