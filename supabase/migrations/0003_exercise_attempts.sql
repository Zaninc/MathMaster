-- Sprint V1.5.3 — histórico de tentativas de exercícios.
-- Como aplicar: Supabase Dashboard → SQL Editor (usar a versão sem
-- comentários fornecida no chat — comentários corrompem no copiar/colar).
-- Pré-requisito: 0002_topics_exercises.sql já aplicada.

-- Uma linha por resposta dada (Refazer + responder = nova tentativa).
-- is_correct tem default false mas é SEMPRE recalculado pelo trigger
-- abaixo a partir do gabarito — o cliente não consegue gravar acerto
-- falso nem precisa enviar is_correct.
create table if not exists public.exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  selected_index smallint not null check (selected_index between 0 and 3),
  is_correct boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.exercise_attempts is
  'Histórico de respostas (Sprint V1.5.3). is_correct é derivado pelo trigger, nunca confiado ao cliente.';

create index if not exists attempts_recent_idx
  on public.exercise_attempts (user_id, created_at desc);

-- Gabarito conferido no banco: o trigger roda como o usuário autenticado,
-- que pode ler exercises pelo RLS da 0002 — sem security definer.
create or replace function public.set_attempt_correctness()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  answer smallint;
begin
  select e.correct_index into answer
  from public.exercises e
  where e.id = new.exercise_id;
  if answer is null then
    raise exception 'Exercício inexistente';
  end if;
  new.is_correct := (answer = new.selected_index);
  return new;
end;
$$;

drop trigger if exists attempts_set_correctness on public.exercise_attempts;
create trigger attempts_set_correctness
  before insert on public.exercise_attempts
  for each row execute function public.set_attempt_correctness();

-- RLS: cada usuário insere tentativas só como si mesmo e lê só as suas.
-- Sem update/delete de propósito — histórico é imutável.
alter table public.exercise_attempts enable row level security;

drop policy if exists "attempts_insert_own" on public.exercise_attempts;
create policy "attempts_insert_own"
  on public.exercise_attempts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "attempts_select_own" on public.exercise_attempts;
create policy "attempts_select_own"
  on public.exercise_attempts for select
  to authenticated
  using (auth.uid() = user_id);
