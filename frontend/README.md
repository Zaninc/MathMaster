# MathMaster — Frontend

Interface web do MathMaster (Next.js 16/App Router + React 19 + TypeScript + Tailwind CSS v4). Consome a API real do backend (`../backend`) — nunca duplica lógica matemática localmente. Ver `docs/SESSION_LOG_2026-07-13-frontend-v1.md` na raiz do repo para o registro completo da Sprint Frontend V1.

## Setup

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). O backend precisa estar rodando (ver `../backend/README.md` ou `../ARCHITECTURE.md`) na URL configurada abaixo.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `NEXT_PUBLIC_MATHMASTER_API_URL` | Recomendada | URL base da API FastAPI. Pública (chega ao navegador) — nunca coloque um segredo aqui. |
| `NEXT_PUBLIC_API_URL` | Depreciada | Fallback do nome usado até o Sprint Frontend V1. Continua funcionando, mas emite aviso no console; migre para a variável acima. |

Sem nenhuma das duas, o cliente de API usa `http://127.0.0.1:8000` como default de desenvolvimento.

## Scripts

```bash
npm run dev         # servidor de desenvolvimento
npm run build        # build de produção
npm run start         # serve o build de produção
npm run lint           # ESLint
npm run test             # Vitest (execução única)
npm run test:watch        # Vitest em modo watch
```

## Estrutura

```
app/            # rotas (App Router) — layout, páginas por área (calculadora/graficos/geometria/aprendizado/ferramentas/ia)
components/     # componentes React, um diretório por área (calculator/, graphs/, geometry/, learning/, tools/, ai/) + layout/ e shared/
lib/            # cliente de API (lib/api), config de ambiente (lib/config), lógica matemática de apresentação (lib/math)
data/           # configuração estática (navegação, exemplos, teclado matemático, fórmulas, dados de preview)
```

## Fronteira frontend ↔ backend (importante)

- **Calculadora**: todo cálculo simbólico é resolvido pelo backend via `POST /solve` (`lib/api/client.ts`). O editor matemático só monta texto na sintaxe que o backend já aceita nativamente — nunca reimplementa parsing/resolução.
- **Gráficos**: usa um avaliador numérico próprio, sandboxed (`lib/math/plot-evaluator.ts`, `mathjs` por dynamic import, AST validada nó a nó contra uma whitelist) só para amostrar pontos de uma função já compreendida — nunca envia essa sintaxe (notação `^`/`sin`/`log` do mathjs) para o backend, e nunca resolve simbolicamente no cliente.
- **Geometria**: fórmulas fixas e determinísticas (área/perímetro de triângulo, área/comprimento de círculo) são calculadas no frontend (`lib/math/geometry.ts`) por serem pedagógicas e sem ambiguidade. Qualquer operação simbólica ou de geometria analítica (reta, circunferência, parábola, elipse, hipérbole) chama o backend real; o desenho da figura (`GeometryCanvas`) é sempre derivado dos mesmos números do formulário, nunca da resposta em texto do backend.
- **Aprendizado**: 100% dados demonstrativos (`data/learning-preview.ts`), rotulados com `<Badge variant="preview">` — a Learning Engine real ainda não existe no backend. A única seção real da página é "Atividade recente", que usa `/history` de verdade.
- **IA (Math Mentor)**: puramente conceitual, `<Badge variant="dev">`, input desabilitado.

## Renderização matemática (KaTeX)

Todo LaTeX exibido ao usuário passa por `components/shared/MathFormula.tsx` — fundação única de renderização matemática (KaTeX via `katex.renderToString`, SSR-safe e determinística, MathML embutido para leitores de tela, fallback gracioso para LaTeX inválido). Hoje é usada nos painéis de resultado de Geometria (`TriangleResultPanel`/`CircleResultPanel`); calculadora, histórico e o futuro editor devem reutilizar o mesmo componente em vez de renderizar KaTeX diretamente. O CSS do KaTeX é importado pelo próprio componente, então só entra nas rotas que exibem fórmulas.

## Testes

Vitest + React Testing Library (`jsdom`). Arquivos de teste ficam ao lado do código-fonte (`*.test.ts`/`*.test.tsx`), não em uma pasta separada. Cobertura inclui lógica pura (cliente de API, inserção no cursor, avaliador de plotagem sandboxed, geometria) e componentes com estado (fluxos de sucesso/erro/loading).

## Deploy (Vercel)

O projeto é um monorepo (`frontend/` + `backend/`) — na Vercel, configure o projeto com **Root Directory: `frontend`** (Project Settings → General → Root Directory). O framework Next.js é detectado automaticamente, nenhum `vercel.json` é necessário para o caso padrão.

Variáveis de ambiente a configurar no painel da Vercel (Project Settings → Environment Variables):

| Variável | Ambiente | Valor |
|---|---|---|
| `NEXT_PUBLIC_MATHMASTER_API_URL` | Production/Preview | URL pública do backend em produção (ainda não implantado — ver pendência abaixo) |

**Pendência conhecida, fora do controle deste repositório**: o backend (`backend/app/config.py`) restringe `cors_origins` a uma lista explícita (`["http://localhost:3000"]` por padrão) e rejeita wildcard por validação — assim que o domínio real da Vercel existir, `MATHMASTER_CORS_ORIGINS` no ambiente do backend precisa incluir esse domínio, ou requisições do frontend em produção falharão por CORS. Isso é uma configuração de ambiente do backend, não uma mudança de código.
