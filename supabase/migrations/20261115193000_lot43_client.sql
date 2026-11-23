-- Lot 43 : rôle Client (voit uniquement ses signalements, pas le tchat) ; libellé Resp.tech.

alter type public.member_role add value if not exists 'client';

-- Visibilité : un client ne voit que les interventions qu'il a créées.
create or replace function private.can_see(p_intervention uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.interventions i
    where i.id = p_intervention and i.org_id = private.my_org()
      and case
        when (private.my_role())::text = 'client' then i.created_by = auth.uid()
        else (i.status <> 'brouillon' or private.is_manager() or i.created_by = auth.uid())
      end)
$$;

drop policy if exists itv_select on public.interventions;
create policy itv_select on public.interventions for select to authenticated
  using (org_id = (select private.my_org())
    and case
      when (select private.my_role())::text = 'client' then created_by = (select auth.uid())
      else (status <> 'brouillon' or (select private.is_manager()) or created_by = (select auth.uid()))
    end);

-- Pas d'accès en lecture au tchat / événements pour le profil Client.
drop policy if exists events_select on public.intervention_events;
create policy events_select on public.intervention_events for select to authenticated
  using (org_id = (select private.my_org())
    and (select private.my_role())::text <> 'client'
    and private.can_see(intervention_id));

create or replace function private.add_comment(p_id uuid, p_body text)
 returns void language plpgsql security definer set search_path to '' as $function$
declare i public.interventions;
begin
  if (private.my_role())::text = 'client' then
    raise exception 'Le profil Client n''a pas accès au tchat' using errcode = '42501';
  end if;
  if not private.can_see(p_id) then raise exception 'Intervention introuvable'; end if;
  select * into i from public.interventions where id = p_id;
  if i.created_by is distinct from auth.uid() then
    if i.status = 'brouillon' then raise exception 'Brouillon : commentaires réservés à l''auteur' using errcode = '42501'; end if;
    if i.status in ('resolue', 'validee') then raise exception 'Intervention clôturée : plus de commentaires possibles' using errcode = '42501'; end if;
  end if;
  if length(trim(coalesce(p_body, ''))) = 0 then raise exception 'Commentaire vide'; end if;
  perform private.log_event(p_id, 'commentaire', left(p_body, 4000));
end $function$;

-- Libellé compact « Resp.tech » (plus « Responsable tech ») pour le profil admin et le compte de test.
create or replace function private.log_event(p_intervention uuid, p_type public.event_type, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_name text; v_real public.member_role; v_role public.member_role := private.my_role();
begin
  select org_id into v_org from public.interventions where id = p_intervention;
  select coalesce(nullif(full_name, ''), email), role into v_name, v_real from public.members where user_id = auth.uid();
  if v_real = 'admin' then
    v_name := case v_role::text
      when 'admin' then 'Admin'
      when 'directeur' then 'Directeur'
      when 'responsable_tech' then 'Resp.tech'
      when 'client' then 'Client'
      else 'Tech' end;
  elsif v_name in ('Responsable tech', 'Responsable technique') then
    v_name := 'Resp.tech';
  end if;
  insert into public.intervention_events(org_id, intervention_id, type, body, actor_id, actor_name, actor_role)
  values (v_org, p_intervention, p_type, coalesce(trim(p_body), ''), auth.uid(), coalesce(v_name, ''), v_role);
  perform set_config('app.transition', 'on', true);
  update public.interventions set updated_at = now() where id = p_intervention;
  perform set_config('app.transition', 'off', true);
end $$;

update public.members set full_name = 'Resp.tech'
  where email = 'resp.a@test.local' and full_name in ('Responsable tech', 'Responsable technique');

update public.intervention_events
  set actor_name = 'Resp.tech'
  where actor_name in ('Responsable tech', 'Responsable technique');
