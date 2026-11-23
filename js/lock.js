// Lot 223 : verrou d'édition. Pendant qu'un utilisateur modifie une intervention, « Modifier » est grisé
// pour les autres (détail, rouage, appui long). Le verrou expire seul après 2 min sans renouvellement.
import { sb } from './sb.js?v=20261123193833';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=20261123193833';
import { state } from './state.js?v=20261123193833';

const LOCKS = new Map(); // id → { by, name, until (ms, horloge locale) }
const fresh = (l, s) => ({ by: l.editing_by, name: l.editing_name || '', until: Date.now() + (s ?? l.secs_left) * 1000 });

// Verrou actif tenu par quelqu'un d'autre (ou null).
export const lockedByOther = id => { const l = LOCKS.get(id); return l && l.until > Date.now() && l.by !== state.user?.id ? l : null; };

// Recharge tous les verrous visibles ; prévient les vues ouvertes (« gi:locks »).
let busy = false;
export async function loadLocks() {
  if (busy || !state.user) return; busy = true;
  try {
    const { data, error } = await sb.rpc('edit_locks');
    if (error) return;
    LOCKS.clear(); (data || []).forEach(l => LOCKS.set(l.intervention_id, fresh(l)));
    dispatchEvent(new CustomEvent('gi:locks'));
  } finally { busy = false; }
}
export async function peekLock(id) {
  const { data, error } = await sb.rpc('edit_lock', { p_id: id, p_action: 'peek' });
  if (error) return null;
  const l = data?.[0]; if (l?.editing_by) LOCKS.set(id, fresh(l)); else LOCKS.delete(id);
  return lockedByOther(id);
}
// Contrôle régulier (20 s) tant que la page est visible, et à chaque retour sur la page.
setInterval(() => { if (document.visibilityState === 'visible') loadLocks(); }, 20000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') loadLocks(); });

// Côté formulaire : prise, renouvellement (45 s) et libération du verrou.
let cur = null, timer = null, token = '';
const keepTok = async () => { try { token = (await sb.auth.getSession()).data.session?.access_token || token; } catch {} };
export async function takeLock(id) {
  if (cur && cur !== id) releaseLock();
  const { data, error } = await sb.rpc('edit_lock', { p_id: id, p_action: 'take' });
  if (error) return { ok: true }; // en cas d'erreur réseau, on ne bloque pas la modification
  const l = data?.[0] || {};
  if (!l.ok) { if (l.editing_by) LOCKS.set(id, fresh(l)); return { ok: false, name: l.editing_name || '' }; }
  cur = id; keepTok(); clearInterval(timer);
  timer = setInterval(() => { if (cur === id) { sb.rpc('edit_lock', { p_id: id, p_action: 'take' }).then(() => {}); keepTok(); } }, 45000);
  return { ok: true };
}
export function releaseLock(beacon) {
  const id = cur; if (!id) return; cur = null; clearInterval(timer); timer = null;
  if (beacon && token) { try { fetch(`${SUPABASE_URL}/rest/v1/rpc/edit_lock`, { method: 'POST', keepalive: true, headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_id: id, p_action: 'release' }) }); } catch {} return; }
  sb.rpc('edit_lock', { p_id: id, p_action: 'release' }).then(() => {});
}
// Fermeture ou rechargement de la page : libération immédiate.
addEventListener('pagehide', () => releaseLock(true));
// Sortie du formulaire d'édition (retour, annulation, enregistrement, autre écran) : libération.
addEventListener('hashchange', () => { if (cur && location.hash !== `#/intervention/${cur}/modifier`) releaseLock(); });
