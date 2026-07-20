-- Sprint "Catálogo versionado de exercícios" — chave estável (slug) para
-- sincronização idempotente via frontend/scripts/sync-exercises/.
-- Aditiva de propósito: nunca apaga/recria linha, nunca toca em id
-- (exercise_attempts.exercise_id continua válido).
-- Como aplicar: Supabase Dashboard → SQL Editor, em blocos pequenos
-- (colar tudo de uma vez já corrompeu migrations anteriores).
-- Pré-requisito: 0003_exercise_attempts.sql já aplicada.

-- ============ Bloco 1 ============
alter table public.exercises add column if not exists slug text;

-- ============ Bloco 2 — Álgebra básica ============
-- Slugs IDÊNTICOS aos usados em frontend/data/exercises/algebra-basica.ts
-- — casados por topic.slug + position, nunca pelo texto da pergunta.
update public.exercises e set slug = 'algebra-basica-simplificacao-001'
  from public.topics t where t.id = e.topic_id and t.slug = 'algebra-basica' and e.position = 1 and e.slug is null;
update public.exercises e set slug = 'algebra-basica-fatoracao-001'
  from public.topics t where t.id = e.topic_id and t.slug = 'algebra-basica' and e.position = 2 and e.slug is null;
update public.exercises e set slug = 'algebra-basica-expressao-racional-001'
  from public.topics t where t.id = e.topic_id and t.slug = 'algebra-basica' and e.position = 3 and e.slug is null;

-- ============ Bloco 3 — Equações ============
-- Slugs IDÊNTICOS aos usados em frontend/data/exercises/equacoes.ts.
update public.exercises e set slug = 'equacoes-primeiro-grau-001'
  from public.topics t where t.id = e.topic_id and t.slug = 'equacoes' and e.position = 1 and e.slug is null;
update public.exercises e set slug = 'equacoes-segundo-grau-001'
  from public.topics t where t.id = e.topic_id and t.slug = 'equacoes' and e.position = 2 and e.slug is null;
update public.exercises e set slug = 'equacoes-discriminante-001'
  from public.topics t where t.id = e.topic_id and t.slug = 'equacoes' and e.position = 3 and e.slug is null;

-- ============ Bloco 4 — Funções ============
-- Slugs IDÊNTICOS aos usados em frontend/data/exercises/funcoes.ts.
update public.exercises e set slug = 'funcoes-avaliacao-001'
  from public.topics t where t.id = e.topic_id and t.slug = 'funcoes' and e.position = 1 and e.slug is null;
update public.exercises e set slug = 'funcoes-dominio-001'
  from public.topics t where t.id = e.topic_id and t.slug = 'funcoes' and e.position = 2 and e.slug is null;
update public.exercises e set slug = 'funcoes-composicao-001'
  from public.topics t where t.id = e.topic_id and t.slug = 'funcoes' and e.position = 3 and e.slug is null;

-- ============ Bloco 5 — fallback de segurança ============
-- Qualquer exercício não coberto pelos blocos acima (cadastrado fora do
-- seed conhecido, ex. via painel) recebe um slug determinístico a partir
-- do próprio id — nunca fica sem slug, nunca duplica, nunca precisa de
-- suposição sobre conteúdo desconhecido.
update public.exercises set slug = 'exercicio-' || substr(id::text, 1, 8) where slug is null;

-- ============ Bloco 6 — trava as garantias ============
alter table public.exercises add constraint exercises_slug_unique unique (slug);
alter table public.exercises alter column slug set not null;
