import { sb } from './sb.js?v=20261123214736';
import { S, esc, fmt, nameOf, DONE, PRIORITY, PAGE } from './state.js?v=20261123214736';

let search = '', doneN = PAGE, tq = 0; // recherche et nombre de terminées gardés entre deux affichages
const COLS = 'id, title, location, description, status, priority, assignee_id, created_by, created_at, resolved_at, validated_at';
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
  el.innerHTML = `<h1>Interventions</h1><p><label>Rechercher <input type="search" id="q" value="${esc(search)}"></label></p><div id="rows"><p>Chargement…</p></div>`;
  const qel = el.querySelector('#q'), rows = el.querySelector('#rows');
  const [reads, msgs] = await Promise.all([
    sb.from('intervention_reads').select('intervention_id, last_read_at').eq('user_id', S.me.id),
    sb.from('intervention_events').select('intervention_id, created_at').in('type', ['commentaire', 'photo']).neq('actor_id', S.me.id).order('created_at', { ascending: false }).limit(5000),
  ]);
  const last = Object.fromEntries((reads.data || []).map(r => [r.intervention_id, r.last_read_at]));
  const unread = {};
  (msgs.data || []).forEach(m => { if (!last[m.intervention_id] || m.created_at > last[m.intervention_id]) unread[m.intervention_id] = (unread[m.intervention_id] || 0) + 1; });
  const item = r => `<li>
      <a href="#i/${r.id}"><b>${esc(r.title)}</b></a> · ${esc(r.location) || 'sans lieu'} · ${PRIORITY[r.priority] || ''}
      · ${r.assignee_id ? esc(nameOf(r.assignee_id)) : 'Non assignée'}
      · ${fmt(DONE.includes(r.status) ? r.resolved_at || r.validated_at : r.created_at)}
      ${unread[r.id] ? `· ${unread[r.id]} non lu${unread[r.id] > 1 ? 's' : ''}` : ''}
    </li>`;
  const paint = (open, done, more) => {
    const groups = [
      ['Brouillons', open.filter(r => r.status === 'brouillon' && (S.me.role !== 'technicien' || r.created_by === S.me.id))],
      ['Mes interventions', open.filter(r => r.status === 'prise_en_charge' && r.assignee_id === S.me.id)],
      ['Nouvelles interventions', open.filter(r => r.status === 'publiee')],
      ['En cours', open.filter(r => r.status === 'prise_en_charge' && r.assignee_id !== S.me.id)],
      ['Terminées', done],
    ];
    rows.innerHTML = groups.map(([t, list]) => `<h2>${t} (${list.length})</h2>${list.length ? `<ul>${list.map(item).join('')}</ul>` : '<p>Aucune.</p>'}`).join('')
      + (more ? '<button id="more">Plus de terminées</button>' : '');
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
