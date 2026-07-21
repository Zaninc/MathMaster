import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useFavoriteFormulas } from "./useFavoriteFormulas";

const STORAGE_KEY = "mathmaster.formulas.favorites";

describe("useFavoriteFormulas", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("começa sem favoritos quando não há nada salvo", async () => {
    const { result } = renderHook(() => useFavoriteFormulas());
    await waitFor(() => expect(result.current.isFavorite("bhaskara")).toBe(false));
  });

  it("hidrata a partir do localStorage já salvo (persistência entre sessões)", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(["bhaskara", "delta"]));

    const { result } = renderHook(() => useFavoriteFormulas());

    await waitFor(() => expect(result.current.isFavorite("bhaskara")).toBe(true));
    expect(result.current.isFavorite("delta")).toBe(true);
    expect(result.current.isFavorite("teorema-pitagoras")).toBe(false);
  });

  it("toggleFavorite adiciona e remove, e persiste no localStorage", async () => {
    const { result } = renderHook(() => useFavoriteFormulas());
    await waitFor(() => expect(result.current.isFavorite("bhaskara")).toBe(false));

    act(() => result.current.toggleFavorite("bhaskara"));
    await waitFor(() => expect(result.current.isFavorite("bhaskara")).toBe(true));
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]")).toEqual(["bhaskara"]);

    act(() => result.current.toggleFavorite("bhaskara"));
    await waitFor(() => expect(result.current.isFavorite("bhaskara")).toBe(false));
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]")).toEqual([]);
  });

  it("ignora conteúdo corrompido no localStorage em vez de quebrar", async () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");

    const { result } = renderHook(() => useFavoriteFormulas());
    await waitFor(() => expect(result.current.isFavorite("bhaskara")).toBe(false));
  });
});
