-- Lot 57 (correction) : 3 niveaux Basse / Normale / Haute ; « urgente » ramenée à « haute »
select set_config('app.transition', 'on', false);
update public.interventions set priority = 'haute' where priority = 'urgente';
