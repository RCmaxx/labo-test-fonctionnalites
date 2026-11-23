import { sb } from './sb.js';
import { route } from './state.js';
import { loadReminders, checkTransfers } from './alerts.js';
import { loadLocks } from './lock.js';

// Temps réel : un canal par session ; la vue ouverte se rafraîchit via show (sauf formulaire ou saisie en cours).
let live = null, wait = null, onChange = null;
function refresh() {
  clearTimeout(wait);
  wait = setTimeout(() => {
    const [page, , sub] = route(), f = document.activeElement;
    if (page === 'nouvelle' || page === 'compte' || sub === 'modifier' || (f?.closest('main') && f.value)) return;
    onChange();
  }, 300);
}
export function startLive(show) {
  onChange = show;
  stopLive();
  live = sb.channel('labo')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'interventions' }, () => { loadReminders(); refresh(); })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'intervention_events' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transfer_requests' }, checkTransfers)
    .subscribe();
  loadReminders(); checkTransfers(); loadLocks();
}
export function stopLive() { if (live) sb.removeChannel(live); live = null; }
