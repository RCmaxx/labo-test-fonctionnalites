import { sb } from './sb.js?v=20261123215127';
import { S, esc } from './state.js?v=20261123215127';

// Verrou d'édition (expire seul côté base après 2 min sans renouvellement).
const LOCKS = new Map(); // intervention_id → { by, name, until }
const lockOf = id => { const l = LOCKS.get(id); return l && l.until > Date.now() && l.by !== S.me?.id ? l : null; };
let held = null, renew = null;
export async function loadLocks() {
  if (!S.me) return;
  const { data, error } = await sb.rpc('edit_locks');
  if (error) return;
  LOCKS.clear();
  data.forEach(l => LOCKS.set(l.intervention_id, { by: l.editing_by, name: l.editing_name, until: Date.now() + l.secs_left * 1000 }));
  drawEdit();
}
// « Modifier » sur la fiche ouverte : lien, ou texte si quelqu'un d'autre modifie.
export function drawEdit() {
  const p = document.getElementById('edit');
  if (!p) return;
  const l = lockOf(p.dataset.id);
  p.innerHTML = l ? `Modifier (${esc(l.name || 'quelqu’un')} modifie en ce moment)` : `<a href="#i/${p.dataset.id}/modifier">Modifier</a>`;
}
// Prend le verrou ; renvoie un message si on ne peut pas modifier (déjà pris, ou droit insuffisant).
export async function takeLock(id) {
  releaseLock();
  const { data, error } = await sb.rpc('edit_lock', { p_id: id, p_action: 'take' });
  if (error) return error.message;
  const l = data?.[0] || {};
  if (!l.ok) return `${l.editing_name || 'Quelqu’un'} modifie déjà cette intervention.`;
  held = id;
  renew = setInterval(() => sb.rpc('edit_lock', { p_id: id, p_action: 'take' }).then(() => {}), 45000);
}
export function releaseLock() {
  if (!held) return;
  sb.rpc('edit_lock', { p_id: held, p_action: 'release' }).then(() => {});
  held = null; clearInterval(renew);
}
setInterval(() => document.visibilityState === 'visible' && loadLocks(), 20000);
addEventListener('hashchange', () => held && location.hash !== `#i/${held}/modifier` && releaseLock());
addEventListener('pagehide', releaseLock);
