import { sb } from './sb.js?v=20261123211258';
import { S, esc, fmt, norm, nameOf, DONE, PRIORITY, PAGE } from './state.js?v=20261123211258';

let search = '', doneN = PAGE; // recherche et nombre de terminées gardés entre deux affichages
export async function renderList(el) {
  el.innerHTML = `<h1>Interventions</h1><p><label>Rechercher <input type="search" id="q" value="${esc(search)}"></label></p><div id="rows"><p>Chargement…</p></div>`;
  const cols = 'id, title, location, description, status, priority, assignee_id, created_by, created_at, resolved_at, validated_at';
  const scope = q => S.me.role === 'client' ? q.eq('created_by', S.me.id) : q;
  const [open, done, reads, msgs] = await Promise.all([
    scope(sb.from('interventions').select(cols).not('status', 'in', `(${DONE})`)).order('created_at', { ascending: false }),
    scope(sb.from('interventions').select(cols).in('status', DONE)).order('resolved_at', { ascending: false, nullsFirst: false }).order('id').limit(doneN),
    sb.from('intervention_reads').select('intervention_id, last_read_at').eq('user_id', S.me.id),
    sb.from('intervention_events').select('intervention_id, created_at').in('type', ['commentaire', 'photo']).neq('actor_id', S.me.id).order('created_at', { ascending: false }).limit(5000),
  ]);
  const rows = el.querySelector('#rows'), err = open.error || done.error;
  if (err) return rows.innerHTML = `<p>${esc(err.message)}</p>`;
  // Non lus : messages des autres postérieurs à ma dernière lecture.
  const last = Object.fromEntries((reads.data || []).map(r => [r.intervention_id, r.last_read_at]));
  const unread = {};
  (msgs.data || []).forEach(m => { if (!last[m.intervention_id] || m.created_at > last[m.intervention_id]) unread[m.intervention_id] = (unread[m.intervention_id] || 0) + 1; });
  const item = r => `<li>
      <a href="#i/${r.id}"><b>${esc(r.title)}</b></a> · ${esc(r.location) || 'sans lieu'} · ${PRIORITY[r.priority] || ''}
      · ${r.assignee_id ? esc(nameOf(r.assignee_id)) : 'Non assignée'}
      · ${fmt(DONE.includes(r.status) ? r.resolved_at || r.validated_at : r.created_at)}
      ${unread[r.id] ? `· ${unread[r.id]} non lu${unread[r.id] > 1 ? 's' : ''}` : ''}
    </li>`;
  const draw = () => {
    // Recherche : chaque mot doit figurer dans le titre, le lieu ou la description (accents et majuscules ignorés).
    const words = norm(search).split(/\s+/).filter(Boolean);
    const hit = r => words.every(w => norm(`${r.title} ${r.location} ${r.description}`).includes(w));
    const o = open.data.filter(hit), d = done.data.filter(hit);
    const groups = [
      ['Brouillons', o.filter(r => r.status === 'brouillon' && (S.me.role !== 'technicien' || r.created_by === S.me.id))],
      ['Mes interventions', o.filter(r => r.status === 'prise_en_charge' && r.assignee_id === S.me.id)],
      ['Nouvelles interventions', o.filter(r => r.status === 'publiee')],
      ['En cours', o.filter(r => r.status === 'prise_en_charge' && r.assignee_id !== S.me.id)],
      ['Terminées', d],
    ];
    rows.innerHTML = groups.map(([t, list]) => `<h2>${t} (${list.length})</h2>${list.length ? `<ul>${list.map(item).join('')}</ul>` : '<p>Aucune.</p>'}`).join('')
      + (done.data.length === doneN ? '<button id="more">Plus de terminées</button>' : '');
    const more = rows.querySelector('#more');
    if (more) more.onclick = () => { doneN += PAGE; renderList(el); };
  };
  el.querySelector('#q').oninput = e => { search = e.target.value; draw(); };
  draw();
}
