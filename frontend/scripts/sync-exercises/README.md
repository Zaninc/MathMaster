# sync-exercises

Sincroniza o catálogo versionado de exercícios (`frontend/data/exercises/`) com o Supabase. Ver `LEARNING_RULES.md` na raiz do repo para o fluxo obrigatório completo.

## Onde criar exercícios

Em `frontend/data/exercises/<topic-slug>.ts`, exportando um array tipado `ExerciseDraft[]` (ver `types.ts`). Depois, adicione o array ao `ALL_EXERCISES` em `index.ts`. Nunca edite exercícios direto no painel do Supabase — o Git é a fonte de autoria, o Supabase é só o runtime.

## Variáveis de ambiente necessárias

Em `frontend/.env.local` (nunca commitado — ver `.env.local.example`):

| Variável | De onde vem |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Já configurada pra rodar o app normalmente |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → `service_role` — **secreta**, nunca `NEXT_PUBLIC_`, nunca exposta ao frontend |

Sem as duas, o script falha na largada com uma mensagem clara — nunca tenta conectar parcialmente.

## Validar sem conectar ao Supabase

A validação estrutural roda antes de qualquer conexão — rodar os testes já cobre isso sem precisar de rede:

```
npm run test -- scripts/sync-exercises
```

## Dry-run (não escreve nada)

```
npm run sync:exercises -- --dry-run
```

Carrega o catálogo, valida, resolve os tópicos, compara com o que já existe no Supabase e imprime o que seria inserido/atualizado — e o que existe no banco mas não está mais no catálogo local (reportado, **nunca apagado**).

## Sincronizar de verdade

```
npm run sync:exercises
```

Faz upsert por `slug` (nunca pelo texto da pergunta) — roda quantas vezes for preciso sem duplicar. Exercícios já existentes mantêm seu `id` original (as tentativas registradas continuam válidas).

## Antes de rodar em produção

1. Criar e revisar a migration de schema, se houver uma nova.
2. Aplicar a migration no Supabase (SQL Editor, em blocos pequenos).
3. Rodar os testes (`npm run test`).
4. Rodar o dry-run e conferir a lista de inserções/atualizações.
5. Rodar o sync real.
6. Abrir `/aprendizado` e testar respostas.
7. Rodar o sync de novo e confirmar que a contagem de inseridos é zero.
