-- Lot 59 : un tech ou un RT demande une intervention déjà prise ; celui qui l'a prise accepte ou refuse le transfert.
create table if not exists public.transfer_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  intervention_id uuid not null references public.interventions(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  requester_role public.member_role not null,
  holder_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'en_attente' check (status in ('en_attente', 'acceptee', 'refusee', 'caduque')),
  created_at timestamptz not null default now()
);
create unique index if not exists transfer_requests_pending on public.transfer_requests(intervention_id, requester_id) where status = 'en_attente';
alter table public.transfer_requests enable row level security;
drop policy if exists transfer_requests_own on public.transfer_requests;
create policy transfer_requests_own on public.transfer_requests for select to authenticated
  using (requester_id = (select auth.uid()) or holder_id = (select auth.uid()));
grant select on public.transfer_requests to authenticated;

create or replace function private.request_transfer(p_id uuid)
 returns void language plpgsql security definer set search_path to '' as $function$
declare i public.interventions; v_role public.member_role := private.my_role();
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
  perform private.log_event(r.intervention_id, 'prise_en_charge', 'Transférée à ' || coalesce(v_name, ''));
end $function$;

create or replace function public.request_transfer(p_id uuid) returns void language sql set search_path to '' as $$ select private.request_transfer(p_id) $$;
create or replace function public.answer_transfer(p_req uuid, p_ok boolean) returns void language sql set search_path to '' as $$ select private.answer_transfer(p_req, p_ok) $$;
grant execute on function public.request_transfer(uuid), public.answer_transfer(uuid, boolean) to authenticated;
revoke execute on function private.request_transfer(uuid), private.answer_transfer(uuid, boolean), public.request_transfer(uuid), public.answer_transfer(uuid, boolean) from public, anon;
grant execute on function private.request_transfer(uuid), private.answer_transfer(uuid, boolean), public.request_transfer(uuid), public.answer_transfer(uuid, boolean) to authenticated;
