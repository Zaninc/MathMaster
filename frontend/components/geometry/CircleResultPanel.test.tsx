import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CircleResultPanel } from "./CircleResultPanel";

describe("CircleResultPanel", () => {
  it("não renderiza nada quando não há estatísticas", () => {
    const { container } = render(<CircleResultPanel stats={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("separa a fórmula do resultado numérico da área e do comprimento", () => {
    render(<CircleResultPanel stats={{ area: 78.54, circumference: 31.42 }} />);

    expect(screen.getByText("πr²")).toBeInTheDocument();
    expect(screen.getByText("78.54")).toBeInTheDocument();
    expect(screen.getByText("2πr")).toBeInTheDocument();
    expect(screen.getByText("31.42")).toBeInTheDocument();
  });
});
