import { sb } from './sb.js';
import { renderDetail } from './detail.js';
import { S, esc, fmtCard, nameOf, DONE, PAGE, TECH, isMob, route } from './state.js';

let search = '', tq = 0, doneN = PAGE;
const WRENCH = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';
const HAND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>';
const CHEV = '<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const place = r => {
  const m = String(r.location || '').trim().match(/^(?:mobil[- ]?home|mh)\s*(\d+)$/i);
  const label = m ? `<small>MH</small>${m[1].padStart(2, '0')}` : esc(r.location) || 'Sans lieu';
  return `<span class="tag tag--place tag--${r.priority || 'normale'}">${label}</span>`;
};
const COLS = 'id, title, location, description, status, priority, assignee_id, assignee_role, proposed_to, assigned_by, available_from, available_until, created_by, created_at, resolved_at, validated_at, client_presence';
const scope = q => S.me.role === 'client' ? q.eq('created_by', S.me.id) : q;
const withSearch = (q, words) => {
  for (const raw of words) {
    const w = raw.replace(/[%_,.()"'\\]/g, '').slice(0, 80);
    if (w) q = q.or(`title.ilike.%${w}%,location.ilike.%${w}%,description.ilike.%${w}%`);
  }
  return q;
};
const WR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/></svg>';
const GICO = {
  mes: WR,
  dem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16v16H4z"/><path d="M22 6H2"/></svg>',
  publiee: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/></svg>',
  prise_en_charge: WR,
  auj: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>',
  sem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>',
  avant: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>',
};
const day0 = d => new Date(d).setHours(0, 0, 0, 0);
const arrival = r => {
  const c = new Date(r.created_at).getTime();
  if (!r.available_from) return c;
  const f = new Date(r.available_from).getTime(), n = Date.now();
  return Math.max(c, ...[day0(f), f - 36e5, f - 18e5].filter(t => t <= n));
};
const byArrival = (a, b) => arrival(b) - arrival(a);
const byFin = (a, b) => new Date(b.resolved_at || b.validated_at || 0) - new Date(a.resolved_at || a.validated_at || 0);
const isTodayDone = r => {
  const d = r.resolved_at || r.validated_at; if (!d) return false;
  return day0(d) === day0(Date.now());
};
const roleOf = id => S.team.find(m => m.user_id === id)?.role;

const finAt = r => new Date(r.resolved_at || r.validated_at || r.updated_at || r.created_at);
const weekStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.getTime(); };
const byDay = rows => {
  const by = new Map();
  rows.forEach(r => { const d = finAt(r), k = d.toDateString(); if (!by.has(k)) by.set(k, [d, []]); by.get(k)[1].push(r); });
  return [...by.values()].map(([d, rs]) => {
    const l = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return `<h3 class="gday">${l[0].toUpperCase() + l.slice(1)}</h3><ul class="cards">${rs.map(itemRef).join('')}</ul>`;
  }).join('');
};
let itemRef = () => '';
const CLOSED = {};
let openId = null;

function stackSticky(box, sel) {
  const set = () => { let y = 0; box.querySelectorAll(sel).forEach(h => { h.style.top = Math.floor(y) + 'px'; y += h.getBoundingClientRect().height; }); };
  set();
  if (!box._stk) { box._stk = new ResizeObserver(set); box._stk.observe(box); }
}
function stk2(box) {
  const set = () => {
    const a = document.getElementById('app');
    const sim = a && getComputedStyle(a).overflowY !== 'visible';
    let y = sim ? 0 : 0;
    box.querySelectorAll(':scope > .group[data-g=mes] > h2, :scope > .group[data-g=prise_en_charge] > h2').forEach(h => {
      h.style.top = Math.floor(y) + 'px'; y += h.getBoundingClientRect().height;
    });
  };
  set();
  if (!box._stk2) { box._stk2 = 1; addEventListener('resize', () => { if (box.classList.contains('stk2')) set(); }); }
}

export async function renderList(el) {
  el.innerHTML = `<p class="search"><label>Rechercher <input type="search" id="q" value="${esc(search)}"></label></p><div id="rows"><p>Chargement…</p></div>`;
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
    const href = S.me.role === 'client' ? '#' : `#i/${r.id}`;
    return `<li><a class="card${done ? ' card--done' : ''}" href="${href}"${S.me.role === 'client' ? ' aria-disabled="true"' : ''}>
      ${n ? `<span class="badge">${n}</span>` : ''}<b class="card__title">${esc(r.title)}</b>
      <span class="card__meta">${place(r)}${r.assignee_id ? `<span class="tag tag--tech">${WRENCH}${esc(nameOf(r.assignee_id))}</span>` : ''}<time>${fmtCard(done ? r.resolved_at || r.validated_at : r.created_at)}</time></span>
      ${r.client_presence ? `<span class="card__presence">${HAND}Présence client</span>` : ''}
    </a></li>`;
  };
  itemRef = item;
  const sec = ([k, label, list], foldable) => `<section class="group${foldable && CLOSED[k] ? ' closed' : ''}" data-g="${k}"><h2${foldable ? ` role="button" tabindex="0" aria-expanded="${!CLOSED[k]}"` : ''}>${GICO[k] || ''}<span class="count">${list.length}</span><span class="glab">${label}</span>${foldable ? CHEV : ''}</h2>${list.length ? `<ul class="cards">${list.map(item).join('')}</ul>` : '<p class="empty">Aucune.</p>'}</section>`;


  const paintTerminees = (done, more) => {
    const d0 = day0(Date.now()), w0 = weekStart();
    const list = [...done].sort((a, b) => finAt(b) - finAt(a));
    const auj = list.filter(r => day0(finAt(r)) === d0);
    const sem = list.filter(r => { const t = day0(finAt(r)); return t >= w0 && t < d0; });
    const avant = list.filter(r => day0(finAt(r)) < w0);
    const groups = [
      ['auj', "Terminées aujourd'hui", auj],
      ['sem', 'Terminées cette semaine', sem],
      ['avant', 'Autres interventions terminées', avant],
    ];
    const foldable = true;
    const body = ([k, label, rows]) => {
      const inner = k === 'sem' && rows.length ? byDay(rows) : (rows.length ? `<ul class="cards">${rows.map(item).join('')}</ul>` : '<p class="empty">Aucune.</p>');
      return `<section class="group${CLOSED[k] ? ' closed' : ''}" data-g="${k}"><h2 role="button" tabindex="0" aria-expanded="${!CLOSED[k]}">${GICO[k] || ''}<span class="count">${rows.length}</span><span class="glab">${label}</span>${CHEV}</h2>${inner}</section>`;
    };
    const mob = isMob();
    const html = mob
      ? groups.map(body).join('')
      : `<div class="gcols gdone">${groups.map(g => `<div class="gcol">${body(g)}</div>`).join('')}</div>`;
    rows.innerHTML = `<h1 class="lpage-title">Interventions terminées</h1>` + html + (more ? '<p class="more"><button type="button" id="more">Voir plus</button></p>' : '');
    const g0 = rows.querySelector('.gcol');
    if (g0) {
      const host = document.querySelector('.sim #app');
      const top = g0.getBoundingClientRect().top - (host ? host.getBoundingClientRect().top - host.scrollTop : 0);
      document.documentElement.style.setProperty('--gtop', Math.round(top) + 'px');
      rows.querySelectorAll('.gcol').forEach(c => stackSticky(c, '.group > h2'));
    }
    rows.querySelectorAll('.group h2[role=button]').forEach(h => {
      h.onclick = h.onkeydown = e => {
        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        if (e.type === 'click' && !e.target.closest('.glab, .count, .chev')) return;
        e.preventDefault();
        const g = h.parentElement, k = g.dataset.g;
        CLOSED[k] = !g.classList.contains('closed');
        g.classList.toggle('closed', CLOSED[k]);
        h.setAttribute('aria-expanded', String(!CLOSED[k]));
      };
    });
    const btn = rows.querySelector('#more');
    if (btn) btn.onclick = () => { doneN += PAGE; renderList(el); };
    const again = openId && rows.querySelector(`a.card[href="#i/${openId}"]`);
    if (again) unfold(again, false); else openId = null;
  };

  const paint = (open, done, more) => {
    if (route()[0] === 'terminees') return paintTerminees(done, more);
    const me = S.me.id, r = S.me.role, mob = isMob(), page = route()[0];
    const mine = x => x.assignee_id === me && (S.me.real !== 'admin' || !x.assignee_role || x.assignee_role === r);
    const pmine = x => x.status === 'publiee' && !x.available_from && x.proposed_to && TECH.includes(r) && (x.proposed_to === me || (S.me.real === 'admin' && roleOf(x.proposed_to) === r));
    const canDem = ['directeur', 'responsable_tech'].includes(r);
    const asked = x => canDem && x.assigned_by === me && !mine(x) && !pmine(x);
    let groups = [
      ['mes', 'Mes interventions', open.filter(x => (x.status === 'prise_en_charge' && mine(x)) || pmine(x)).sort(byArrival)],
      ['dem', "Mes demandes d'intervention", open.filter(asked)],
      ['publiee', 'Nouvelles interventions', open.filter(x => x.status === 'publiee' && !pmine(x) && !asked(x)).sort(byArrival)],
      ['prise_en_charge', TECH.includes(r) ? 'Autres interventions en cours' : 'En cours', open.filter(x => x.status === 'prise_en_charge' && !mine(x) && !asked(x)).sort(byArrival)],
    ];
    if (!mob && r !== 'client') groups.push(['auj', "Terminées aujourd'hui", done.filter(isTodayDone).sort(byFin)]);
    groups = groups.filter(([k, , list]) => (k !== 'mes' || list.length) && (k !== 'dem' || canDem));

    const tabn = document.getElementById('tabn');
    if (tabn) tabn.textContent = open.filter(x => x.status === 'publiee' && !pmine(x) && !asked(x)).length || '';

    if (r === 'client') {
      rows.innerHTML = `<section class="group" data-g="publiee"><h2>${GICO.publiee}<span class="count">${open.length}</span><span class="glab">Mes interventions</span></h2>${open.length ? `<ul class="cards">${open.sort(byArrival).map(item).join('')}</ul>` : '<p class="empty">Aucune.</p>'}</section>`;
      return;
    }
    if (mob && page === 'nouvelles') groups = [['publiee', 'Interventions', open.sort(byArrival)]];
    else if (mob) groups = groups.filter(g => ['mes', 'prise_en_charge'].includes(g[0]));

    const std = !mob;
    const shown = groups.filter(g => g[2].length || (std && g[0] === 'auj'));
    const foldable = mob;
    const COL = { dem: 0, publiee: 0, mes: 1, prise_en_charge: 1, auj: 2 };
    if (std) {
      rows.innerHTML = `<div class="gcols">${[0, 1, 2].map(c => {
        const gs = shown.filter(g => COL[g[0]] === c);
        return `<div class="gcol">${gs.length ? gs.map(g => sec(g, foldable)).join('') : ''}</div>`;
      }).join('')}</div>`;
    } else {
      rows.innerHTML = shown.length ? shown.map(g => sec(g, foldable)).join('') : '<p class="empty">Aucune intervention pour le moment.</p>';
    }
    rows.classList.toggle('stk2', mob && page !== 'nouvelles');
    const g0 = rows.querySelector('.gcol');
    if (g0) {
      const host = document.querySelector('.sim #app');
      const top = g0.getBoundingClientRect().top - (host ? host.getBoundingClientRect().top - host.scrollTop : 0);
      document.documentElement.style.setProperty('--gtop', Math.round(top) + 'px');
      rows.querySelectorAll('.gcol').forEach(c => stackSticky(c, '.group > h2'));
    }
    if (rows.classList.contains('stk2')) stk2(rows);
    const again = openId && rows.querySelector(`a.card[href="#i/${openId}"]`);
    if (again) unfold(again, false); else openId = null;
    rows.querySelectorAll('.group h2[role=button]').forEach(h => {
      h.onclick = h.onkeydown = e => {
        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        if (e.type === 'click' && !e.target.closest('.glab, .count, .chev')) return;
        e.preventDefault();
        const g = h.parentElement, k = g.dataset.g;
        CLOSED[k] = !g.classList.contains('closed');
        g.classList.toggle('closed', CLOSED[k]);
        h.setAttribute('aria-expanded', String(!CLOSED[k]));
      };
    });
  };

  const fold = u => {
    if (!u.classList.contains('is-open')) return u.remove();
    u.classList.remove('is-open');
    u.addEventListener('transitionend', () => u.remove(), { once: true });
  };
  const unfold = (a, anim = true) => {
    const id = a.getAttribute('href').split('/')[1], cur = rows.querySelector('.unfold');
    if (cur) { fold(cur); if (cur.dataset.id === id && anim) return openId = null; }
    openId = id;
    a.parentElement.insertAdjacentHTML('afterend', `<li class="unfold${anim ? '' : ' is-open is-now'}" data-id="${id}"><div><div class="unfold__body"></div></div></li>`);
    const u = a.parentElement.nextElementSibling;
    renderDetail(u.querySelector('.unfold__body'), id).then(() => anim && requestAnimationFrame(() => u.classList.add('is-open')));
  };
  rows.onclick = e => {
    const a = e.target.closest('a.card');
    if (!a || e.metaKey || e.ctrlKey || S.me.role === 'client') return;
    if (a.getAttribute('href') === '#') return;
    e.preventDefault(); unfold(a);
  };
  const load = async () => {
    const words = search.trim().split(/\s+/).filter(Boolean);
    const openQ = scope(sb.from('interventions').select(COLS).not('status', 'in', `(brouillon,${DONE.join(',')})`)).order('created_at', { ascending: false });
    if (route()[0] === 'terminees') {
      const q = words.length
        ? withSearch(scope(sb.from('interventions').select(COLS).in('status', DONE)), words).order('resolved_at', { ascending: false, nullsFirst: false }).limit(200)
        : scope(sb.from('interventions').select(COLS).in('status', DONE)).order('resolved_at', { ascending: false, nullsFirst: false }).order('id').limit(doneN);
      const { data, error } = await q;
      if (error) return rows.innerHTML = `<p>${esc(error.message)}</p>`;
      paint([], data || [], !words.length && (data || []).length === doneN);
      return;
    }
    if (words.length) {
      const { data, error } = await withSearch(scope(sb.from('interventions').select(COLS).neq('status', 'brouillon')), words)
        .order('created_at', { ascending: false }).limit(200);
      if (error) return rows.innerHTML = `<p>${esc(error.message)}</p>`;
      const all = data || [];
      paint(all.filter(r => !DONE.includes(r.status)), all.filter(r => DONE.includes(r.status)));
      return;
    }
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const [open, done] = await Promise.all([
      openQ,
      isMob() || S.me.role === 'client' ? { data: [] } : scope(sb.from('interventions').select(COLS).in('status', DONE).gte('resolved_at', t0.toISOString())).order('resolved_at', { ascending: false }).limit(100),
    ]);
    const err = open.error || done.error;
    if (err) return rows.innerHTML = `<p>${esc(err.message)}</p>`;
    paint(open.data || [], done.data || []);
  };
  qel.oninput = e => { search = e.target.value; clearTimeout(tq); tq = setTimeout(load, 250); };
  await load();
}
