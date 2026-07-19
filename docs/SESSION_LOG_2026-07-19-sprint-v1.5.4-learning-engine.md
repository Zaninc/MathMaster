# Session Log — 2026-07-19 — Sprint V1.5.4 (Learning Engine v1)

## Escopo

Métricas de domínio por tópico, confiança, progresso baseado nas tentativas, estatísticas na
página `/aprendizado` e recomendações simples de estudo. Determinístico, sem IA. Fora do
escopo (intocados): simulados, gamificação, rankings, notificações, geração de exercícios.

## Arquitetura

**Zero SQL novo.** A fonte é `exercise_attempts` (V1.5.3), que já é isolada por usuário via
RLS e tem `is_correct` à prova de trapaça (trigger). O motor é TypeScript puro:

- **`lib/learning/metrics.ts`** — funções puras, sem rede/relógio/IA, com todos os parâmetros
  de calibração como constantes nomeadas num lugar só:
  - **Domínio (0–100)**: média ponderada dos acertos com decaimento por recência
    (`RECENCY_DECAY = 0.85` por tentativa mais antiga; últimas
    `MAX_ATTEMPTS_CONSIDERED = 20` por tópico). Provado em teste: o mesmo conjunto
    1 erro + 3 acertos dá domínio > 75% com o erro antigo e < 75% com o erro recente.
  - **Confiança**: baixa (< 4 tentativas), média (4–9), alta (≥ 10) — volume de evidência,
    não qualidade.
  - **Progresso**: exercícios distintos tentados / total do tópico (tentativas repetidas não
    inflam).
  - **Tópico nunca tentado → `nao-iniciado` com domínio `null`** (nunca 0% — não iniciado
    não é ruim).
  - **Classificação**: `forte` = domínio ≥ 80 **e** confiança ≥ média (um acerto isolado não
    é domínio); `fraco` = domínio < 50; senão `neutro`.
- **`buildRecommendations`**: máx. 3, priorizando fracos ("Continue praticando X", pior
  primeiro), depois não iniciados ("Comece X"), depois fortes ("Você domina X") — as frases
  da especificação, literais.

## Interface

`components/learning/LearningStats.tsx` (puro, SSR-safe): seção "Seu progresso" no topo do
`/aprendizado` logado — um cartão por tópico com `DomainMeter` **reaproveitado** (o componente
compartilhado com a Home, cujo docstring já previa este uso), selo Ponto forte / Precisa de
atenção / Não iniciado (borda do cartão acompanha), linha de progresso+tentativas+confiança,
e a caixa "Sugestões de estudo". Deslogado/não configurado: página exatamente como antes.

A página busca as 200 tentativas mais recentes (`exercise_id, is_correct, created_at`) na
mesma leva paralela de topics/exercises e calcula tudo no Server Component.

## Requisitos verificados

- Isolamento por usuário: a consulta roda com a sessão e o RLS da 0003 filtra no banco.
- Calculadora pública: nenhum arquivo tocado.
- `/dashboard` e `/dashboard/historico`: nenhum arquivo tocado. `/aprendizado`: só acréscimo.

## Validação

| Item | Resultado |
| --- | --- |
| `npm run test` | 246/246 (39 arquivos; +17: 12 do motor, 5 da UI). Um flake conhecido do MathPreview (janela de debounce sob carga, documentado na sprint KaTeX) falhou 1× e passou 2× seguidas |
| `npm run lint` | limpo |
| `npm run build` | ok |
| Smoke | deslogado sem vazamento da seção; métricas conferidas manualmente contra as tentativas da conta de teste |

## Limitações conhecidas

- Parâmetros (0.85, 80/50, 4/10) são decisões de produto iniciais — calibrar com uso real.
- Domínio considera tentativas, não dificuldade dos exercícios (peso por dificuldade é
  evolução natural).
- Pendências pré-existentes: overflow da NavBar em 768px e CORS de produção.
