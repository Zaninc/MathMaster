-- Sprint V1.5.1 — tabela profiles + trigger de signup + RLS.
-- Como aplicar: Supabase Dashboard → SQL Editor → colar e executar
-- (ou `supabase db push` se estiver usando a CLI com migrações).

-- 1 linha por usuário do auth.users; criada automaticamente no signup
-- pelo trigger abaixo. display_name vem do user_metadata do cadastro.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil público 1:1 com auth.users. Criado pelo trigger handle_new_user no signup.';

-- RLS: cada usuário só enxerga e edita o próprio perfil. INSERT não tem
-- política de usuário de propósito — quem insere é o trigger (definer).
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Trigger: cria o profile no INSERT em auth.users, copiando o
-- display_name enviado pelo formulário de cadastro (user_metadata).
-- security definer: auth.users não é gravável pelo role do usuário.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantém updated_at honesto em qualquer UPDATE de perfil.
create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_profiles_updated_at();
