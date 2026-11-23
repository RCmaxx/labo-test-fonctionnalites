-- Lot 225 : fonction trigger public.photo_limit non appelable via l'API (le trigger continue de s'exécuter).
revoke execute on function public.photo_limit() from authenticated;
