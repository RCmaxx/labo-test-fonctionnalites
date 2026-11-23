-- Profil sous lequel l'intervention a été prise (le compte admin change de profil) : filtre « Mes interventions ».
alter table public.interventions add column if not exists assignee_role public.member_role;
alter table public.interventions disable trigger interventions_before;
update public.interventions i set assignee_role = (select e.actor_role from public.intervention_events e
  where e.intervention_id = i.id and e.type = 'prise_en_charge' order by e.created_at desc limit 1)
where i.assignee_id is not null;
alter table public.interventions enable trigger interventions_before;

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
    update public.interventions set status = 'prise_en_charge', assignee_id = auth.uid(), assignee_role = v_role where id = p_id;
    v_new := 'prise_en_charge'; v_ev := 'prise_en_charge';
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
end $$;

-- Lieux préenregistrés (saisie semi-automatique du champ Lieu).
create table if not exists public.places (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  num int,
  unique (org_id, label)
);
alter table public.places enable row level security;
create policy places_select on public.places for select to authenticated using (org_id = private.my_org());
grant select on public.places to authenticated;

-- Liste provisoire Mobil-home 1 à 300 pour le camping de test, à remplacer par la vraie liste.
insert into public.places(org_id, label, num)
select o.id, 'Mobil-home ' || n, n from public.organizations o, generate_series(1, 300) n
where o.name = 'Camping Les Mouettes Argentées' on conflict do nothing;
