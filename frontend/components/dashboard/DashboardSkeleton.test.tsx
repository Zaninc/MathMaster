import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardSkeleton } from "./DashboardSkeleton";

describe("DashboardSkeleton", () => {
  it("é decorativo (aria-hidden) e não expõe texto para leitores de tela", () => {
    const { container } = render(<DashboardSkeleton />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    expect(container.textContent).toBe("");
  });
});
