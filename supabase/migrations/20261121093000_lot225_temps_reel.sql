-- Lot 225 : temps réel Supabase (postgres_changes) à la place du polling 8 s / 30 s.
-- Les événements sont filtrés par la RLS de chaque table (politiques SELECT) pour chaque abonné.
do $$
declare t text;
begin
  foreach t in array array['interventions', 'intervention_events', 'intervention_photos', 'transfer_requests'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
