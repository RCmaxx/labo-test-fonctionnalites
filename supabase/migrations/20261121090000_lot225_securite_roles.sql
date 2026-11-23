-- Lot 225 : sécurité par rôle (audit RLS, RPC security definer, storage).
-- Appliquée avec le feu vert de l'utilisateur (Lot 225). Exécutée dans une transaction par l'outil de migration.
-- Rôles existants (enum member_role) : admin, directeur, responsable_tech, technicien, reception, client.
-- « Développeur » n'existe pas comme rôle applicatif (hypothèse : compte admin ou accès service, hors appli).
-- Résumé :
--  1. interventions : modification réservée à l'auteur, à la personne assignée (assignee_id ou proposed_to)
--     et aux responsables / admins ; le client ne modifie que son propre brouillon.
--  2. interventions : création au nom de soi seulement, sans assignation forcée.
--  3. interventions : proposed_to / assigned_by / assignee_role ne bougent plus hors des actions du workflow.
--  4. photos (table et fichiers) : plus aucune lecture pour le client ; fichiers lisibles seulement si
--     l'intervention est visible (avant : tout fichier de l'entreprise, même d'une intervention non visible).
--  5. membres : le client ne voit que sa propre fiche.
--  6. verrou d'édition : refusé au client ; « prendre » suit la nouvelle règle de modification.
--  7. fonction trigger public.photo_limit : plus exécutable par anon / public.

-- 1. Modification.
drop policy if exists itv_update on public.interventions;
create policy itv_update on public.interventions for update to authenticated
  using (
    org_id = (select private.my_org())
    and case when (select private.my_role())::text = 'client'
      then created_by = (select auth.uid()) and status = 'brouillon'
      else created_by = (select auth.uid()) or assignee_id = (select auth.uid()) or proposed_to = (select auth.uid())
        or (select private.is_manager()) or (select private.real_role()) = 'admin'
    end)
  with check (
    org_id = (select private.my_org())
    and case when (select private.my_role())::text = 'client'
      then created_by = (select auth.uid()) and status = 'brouillon'
      else created_by = (select auth.uid()) or assignee_id = (select auth.uid()) or proposed_to = (select auth.uid())
        or (select private.is_manager()) or (select private.real_role()) = 'admin'
    end);

-- 2. Création : auteur = soi, pas d'assignation à la création (elle passe par assign_tech).
drop policy if exists itv_insert on public.interventions;
create policy itv_insert on public.interventions for insert to authenticated
  with check (org_id = (select private.my_org()) and created_by = (select auth.uid())
    and proposed_to is null and assigned_by is null);

-- 3. Champs d'assignation protégés hors workflow (assign_tech, transition, close_for passent app.transition = on).
create or replace function private.interventions_before()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    -- Toute intervention naît brouillon, sans assignation.
    new.status := 'brouillon'; new.assignee_id := null;
    new.published_at := null; new.resolved_at := null; new.validated_at := null;
    new.proposed_to := null; new.assigned_by := null; new.assignee_role := null;
    return new;
  end if;
  new.org_id := old.org_id; new.created_by := old.created_by; new.created_at := old.created_at;
  if coalesce(current_setting('app.transition', true), 'off') <> 'on' then
    -- Hors workflow, le statut et l'assignation ne bougent pas.
    if (new.status, new.assignee_id, new.published_at, new.resolved_at, new.validated_at, new.proposed_to, new.assigned_by, new.assignee_role)
       is distinct from (old.status, old.assignee_id, old.published_at, old.resolved_at, old.validated_at, old.proposed_to, old.assigned_by, old.assignee_role) then
      raise exception 'Utilisez les actions du workflow pour changer le statut' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- 4. Photos : lecture interdite au client ; fichiers liés à une intervention visible.
drop policy if exists photos_select on public.intervention_photos;
create policy photos_select on public.intervention_photos for select to authenticated
  using (org_id = (select private.my_org()) and (select private.my_role())::text <> 'client' and private.can_see(intervention_id));

create or replace function private.can_read_photo(p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare f text[] := storage.foldername(p_name); v uuid;
begin
  if (private.my_role())::text = 'client' or f[1] is distinct from private.my_org()::text then return false; end if;
  begin v := f[2]::uuid; exception when others then return false; end;
  return private.can_see(v);
end $$;
revoke execute on function private.can_read_photo(text) from public, anon;
grant execute on function private.can_read_photo(text) to authenticated;

drop policy if exists photos_obj_select on storage.objects;
create policy photos_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'photos' and private.can_read_photo(name));

-- 5. Membres : le client ne voit que lui-même.
drop policy if exists members_select on public.members;
create policy members_select on public.members for select to authenticated
  using (org_id = (select private.my_org()) and ((select private.my_role())::text <> 'client' or user_id = (select auth.uid())));

-- 6. Verrou d'édition.
create or replace function private.edit_lock(p_id uuid, p_action text)
returns table(editing_by uuid, editing_name text, secs_left integer, mine boolean, ok boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare i public.interventions; l public.intervention_locks; me uuid := auth.uid();
begin
  if me is null then raise exception 'Non connecté' using errcode = '42501'; end if;
  if (private.my_role())::text = 'client' then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_action not in ('take', 'release', 'peek') then raise exception 'Action inconnue'; end if;
  select * into i from public.interventions where id = p_id;
  if not found or i.org_id is distinct from private.my_org() or not private.can_see(p_id) then
    raise exception 'Intervention introuvable' using errcode = '42501';
  end if;
  delete from public.intervention_locks k where k.intervention_id = p_id and k.editing_until <= now();
  if p_action = 'take' then
    if not (i.created_by = me or (i.available_from is not null and (i.assignee_id = me or i.proposed_to = me
        or private.is_manager() or private.real_role() = 'admin'))) then
      raise exception 'Modification non autorisée' using errcode = '42501';
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

create or replace function private.edit_locks()
returns table(intervention_id uuid, editing_by uuid, editing_name text, secs_left integer)
language sql stable security definer set search_path = '' as $$
  select k.intervention_id, k.editing_by, k.editing_name,
         greatest(0, ceil(extract(epoch from (k.editing_until - now()))))::integer
  from public.intervention_locks k
  where k.org_id = private.my_org() and k.editing_until > now()
    and (private.my_role())::text <> 'client' and private.can_see(k.intervention_id)
$$;

-- 7. Fonction trigger exposée.
revoke execute on function public.photo_limit() from public, anon;

