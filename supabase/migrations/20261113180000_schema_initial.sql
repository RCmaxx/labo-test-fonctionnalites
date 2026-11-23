-- Gestion des interventions : schéma initial multi-entreprise (V1)
-- Isolation par org_id via Row Level Security.
-- Les fonctions privilégiées vivent dans le schéma "private" (non exposé par l'API) ;
-- l'API n'expose que de fines enveloppes "security invoker" dans public.

create extension if not exists pgcrypto;
create schema if not exists private;

-- Types ----------------------------------------------------------------------
create type public.member_role as enum ('admin', 'directeur', 'responsable_tech', 'technicien');
create type public.intervention_status as enum ('brouillon', 'publiee', 'prise_en_charge', 'resolue', 'validee');
create type public.intervention_priority as enum ('basse', 'normale', 'haute', 'urgente');
create type public.event_type as enum ('creee', 'modifiee', 'publiee', 'prise_en_charge', 'resolue', 'validee', 'refusee', 'commentaire', 'photo');

-- Tables ---------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

-- Un utilisateur appartient à une seule entreprise (user_id = clé primaire).
-- acting_role : rôle simulé par un admin (« Voir en tant que »), appliqué aussi par la RLS.
create table public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  role public.member_role not null default 'technicien',
  acting_role public.member_role,
  full_name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);
create index members_org_id_idx on public.members(org_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  role public.member_role not null default 'technicien',
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null
);
create index invitations_org_id_idx on public.invitations(org_id);
create index invitations_invited_by_idx on public.invitations(invited_by);
create index invitations_accepted_by_idx on public.invitations(accepted_by);

create table public.interventions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  location text not null default '',
  description text not null default '',
  priority public.intervention_priority not null default 'normale',
  status public.intervention_status not null default 'brouillon',
  assignee_id uuid references public.members(user_id) on delete set null,
  scheduled_date date,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  resolved_at timestamptz,
  validated_at timestamptz
);
create index interventions_org_status_idx on public.interventions(org_id, status, updated_at desc);
create index interventions_assignee_idx on public.interventions(assignee_id);
create index interventions_created_by_idx on public.interventions(created_by);

create table public.intervention_photos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  intervention_id uuid not null references public.interventions(id) on delete cascade,
  path text not null unique,
  uploaded_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index intervention_photos_intervention_idx on public.intervention_photos(intervention_id);
create index intervention_photos_org_idx on public.intervention_photos(org_id);
create index intervention_photos_uploaded_by_idx on public.intervention_photos(uploaded_by);

-- Journal (frise chronologique). Écrit uniquement par les fonctions serveur.
create table public.intervention_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  intervention_id uuid not null references public.interventions(id) on delete cascade,
  type public.event_type not null,
  body text not null default '',
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null default '',
  actor_role public.member_role,
  created_at timestamptz not null default now()
);
create index intervention_events_intervention_idx on public.intervention_events(intervention_id, created_at);
create index intervention_events_org_idx on public.intervention_events(org_id);
create index intervention_events_actor_idx on public.intervention_events(actor_id);

-- Fonctions d'aide (security definer : pas de récursion RLS) ------------------
create or replace function private.my_org() returns uuid
language sql stable security definer set search_path = '' as $$
  select org_id from public.members where user_id = auth.uid()
$$;

create or replace function private.real_role() returns public.member_role
language sql stable security definer set search_path = '' as $$
  select role from public.members where user_id = auth.uid()
$$;

-- Rôle effectif : un admin peut simuler un autre rôle.
create or replace function private.my_role() returns public.member_role
language sql stable security definer set search_path = '' as $$
  select case when role = 'admin' and acting_role is not null then acting_role else role end
  from public.members where user_id = auth.uid()
$$;

create or replace function private.is_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_role() in ('admin','directeur','responsable_tech'), false)
$$;

-- Visible : même entreprise, et brouillons réservés aux gestionnaires.
create or replace function private.can_see(p_intervention uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.interventions i
    where i.id = p_intervention and i.org_id = private.my_org()
      and (i.status <> 'brouillon' or private.is_manager()))
$$;

-- Peut travailler dessus (photos) : gestionnaire, ou technicien assigné.
create or replace function private.can_work_on(p_intervention uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.interventions i
    where i.id = p_intervention and i.org_id = private.my_org()
      and (private.is_manager() or (i.assignee_id = auth.uid() and i.status <> 'brouillon')))
$$;

create or replace function private.log_event(p_intervention uuid, p_type public.event_type, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_name text;
begin
  select org_id into v_org from public.interventions where id = p_intervention;
  select coalesce(nullif(full_name, ''), email) into v_name from public.members where user_id = auth.uid();
  insert into public.intervention_events(org_id, intervention_id, type, body, actor_id, actor_name, actor_role)
  values (v_org, p_intervention, p_type, coalesce(trim(p_body), ''), auth.uid(), coalesce(v_name, ''), private.my_role());
  perform set_config('app.transition', 'on', true);
  update public.interventions set updated_at = now() where id = p_intervention;
  perform set_config('app.transition', 'off', true);
end $$;

-- Triggers -------------------------------------------------------------------
create or replace function private.interventions_before() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    -- Toute intervention naît brouillon, sans assignation.
    new.status := 'brouillon'; new.assignee_id := null;
    new.published_at := null; new.resolved_at := null; new.validated_at := null;
    return new;
  end if;
  new.org_id := old.org_id; new.created_by := old.created_by; new.created_at := old.created_at;
  if coalesce(current_setting('app.transition', true), 'off') <> 'on' then
    -- Hors workflow, le statut et l'assignation ne bougent pas.
    if (new.status, new.assignee_id, new.published_at, new.resolved_at, new.validated_at)
       is distinct from (old.status, old.assignee_id, old.published_at, old.resolved_at, old.validated_at) then
      raise exception 'Utilisez les actions du workflow pour changer le statut' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger interventions_before before insert or update on public.interventions
  for each row execute function private.interventions_before();

create or replace function private.interventions_after() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_event(new.id, 'creee', '');
  elsif coalesce(current_setting('app.transition', true), 'off') <> 'on'
    and (new.title, new.location, new.description, new.priority, new.scheduled_date)
        is distinct from (old.title, old.location, old.description, old.priority, old.scheduled_date) then
    perform private.log_event(new.id, 'modifiee', '');
  end if;
  return null;
end $$;
create trigger interventions_after after insert or update on public.interventions
  for each row execute function private.interventions_after();

create or replace function private.photos_before() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select org_id into new.org_id from public.interventions where id = new.intervention_id;
  if new.org_id is null then raise exception 'Intervention introuvable'; end if;
  return new;
end $$;
create trigger photos_before before insert on public.intervention_photos
  for each row execute function private.photos_before();

create or replace function private.photos_after() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.log_event(new.intervention_id, 'photo', new.path);
  return null;
end $$;
create trigger photos_after after insert on public.intervention_photos
  for each row execute function private.photos_after();

-- Membres : rôle et rôle simulé protégés.
create or replace function private.members_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and old.user_id = auth.uid() then
    if tg_op = 'DELETE' or new.role is distinct from old.role then
      raise exception 'Vous ne pouvez pas modifier votre propre rôle' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.org_id := old.org_id; new.user_id := old.user_id; new.email := old.email;
  if coalesce(current_setting('app.transition', true), 'off') <> 'on' then
    new.acting_role := old.acting_role;
  end if;
  return new;
end $$;
create trigger members_guard before update or delete on public.members
  for each row execute function private.members_guard();

-- Fonctions métier ------------------------------------------------------------
create or replace function private.create_organization(p_name text, p_full_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  if auth.uid() is null then raise exception 'Non connecté' using errcode = '42501'; end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then
    raise exception 'Vous appartenez déjà à une entreprise';
  end if;
  insert into public.organizations(name) values (trim(p_name)) returning id into v_org;
  insert into public.members(user_id, org_id, role, full_name, email)
  values (auth.uid(), v_org, 'admin', coalesce(trim(p_full_name), ''), lower(coalesce(auth.jwt()->>'email', '')));
  return v_org;
end $$;

create or replace function private.accept_invitation(p_token uuid, p_full_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_inv public.invitations;
begin
  if auth.uid() is null then raise exception 'Non connecté' using errcode = '42501'; end if;
  select * into v_inv from public.invitations
   where token = p_token and accepted_at is null and expires_at > now();
  if not found then raise exception 'Invitation invalide ou expirée'; end if;
  if lower(v_inv.email) <> lower(coalesce(auth.jwt()->>'email', '')) then
    raise exception 'Cette invitation est destinée à une autre adresse e-mail';
  end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then
    raise exception 'Vous appartenez déjà à une entreprise';
  end if;
  insert into public.members(user_id, org_id, role, full_name, email)
  values (auth.uid(), v_inv.org_id, v_inv.role, coalesce(trim(p_full_name), ''), lower(v_inv.email));
  update public.invitations set accepted_at = now(), accepted_by = auth.uid() where id = v_inv.id;
  return v_inv.org_id;
end $$;

create or replace function private.invitation_info(p_token uuid)
returns table(org_name text, email text, role public.member_role)
language sql stable security definer set search_path = '' as $$
  select o.name, i.email, i.role from public.invitations i
  join public.organizations o on o.id = i.org_id
  where i.token = p_token and i.accepted_at is null and i.expires_at > now()
$$;

-- « Voir en tant que » : réservé aux admins (rôle réel). null = revenir admin.
create or replace function private.set_acting_role(p_role public.member_role) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if private.real_role() is distinct from 'admin' then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  perform set_config('app.transition', 'on', true);
  update public.members set acting_role = case when p_role = 'admin' then null else p_role end
   where user_id = auth.uid();
  perform set_config('app.transition', 'off', true);
end $$;

-- Workflow : publier, prendre en charge, résoudre, valider, refuser.
create or replace function private.transition(p_id uuid, p_action text, p_comment text)
returns public.intervention_status
language plpgsql security definer set search_path = '' as $$
declare i public.interventions; v_role public.member_role := private.my_role(); v_new public.intervention_status;
  v_ev public.event_type;
begin
  select * into i from public.interventions where id = p_id and org_id = private.my_org() for update;
  if not found then raise exception 'Intervention introuvable'; end if;
  perform set_config('app.transition', 'on', true);
  if p_action = 'publier' then
    if not private.is_manager() then raise exception 'Action réservée aux responsables' using errcode = '42501'; end if;
    if i.status <> 'brouillon' then raise exception 'Seul un brouillon peut être publié'; end if;
    update public.interventions set status = 'publiee', published_at = now() where id = p_id;
    v_new := 'publiee'; v_ev := 'publiee';
  elsif p_action = 'prendre' then
    if v_role not in ('technicien', 'responsable_tech') then raise exception 'Action réservée aux techniciens' using errcode = '42501'; end if;
    if i.status <> 'publiee' or i.assignee_id is not null then raise exception 'Intervention déjà prise ou non publiée'; end if;
    update public.interventions set status = 'prise_en_charge', assignee_id = auth.uid() where id = p_id;
    v_new := 'prise_en_charge'; v_ev := 'prise_en_charge';
  elsif p_action = 'resoudre' then
    if i.assignee_id is distinct from auth.uid() then raise exception 'Seul le technicien en charge peut résoudre' using errcode = '42501'; end if;
    if i.status <> 'prise_en_charge' then raise exception 'L''intervention n''est pas en cours'; end if;
    update public.interventions set status = 'resolue', resolved_at = now() where id = p_id;
    v_new := 'resolue'; v_ev := 'resolue';
  elsif p_action = 'valider' then
    if not private.is_manager() then raise exception 'Action réservée aux responsables' using errcode = '42501'; end if;
    if i.status <> 'resolue' then raise exception 'Seule une intervention résolue peut être validée'; end if;
    update public.interventions set status = 'validee', validated_at = now() where id = p_id;
    v_new := 'validee'; v_ev := 'validee';
  elsif p_action = 'refuser' then
    if not private.is_manager() then raise exception 'Action réservée aux responsables' using errcode = '42501'; end if;
    if i.status <> 'resolue' then raise exception 'Seule une intervention résolue peut être refusée'; end if;
    update public.interventions set status = 'prise_en_charge', resolved_at = null where id = p_id;
    v_new := 'prise_en_charge'; v_ev := 'refusee';
  else
    raise exception 'Action inconnue';
  end if;
  perform set_config('app.transition', 'off', true);
  perform private.log_event(p_id, v_ev, p_comment);
  return v_new;
end $$;

create or replace function private.add_comment(p_id uuid, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_see(p_id) then raise exception 'Intervention introuvable'; end if;
  if length(trim(coalesce(p_body, ''))) = 0 then raise exception 'Commentaire vide'; end if;
  perform private.log_event(p_id, 'commentaire', left(p_body, 4000));
end $$;

grant usage on schema private to authenticated, anon;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
grant execute on function private.invitation_info(uuid) to anon;

-- Enveloppes publiques (security invoker) exposées via l'API.
create or replace function public.create_organization(p_name text, p_full_name text) returns uuid
language sql security invoker set search_path = '' as $$ select private.create_organization(p_name, p_full_name) $$;
create or replace function public.accept_invitation(p_token uuid, p_full_name text) returns uuid
language sql security invoker set search_path = '' as $$ select private.accept_invitation(p_token, p_full_name) $$;
create or replace function public.invitation_info(p_token uuid)
returns table(org_name text, email text, role public.member_role)
language sql stable security invoker set search_path = '' as $$ select * from private.invitation_info(p_token) $$;
create or replace function public.set_acting_role(p_role public.member_role) returns void
language sql security invoker set search_path = '' as $$ select private.set_acting_role(p_role) $$;
create or replace function public.transition(p_id uuid, p_action text, p_comment text default '')
returns public.intervention_status
language sql security invoker set search_path = '' as $$ select private.transition(p_id, p_action, p_comment) $$;
create or replace function public.add_comment(p_id uuid, p_body text) returns void
language sql security invoker set search_path = '' as $$ select private.add_comment(p_id, p_body) $$;

revoke execute on function public.create_organization(text, text), public.accept_invitation(uuid, text),
  public.set_acting_role(public.member_role), public.transition(uuid, text, text), public.add_comment(uuid, text)
  from public, anon;
grant execute on function public.create_organization(text, text), public.accept_invitation(uuid, text),
  public.set_acting_role(public.member_role), public.transition(uuid, text, text), public.add_comment(uuid, text)
  to authenticated;
grant execute on function public.invitation_info(uuid) to anon, authenticated;

-- RLS ------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.members enable row level security;
alter table public.invitations enable row level security;
alter table public.interventions enable row level security;
alter table public.intervention_photos enable row level security;
alter table public.intervention_events enable row level security;

create policy org_select on public.organizations for select to authenticated
  using (id = (select private.my_org()));
create policy org_update on public.organizations for update to authenticated
  using (id = (select private.my_org()) and (select private.my_role()) = 'admin')
  with check (id = (select private.my_org()));

create policy members_select on public.members for select to authenticated
  using (org_id = (select private.my_org()));
create policy members_update on public.members for update to authenticated
  using (org_id = (select private.my_org()) and ((select private.my_role()) = 'admin' or user_id = (select auth.uid())))
  with check (org_id = (select private.my_org()));
create policy members_delete on public.members for delete to authenticated
  using (org_id = (select private.my_org()) and (select private.my_role()) = 'admin');

create policy inv_select on public.invitations for select to authenticated
  using (org_id = (select private.my_org()) and (select private.my_role()) = 'admin');
create policy inv_insert on public.invitations for insert to authenticated
  with check (org_id = (select private.my_org()) and (select private.my_role()) = 'admin' and invited_by = (select auth.uid()));
create policy inv_delete on public.invitations for delete to authenticated
  using (org_id = (select private.my_org()) and (select private.my_role()) = 'admin');

create policy itv_select on public.interventions for select to authenticated
  using (org_id = (select private.my_org()) and (status <> 'brouillon' or (select private.is_manager())));
create policy itv_insert on public.interventions for insert to authenticated
  with check (org_id = (select private.my_org()) and (select private.is_manager()));
create policy itv_update on public.interventions for update to authenticated
  using (org_id = (select private.my_org()) and (select private.is_manager()))
  with check (org_id = (select private.my_org()));
create policy itv_delete on public.interventions for delete to authenticated
  using (org_id = (select private.my_org()) and (select private.is_manager()));

create policy photos_select on public.intervention_photos for select to authenticated
  using (org_id = (select private.my_org()) and private.can_see(intervention_id));
create policy photos_insert on public.intervention_photos for insert to authenticated
  with check (uploaded_by = (select auth.uid()) and private.can_work_on(intervention_id));
create policy photos_delete on public.intervention_photos for delete to authenticated
  using (org_id = (select private.my_org()) and (uploaded_by = (select auth.uid()) or (select private.is_manager())));

create policy events_select on public.intervention_events for select to authenticated
  using (org_id = (select private.my_org()) and private.can_see(intervention_id));

-- Stockage des photos : bucket privé, chemin "<org_id>/<intervention_id>/<fichier>"
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

create policy photos_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select private.my_org())::text);
create policy photos_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select private.my_org())::text
    and private.can_work_on(((storage.foldername(name))[2])::uuid));
create policy photos_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select private.my_org())::text
    and (owner_id = (select auth.uid())::text or (select private.is_manager())));
