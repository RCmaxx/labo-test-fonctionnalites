-- Lot 56 : Directeur simulé renommé Raphaël (log_event + historique)
do $$ declare d text; begin d := pg_get_functiondef('private.log_event'::regproc); d := replace(d, $q$when 'directeur' then 'Marc'$q$, $q$when 'directeur' then 'Raphaël'$q$); execute d; end $$;
update public.intervention_events set actor_name = 'Raphaël' where actor_name = 'Marc' and actor_role = 'directeur';
