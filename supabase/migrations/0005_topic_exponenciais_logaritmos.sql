-- Sprint "Exponenciais e Logaritmos" — novo tópico de estudo.
-- Como aplicar: Supabase Dashboard → SQL Editor → colar e executar.
-- Pré-requisito: 0004_exercises_slug.sql já aplicada.
--
-- Só cria o TÓPICO (linha em `topics`) — os exercícios em si NÃO são
-- inseridos aqui. Desde a Sprint "Catálogo versionado de exercícios"
-- (ver 0004, `LEARNING_RULES.md` §8), exercícios entram exclusivamente
-- via `frontend/data/exercises/<topico>.ts` + `npm run sync:exercises`,
-- nunca via SQL manual — o script de sync exige que o tópico já exista
-- no banco antes de sincronizar (`validateTopicReferences`), por isso
-- esta migração precisa ser aplicada ANTES de rodar o sync para
-- `frontend/data/exercises/exponenciais-logaritmos.ts`.

insert into public.topics (slug, title, description, position) values
  ('exponenciais-logaritmos', 'Exponenciais e Logaritmos',
   'Potências, o número de Euler, logaritmos e equações exponenciais.', 4)
on conflict (slug) do update
  set title = excluded.title,
      description = excluded.description,
      position = excluded.position;
