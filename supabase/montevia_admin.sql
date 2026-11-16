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

-- ============================================================
-- Accès au panneau admin Montevia
-- ============================================================
create table if not exists public.montevia_admin_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.montevia_admin_access enable row level security;

-- Lecture : admins DevReports ou admins Montevia
drop policy if exists "admins read montevia admin access" on public.montevia_admin_access;
create policy "admins read montevia admin access"
on public.montevia_admin_access
for select
to authenticated
using (
  (select public.is_admin())
  or exists (select 1 from public.montevia_admin_access where user_id = auth.uid())
);

-- Écriture : admins DevReports ou admins Montevia
drop policy if exists "admins write montevia admin access" on public.montevia_admin_access;
create policy "admins write montevia admin access"
on public.montevia_admin_access
for all
to authenticated
using (
  (select public.is_admin())
  or exists (select 1 from public.montevia_admin_access where user_id = auth.uid())
)
with check (
  (select public.is_admin())
  or exists (select 1 from public.montevia_admin_access where user_id = auth.uid())
);

-- Fonction combinée : accès admin Montevia
create or replace function public.montevia_is_admin()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  ) or exists (
    select 1 from public.montevia_admin_access where user_id = auth.uid()
  );
$$;

-- Mettre à jour les politiques RLS de l'équipe pour utiliser montevia_is_admin()
drop policy if exists "admins read montevia team" on public.montevia_team_members;
create policy "admins read montevia team"
on public.montevia_team_members
for select
to authenticated
using ((select public.montevia_is_admin()));

drop policy if exists "admins insert montevia team" on public.montevia_team_members;
create policy "admins insert montevia team"
on public.montevia_team_members
for insert
to authenticated
with check ((select public.montevia_is_admin()));

drop policy if exists "admins update montevia team" on public.montevia_team_members;
create policy "admins update montevia team"
on public.montevia_team_members
for update
to authenticated
using ((select public.montevia_is_admin()))
with check ((select public.montevia_is_admin()));

drop policy if exists "admins delete montevia team" on public.montevia_team_members;
create policy "admins delete montevia team"
on public.montevia_team_members
for delete
to authenticated
using ((select public.montevia_is_admin()));

grant select, insert, update, delete on table public.montevia_admin_access to authenticated;

-- Recharge le cache de schéma de PostgREST
notify pgrst, 'reload schema';

-- ============================================================
-- Galerie d'images in-game
-- ============================================================
create table if not exists public.montevia_gallery (
  id uuid primary key default gen_random_uuid(),
  image_url text not null check (char_length(image_url) between 1 and 2048),
  caption text not null default '' check (char_length(caption) <= 200),
  sort_order integer not null default 100 check (sort_order between 0 and 9999),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.montevia_gallery enable row level security;

drop policy if exists "public read published gallery" on public.montevia_gallery;
create policy "public read published gallery"
on public.montevia_gallery
for select
to anon, authenticated
using (published = true);

drop policy if exists "admins read gallery" on public.montevia_gallery;
create policy "admins read gallery"
on public.montevia_gallery
for select
to authenticated
using (public.montevia_is_admin());

drop policy if exists "admins insert gallery" on public.montevia_gallery;
create policy "admins insert gallery"
on public.montevia_gallery
for insert
to authenticated
with check (public.montevia_is_admin());

drop policy if exists "admins update gallery" on public.montevia_gallery;
create policy "admins update gallery"
on public.montevia_gallery
for update
to authenticated
using (public.montevia_is_admin())
with check (public.montevia_is_admin());

drop policy if exists "admins delete gallery" on public.montevia_gallery;
create policy "admins delete gallery"
on public.montevia_gallery
for delete
to authenticated
using (public.montevia_is_admin());

create index if not exists montevia_gallery_order_idx
  on public.montevia_gallery (published, sort_order, created_at);

create or replace function public.montevia_touch_gallery()
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

drop trigger if exists montevia_gallery_touch on public.montevia_gallery;
create trigger montevia_gallery_touch
before update on public.montevia_gallery
for each row execute function public.montevia_touch_gallery();

grant select on table public.montevia_gallery to anon, authenticated;
grant insert, update, delete on table public.montevia_gallery to authenticated;

-- ============================================================
-- Paramètres du site (liens des boutons, etc.)
-- ============================================================
create table if not exists public.montevia_site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.montevia_site_settings enable row level security;

drop policy if exists "public read montevia settings" on public.montevia_site_settings;
create policy "public read montevia settings"
on public.montevia_site_settings
for select
to anon, authenticated
using (true);

drop policy if exists "admins write montevia settings" on public.montevia_site_settings;
create policy "admins write montevia settings"
on public.montevia_site_settings
for all
to authenticated
using (public.montevia_is_admin())
with check (public.montevia_is_admin());

grant select on table public.montevia_site_settings to anon, authenticated;
grant insert, update, delete on table public.montevia_site_settings to authenticated;

-- Valeurs par défaut
insert into public.montevia_site_settings (key, value) values
  ('roblox_url', 'https://www.roblox.com/fr/games/136984692229053/Montevia'),
  ('discord_url', 'https://discord.gg/6wHfn69Jt')
on conflict (key) do nothing;

-- Recharge le cache
notify pgrst, 'reload schema';

-- Vérification rapide après exécution :
-- select * from public.montevia_team_members order by sort_order, display_name;

-- ============================================================
-- Système de tickets
-- ============================================================
create table if not exists public.montevia_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  discord_username text not null default '',
  subject text not null check (char_length(trim(subject)) between 1 and 120),
  message text not null check (char_length(trim(message)) between 1 and 2000),
  status text not null default 'open' check (status in ('open','in_progress','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

alter table public.montevia_tickets enable row level security;

-- Lecture : l'utilisateur voit ses propres tickets, les admins voient tout
drop policy if exists "users read own tickets" on public.montevia_tickets;
create policy "users read own tickets"
on public.montevia_tickets
for select
to authenticated
using (user_id = auth.uid() or public.montevia_is_admin());

-- Insertion : tout utilisateur authentifié peut créer un ticket
drop policy if exists "users insert tickets" on public.montevia_tickets;
create policy "users insert tickets"
on public.montevia_tickets
for insert
to authenticated
with check (user_id = auth.uid());

-- Mise à jour : admins peuvent modifier le statut
drop policy if exists "admins update tickets" on public.montevia_tickets;
create policy "admins update tickets"
on public.montevia_tickets
for update
to authenticated
using (public.montevia_is_admin())
with check (public.montevia_is_admin());

-- Suppression : admins uniquement
drop policy if exists "admins delete tickets" on public.montevia_tickets;
create policy "admins delete tickets"
on public.montevia_tickets
for delete
to authenticated
using (public.montevia_is_admin());

create index if not exists montevia_tickets_status_idx
  on public.montevia_tickets (status, created_at desc);

create or replace function public.montevia_touch_ticket()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.status = 'closed' and old.status <> 'closed' then
    new.closed_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists montevia_tickets_touch on public.montevia_tickets;
create trigger montevia_tickets_touch
before update on public.montevia_tickets
for each row execute function public.montevia_touch_ticket();

grant select, insert on table public.montevia_tickets to authenticated;
grant update, delete on table public.montevia_tickets to authenticated;

-- ============================================================
-- Stockage des images (bucket public)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('montevia-gallery', 'montevia-gallery', true)
on conflict (id) do nothing;

drop policy if exists "public read gallery images" on storage.objects;
create policy "public read gallery images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'montevia-gallery');

drop policy if exists "admins upload gallery images" on storage.objects;
create policy "admins upload gallery images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'montevia-gallery' and public.montevia_is_admin());

drop policy if exists "admins delete gallery images" on storage.objects;
create policy "admins delete gallery images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'montevia-gallery' and public.montevia_is_admin());

-- ============================================================
-- Messages de tickets (conversation)
-- ============================================================
create table if not exists public.montevia_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.montevia_tickets(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_type text not null check (sender_type in ('user','admin')),
  message text not null check (char_length(trim(message)) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.montevia_ticket_messages enable row level security;

drop policy if exists "read ticket messages" on public.montevia_ticket_messages;
create policy "read ticket messages"
on public.montevia_ticket_messages
for select
to authenticated
using (
  public.montevia_is_admin()
  or exists (
    select 1 from public.montevia_tickets t
    where t.id = ticket_id and t.user_id = auth.uid()
  )
);

drop policy if exists "insert ticket messages" on public.montevia_ticket_messages;
create policy "insert ticket messages"
on public.montevia_ticket_messages
for insert
to authenticated
with check (
  public.montevia_is_admin()
  or exists (
    select 1 from public.montevia_tickets t
    where t.id = ticket_id and t.user_id = auth.uid() and t.status <> 'closed'
  )
);

grant select, insert on table public.montevia_ticket_messages to authenticated;

create index if not exists montevia_ticket_messages_ticket_idx
  on public.montevia_ticket_messages (ticket_id, created_at);

-- ============================================================
-- Évolution tickets : catégories, priorité, notes internes
-- ============================================================
alter table public.montevia_tickets
  add column if not exists category text not null default 'general'
  check (category in ('general','bug','question','suggestion','autre'));

alter table public.montevia_ticket_messages
  add column if not exists is_internal boolean not null default false;

-- Les notes internes ne sont visibles que par les admins
drop policy if exists "read ticket messages" on public.montevia_ticket_messages;
create policy "read ticket messages"
on public.montevia_ticket_messages
for select
to authenticated
using (
  public.montevia_is_admin()
  or (is_internal = false and exists (
    select 1 from public.montevia_tickets t
    where t.id = ticket_id and t.user_id = auth.uid()
  ))
);

-- ============================================================
-- Évolution tickets : claim, participants, infos opener
-- ============================================================
alter table public.montevia_tickets
  add column if not exists claimed_by uuid references auth.users(id) on delete set null,
  add column if not exists claimed_at timestamptz;

create table if not exists public.montevia_ticket_participants (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.montevia_tickets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (ticket_id, user_id)
);

alter table public.montevia_ticket_participants enable row level security;

drop policy if exists "read ticket participants" on public.montevia_ticket_participants;
create policy "read ticket participants"
on public.montevia_ticket_participants
for select
to authenticated
using (
  public.montevia_is_admin()
  or exists (
    select 1 from public.montevia_tickets t
    where t.id = ticket_id and t.user_id = auth.uid()
  )
  or user_id = auth.uid()
);

drop policy if exists "admins manage ticket participants" on public.montevia_ticket_participants;
create policy "admins manage ticket participants"
on public.montevia_ticket_participants
for all
to authenticated
using (public.montevia_is_admin())
with check (public.montevia_is_admin());

grant select, insert, delete on table public.montevia_ticket_participants to authenticated;

create index if not exists montevia_ticket_participants_ticket_idx
  on public.montevia_ticket_participants (ticket_id);
