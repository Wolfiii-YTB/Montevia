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
-- Changelog / Patch notes
-- ============================================================
create table if not exists public.montevia_changelog (
  id uuid primary key default gen_random_uuid(),
  version text not null check (char_length(trim(version)) between 1 and 20),
  title text not null check (char_length(trim(title)) between 1 and 120),
  content text not null check (char_length(trim(content)) between 1 and 2000),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.montevia_changelog enable row level security;

drop policy if exists "public read published changelog" on public.montevia_changelog;
create policy "public read published changelog"
on public.montevia_changelog
for select
to anon, authenticated
using (published = true);

drop policy if exists "admins all changelog" on public.montevia_changelog;
create policy "admins all changelog"
on public.montevia_changelog
for all
to authenticated
using (public.montevia_is_admin())
with check (public.montevia_is_admin());

grant select on table public.montevia_changelog to anon, authenticated;
grant insert, update, delete on table public.montevia_changelog to authenticated;

create or replace function public.montevia_touch_changelog()
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

drop trigger if exists montevia_changelog_touch on public.montevia_changelog;
create trigger montevia_changelog_touch
before update on public.montevia_changelog
for each row execute function public.montevia_touch_changelog();

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




-- ============================================================
-- CORRECTIF TICKETS / RLS / SECURITE (voir aussi montevia_tickets_fix.sql)
-- ============================================================
-- ============================================================
-- MONTEVIA — Correctif complet du système de tickets
-- Projet Supabase : bylwvlxxvgumvqgpwgod
-- À exécuter dans Supabase > SQL Editor.
--
-- Ce script est idempotent : il peut être relancé sans risque.
-- Il corrige :
--   1. la récursion infinie RLS sur montevia_admin_access (erreur 42P17 / 500) ;
--   2. les droits de lecture/écriture des tickets pour le staff,
--      l'ouvreur et les participants ;
--   3. les notes internes (visibles uniquement par le staff) ;
--   4. le claim, la fermeture/réouverture et le nom de l'ouvreur ;
--   5. la fuite du webhook Discord (déplacé dans une table privée).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Accès administrateur Montevia
-- ------------------------------------------------------------
create table if not exists public.montevia_admin_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.montevia_admin_access enable row level security;

-- Fonction SECURITY DEFINER : elle contourne la RLS, donc pas de récursion.
create or replace function public.montevia_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'admin'
        and status = 'active'
    )
    or exists (
      select 1
      from public.montevia_admin_access
      where user_id = auth.uid()
    );
$$;

revoke all on function public.montevia_is_admin() from public;
grant execute on function public.montevia_is_admin() to anon, authenticated;

-- Supprimer les anciennes policies récursives.
drop policy if exists "admins read montevia admin access" on public.montevia_admin_access;
drop policy if exists "admins write montevia admin access" on public.montevia_admin_access;
drop policy if exists "montevia admins read access" on public.montevia_admin_access;
drop policy if exists "montevia admins manage access" on public.montevia_admin_access;

-- Un admin (DevReports ou Montevia) peut lire et gérer les accès.
-- La fonction est SECURITY DEFINER : aucune récursion possible.
create policy "montevia admins read access"
on public.montevia_admin_access
for select
to authenticated
using (public.montevia_is_admin());

create policy "montevia admins manage access"
on public.montevia_admin_access
for all
to authenticated
using (public.montevia_is_admin())
with check (public.montevia_is_admin());

revoke all on table public.montevia_admin_access from anon;
grant select, insert, update, delete on table public.montevia_admin_access to authenticated;

-- ------------------------------------------------------------
-- 2. Colonnes tickets (mise à niveau des anciennes installations)
-- ------------------------------------------------------------
alter table public.montevia_tickets
  add column if not exists category text not null default 'general',
  add column if not exists priority text not null default 'normal',
  add column if not exists claimed_by uuid references auth.users(id) on delete set null,
  add column if not exists claimed_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists opener_name text not null default '';

-- Contraintes (ajoutées seulement si elles manquent).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.montevia_tickets'::regclass
      and conname = 'montevia_tickets_category_check'
  ) then
    alter table public.montevia_tickets
      add constraint montevia_tickets_category_check
      check (category in ('general', 'bug', 'question', 'suggestion', 'autre'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.montevia_tickets'::regclass
      and conname = 'montevia_tickets_priority_check'
  ) then
    alter table public.montevia_tickets
      add constraint montevia_tickets_priority_check
      check (priority in ('low', 'normal', 'high'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.montevia_tickets'::regclass
      and conname = 'montevia_tickets_status_check'
  ) then
    alter table public.montevia_tickets
      add constraint montevia_tickets_status_check
      check (status in ('open', 'in_progress', 'closed'));
  end if;
end
$$;

-- ------------------------------------------------------------
-- 3. Table des messages (si installation incomplète)
-- ------------------------------------------------------------
create table if not exists public.montevia_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.montevia_tickets(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_type text not null check (sender_type in ('user', 'admin')),
  message text not null check (char_length(trim(message)) between 1 and 2000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.montevia_ticket_messages enable row level security;

alter table public.montevia_ticket_messages
  add column if not exists is_internal boolean not null default false;

create index if not exists montevia_ticket_messages_ticket_idx
  on public.montevia_ticket_messages (ticket_id, created_at);

-- ------------------------------------------------------------
-- 4. Trigger updated_at / closed_at
-- ------------------------------------------------------------
create or replace function public.montevia_touch_ticket()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();

  if new.status = 'closed' and coalesce(old.status, '') <> 'closed' then
    new.closed_at = now();
  elsif new.status <> 'closed' then
    new.closed_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists montevia_tickets_touch on public.montevia_tickets;
create trigger montevia_tickets_touch
before update on public.montevia_tickets
for each row execute function public.montevia_touch_ticket();

-- Mettre à jour l'activité du ticket quand un message est ajouté.
create or replace function public.montevia_touch_ticket_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.montevia_tickets
  set updated_at = now()
  where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists montevia_ticket_message_touch on public.montevia_ticket_messages;
create trigger montevia_ticket_message_touch
after insert on public.montevia_ticket_messages
for each row execute function public.montevia_touch_ticket_on_message();

-- ------------------------------------------------------------
-- 5. Participants (table + contrainte + index)
-- ------------------------------------------------------------
create table if not exists public.montevia_ticket_participants (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.montevia_tickets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (ticket_id, user_id)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.montevia_ticket_participants'::regclass
      and conname = 'montevia_ticket_participants_ticket_id_user_id_key'
  ) then
    alter table public.montevia_ticket_participants
      add constraint montevia_ticket_participants_ticket_id_user_id_key
      unique (ticket_id, user_id);
  end if;
end
$$;

create index if not exists montevia_ticket_participants_user_idx
  on public.montevia_ticket_participants (user_id, ticket_id);

create index if not exists montevia_tickets_user_idx
  on public.montevia_tickets (user_id, created_at desc);

create index if not exists montevia_tickets_activity_idx
  on public.montevia_tickets (status, updated_at desc);

-- ------------------------------------------------------------
-- 6. Fonction d'accès à un ticket
--    Ouvreur, participant ou admin. SECURITY DEFINER => pas de récursion.
-- ------------------------------------------------------------
create or replace function public.montevia_can_access_ticket(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.montevia_tickets t
    where t.id = p_ticket_id
      and (
        t.user_id = auth.uid()
        or exists (
          select 1
          from public.montevia_ticket_participants p
          where p.ticket_id = t.id
            and p.user_id = auth.uid()
        )
        or public.montevia_is_admin()
      )
  );
$$;

revoke all on function public.montevia_can_access_ticket(uuid) from public;
grant execute on function public.montevia_can_access_ticket(uuid) to authenticated;

-- Permet à l'ouvreur de fermer son propre ticket, et au staff de changer
-- le statut (fermer / rouvrir / remettre en cours).
create or replace function public.montevia_set_ticket_status(p_ticket_id uuid, p_status text)
returns public.montevia_tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.montevia_tickets;
  is_staff boolean := public.montevia_is_admin();
begin
  if p_status not in ('open', 'in_progress', 'closed') then
    raise exception 'Statut invalide.';
  end if;

  select *
  into result
  from public.montevia_tickets
  where id = p_ticket_id;

  if not found then
    raise exception 'Ticket introuvable.';
  end if;

  if not (
    is_staff
    or (result.user_id = auth.uid() and p_status = 'closed' and result.status <> 'closed')
  ) then
    raise exception 'Action non autorisée.';
  end if;

  update public.montevia_tickets
  set status = p_status
  where id = p_ticket_id
  returning * into result;

  return result;
end;
$$;

revoke all on function public.montevia_set_ticket_status(uuid, text) from public;
grant execute on function public.montevia_set_ticket_status(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 7. Policies tickets
-- ------------------------------------------------------------
drop policy if exists "users read own tickets" on public.montevia_tickets;
drop policy if exists "users insert tickets" on public.montevia_tickets;
drop policy if exists "admins update tickets" on public.montevia_tickets;
drop policy if exists "admins delete tickets" on public.montevia_tickets;
drop policy if exists "montevia tickets select" on public.montevia_tickets;
drop policy if exists "montevia tickets insert" on public.montevia_tickets;
drop policy if exists "montevia tickets update" on public.montevia_tickets;
drop policy if exists "montevia tickets delete" on public.montevia_tickets;

create policy "montevia tickets select"
on public.montevia_tickets
for select
to authenticated
using (public.montevia_can_access_ticket(id));

create policy "montevia tickets insert"
on public.montevia_tickets
for insert
to authenticated
with check (user_id = auth.uid());

create policy "montevia tickets update"
on public.montevia_tickets
for update
to authenticated
using (public.montevia_is_admin())
with check (public.montevia_is_admin());

create policy "montevia tickets delete"
on public.montevia_tickets
for delete
to authenticated
using (public.montevia_is_admin());

revoke all on table public.montevia_tickets from anon;
grant select, insert, update, delete on table public.montevia_tickets to authenticated;

-- Backfill du nom de l'ouvreur pour les tickets existants.
-- On préfère le pseudo Discord quand le profil n'a pas de vrai nom.
update public.montevia_tickets t
set opener_name = case
  when coalesce(trim(p.display_name), '') not in ('', 'Membre') then trim(p.display_name)
  when coalesce(trim(t.discord_username), '') <> '' then trim(t.discord_username)
  when coalesce(trim(p.nickname), '') <> '' then trim(p.nickname)
  else 'Utilisateur'
end
from public.profiles p
where p.id = t.user_id
  and coalesce(trim(t.opener_name), '') in ('', 'Membre');

-- ------------------------------------------------------------
-- 8. Policies messages (dont notes internes)
-- ------------------------------------------------------------
drop policy if exists "read ticket messages" on public.montevia_ticket_messages;
drop policy if exists "insert ticket messages" on public.montevia_ticket_messages;
drop policy if exists "delete ticket messages" on public.montevia_ticket_messages;
drop policy if exists "montevia messages select" on public.montevia_ticket_messages;
drop policy if exists "montevia messages insert" on public.montevia_ticket_messages;
drop policy if exists "montevia messages delete" on public.montevia_ticket_messages;

create policy "montevia messages select"
on public.montevia_ticket_messages
for select
to authenticated
using (
  public.montevia_is_admin()
  or (
    is_internal = false
    and public.montevia_can_access_ticket(ticket_id)
  )
);

create policy "montevia messages insert"
on public.montevia_ticket_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.montevia_can_access_ticket(ticket_id)
  and (
    (
      public.montevia_is_admin()
      and sender_type = 'admin'
    )
    or (
      not public.montevia_is_admin()
      and sender_type = 'user'
      and is_internal = false
      and exists (
        select 1
        from public.montevia_tickets t
        where t.id = ticket_id
          and t.status <> 'closed'
      )
    )
  )
);

create policy "montevia messages delete"
on public.montevia_ticket_messages
for delete
to authenticated
using (public.montevia_is_admin());

revoke all on table public.montevia_ticket_messages from anon;
grant select, insert, delete on table public.montevia_ticket_messages to authenticated;

-- ------------------------------------------------------------
-- 9. Policies participants
-- ------------------------------------------------------------
drop policy if exists "read ticket participants" on public.montevia_ticket_participants;
drop policy if exists "admins manage ticket participants" on public.montevia_ticket_participants;
drop policy if exists "montevia participants select" on public.montevia_ticket_participants;
drop policy if exists "montevia participants manage" on public.montevia_ticket_participants;

create policy "montevia participants select"
on public.montevia_ticket_participants
for select
to authenticated
using (public.montevia_can_access_ticket(ticket_id));

create policy "montevia participants manage"
on public.montevia_ticket_participants
for all
to authenticated
using (public.montevia_is_admin())
with check (public.montevia_is_admin());

revoke all on table public.montevia_ticket_participants from anon;
grant select, insert, update, delete on table public.montevia_ticket_participants to authenticated;

-- ------------------------------------------------------------
-- 10. Webhook Discord : table privée (plus jamais exposée au public)
-- ------------------------------------------------------------
create table if not exists public.montevia_private_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.montevia_private_settings enable row level security;

drop policy if exists "montevia admins manage private settings" on public.montevia_private_settings;
create policy "montevia admins manage private settings"
on public.montevia_private_settings
for all
to authenticated
using (public.montevia_is_admin())
with check (public.montevia_is_admin());

revoke all on table public.montevia_private_settings from anon, authenticated;
grant select, insert, update, delete on table public.montevia_private_settings to authenticated;
grant select, insert, update, delete on table public.montevia_private_settings to service_role;

-- Table publique des réglages (si installation incomplète).
create table if not exists public.montevia_site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.montevia_site_settings enable row level security;

-- Migrer l'ancien webhook public vers la table privée, puis le supprimer
-- de la table publique lisible par tout le monde.
insert into public.montevia_private_settings (key, value)
select 'discord_webhook', value
from public.montevia_site_settings
where key = 'discord_webhook'
  and coalesce(trim(value), '') <> ''
on conflict (key) do nothing;

delete from public.montevia_site_settings
where key = 'discord_webhook';

-- ------------------------------------------------------------
-- 11. Liaison Roblox (manuelle, protégée par RLS)
-- ------------------------------------------------------------
create table if not exists public.montevia_account_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  roblox_username text not null default '' check (char_length(roblox_username) <= 40),
  roblox_user_id text not null default '' check (char_length(roblox_user_id) <= 30),
  roblox_url text not null default '' check (char_length(roblox_url) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.montevia_account_links enable row level security;

drop policy if exists "montevia account links select own" on public.montevia_account_links;
create policy "montevia account links select own"
on public.montevia_account_links
for select
to authenticated
using (user_id = auth.uid() or public.montevia_is_admin());

drop policy if exists "montevia account links insert own" on public.montevia_account_links;
create policy "montevia account links insert own"
on public.montevia_account_links
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "montevia account links update own" on public.montevia_account_links;
create policy "montevia account links update own"
on public.montevia_account_links
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "montevia account links delete own" on public.montevia_account_links;
create policy "montevia account links delete own"
on public.montevia_account_links
for delete
to authenticated
using (user_id = auth.uid());

revoke all on table public.montevia_account_links from anon, authenticated;
grant select, insert, update, delete on table public.montevia_account_links to authenticated;

-- Limites du bucket de la galerie (5 Mo, images uniquement).
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
where id = 'montevia-gallery';

-- ------------------------------------------------------------
-- 12. Notification Discord côté serveur (webhook jamais exposé)
--     Nécessite l'extension pg_net (activée automatiquement si possible).
-- ------------------------------------------------------------
do $$
begin
  begin
    execute 'create extension if not exists pg_net';
  exception when others then
    raise notice 'pg_net indisponible : %', sqlerrm;
  end;
end
$$;

create or replace function public.montevia_discord_notify(
  p_ticket_id uuid,
  p_kind text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hook text;
  t record;
  payload jsonb;
  body_text text;
begin
  select value
    into hook
    from public.montevia_private_settings
   where key = 'discord_webhook';

  if coalesce(btrim(hook), '') = '' then
    return;
  end if;

  if hook !~* '^https://(discord|discordapp)\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$' then
    return;
  end if;

  select subject, opener_name, discord_username, category, priority, status
    into t
    from public.montevia_tickets
   where id = p_ticket_id;

  if not found then
    return;
  end if;

  body_text := left(coalesce(p_message, ''), 900);

  if p_kind = 'ticket' then
    payload := jsonb_build_object(
      'username', 'Montevia Support',
      'embeds', jsonb_build_array(jsonb_build_object(
        'title', '🎫 Nouveau ticket',
        'description', '**' || coalesce(t.subject, 'Ticket') || '**' || E'\n' || body_text,
        'color', 3527578,
        'fields', jsonb_build_array(
          jsonb_build_object('name', 'Ouvreur', 'value', coalesce(nullif(t.opener_name, ''), nullif(t.discord_username, ''), 'Utilisateur'), 'inline', true),
          jsonb_build_object('name', 'Discord', 'value', coalesce(nullif(t.discord_username, ''), '—'), 'inline', true),
          jsonb_build_object('name', 'Catégorie', 'value', coalesce(t.category, 'general'), 'inline', true),
          jsonb_build_object('name', 'Priorité', 'value', coalesce(t.priority, 'normal'), 'inline', true)
        ),
        'url', 'https://wolfiii-ytb.github.io/Montevia/ticket.html?id=' || p_ticket_id::text,
        'timestamp', to_jsonb(now())
      ))
    );
  else
    payload := jsonb_build_object(
      'username', 'Montevia Support',
      'embeds', jsonb_build_array(jsonb_build_object(
        'title', '💬 Nouveau message',
        'description', body_text,
        'color', 3527578,
        'fields', jsonb_build_array(
          jsonb_build_object('name', 'Ticket', 'value', coalesce(nullif(t.subject, ''), 'Ticket'), 'inline', false)
        ),
        'url', 'https://wolfiii-ytb.github.io/Montevia/ticket.html?id=' || p_ticket_id::text,
        'timestamp', to_jsonb(now())
      ))
    );
  end if;

  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    return;
  end if;

  perform net.http_post(
    url := hook,
    body := payload,
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
end;
$$;

revoke all on function public.montevia_discord_notify(uuid, text, text) from public;
revoke all on function public.montevia_discord_notify(uuid, text, text) from anon, authenticated;

create or replace function public.montevia_notify_ticket_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.montevia_discord_notify(new.id, 'ticket', new.message);
  return new;
end;
$$;

revoke all on function public.montevia_notify_ticket_insert() from public;
revoke all on function public.montevia_notify_ticket_insert() from anon, authenticated;

drop trigger if exists montevia_ticket_notify_insert on public.montevia_tickets;
create trigger montevia_ticket_notify_insert
after insert on public.montevia_tickets
for each row execute function public.montevia_notify_ticket_insert();

create or replace function public.montevia_notify_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_internal then
    return new;
  end if;

  perform public.montevia_discord_notify(
    new.ticket_id,
    'message',
    case when new.sender_type = 'admin' then '🛡️ Staff : ' else '' end || new.message
  );
  return new;
end;
$$;

revoke all on function public.montevia_notify_message_insert() from public;
revoke all on function public.montevia_notify_message_insert() from anon, authenticated;

drop trigger if exists montevia_ticket_notify_message on public.montevia_ticket_messages;
create trigger montevia_ticket_notify_message
after insert on public.montevia_ticket_messages
for each row execute function public.montevia_notify_message_insert();

-- ------------------------------------------------------------
-- 13. Recharger le cache de schéma PostgREST
-- ------------------------------------------------------------
notify pgrst, 'reload schema';

-- Vérification rapide (à exécuter séparément si besoin) :
-- select public.montevia_is_admin();
-- select * from public.montevia_tickets order by created_at desc limit 5;

