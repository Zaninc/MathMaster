# LEARNING_RULES.md — Regras Permanentes de Exercícios (/aprendizado)

Este documento centraliza as regras de estrutura, renderização e progresso para qualquer exercício novo adicionado à Learning Engine do MathMaster. Existe pelo mesmo motivo do `CLAUDE_RULES.md`: substituir a necessidade de repetir instruções a cada exercício novo — **nenhum exercício pode ignorar estas regras.**

Documentação relacionada: [CLAUDE_RULES.md](./CLAUDE_RULES.md) · [MVP_SCOPE.md](./MVP_SCOPE.md) · [UI_UX.md](./UI_UX.md)

---

## 1. Filosofia

A área de aprendizado existe para ensinar, acompanhar e motivar. Todo exercício novo deve seguir a mesma estrutura visual, pedagógica e de progresso já existente — nunca um formato próprio, por melhor que pareça isoladamente.

## 2. Estrutura obrigatória

Todo exercício precisa dos campos abaixo, no schema **real** da tabela `exercises` (`supabase/migrations/0002_topics_exercises.sql`, espelhado em `frontend/lib/supabase/types.ts`):

```ts
interface Exercise {
  id: string;
  topic_id: string;               // FK pra topics — sempre um tópico já existente
  difficulty: "facil" | "medio" | "dificil";
  statement: string;               // enunciado em texto simples/Unicode
  statement_latex: string | null;  // fórmula em LaTeX, quando o enunciado tiver matemática
  choices: string[];               // alternativas
  correct_index: number;           // índice da alternativa correta em `choices`
  explanation: string | null;      // todo exercício novo deve preencher — null existe só por flexibilidade do schema
  position: number;                // ordem de exibição dentro do tópico
}
```

> **Nota de correção:** a primeira versão desta regra usava nomes ilustrativos (`topic`, `question`, `options`, `correctAnswer`, `"easy"/"medium"/"hard"`) que não existem no código. Os nomes acima são os reais, tirados de `lib/supabase/types.ts` e `ExerciseCard.tsx` — use sempre este schema, nunca o ilustrativo.

## 3. Renderização obrigatória

Todo exercício novo é exibido pelo `ExerciseCard` já existente (`components/learning/ExerciseCard.tsx`) — **nenhum exercício pode criar um layout próprio**:

1. Card principal (`<article>`, borda/fundo padrão).
2. Enunciado no topo (`statement`, com `statement_latex` renderizado via KaTeX logo abaixo, quando existir).
3. Badge de dificuldade (rótulo PT-BR: Fácil/Médio/Difícil).
4. Alternativas em grade (`choices`).
5. Feedback visual imediato ao responder: verde na alternativa correta, vermelho na selecionada quando errada.
6. Explicação abaixo (`explanation`), sempre que preenchida.
7. Botão "Refazer" (permite responder de novo — cada resposta é uma nova tentativa registrada).

## 4. Matemática

Toda expressão matemática usa KaTeX via `statement_latex` (`components/shared/MathFormula.tsx`) — nunca ASCII cru no enunciado exibido.

Nunca renderizar: `x^2`, `sqrt(x)`, `int_0^1`.
Sempre renderizar: \(x^2\), \(\sqrt{x}\), \(\int_0^1 x\,dx\) — LaTeX real em `statement_latex`.

## 5. Dificuldades

- **facil**: aplicação direta, um conceito.
- **medio**: combinação de conceitos, mais etapas.
- **dificil**: raciocínio mais profundo, múltiplas transformações.

Valores reais no tipo `ExerciseDifficulty`: `"facil" | "medio" | "dificil"` — sem acento, minúsculo.

## 6. Progressão

Todo exercício novo:

- pertence a um `topic_id` já existente em `topics` — nunca cria um tópico "de passagem" só pra um exercício;
- alimenta domínio e confiança automaticamente através de `exercise_attempts` → `computeTopicMetrics` (`lib/learning/metrics.ts`) — nenhum exercício calcula ou guarda domínio/confiança por conta própria;
- aparece no histórico (`/dashboard/historico`, `AttemptList`) automaticamente, por ser uma linha em `exercise_attempts`;
- participa das recomendações (`buildRecommendations`, mesmo arquivo) automaticamente, pelo mesmo motivo.

**Nenhuma lógica paralela de progresso pode ser criada.** Se uma métrica nova for necessária, ela entra em `lib/learning/metrics.ts` — nunca num componente, nunca duplicada.

## 7. Consistência

Novos exercícios reutilizam, sem exceção:

- `components/learning/ExerciseCard.tsx` (renderização);
- `components/learning/ExerciseBrowser.tsx` (navegação tópico → dificuldade);
- a Learning Engine (`lib/learning/metrics.ts`, `lib/learning/labels.ts`);
- o sistema de histórico (`exercise_attempts`, `AttemptList`);
- as métricas atuais (domínio, confiança, standing).

Duplicar componente ou cálculo para um exercício "especial" é proibido — se o exercício não cabe na estrutura atual, o problema é a estrutura (discutir antes de implementar), não criar uma exceção.

---

## Como expandir este documento

- Novas regras permanentes de exercícios entram na seção correspondente (ou numa nova seção numerada, ao final).
- Regras específicas de um exercício único **não** entram aqui.
- Se uma regra daqui for revista ou revogada, registrar a mudança e o motivo, não apenas apagar silenciosamente.
