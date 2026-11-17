-- ============================================================
-- Montevia — sécurité renforcée (serveur)
-- À exécuter dans Supabase > SQL Editor après montevia_tickets_fix.sql
-- Idempotent : peut être relancé sans casser l'existant.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Contraintes de longueur (NOT VALID : ne bloque pas
--    l'historique, mais s'applique à toutes les nouvelles lignes)
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.montevia_tickets'::regclass
      and conname = 'montevia_tickets_subject_len_chk'
  ) then
    alter table public.montevia_tickets
      add constraint montevia_tickets_subject_len_chk
      check (char_length(trim(subject)) between 3 and 120) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.montevia_tickets'::regclass
      and conname = 'montevia_tickets_message_len_chk'
  ) then
    alter table public.montevia_tickets
      add constraint montevia_tickets_message_len_chk
      check (char_length(trim(message)) between 10 and 2000) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.montevia_ticket_messages'::regclass
      and conname = 'montevia_messages_len_chk'
  ) then
    alter table public.montevia_ticket_messages
      add constraint montevia_messages_len_chk
      check (char_length(trim(message)) between 1 and 2000) not valid;
  end if;
end
$$;

-- ------------------------------------------------------------
-- 2. Journal d'audit sécurité
-- ------------------------------------------------------------
create table if not exists public.montevia_security_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  actor_id uuid,
  ticket_id uuid,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists montevia_security_events_created_idx
  on public.montevia_security_events (created_at desc);

create index if not exists montevia_security_events_type_idx
  on public.montevia_security_events (event_type, created_at desc);

alter table public.montevia_security_events enable row level security;

drop policy if exists "montevia security events admin read" on public.montevia_security_events;

create policy "montevia security events admin read"
on public.montevia_security_events
for select
to authenticated
using (public.montevia_is_admin());

revoke all on table public.montevia_security_events from anon;
grant select on table public.montevia_security_events to authenticated;

-- ------------------------------------------------------------
-- 3. Limitation de débit : création de tickets
--    5 tickets / 10 minutes et 15 secondes entre deux créations.
-- ------------------------------------------------------------
create or replace function public.montevia_rate_limit_ticket()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer := 0;
  last_created timestamptz;
begin
  if new.user_id is null then
    return new;
  end if;

  select count(*), max(created_at)
  into recent_count, last_created
  from public.montevia_tickets
  where user_id = new.user_id
    and created_at > now() - interval '10 minutes';

  if recent_count >= 5 then
    raise exception 'Trop de tickets créés. Réessaie dans quelques minutes.'
      using errcode = 'P0001';
  end if;

  if last_created is not null and last_created > now() - interval '15 seconds' then
    raise exception 'Patiente quelques secondes avant de créer un autre ticket.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.montevia_rate_limit_ticket() from public;

drop trigger if exists montevia_tickets_rate_limit on public.montevia_tickets;
create trigger montevia_tickets_rate_limit
before insert on public.montevia_tickets
for each row execute function public.montevia_rate_limit_ticket();

-- ------------------------------------------------------------
-- 4. Limitation de débit : messages
--    30 messages / 2 minutes et 2 secondes entre deux messages.
-- ------------------------------------------------------------
create or replace function public.montevia_rate_limit_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer := 0;
  last_sent timestamptz;
begin
  if new.sender_id is null then
    return new;
  end if;

  select count(*), max(created_at)
  into recent_count, last_sent
  from public.montevia_ticket_messages
  where sender_id = new.sender_id
    and created_at > now() - interval '2 minutes';

  if recent_count >= 30 then
    raise exception 'Trop de messages envoyés. Patiente quelques minutes.'
      using errcode = 'P0001';
  end if;

  if last_sent is not null and last_sent > now() - interval '2 seconds' then
    raise exception 'Patiente deux secondes avant d''envoyer un autre message.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.montevia_rate_limit_message() from public;

drop trigger if exists montevia_messages_rate_limit on public.montevia_ticket_messages;
create trigger montevia_messages_rate_limit
before insert on public.montevia_ticket_messages
for each row execute function public.montevia_rate_limit_message();

-- ------------------------------------------------------------
-- 5. Audit : création de ticket et messages
-- ------------------------------------------------------------
create or replace function public.montevia_audit_ticket_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.montevia_security_events (event_type, actor_id, ticket_id, detail)
  values ('ticket_created', new.user_id, new.id, left(coalesce(new.subject, ''), 200));
  return new;
end;
$$;

revoke all on function public.montevia_audit_ticket_insert() from public;

drop trigger if exists montevia_tickets_audit_insert on public.montevia_tickets;
create trigger montevia_tickets_audit_insert
after insert on public.montevia_tickets
for each row execute function public.montevia_audit_ticket_insert();

create or replace function public.montevia_audit_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.montevia_security_events (event_type, actor_id, ticket_id, detail)
  values (
    case when new.is_internal then 'internal_note_created' else 'message_created' end,
    new.sender_id,
    new.ticket_id,
    'longueur=' || char_length(coalesce(new.message, '')) || ' role=' || coalesce(new.sender_type, '?')
  );
  return new;
end;
$$;

revoke all on function public.montevia_audit_message_insert() from public;

drop trigger if exists montevia_messages_audit_insert on public.montevia_ticket_messages;
create trigger montevia_messages_audit_insert
after insert on public.montevia_ticket_messages
for each row execute function public.montevia_audit_message_insert();

-- ------------------------------------------------------------
-- 6. Audit : changements de statut et prise en charge
-- ------------------------------------------------------------
create or replace function public.montevia_audit_ticket_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.montevia_security_events (event_type, actor_id, ticket_id, detail)
    values ('ticket_status', auth.uid(), new.id, coalesce(old.status, '?') || ' -> ' || coalesce(new.status, '?'));
  end if;

  if new.claimed_by is distinct from old.claimed_by then
    insert into public.montevia_security_events (event_type, actor_id, ticket_id, detail)
    values ('ticket_claim', auth.uid(), new.id, coalesce(new.claimed_by::text, 'libéré'));
  end if;

  if new.priority is distinct from old.priority or new.category is distinct from old.category then
    insert into public.montevia_security_events (event_type, actor_id, ticket_id, detail)
    values (
      'ticket_meta',
      auth.uid(),
      new.id,
      coalesce(old.category, '?') || '/' || coalesce(old.priority, '?') ||
      ' -> ' || coalesce(new.category, '?') || '/' || coalesce(new.priority, '?')
    );
  end if;

  return new;
end;
$$;

revoke all on function public.montevia_audit_ticket_update() from public;

drop trigger if exists montevia_tickets_audit_update on public.montevia_tickets;
create trigger montevia_tickets_audit_update
after update on public.montevia_tickets
for each row execute function public.montevia_audit_ticket_update();

-- ------------------------------------------------------------
-- 7. Résumé de sécurité (admin uniquement)
-- ------------------------------------------------------------
create or replace function public.montevia_security_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.montevia_is_admin() then
    raise exception 'Action non autorisée.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'tickets_24h', (
      select count(*) from public.montevia_tickets
      where created_at > now() - interval '24 hours'
    ),
    'messages_24h', (
      select count(*) from public.montevia_ticket_messages
      where created_at > now() - interval '24 hours'
    ),
    'internal_24h', (
      select count(*) from public.montevia_ticket_messages
      where is_internal and created_at > now() - interval '24 hours'
    ),
    'open_tickets', (
      select count(*) from public.montevia_tickets
      where status <> 'closed'
    ),
    'closed_24h', (
      select count(*) from public.montevia_tickets
      where status = 'closed'
        and coalesce(closed_at, updated_at) > now() - interval '24 hours'
    ),
    'events_24h', (
      select count(*) from public.montevia_security_events
      where created_at > now() - interval '24 hours'
    ),
    'generated_at', now()
  ) into result;

  return result;
end;
$$;

revoke all on function public.montevia_security_summary() from public;
grant execute on function public.montevia_security_summary() to authenticated;

-- ------------------------------------------------------------
-- 8. Purge des vieux événements (à planifier avec pg_cron)
--    select cron.schedule('montevia-security-purge', '0 4 * * *',
--      $$select public.montevia_prune_security_events();$$);
-- ------------------------------------------------------------
create or replace function public.montevia_prune_security_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer := 0;
begin
  delete from public.montevia_security_events
  where created_at < now() - interval '90 days';

  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.montevia_prune_security_events() from public;
