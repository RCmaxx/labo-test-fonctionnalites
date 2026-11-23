-- Lot 59 : le demandeur est prévenu du refus (une seule fois).
alter table public.transfer_requests add column if not exists requester_seen boolean not null default false;
create or replace function private.ack_transfer(p_req uuid)
 returns void language sql security definer set search_path to '' as $$
  update public.transfer_requests set requester_seen = true where id = p_req and requester_id = auth.uid() $$;
create or replace function public.ack_transfer(p_req uuid) returns void language sql set search_path to '' as $$ select private.ack_transfer(p_req) $$;
revoke execute on function private.ack_transfer(uuid), public.ack_transfer(uuid) from public, anon;
grant execute on function private.ack_transfer(uuid), public.ack_transfer(uuid) to authenticated;
update public.transfer_requests set requester_seen = true where status = 'refusee';
