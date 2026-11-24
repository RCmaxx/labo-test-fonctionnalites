import { sb } from './sb.js';
import { esc, nameOf, TECH, S } from './state.js';

const hostModal = () => document.querySelector('.sim #app') || document.body;
const SEEN = 'labo-rappels-vus';
const seen = () => {
  try {
    return JSON.parse(localStorage.getItem(SEEN) || '[]');
  } catch {
    return [];
  }
};
const due = r => {
  const t = new Date(r.available_from) - r.remind_minutes * 6e4;
  return t <= Date.now() && Date.now() - t < 432e5 && !seen().includes(r.id);
};

function toast(msg, err = false) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.textContent = msg;
  hostModal().append(t);
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.remove(), 3500);
}

function confirmBox(msg, okLab = 'Oui', cancelLab = 'Non') {
  return new Promise(res => {
    const o = document.createElement('div');
    o.className = 'modal';
    o.innerHTML = `<div class="mbox"><p class="mq">${msg}</p><div class="mbtns"><button type="button" class="primary" data-ok>${okLab}</button>${cancelLab ? `<button type="button" class="ghost">${cancelLab}</button>` : ''}</div></div>`;
    hostModal().append(o);
    o.onclick = e => {
      const b = e.target.closest('button');
      if (!b && e.target !== o) return;
      o.remove();
      res(!!b?.dataset.ok);
    };
  });
}

function notif(html, href) {
  const n = document.createElement('div');
  n.className = 'notif';
  n.innerHTML = html;
  n.onclick = () => {
    n.remove();
    if (href) location.hash = href;
  };
  hostModal().append(n);
  setTimeout(() => n.remove(), 10000);
}

let reminders = [];
const asked = new Set();

function checkReminders() {
  if (!TECH.includes(S.me?.role)) return;
  let s = seen();
  reminders.filter(due).forEach(r => {
    s.push(r.id);
    notif(`<b>Rappel</b> « ${esc(r.title)} » est disponible`, `i/${r.id}`);
  });
  localStorage.setItem(SEEN, JSON.stringify(s.slice(-200)));
}
setInterval(checkReminders, 30000);

export async function checkTransfers() {
  if (!S.me || document.hidden) return;
  const uid = S.me.id;
  const { data } = await sb
    .from('transfer_requests')
    .select('id, requester_id, interventions(title)')
    .eq('holder_id', uid)
    .eq('status', 'en_attente')
    .order('created_at');
  if (uid !== S.me?.id) return;
  for (const q of data || []) {
    if (asked.has(q.id)) continue;
    asked.add(q.id);
    const t = q.interventions?.title;
    const ok = await confirmBox(
      `${esc(nameOf(q.requester_id))} demande l'intervention${t ? ` « ${esc(t)} »` : ''}. Transférer ?`
    );
    const { error } = await sb.rpc('answer_transfer', { p_req: q.id, p_ok: ok });
    if (error) toast(error.message, true);
  }
  const { data: no } = await sb
    .from('transfer_requests')
    .select('id, holder_id')
    .eq('requester_id', uid)
    .eq('status', 'refusee')
    .eq('requester_seen', false);
  if (uid !== S.me?.id) return;
  for (const q of no || []) {
    if (asked.has(q.id)) continue;
    asked.add(q.id);
    await sb.rpc('ack_transfer', { p_req: q.id });
    await confirmBox(`${esc(nameOf(q.holder_id))} n'a pas accepté votre demande.`, 'OK', '');
  }
}

export async function loadReminders() {
  if (!TECH.includes(S.me?.role)) return (reminders = []);
  const { data } = await sb
    .from('interventions')
    .select('id, title, available_from, remind_minutes')
    .eq('status', 'publiee')
    .not('remind_minutes', 'is', null)
    .not('available_from', 'is', null);
  reminders = data || [];
  checkReminders();
}

export function drawAlerts() {
  checkReminders();
}
