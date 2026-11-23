import { sb } from './sb.js?v=20261123215119';
import { esc, nameOf, TECH, S } from './state.js?v=20261123215119';

// Bandeau d'alertes : demandes de transfert, refus, rappels.
let transfers = [], refused = [], reminders = [];
const SEEN = 'labo-rappels-vus';
const seen = () => JSON.parse(localStorage.getItem(SEEN) || '[]');
// Rappel échu depuis moins de 12 h et pas encore vu.
const due = r => { const t = new Date(r.available_from) - r.remind_minutes * 6e4; return t <= Date.now() && Date.now() - t < 432e5 && !seen().includes(r.id); };
export function drawAlerts() {
  const el = document.getElementById('alerts');
  if (!el) return;
  const items = [
    ...transfers.map(q => `<p>${esc(nameOf(q.requester_id))} demande l'intervention « ${esc(q.interventions?.title)} ». <button data-answer="${q.id}" value="1">Accepter</button> <button data-answer="${q.id}" value="">Refuser</button></p>`),
    ...refused.map(q => `<p>${esc(nameOf(q.holder_id))} n'a pas accepté votre demande. <button data-ack="${q.id}">OK</button></p>`),
    ...reminders.filter(due).map(r => `<p>Rappel : <a href="#i/${r.id}">${esc(r.title)}</a> est disponible. <button data-seen="${r.id}">OK</button></p>`),
  ];
  el.innerHTML = items.length ? items.join('') + '<p id="alerr"></p>' : '';
  el.onclick = async e => {
    const b = e.target.closest('button'), d = b?.dataset;
    if (!d) return;
    if (d.seen) { localStorage.setItem(SEEN, JSON.stringify([...seen(), d.seen].slice(-200))); return drawAlerts(); }
    const { error } = d.answer ? await sb.rpc('answer_transfer', { p_req: d.answer, p_ok: !!b.value }) : await sb.rpc('ack_transfer', { p_req: d.ack });
    error ? el.querySelector('#alerr').textContent = error.message : checkTransfers();
  };
}
setInterval(drawAlerts, 30000); // contrôle local des rappels, sans requête
export async function checkTransfers() {
  if (!S.me) return;
  const [p, r] = await Promise.all([
    sb.from('transfer_requests').select('id, requester_id, interventions(title)').eq('holder_id', S.me.id).eq('status', 'en_attente').order('created_at'),
    sb.from('transfer_requests').select('id, holder_id').eq('requester_id', S.me.id).eq('status', 'refusee').eq('requester_seen', false),
  ]);
  transfers = p.data || []; refused = r.data || [];
  drawAlerts();
}
export async function loadReminders() {
  if (!TECH.includes(S.me?.role)) return reminders = [];
  const { data } = await sb.from('interventions').select('id, title, available_from, remind_minutes')
    .eq('status', 'publiee').not('remind_minutes', 'is', null).not('available_from', 'is', null);
  reminders = data || [];
  drawAlerts();
}
