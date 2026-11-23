-- Lot 27 : un directeur ou responsable tech peut assigner un technicien dès la création.
create or replace function private.assign_tech(p_id uuid, p_tech uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare i public.interventions; v_name text;
begin
  if not private.is_manager() then raise exception 'Action réservée aux responsables' using errcode = '42501'; end if;
  select * into i from public.interventions where id = p_id and org_id = private.my_org() for update;
  if not found then raise exception 'Intervention introuvable'; end if;
  if i.status <> 'publiee' or i.assignee_id is not null then raise exception 'Intervention déjà prise ou non publiée'; end if;
  select coalesce(nullif(full_name, ''), email) into v_name from public.members
    where user_id = p_tech and org_id = private.my_org() and role = 'technicien';
  if v_name is null then raise exception 'Technicien introuvable'; end if;
  perform set_config('app.transition', 'on', true);
  update public.interventions set status = 'prise_en_charge', assignee_id = p_tech, assignee_role = 'technicien' where id = p_id;
  perform set_config('app.transition', 'off', true);
  perform private.log_event(p_id, 'prise_en_charge', 'Assignée à ' || split_part(v_name, ' ', 1));
end $$;
create or replace function public.assign_tech(p_id uuid, p_tech uuid) returns void
language sql security invoker set search_path = '' as $$ select private.assign_tech(p_id, p_tech) $$;
revoke execute on function public.assign_tech(uuid, uuid) from public, anon;
grant execute on function public.assign_tech(uuid, uuid) to authenticated;
grant execute on function private.assign_tech(uuid, uuid) to authenticated;
