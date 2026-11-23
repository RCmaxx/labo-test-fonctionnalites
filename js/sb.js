import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=20261123201223';

// Labo : lecture seule sur la base de production. Toute écriture est bloquée ici, avant le réseau.
const READ_RPC = ['edit_locks', 'invitation_info'];
function readOnly(url, opt = {}) {
  const u = String(url), m = (opt.method || 'GET').toUpperCase();
  const ok = m === 'GET' || m === 'HEAD' || u.includes('/auth/v1/') || u.includes('/storage/v1/object/sign/')
    || READ_RPC.some(n => u.endsWith('/rpc/' + n))
    || (u.endsWith('/rpc/edit_lock') && /"p_action":"peek"/.test(opt.body || ''));
  if (ok) return fetch(url, opt);
  return Promise.resolve(new Response(JSON.stringify({ message: 'Labo : écriture bloquée (lecture seule).' }),
    { status: 403, headers: { 'Content-Type': 'application/json' } }));
}

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { fetch: readOnly },
  auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true },
});

// URL de l'appli (sans hash ni query) pour les redirections d'e-mails.
export const APP_URL = location.origin + location.pathname;
