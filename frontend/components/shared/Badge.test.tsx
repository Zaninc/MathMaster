import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "./Badge";

describe("Badge", () => {
  it("renderiza o rótulo padrão de cada variante", () => {
    render(<Badge variant="dev" />);
    expect(screen.getByText("Em desenvolvimento")).toBeInTheDocument();
  });

  it("renderiza texto customizado quando fornecido", () => {
    render(<Badge variant="preview">Preview da Learning Engine</Badge>);
    expect(screen.getByText("Preview da Learning Engine")).toBeInTheDocument();
  });
});
