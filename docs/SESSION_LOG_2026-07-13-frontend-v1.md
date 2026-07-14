# SESSION_LOG_2026-07-13-frontend-v1.md
## MathMaster — Registro de Sessão

| | |
|---|---|
| **Data** | 2026-07-13 |
| **Produto** | MathMaster |
| **Escopo da sessão** | Sprint Frontend V1 completa (Etapas 0–8) — primeira interface real do MathMaster, substituindo o protótipo de input único do Sprint 2 |

---

## 1. O que foi implementado

Reconstrução completa do frontend (`frontend/`), antes um scaffold de `create-next-app` com uma única página. Processo em duas fases por etapa, como já era padrão no backend: plano apresentado (arquitetura, arquivos afetados, decisões) → implementação → `lint`/`test`/`build`/smoke test → commit isolado. A partir da aprovação da Etapa 2, o ritmo de revisão intermediária foi explicitamente dispensado pelo Theo ("prosseguir todas as etapas sem a revisão final, para economizar tempo") — etapas 3–8 foram implementadas e commitadas em sequência, sem pausa para aprovação prévia, mantendo os mesmos gates de qualidade.

### 1.1 Etapa 0 — Fundação (commit `b29672a`)

Design tokens dark-only (paleta aprovada na auditoria — azul elétrico, sem tema claro), `NavBar`/`Footer`/`PageShell`, navegação funcional nas 7 rotas (6 placeholders honestos "em construção"), cliente de API tipado (`lib/api/client.ts`) com classificação de erros (`invalid_expression`/`backend_timeout`/`rate_limited`/`server_error`/`network_error`/`network_timeout`), migração de `NEXT_PUBLIC_API_URL` para `NEXT_PUBLIC_MATHMASTER_API_URL` (fallback depreciado com aviso). Vitest + React Testing Library introduzidos desde o início (diferente do backend, que só formalizou pytest no Hardening II).

### 1.2 Etapa 1 — Home (commit `cd1bbbb`)

Hero com slogan oficial ("Ensinar. Acompanhar. Motivar.") e fundo SVG decorativo estático (sem animação — evita `prefers-reduced-motion` por construção), Calculadora rápida 100% funcional (chama o backend real, 8 atalhos de categoria + 6 exemplos), Três Pilares como composição conectada, Preview de progresso (`DomainMeter` reutilizável), tira de visualização estática claramente legendada como prévia, teaser do Math Mentor. Histórico removido da Home (fora da especificação desta página; segue disponível na Calculadora).

### 1.3 Etapa 2 — Calculadora (commit `4a5e480`)

Editor híbrido aprovado na auditoria: input de texto real (fonte de verdade) + `MathPreview` cosmético (só embeleza expoentes `**n`, nunca 2ª fonte de informação) + `MathKeyboard` com 7 categorias/~40 teclas que inserem no cursor (`lib/math/insert-at-cursor.ts`, função pura testada). `ResultPanel` com skeleton, copiar, tentar outro e "ver explicação" desabilitado. `HistoryPanel` honesto (histórico é global da instância, não pessoal; "Ocultar" é só local, não existe endpoint de exclusão). Pré-preenchimento via `?expression=` sem auto-resolver.

### 1.4 Etapa 3 — Gráficos (commit `f7b701a`)

Plano cartesiano próprio em SVG (`GraphCanvas`, pan via Pointer Events, zoom via wheel/botões, tooltip). Avaliador numérico sandboxed (`lib/math/plot-evaluator.ts`): `mathjs` por dynamic import (confirmado isolado num chunk de ~756KB próprio, fora do bundle inicial), AST validada nó a nó contra uma whitelist explícita (nunca `mathjs.evaluate()` livre) — bloqueia atribuição, definição de função, acesso a propriedade, array/objeto, símbolo desconhecido, função fora da whitelist. Um bug real foi pego pelos testes antes de chegar à UI: `FunctionNode.forEach()` do mathjs também visita o identificador da própria função (`sin` de `sin(x)`), rejeitado por engano como símbolo desconhecido — corrigido iterando `.args` diretamente.

### 1.5 Etapa 4 — Geometria (commit `d73672e`)

Fronteira documentada explicitamente (README + comentários no código): Triângulo (3 vértices, classificação por lados/ângulos, área via fórmula do shoelace) e Círculo (área/comprimento) são calculados no frontend — fórmulas fixas, sem ambiguidade. Reta/Circunferência/Parábola/Elipse/Hipérbole sempre chamam o backend real; o `GeometryCanvas` desenha a partir dos mesmos números do formulário, nunca reinterpretando a resposta em texto do backend. Todas as 5 sintaxes técnicas de geometria analítica (incl. o caso de rejeição de parábola diagonal) validadas contra o backend real antes de escrever a UI.

### 1.6 Etapa 5 — Aprendizado (commit `bdefb2a`)

Dashboard 100% preview (`<Badge variant="preview">` em toda seção com dado demonstrativo) — domínio médio, sequência de estudos, domínio por área (reaproveita `DomainMeter` da Etapa 1), pontos fortes/atenção (derivados dos mesmos dados demonstrativos, sem inventar métrica nova), próximo passo recomendado, conceitos futuros da Learning Engine. Única seção real: "Atividade recente", via `/history` de verdade.

### 1.7 Etapa 6 — Ferramentas + IA (commit `966d683`)

Ferramentas: grid de 9 recursos, cada um honestamente rotulado "Disponível" (Histórico → linka para a Calculadora; Fórmulas → referência estática real, sem backend) ou "Planejado — V1.1/V1.5". Math Mentor: preview conceitual (4 features), input desabilitado com explicação em texto visível (não só `placeholder`, que alguns leitores de tela não anunciam de forma confiável).

### 1.8 Etapa 7 — Polimento (commit `4abeb72`)

Achado real de contraste: `--text-muted` (`#5f6b85`) tinha ~3.77:1 contra o fundo — abaixo do WCAG AA (4.5:1) para texto normal; corrigido para `#7280a0` (~5.09:1), demais tokens verificados e aprovados (todos ≥4.6:1). Skip link ("Pular para o conteúdo"). Metadata por página (title/description, incl. correção de um aviso do Next 16 sobre `themeColor` pertencer a `viewport`, não a `metadata`). Favicon próprio (`app/icon.svg`, monograma) substituindo o ícone padrão do `create-next-app`. Páginas `not-found.tsx`/`error.tsx` com a identidade visual (antes usariam o fallback genérico do Next). `graficos/page.tsx` refatorado para Server Component (metadata exige isso; o `dynamic(..., {ssr:false})` foi isolado em `GraphsWorkspaceLoader.tsx`, Client Component separado).

### 1.9 Etapa 8 — Deploy readiness (esta etapa)

Documentação (`frontend/README.md` expandido com a fronteira frontend↔backend e instruções de deploy; este log). Confirmado: nenhum segredo no código (`.env.local` nunca versionado, único `.env*` rastreado é o `.env.local.example` com URL pública). `npm audit`: 2 vulnerabilidades moderadas em `postcss`, dependência transitiva do próprio `next@16.2.10` — corrigir exigiria downgrade do Next para `9.3.3` (inaceitável), sem ação disponível no momento.

**Pendência que não pôde ser fechada nesta sessão** (fora do controle deste repositório): CORS de produção. O backend restringe `cors_origins` a uma lista explícita e não há domínio real da Vercel ainda (nenhum deploy foi feito) — `MATHMASTER_CORS_ORIGINS` do backend precisa ser configurado com o domínio real assim que o deploy acontecer. Documentado em `frontend/README.md` §Deploy.

---

## 2. Arquivos criados e modificados

Resumo por etapa nas seções 1.1–1.9 acima. Ao todo: ~90 arquivos novos em `frontend/app/`, `frontend/components/` (calculator/, math-input/, graphs/, geometry/, learning/, tools/, ai/, layout/, shared/), `frontend/lib/` (api/, config/, math/, utils/), `frontend/data/`; `frontend/package.json` (+`mathjs`, +Vitest/RTL/jsdom/`@vitejs/plugin-react-swc`); `frontend/.gitignore` (exceção para `.env*.example`); `frontend/README.md`.

Backend: **zero arquivos alterados** — toda a integração é via `/solve`/`/history`/`/health` já existentes.

---

## 3. Testes executados

**107 testes automatizados** (Vitest + React Testing Library), zero pulados, cobrindo: cliente de API e classificação de erros (incl. o caso frágil de timeout do backend, coberto por regressão dedicada), construção/inserção de sintaxe técnica no cursor, avaliador de plotagem sandboxed (13 testes específicos de bloqueio da whitelist), geometria pura (fórmulas de triângulo/círculo, amostragem de parábola/elipse/hipérbole), e componentes com estado (Home, Calculadora, Gráficos, Geometria, Aprendizado, Ferramentas, Math Mentor) cobrindo sucesso/erro/loading.

`npm run lint`/`npm run build` verdes a cada etapa, não só no final. Smoke tests manuais reais (backend `uvicorn` + frontend `next dev`/`next start`) em toda etapa que integra com o backend, incl. validação prévia de cada string de sintaxe técnica nova (geometria, atalhos do teclado) contra a API real antes de escrever a UI correspondente — mesma disciplina já estabelecida no backend.

**Limitação de ambiente registrada**: sem ferramenta de navegador real neste ambiente — verificação visual (responsividade em breakpoints reais, contraste renderizado, animações) feita estruturalmente (classes Tailwind, cálculo de contraste WCAG) e via SSR/build, não por captura de tela real. Um processo `next dev` remanescente de sessão anterior bloqueou reuso da porta 3000 algumas vezes (contornado com `next start` em portas alternativas); não pôde ser encerrado por PID não verificado (classificador de permissões bloqueou corretamente essa ação).

---

## 4. Estado atual do projeto

- **Frontend**: 7 rotas reais (`/`, `/calculadora`, `/graficos`, `/geometria`, `/aprendizado`, `/ferramentas`, `/ia`), todas funcionais ou honestamente marcadas como preview/planejado. Build de produção limpo, 107 testes passando.
- **Backend**: inalterado nesta sprint.
- **Commits**: 9 commits isolados nesta sessão (`b29672a` … `4abeb72`), todos locais — **nenhum push realizado**, aguardando decisão explícita do Theo.
- **Pendência externa**: domínio real da Vercel (para CORS de produção) — depende de decisão/ação fora deste repositório.

## 5. Objetivo da próxima etapa

Decisão do Theo sobre push dos 9 commits para `origin/main` e sobre o deploy real na Vercel (domínio, configuração de `MATHMASTER_CORS_ORIGINS` no backend). Depois disso, V1.1 do roadmap de produto (simulados, caderno de questões, histórico mais avançado) ou a próxima área pendente do Math Engine (`matrices/`), a confirmar.
