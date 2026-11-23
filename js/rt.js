// Lot 225 : temps réel Supabase à la place du polling (8 s transferts, 30 s rappels).
// Une seule connexion (un canal) par client ; reconnexion automatique par supabase-js ; événements filtrés par la RLS.
// Repli : polling lent (60 s) seulement tant que le canal est déconnecté.
import { sb } from './sb.js?v=20261123201223';
import { state } from './state.js?v=20261123201223';

let ch = null, uid = null, slow = null, handlers = null;
const emit = (name, detail) => dispatchEvent(new CustomEvent(name, { detail }));

function fallback(on) {
  if (on && !slow) slow = setInterval(() => { if (document.visibilityState === 'visible') { handlers?.transfers(); handlers?.reminders(); emit('gi:rt-poll'); } }, 60000);
  if (!on && slow) { clearInterval(slow); slow = null; }
}

// h = { transfers(), reminders() } fournis par app.js.
export function startRealtime(h) {
  handlers = h;
  const u = state.user?.id || null;
  if (u === uid && ch) return;
  stopRealtime(); uid = u; if (!u) return;
  const c = sb.channel('gi-rt'); ch = c;
  c
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transfer_requests' }, () => handlers?.transfers())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'interventions' }, p => {
      const id = (p.new && p.new.id) || (p.old && p.old.id);
      if (id) emit('gi:itv', { id, type: p.eventType });
      handlers?.reminders();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'intervention_events' }, p => emit('gi:itv-event', p.new))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'intervention_photos' }, p => emit('gi:itv-photo', p.new))
    .subscribe(status => {
      if (ch !== c) return; // canal remplacé ou fermé volontairement
      if (status === 'SUBSCRIBED') { fallback(false); handlers?.transfers(); }
      else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) fallback(true);
    });
}
export function stopRealtime() {
  fallback(false);
  if (ch) { sb.removeChannel(ch); ch = null; }
  uid = null;
}
