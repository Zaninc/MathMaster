import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProgressPreviewSkeleton } from "./ProgressPreviewSkeleton";

describe("ProgressPreviewSkeleton", () => {
  it("mostra o título da seção e um placeholder decorativo (aria-hidden)", () => {
    const { container, getByText } = render(<ProgressPreviewSkeleton />);
    expect(getByText("Seu progresso")).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});
