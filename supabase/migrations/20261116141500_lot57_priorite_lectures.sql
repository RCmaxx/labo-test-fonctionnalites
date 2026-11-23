-- Lot 57 : « Haute » devient « Urgent » ; lectures du tchat par utilisateur
update public.interventions set priority = 'urgente' where priority = 'haute';
create table if not exists public.intervention_reads (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  intervention_id uuid not null references public.interventions(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, intervention_id)
);
alter table public.intervention_reads enable row level security;
create policy reads_own_select on public.intervention_reads for select to authenticated using (user_id = (select auth.uid()));
create policy reads_own_insert on public.intervention_reads for insert to authenticated with check (user_id = (select auth.uid()));
create policy reads_own_update on public.intervention_reads for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update on public.intervention_reads to authenticated;
