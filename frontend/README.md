# MathMaster — Frontend

Interface web do MathMaster (Next.js/App Router + React + TypeScript + Tailwind CSS v4). Consome a API real do backend (`../backend`) — nunca duplica lógica matemática localmente.

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
app/            # rotas (App Router) — layout, páginas
components/     # componentes React (layout/, shared/, ...)
lib/            # cliente de API, config de ambiente, utilitários
data/           # configuração estática (navegação, exemplos, categorias)
```

## Testes

Vitest + React Testing Library (`jsdom`). Arquivos de teste ficam ao lado do código-fonte (`*.test.ts`/`*.test.tsx`), não em uma pasta separada.
