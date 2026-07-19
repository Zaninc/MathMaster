# Session Log — 2026-07-19 — Sprint V1.5.3 (Histórico)

## Escopo

Tabela `exercise_attempts`, gravação de cada tentativa (acerto/erro + data/hora), página
`/dashboard/historico` com os exercícios resolvidos recentemente. Fora do escopo (intocados):
estatísticas avançadas, learning engine, recomendações, simulados, IA, gamificação.

## O que foi implementado

- **Migração `supabase/migrations/0003_exercise_attempts.sql`**: tabela com
  `user_id default auth.uid()`, `exercise_id` (cascade), `selected_index` (0–3),
  `is_correct`, `created_at`; índice `(user_id, created_at desc)` para a listagem.
- **Decisão central: `is_correct` é derivado por trigger no banco** (`attempts_set_correctness`,
  BEFORE INSERT compara com `exercises.correct_index`) — o cliente envia apenas
  `exercise_id + selected_index`. Provado no smoke: tentativa forjada com `is_correct: true`
  e resposta errada foi sobrescrita para `false` pelo trigger.
- **RLS de isolamento**: insert só como si mesmo (`with check auth.uid() = user_id`),
  select só das próprias; sem update/delete — histórico imutável. Anônimo lê `[]`.
- **`ExerciseCard`**: ao responder, grava a tentativa em fire-and-forget — o feedback visual
  nunca espera o banco; falha de gravação vira só um `console.warn`. "Refazer" + responder
  gera nova tentativa (registro de prática, não nota). Sem Supabase configurado, nada muda.
- **`/dashboard/historico`** (nova, protegida como o `/dashboard`): 20 tentativas mais
  recentes via join PostgREST (`exercise_attempts → exercises → topics`), achatadas num view
  model para o componente puro `AttemptList` (enunciado, tópico, dificuldade, resposta
  escolhida, Acertou/Errou, data/hora `pt-BR` fixada em `America/Sao_Paulo` — determinístico
  entre server e client, sem mismatch de hidratação).
- **Dashboard**: atalho "Histórico" adicionado; descrição do atalho "Aprendizado" atualizada
  ("Trilhas de estudo guiadas" → "Exercícios por tópico e dificuldade", refletindo a V1.5.2).

## Requisitos verificados

- Histórico só para autenticados: página redireciona para `/login`; RLS nega leitura anônima.
- Isolamento por usuário via RLS: provado via REST (anon `[]`, autenticado vê as suas).
- Calculadora continua pública (nenhum arquivo dela tocado).
- `/aprendizado` e `/dashboard` compatíveis (só acréscimos).

## Validação

| Item | Resultado |
| --- | --- |
| `npm run test` | 229/229 (37 arquivos; +6 novos: AttemptList e gravação no ExerciseCard) |
| `npm run lint` | limpo |
| `npm run build` | ok — `/dashboard/historico` dinâmica |
| Migração real | aplicada por Theo em 3 blocos pequenos no SQL Editor |
| Smoke API real | correta→true, errada→false, forjada→sobrescrita, isolamento anon confirmado |

## Incidente de processo (continuação do da V1.5.2)

O colar de SQL longo corrompeu de novo — desta vez **perdendo ~30 caracteres do meio de uma
linha** (sem comentários envolvidos), provando que o problema é de clipboard/render do chat
com blocos longos, não só de comentários. **Norma operacional daqui em diante: migrações
manuais são entregues em blocos pequenos (≤ ~20 linhas), rodados um a um.** Os nomes de
índice/trigger foram encurtados (`attempts_recent_idx`, `attempts_set_correctness`) e o
arquivo versionado foi sincronizado com o que foi de fato aplicado.

## Limitações conhecidas

- Lista fixa nas 20 últimas tentativas (sem paginação — suficiente para o volume atual).
- A conta de teste carrega as tentativas do smoke (3 linhas) — inofensivo.
- Pendências pré-existentes: overflow da NavBar em 768px e CORS de produção.
