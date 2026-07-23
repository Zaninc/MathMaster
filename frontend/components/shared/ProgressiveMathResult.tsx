"use client";

import { useState } from "react";

import { useIsOverflowing } from "@/hooks/useIsOverflowing";

import { MathFormula } from "./MathFormula";

interface ProgressiveMathResultProps {
  /** LaTeX do valor exato (compacto ou não), ou `null` se ainda não resolveu/não há forma reconhecida. */
  latex: string | null;
  /** Texto cru de fallback quando `latex` é `null`. */
  text: string;
  /** Aproximação numérica do backend (já formatada), ou `null` quando não há uma. */
  approx: string | null;
  className?: string;
  /**
   * `false` suprime o botão "Ver resultado exato" — necessário em contextos
   * onde este componente já é renderizado DENTRO de outro `<button>` (ex.
   * `HistoryPanel`, cujo item inteiro é o botão "Reutilizar expressão"):
   * aninhar `<button>` dentro de `<button>` é HTML inválido e o clique do
   * toggle borbulharia para o botão externo. Nesses casos, a aproximação
   * (quando detectada) fica fixa — o usuário sempre pode clicar
   * "Reutilizar" para ver o valor exato completo na calculadora. Padrão
   * `true` em todo o resto (ex. `ResultPanel`, que não tem esse aninhamento).
   */
  allowToggle?: boolean;
}

type Mode = "auto" | "exact" | "approx";

/**
 * Sprint V2.1 (apresentação progressiva) — resultados simbólicos longos
 * (ex. "Σ(i=1..30) sin(i)") mostram a aproximação numérica do backend como
 * valor principal, com um botão para revelar o exato. O critério é o
 * espaço REALMENTE ocupado na tela (medido via `useIsOverflowing`,
 * `ResizeObserver` real na PRÓPRIA fórmula exata — nunca um clone
 * separado: uma tentativa anterior com um clone invisível num wrapper
 * `inline-flex` próprio mediu larguras erradas, porque esse wrapper extra
 * mudava o contexto de largura disponível do que o `MathFormula` já tinha
 * como item direto da linha do chamador — nunca uma contagem de
 * caracteres/complexidade simbólica, que não reflete o espaço ocupado na
 * tela), nunca uma contagem de caracteres/complexidade simbólica.
 *
 * NÃO introduz nenhum wrapper novo de layout: em modo "auto" (padrão), o
 * valor exato é renderizado normalmente (mesmo elemento/mesma posição de
 * antes desta sprint) — só quando ele REALMENTE mede overflow é que troca
 * para a aproximação. Uma escolha manual do usuário (clicar no toggle) tem
 * prioridade sobre a medição automática até a próxima resposta chegar
 * (`latex` mudar reseta para "auto").
 *
 * Limitação consciente: como o valor exato desmonta ao trocar para a
 * aproximação, a medição para de reagir a redimensionamento enquanto a
 * aproximação estiver sendo exibida — o botão de toggle sempre permite
 * conferir o valor exato manualmente nesse meio tempo.
 *
 * Quando `approx` é `null` (resultado curto, ou fora do escopo desta
 * sprint — só somatório calcula aproximação hoje), o componente é
 * equivalente a renderizar `<MathFormula scrollable>` diretamente: nenhuma
 * mudança de comportamento para qualquer resultado já existente.
 */
export function ProgressiveMathResult({
  latex,
  text,
  approx,
  className,
  allowToggle = true,
}: ProgressiveMathResultProps) {
  const [ref, isOverflowing] = useIsOverflowing<HTMLElement>();
  const [mode, setMode] = useState<Mode>("auto");
  // Reseta a escolha manual quando um resultado NOVO chega — padrão
  // recomendado do React para "resetar estado quando uma prop muda"
  // (ajuste direto no corpo do render, nunca `setState` dentro de efeito,
  // que dispararia o lint `react-hooks/set-state-in-effect` já visto antes
  // neste projeto em `RouteTransition`).
  const [previousLatex, setPreviousLatex] = useState(latex);
  if (latex !== previousLatex) {
    setPreviousLatex(latex);
    setMode("auto");
  }

  if (latex === null) {
    return <span className={className}>{text}</span>;
  }

  const autoWantsApprox = approx !== null && isOverflowing;
  const showApprox = mode === "approx" || (mode === "auto" && autoWantsApprox);
  // O toggle só aparece quando já se sabe que há algo para alternar — ou o
  // usuário já escolheu manualmente, ou a medição automática já pediu approx.
  const showToggle = allowToggle && approx !== null && (mode !== "auto" || autoWantsApprox);

  return (
    <>
      {showApprox ? (
        <span className={className}>≈ {approx}</span>
      ) : (
        <MathFormula ref={ref} formula={latex} scrollable className={className} />
      )}

      {showToggle && (
        <button
          type="button"
          onClick={() => setMode(showApprox ? "exact" : "approx")}
          className="text-xs text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {showApprox ? "Ver resultado exato" : "Ver aproximado"}
        </button>
      )}
    </>
  );
}
