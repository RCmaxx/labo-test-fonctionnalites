-- Lot 84 : « Renvoyer active » remet une intervention terminée en cours (si quelqu'un l'avait) ou en nouvelle.
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
  elsif p_action = 'renvoyer' then
    if not (private.is_manager() or i.assignee_id = auth.uid()) then raise exception 'Action réservée aux responsables et au technicien en charge' using errcode = '42501'; end if;
    if i.status not in ('resolue', 'validee') then raise exception 'L''intervention n''est pas terminée'; end if;
    v_new := case when i.assignee_id is not null then 'prise_en_charge' else 'publiee' end;
    update public.interventions set status = v_new, resolved_at = null, validated_at = null where id = p_id;
    v_ev := 'reactivee';
  else
    raise exception 'Action inconnue';
  end if;
  perform set_config('app.transition', 'off', true);
  perform private.log_event(p_id, v_ev, p_comment);
  return v_new;
end $function$;
