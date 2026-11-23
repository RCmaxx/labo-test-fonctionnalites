-- Lot 30 : directeur/RT clôturent sans être en charge ; clôture d'une intervention non prise ; admin simulé accepte une assignation.
create or replace function private.transition(p_id uuid, p_action text, p_comment text)
 returns public.intervention_status language plpgsql security definer set search_path to '' as $function$
declare i public.interventions; v_role public.member_role := private.my_role(); v_new public.intervention_status;
  v_ev public.event_type;
  v_admin boolean := exists (select 1 from public.members where user_id = auth.uid() and role = 'admin');
begin
  select * into i from public.interventions where id = p_id and org_id = private.my_org() for update;
  if not found then raise exception 'Intervention introuvable'; end if;
  perform set_config('app.transition', 'on', true);
  if p_action = 'publier' then
    if not (private.is_manager() or i.created_by = auth.uid()) then raise exception 'Action réservée aux responsables' using errcode = '42501'; end if;
    if i.status <> 'brouillon' then raise exception 'Seul un brouillon peut être publié'; end if;
    update public.interventions set status = 'publiee', published_at = now() where id = p_id;
    v_new := 'publiee'; v_ev := 'publiee';
  elsif p_action = 'prendre' then
    if v_role not in ('technicien', 'responsable_tech') then raise exception 'Action réservée aux techniciens' using errcode = '42501'; end if;
    if i.status <> 'publiee' or i.assignee_id is not null then raise exception 'Intervention déjà prise ou non publiée'; end if;
    if i.available_from is not null and i.available_from - interval '5 minutes' > now() then raise exception 'Intervention programmée : pas encore disponible'; end if;
    if i.proposed_to is not null and i.proposed_to <> auth.uid() and not v_admin then raise exception 'Intervention assignée à un autre technicien' using errcode = '42501'; end if;
    update public.interventions set status = 'prise_en_charge', assignee_id = auth.uid(), assignee_role = v_role, proposed_to = null where id = p_id;
    v_new := 'prise_en_charge'; v_ev := 'prise_en_charge';
  elsif p_action = 'liberer' then
    if i.assignee_id is distinct from auth.uid() then raise exception 'Seul le technicien en charge peut se désister' using errcode = '42501'; end if;
    if i.status <> 'prise_en_charge' then raise exception 'L''intervention n''est pas en cours'; end if;
    update public.interventions set status = 'publiee', assignee_id = null, assignee_role = null where id = p_id;
    v_new := 'publiee'; v_ev := 'liberee';
  elsif p_action = 'resoudre' then
    if i.assignee_id is distinct from auth.uid() and v_role not in ('directeur', 'responsable_tech') then raise exception 'Seul le technicien en charge peut clôturer' using errcode = '42501'; end if;
    if i.status <> 'prise_en_charge' then raise exception 'L''intervention n''est pas en cours'; end if;
    update public.interventions set status = 'resolue', resolved_at = now() where id = p_id;
    v_new := 'resolue'; v_ev := 'resolue';
  else
    raise exception 'Action inconnue';
  end if;
  perform set_config('app.transition', 'off', true);
  perform private.log_event(p_id, v_ev, p_comment);
  return v_new;
end $function$;

-- Clôture d'une intervention non prise, réalisée par un membre (p_tech) ou une autre personne (p_other).
create or replace function private.close_for(p_id uuid, p_tech uuid, p_other text)
 returns void language plpgsql security definer set search_path to '' as $function$
declare i public.interventions; m public.members; v_name text;
begin
  if private.my_role() not in ('directeur', 'responsable_tech') then raise exception 'Action réservée au directeur et au responsable tech' using errcode = '42501'; end if;
  select * into i from public.interventions where id = p_id and org_id = private.my_org() for update;
  if not found then raise exception 'Intervention introuvable'; end if;
  if i.status <> 'publiee' or i.assignee_id is not null then raise exception 'Intervention déjà prise ou non publiée'; end if;
  if p_tech is not null then
    select * into m from public.members where user_id = p_tech and org_id = private.my_org();
    if not found then raise exception 'Membre introuvable'; end if;
    v_name := coalesce(nullif(m.full_name, ''), m.email);
  else
    v_name := nullif(trim(coalesce(p_other, '')), '');
    if v_name is null then raise exception 'Indiquez qui a fait l''intervention'; end if;
  end if;
  perform set_config('app.transition', 'on', true);
  update public.interventions set status = 'resolue', resolved_at = now(), proposed_to = null,
    assignee_id = p_tech, assignee_role = m.role where id = p_id;
  perform set_config('app.transition', 'off', true);
  perform private.log_event(p_id, 'resolue', 'Réalisée par ' || v_name);
end $function$;
create or replace function public.close_for(p_id uuid, p_tech uuid, p_other text) returns void
language sql security invoker set search_path = '' as $$ select private.close_for(p_id, p_tech, p_other) $$;
revoke execute on function public.close_for(uuid, uuid, text) from public, anon;
revoke execute on function private.close_for(uuid, uuid, text) from public, anon;
grant execute on function public.close_for(uuid, uuid, text) to authenticated;
grant execute on function private.close_for(uuid, uuid, text) to authenticated;
