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

  it("ferramentas planejadas continuam sem href", () => {
    const planned = TOOLS.filter((tool) => tool.status === "planned");
    expect(planned.length).toBeGreaterThan(0);
    for (const tool of planned) {
      expect(tool.href).toBeUndefined();
    }
  });
});
