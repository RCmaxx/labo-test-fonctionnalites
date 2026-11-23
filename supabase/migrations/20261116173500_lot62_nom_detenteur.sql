-- Lot 62 : compte admin détenteur → nom du profil qui a pris l'intervention (comme partout ailleurs).
create or replace function private.request_transfer(p_id uuid)
 returns void language plpgsql security definer set search_path to '' as $function$
declare i public.interventions; v_role public.member_role := private.my_role(); v_holder text; v_hrole public.member_role;
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
  select coalesce(nullif(full_name, ''), email), role into v_holder, v_hrole from public.members where user_id = i.assignee_id;
  if v_hrole = 'admin' then v_holder := case i.assignee_role::text when 'responsable_tech' then 'Julien' when 'directeur' then 'Raphaël' else 'Thomas' end; end if;
  perform private.log_event(p_id, 'demande_transfert', 'Demande à ' || coalesce(v_holder, ''));
end $function$;
-- Données : noms du compte admin remplacés par le profil, et « par Y » ajouté aux anciens transferts.
update public.intervention_events set body = 'Demande à Julien' where type = 'demande_transfert' and body = 'Demande à Appli Admin';
update public.intervention_events set body = 'Transférée à Julien' where type = 'prise_en_charge' and body = 'Transférée à Appli Admin';
update public.intervention_events set body = 'Transférée par ' || actor_name || ' à ' || substr(body, 14) where type = 'prise_en_charge' and body like 'Transférée à %';

create or replace function private.answer_transfer(p_req uuid, p_ok boolean)
 returns void language plpgsql security definer set search_path to '' as $function$
declare r public.transfer_requests; i public.interventions; v_name text; v_qrole public.member_role;
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
  select coalesce(nullif(full_name, ''), email), role into v_name, v_qrole from public.members where user_id = r.requester_id and org_id = r.org_id;
  if v_qrole = 'admin' then v_name := case r.requester_role::text when 'responsable_tech' then 'Julien' else 'Thomas' end; end if;
  perform set_config('app.transition', 'on', true);
  update public.interventions set assignee_id = r.requester_id, assignee_role = r.requester_role where id = r.intervention_id;
  perform set_config('app.transition', 'off', true);
  perform private.log_event(r.intervention_id, 'prise_en_charge', 'Transférée par ' || private.shown_name(auth.uid()) || ' à ' || coalesce(v_name, ''));
end $function$;
