-- Lot 28 : l'assignation reste « nouvelle » jusqu'à l'acceptation par la personne assignée.
alter table public.interventions add column if not exists proposed_to uuid references auth.users(id) on delete set null;
CREATE OR REPLACE FUNCTION private.transition(p_id uuid, p_action text, p_comment text)
 RETURNS intervention_status
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare i public.interventions; v_role public.member_role := private.my_role(); v_new public.intervention_status;
  v_ev public.event_type;
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
    if i.proposed_to is not null and i.proposed_to <> auth.uid() then raise exception 'Intervention assignée à un autre technicien' using errcode = '42501'; end if;
    update public.interventions set status = 'prise_en_charge', assignee_id = auth.uid(), assignee_role = v_role where id = p_id;
    v_new := 'prise_en_charge'; v_ev := 'prise_en_charge';
  elsif p_action = 'liberer' then
    if i.assignee_id is distinct from auth.uid() then raise exception 'Seul le technicien en charge peut se désister' using errcode = '42501'; end if;
    if i.status <> 'prise_en_charge' then raise exception 'L''intervention n''est pas en cours'; end if;
    update public.interventions set status = 'publiee', assignee_id = null, assignee_role = null where id = p_id;
    v_new := 'publiee'; v_ev := 'liberee';
  elsif p_action = 'resoudre' then
    if i.assignee_id is distinct from auth.uid() then raise exception 'Seul le technicien en charge peut résoudre' using errcode = '42501'; end if;
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
create or replace function private.assign_tech(p_id uuid, p_tech uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare i public.interventions; v_name text;
begin
  if not private.is_manager() then raise exception 'Action réservée aux responsables' using errcode = '42501'; end if;
  select * into i from public.interventions where id = p_id and org_id = private.my_org() for update;
  if not found then raise exception 'Intervention introuvable'; end if;
  if i.status <> 'publiee' or i.assignee_id is not null then raise exception 'Intervention déjà prise ou non publiée'; end if;
  select coalesce(nullif(full_name, ''), email) into v_name from public.members
    where user_id = p_tech and org_id = private.my_org()
      and (role = 'technicien' or (role = 'responsable_tech' and private.my_role() in ('directeur', 'admin')));
  if v_name is null then raise exception 'Technicien introuvable'; end if;
  perform set_config('app.transition', 'on', true);
  update public.interventions set proposed_to = p_tech where id = p_id;
  perform set_config('app.transition', 'off', true);
end $$;
create or replace function public.assign_tech(p_id uuid, p_tech uuid) returns void
language sql security invoker set search_path = '' as $$ select private.assign_tech(p_id, p_tech) $$;
revoke execute on function public.assign_tech(uuid, uuid) from public, anon;
grant execute on function public.assign_tech(uuid, uuid) to authenticated;
grant execute on function private.assign_tech(uuid, uuid) to authenticated;
