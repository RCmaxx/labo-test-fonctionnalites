import { sb } from './sb.js?v=20261123220622';
import { S, esc, fmtCard, nameOf, DONE, PAGE } from './state.js?v=20261123220622';

let search = '', doneN = PAGE, tq = 0; // recherche et nombre de terminées gardés entre deux affichages
// Icônes de l'appli (clé du technicien, main de la présence client).
const WRENCH = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';
const HAND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>';
// Lieu coloré par priorité ; « Mobil-home 5 » s'affiche « MH 05 » comme dans l'appli.
const place = r => {
  const m = String(r.location || '').trim().match(/^(?:mobil[- ]?home|mh)\s*(\d+)$/i);
  const label = m ? `<small>MH</small>${m[1].padStart(2, '0')}` : esc(r.location) || 'Sans lieu';
  return `<span class="tag tag--place tag--${r.priority || 'normale'}">${label}</span>`;
};
const COLS = 'id, title, location, description, status, priority, assignee_id, created_by, created_at, resolved_at, validated_at, client_presence';
const scope = q => S.me.role === 'client' ? q.eq('created_by', S.me.id) : q;
// Filtre PostgREST : chaque mot doit apparaître dans titre, lieu ou description (ilike, casse ignorée).
const withSearch = (q, words) => {
  for (const raw of words) {
    const w = raw.replace(/[%_,.()"'\\]/g, '').slice(0, 80);
    if (w) q = q.or(`title.ilike.%${w}%,location.ilike.%${w}%,description.ilike.%${w}%`);
  }
  return q;
};
export async function renderList(el) {
  el.innerHTML = `<h1>Interventions</h1><p class="search"><label>Rechercher <input type="search" id="q" value="${esc(search)}"></label></p><div id="rows"><p>Chargement…</p></div>`;
  const qel = el.querySelector('#q'), rows = el.querySelector('#rows');
  const [reads, msgs] = await Promise.all([
    sb.from('intervention_reads').select('intervention_id, last_read_at').eq('user_id', S.me.id),
    sb.from('intervention_events').select('intervention_id, created_at').in('type', ['commentaire', 'photo']).neq('actor_id', S.me.id).order('created_at', { ascending: false }).limit(5000),
  ]);
  const last = Object.fromEntries((reads.data || []).map(r => [r.intervention_id, r.last_read_at]));
  const unread = {};
  (msgs.data || []).forEach(m => { if (!last[m.intervention_id] || m.created_at > last[m.intervention_id]) unread[m.intervention_id] = (unread[m.intervention_id] || 0) + 1; });
  const item = r => {
    const done = DONE.includes(r.status), n = unread[r.id];
    return `<li><a class="card${done ? ' card--done' : ''}" href="#i/${r.id}">
      ${n ? `<span class="badge">${n}</span>` : ''}<b class="card__title">${esc(r.title)}</b>
      <span class="card__meta">${place(r)}${r.assignee_id ? `<span class="tag tag--tech">${WRENCH}${esc(nameOf(r.assignee_id))}</span>` : ''}<time>${fmtCard(done ? r.resolved_at || r.validated_at : r.created_at)}</time></span>
      ${r.client_presence ? `<span class="card__presence">${HAND}Présence client</span>` : ''}
    </a></li>`;
  };
  const paint = (open, done, more) => {
    const groups = [
      ['Brouillons', open.filter(r => r.status === 'brouillon' && (S.me.role !== 'technicien' || r.created_by === S.me.id))],
      ['Mes interventions', open.filter(r => r.status === 'prise_en_charge' && r.assignee_id === S.me.id)],
      ['Nouvelles interventions', open.filter(r => r.status === 'publiee')],
      ['En cours', open.filter(r => r.status === 'prise_en_charge' && r.assignee_id !== S.me.id)],
      ['Terminées', done],
    ];
    rows.innerHTML = groups.map(([t, list]) => `<section class="group"><h2 class="group__title">${t} <span class="count">${list.length}</span></h2>${list.length ? `<ul class="cards">${list.map(item).join('')}</ul>` : '<p class="empty">Aucune.</p>'}</section>`).join('')
      + (more ? '<p class="more"><button id="more">Plus de terminées</button></p>' : '');
    const btn = rows.querySelector('#more');
    if (btn) btn.onclick = () => { doneN += PAGE; renderList(el); };
  };
  const load = async () => {
    const words = search.trim().split(/\s+/).filter(Boolean);
    if (words.length) {
      const { data, error } = await withSearch(scope(sb.from('interventions').select(COLS)), words)
        .order('created_at', { ascending: false }).limit(200);
      if (error) return rows.innerHTML = `<p>${esc(error.message)}</p>`;
      const all = data || [];
      paint(all.filter(r => !DONE.includes(r.status)), all.filter(r => DONE.includes(r.status)), false);
      return;
    }
    const [open, done] = await Promise.all([
      scope(sb.from('interventions').select(COLS).not('status', 'in', `(${DONE})`)).order('created_at', { ascending: false }),
      scope(sb.from('interventions').select(COLS).in('status', DONE)).order('resolved_at', { ascending: false, nullsFirst: false }).order('id').limit(doneN),
    ]);
    const err = open.error || done.error;
    if (err) return rows.innerHTML = `<p>${esc(err.message)}</p>`;
    paint(open.data, done.data, done.data.length === doneN);
  };
  qel.oninput = e => { search = e.target.value; clearTimeout(tq); tq = setTimeout(load, 250); };
  await load();
}
