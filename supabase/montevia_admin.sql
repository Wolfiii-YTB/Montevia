-- ============================================================
-- MONTEVIA — Panneau d'administration de l'équipe
-- Projet Supabase : bylwvlxxvgumvqgpwgod (DevReports)
-- À exécuter dans Supabase > SQL Editor.
--
-- Ce script réutilise :
--   - les comptes Supabase Auth de DevReports ;
--   - la fonction public.is_admin() déjà installée par DevReports.
--
-- Il crée uniquement la table publique de l'équipe Montevia et
-- ses politiques RLS. Aucun mot de passe ni clé secrète n'est
-- stocké dans le site.
-- ============================================================

do $$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'La fonction public.is_admin() est introuvable. Exécute d''abord le script Supabase de DevReports.';
  end if;
end
$$;

create table if not exists public.montevia_team_members (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(trim(display_name)) between 1 and 60),
  username text not null default '' check (char_length(username) <= 40),
  role_label text not null check (char_length(trim(role_label)) between 1 and 60),
  pole text not null default 'autre' check (pole in ('direction','developpement','moderation','support','studio','autre')),
  bio text not null default '' check (char_length(bio) <= 600),
  avatar_url text not null default '' check (char_length(avatar_url) <= 2048),
  roblox_url text not null default '' check (char_length(roblox_url) <= 2048),
  discord_username text not null default '' check (char_length(discord_username) <= 40),
  sort_order integer not null default 100 check (sort_order between 0 and 9999),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.montevia_team_members is 'Membres affichés sur la page équipe publique de Montevia.';
comment on column public.montevia_team_members.pole is 'Pôle affiché : direction, developpement, moderation, support, studio ou autre.';
comment on column public.montevia_team_members.published is 'Si false, la fiche est visible uniquement par les administrateurs.';

create index if not exists montevia_team_members_order_idx
  on public.montevia_team_members (published, sort_order, display_name);

create or replace function public.montevia_touch_team_member()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists montevia_team_members_touch on public.montevia_team_members;
create trigger montevia_team_members_touch
before update on public.montevia_team_members
for each row execute function public.montevia_touch_team_member();

alter table public.montevia_team_members enable row level security;

-- Lecture publique : uniquement les fiches publiées.
drop policy if exists "public read published montevia team" on public.montevia_team_members;
create policy "public read published montevia team"
on public.montevia_team_members
for select
to anon, authenticated
using (published = true);

-- Lecture complète pour les administrateurs actifs.
drop policy if exists "admins read montevia team" on public.montevia_team_members;
create policy "admins read montevia team"
on public.montevia_team_members
for select
to authenticated
using ((select public.is_admin()));

-- Écriture réservée aux administrateurs actifs.
drop policy if exists "admins insert montevia team" on public.montevia_team_members;
create policy "admins insert montevia team"
on public.montevia_team_members
for insert
to authenticated
with check ((select public.is_admin()));

drop policy if exists "admins update montevia team" on public.montevia_team_members;
create policy "admins update montevia team"
on public.montevia_team_members
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "admins delete montevia team" on public.montevia_team_members;
create policy "admins delete montevia team"
on public.montevia_team_members
for delete
to authenticated
using ((select public.is_admin()));

revoke all on table public.montevia_team_members from anon, authenticated;
grant select on table public.montevia_team_members to anon, authenticated;
grant insert, update, delete on table public.montevia_team_members to authenticated;

-- Recharge le cache de schéma de PostgREST pour que la table soit
-- immédiatement visible par l'API REST.
notify pgrst, 'reload schema';

-- Vérification rapide après exécution :
-- select * from public.montevia_team_members order by sort_order, display_name;
