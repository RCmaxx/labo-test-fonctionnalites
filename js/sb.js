import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const URL = 'https://alkmkdzazprskhchcofp.supabase.co';
const KEY = 'sb_publishable_D13UiBp5EkFGvcxVSgjunA_lfATuT7w'; // clé publique, protégée par la RLS

// Labo : lecture seule sur la base de production. Toute écriture est refusée avant le réseau.
const READS = ['/auth/v1/', '/storage/v1/object/sign/', '/rpc/edit_locks', '/rpc/invitation_info'];
function readOnly(url, opt = {}) {
  const m = (opt.method || 'GET').toUpperCase();
  if (m === 'GET' || m === 'HEAD' || READS.some(p => String(url).includes(p))) return fetch(url, opt);
  return Promise.resolve(new Response('{"message":"Labo : écriture bloquée (lecture seule)."}',
    { status: 403, headers: { 'Content-Type': 'application/json' } }));
}

export const sb = createClient(URL, KEY, { global: { fetch: readOnly } });
