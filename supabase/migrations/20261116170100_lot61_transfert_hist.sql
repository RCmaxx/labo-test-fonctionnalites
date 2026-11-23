-- Lot 61 : nom affiché d'un membre (compte admin : nom du profil simulé, comme log_event).
create or replace function private.shown_name(p_uid uuid)
 returns text language plpgsql stable security definer set search_path to '' as $function$
declare v_name text; v_real public.member_role;
begin
  select coalesce(nullif(full_name, ''), email), role into v_name, v_real from public.members where user_id = p_uid;
  if v_real = 'admin' and p_uid = auth.uid() then
    v_name := case private.my_role()::text when 'responsable_tech' then 'Julien' when 'technicien' then 'Thomas' when 'reception' then 'Léa' when 'client' then 'Client' else 'Raphaël' end;
  end if;
  return coalesce(v_name, '');
end $function$;
revoke execute on function private.shown_name(uuid) from public, anon;
grant execute on function private.shown_name(uuid) to authenticated;

create or replace function private.request_transfer(p_id uuid)
 returns void language plpgsql security definer set search_path to '' as $function$
declare i public.interventions; v_role public.member_role := private.my_role(); v_holder text;
begin
  if v_role not in ('technicien', 'responsable_tech') then raise exception 'Action réservée aux techniciens' using errcode = '42501'; end if;
  select * into i from public.interventions where id = p_id and org_id = private.my_org();
  if not found then raise exception 'Intervention introuvable'; end if;
  if i.status <> 'prise_en_charge' or i.assignee_id is null then raise exception 'L''intervention n''est pas en cours'; end if;
  if i.assignee_id = auth.uid() then raise exception 'Intervention déjà prise par vous'; end if;
  insert into public.transfer_requests(org_id, intervention_id, requester_id, requester_role, holder_id)
  values (i.org_id, p_id, auth.uid(), v_role, i.assignee_id)
  on conflict (intervention_id, requester_id) where status = 'en_attente'
  do update set holder_id = excluded.holder_id, requester_role = excluded.requester_role, created_at = now();
  select coalesce(nullif(full_name, ''), email) into v_holder from public.members where user_id = i.assignee_id;
  perform private.log_event(p_id, 'demande_transfert', 'Demande à ' || coalesce(v_holder, ''));
end $function$;

create or replace function private.answer_transfer(p_req uuid, p_ok boolean)
 returns void language plpgsql security definer set search_path to '' as $function$
declare r public.transfer_requests; i public.interventions; v_name text;
begin
  select * into r from public.transfer_requests where id = p_req and holder_id = auth.uid() for update;
  if not found then raise exception 'Demande introuvable'; end if;
  if r.status <> 'en_attente' then return; end if;
  select * into i from public.interventions where id = r.intervention_id for update;
  if i.assignee_id is distinct from auth.uid() or i.status <> 'prise_en_charge' then
    update public.transfer_requests set status = 'caduque' where id = p_req; return;
  end if;
  if not p_ok then update public.transfer_requests set status = 'refusee' where id = p_req; return; end if;
  update public.transfer_requests set status = 'acceptee' where id = p_req;
  update public.transfer_requests set status = 'caduque' where intervention_id = r.intervention_id and status = 'en_attente';
  select coalesce(nullif(full_name, ''), email) into v_name from public.members where user_id = r.requester_id and org_id = r.org_id;
  perform set_config('app.transition', 'on', true);
  update public.interventions set assignee_id = r.requester_id, assignee_role = r.requester_role where id = r.intervention_id;
  perform set_config('app.transition', 'off', true);
  perform private.log_event(r.intervention_id, 'prise_en_charge', 'Transférée par ' || private.shown_name(auth.uid()) || ' à ' || coalesce(v_name, ''));
end $function$;

-- Lot 61 : clôture sans auteur possible.
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
  end if;
  perform set_config('app.transition', 'on', true);
  update public.interventions set status = 'resolue', resolved_at = now(), proposed_to = null,
    assignee_id = p_tech, assignee_role = m.role where id = p_id;
  perform set_config('app.transition', 'off', true);
  perform private.log_event(p_id, 'resolue', case when v_name is null then '' else 'Réalisée par ' || v_name end);
end $function$;
