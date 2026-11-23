-- Lot 223 : verrou d'édition. Quand quelqu'un modifie une intervention, « Modifier » est grisé pour les autres.
-- Migration purement additive : une nouvelle table et de nouvelles fonctions ; aucune table, colonne,
-- politique ni fonction existante n'est modifiée. Le verrou vit dans sa propre table (et non dans
-- public.interventions) pour ne pas déclencher les triggers de l'intervention (updated_at, historique).
-- Expiration automatique : 2 minutes sans renouvellement.

create table if not exists public.intervention_locks (
  intervention_id uuid primary key references public.interventions(id) on delete cascade,
  org_id uuid not null,
  editing_by uuid not null references auth.users(id) on delete cascade,
  editing_name text not null default '',
  editing_until timestamptz not null
);
alter table public.intervention_locks enable row level security;
-- Aucun accès direct : lecture et écriture uniquement par les fonctions ci-dessous.
revoke all on public.intervention_locks from public, anon, authenticated;

-- Prendre / renouveler ('take'), libérer ('release') ou consulter ('peek') le verrou d'une intervention.
create or replace function private.edit_lock(p_id uuid, p_action text)
returns table(editing_by uuid, editing_name text, secs_left integer, mine boolean, ok boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare i public.interventions; l public.intervention_locks; me uuid := auth.uid();
begin
  if me is null then raise exception 'Non connecté' using errcode = '42501'; end if;
  if p_action not in ('take', 'release', 'peek') then raise exception 'Action inconnue'; end if;
  select * into i from public.interventions where id = p_id;
  if not found or i.org_id is distinct from private.my_org() or not private.can_see(p_id) then
    raise exception 'Intervention introuvable' using errcode = '42501';
  end if;
  delete from public.intervention_locks k where k.intervention_id = p_id and k.editing_until <= now();
  if p_action = 'take' then
    if i.created_by is distinct from me and i.available_from is null then
      raise exception 'Seul l''auteur de l''intervention peut la modifier' using errcode = '42501';
    end if;
    insert into public.intervention_locks as k (intervention_id, org_id, editing_by, editing_name, editing_until)
      values (p_id, i.org_id, me, private.shown_name(me), now() + interval '2 minutes')
      on conflict (intervention_id) do update
        set editing_until = excluded.editing_until, editing_name = excluded.editing_name
        where k.editing_by = me;
  elsif p_action = 'release' then
    delete from public.intervention_locks k where k.intervention_id = p_id and k.editing_by = me;
  end if;
  select * into l from public.intervention_locks k where k.intervention_id = p_id;
  if not found then
    return query select null::uuid, ''::text, 0, false, p_action <> 'take';
    return;
  end if;
  return query select l.editing_by, l.editing_name,
    greatest(0, ceil(extract(epoch from (l.editing_until - now()))))::integer,
    l.editing_by = me, (p_action <> 'take') or l.editing_by = me;
end $$;

-- Verrous actifs visibles par le membre connecté (pour griser « Modifier » dans les listes et menus).
create or replace function private.edit_locks()
returns table(intervention_id uuid, editing_by uuid, editing_name text, secs_left integer)
language sql stable security definer set search_path = '' as $$
  select k.intervention_id, k.editing_by, k.editing_name,
         greatest(0, ceil(extract(epoch from (k.editing_until - now()))))::integer
  from public.intervention_locks k
  where k.org_id = private.my_org() and k.editing_until > now() and private.can_see(k.intervention_id)
$$;

create or replace function public.edit_lock(p_id uuid, p_action text)
returns table(editing_by uuid, editing_name text, secs_left integer, mine boolean, ok boolean)
language sql set search_path = '' as $$ select * from private.edit_lock(p_id, p_action) $$;

create or replace function public.edit_locks()
returns table(intervention_id uuid, editing_by uuid, editing_name text, secs_left integer)
language sql stable set search_path = '' as $$ select * from private.edit_locks() $$;

revoke execute on function private.edit_lock(uuid, text), private.edit_locks(), public.edit_lock(uuid, text), public.edit_locks() from public, anon;
grant execute on function private.edit_lock(uuid, text), private.edit_locks(), public.edit_lock(uuid, text), public.edit_locks() to authenticated;
