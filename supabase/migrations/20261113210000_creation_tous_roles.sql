-- Tous les membres peuvent créer et publier leurs interventions.
drop policy if exists itv_insert on public.interventions;
create policy itv_insert on public.interventions for insert to authenticated
  with check (org_id = (select private.my_org()));

drop policy if exists itv_select on public.interventions;
create policy itv_select on public.interventions for select to authenticated
  using (org_id = (select private.my_org())
    and (status <> 'brouillon' or (select private.is_manager()) or created_by = (select auth.uid())));

create or replace function private.can_see(p_intervention uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.interventions i
    where i.id = p_intervention and i.org_id = private.my_org()
      and (i.status <> 'brouillon' or private.is_manager() or i.created_by = auth.uid()))
$$;

create or replace function private.can_work_on(p_intervention uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.interventions i
    where i.id = p_intervention and i.org_id = private.my_org()
      and (private.is_manager()
        or (i.assignee_id = auth.uid() and i.status <> 'brouillon')
        or (i.created_by = auth.uid() and i.status = 'brouillon')))
$$;

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
    if not (private.is_manager() or i.created_by = auth.uid()) then raise exception 'Action réservée aux responsables' using errcode = '42501'; end if;
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
