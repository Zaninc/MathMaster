-- Sprint V1.5.2 — tópicos + exercícios (múltipla escolha) + seed de teste.
-- Como aplicar: Supabase Dashboard → SQL Editor → colar e executar.
-- Pré-requisito: 0001_profiles.sql já aplicada.

-- Tópicos de estudo (Álgebra, Equações, ...). Conteúdo global do produto,
-- não pertence a um usuário — o vínculo com o usuário autenticado é o RLS
-- de leitura abaixo (sem sessão, nada é listado).
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.topics is
  'Tópicos de exercícios (Sprint V1.5.2). Leitura só autenticada; escrita só via SQL/painel.';

-- Exercícios de múltipla escolha (decisão da sprint: 4 alternativas,
-- correção instantânea no cliente; resposta digitada fica para o futuro).
-- statement_latex é opcional: fórmula em destaque renderizada com KaTeX.
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete cascade,
  difficulty text not null check (difficulty in ('facil', 'medio', 'dificil')),
  statement text not null,
  statement_latex text,
  choices jsonb not null check (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) = 4),
  correct_index smallint not null check (correct_index between 0 and 3),
  explanation text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.exercises is
  'Exercícios de múltipla escolha (Sprint V1.5.2). choices = array JSON de 4 strings.';

create index if not exists exercises_topic_id_idx on public.exercises (topic_id);

-- RLS: leitura exige usuário autenticado (requisito da sprint — exercícios
-- vinculados ao login; a calculadora segue pública pois não toca nessas
-- tabelas). Sem políticas de escrita de propósito: conteúdo é gerenciado
-- por SQL/painel, nunca pelo cliente.
alter table public.topics enable row level security;
alter table public.exercises enable row level security;

drop policy if exists "topics_select_authenticated" on public.topics;
create policy "topics_select_authenticated"
  on public.topics for select
  to authenticated
  using (true);

drop policy if exists "exercises_select_authenticated" on public.exercises;
create policy "exercises_select_authenticated"
  on public.exercises for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Seed manual de teste (idempotente via on conflict do slug + delete dos
-- exercícios dos tópicos seedados antes de reinserir).
-- ---------------------------------------------------------------------------

insert into public.topics (slug, title, description, position) values
  ('algebra-basica', 'Álgebra básica', 'Simplificação, fatoração e operações com expressões.', 1),
  ('equacoes', 'Equações', 'Equações de primeiro e segundo grau.', 2),
  ('funcoes', 'Funções', 'Avaliação, domínio e comportamento de funções.', 3)
on conflict (slug) do update
  set title = excluded.title,
      description = excluded.description,
      position = excluded.position;

delete from public.exercises
  where topic_id in (select id from public.topics where slug in ('algebra-basica', 'equacoes', 'funcoes'));

insert into public.exercises (topic_id, difficulty, statement, statement_latex, choices, correct_index, explanation, position)
select t.id, e.difficulty, e.statement, e.statement_latex, e.choices, e.correct_index, e.explanation, e.position
from (values
  -- Álgebra básica
  ('algebra-basica', 'facil', 'Simplifique a expressão:', '3x + 2x - x',
    '["5x", "4x", "6x", "x"]'::jsonb, 1,
    '3x + 2x - x = (3 + 2 - 1)x = 4x.', 1),
  ('algebra-basica', 'medio', 'Fatore completamente:', 'x^2 - 9',
    '["(x−3)(x+3)", "(x−9)(x+1)", "(x−3)²", "x(x−9)"]'::jsonb, 0,
    'Diferença de quadrados: x² − 9 = x² − 3² = (x−3)(x+3).', 2),
  ('algebra-basica', 'dificil', 'Qual é o valor da expressão quando x = 2?', '\dfrac{x^3 - 8}{x - 2}',
    '["0", "12", "8", "indefinido"]'::jsonb, 1,
    'x³ − 8 = (x−2)(x² + 2x + 4); cancelando (x−2), sobra x² + 2x + 4 = 4 + 4 + 4 = 12.', 3),

  -- Equações
  ('equacoes', 'facil', 'Resolva a equação:', '2x + 6 = 0',
    '["x = 3", "x = -3", "x = -6", "x = 6"]'::jsonb, 1,
    '2x = −6, logo x = −3.', 1),
  ('equacoes', 'medio', 'Quais são as raízes da equação?', 'x^2 - 5x + 6 = 0',
    '["x = 1 e x = 6", "x = -2 e x = -3", "x = 2 e x = 3", "x = -1 e x = -6"]'::jsonb, 2,
    'Soma 5 e produto 6: as raízes são 2 e 3.', 2),
  ('equacoes', 'dificil', 'Para qual valor de k a equação tem exatamente uma raiz real?', 'x^2 + kx + 9 = 0',
    '["k = 3 ou k = -3", "k = 9", "k = 6 ou k = -6", "k = 0"]'::jsonb, 2,
    'Uma raiz real exige Δ = 0: k² − 36 = 0, logo k = ±6.', 3),

  -- Funções
  ('funcoes', 'facil', 'Se f(x) = 2x + 1, quanto vale f(3)?', null,
    '["6", "5", "7", "9"]'::jsonb, 2,
    'f(3) = 2·3 + 1 = 7.', 1),
  ('funcoes', 'medio', 'Qual é o domínio da função?', 'f(x) = \dfrac{1}{x - 4}',
    '["x > 4", "Todos os reais", "Todos os reais exceto 0", "Todos os reais exceto 4"]'::jsonb, 3,
    'O denominador não pode ser zero: x − 4 ≠ 0, logo x ≠ 4.', 2),
  ('funcoes', 'dificil', 'Se f(x) = x² e g(x) = x + 1, qual é f(g(2))?', null,
    '["5", "6", "3", "9"]'::jsonb, 3,
    'g(2) = 3 e f(3) = 3² = 9.', 3)
) as e(topic_slug, difficulty, statement, statement_latex, choices, correct_index, explanation, position)
join public.topics t on t.slug = e.topic_slug;
