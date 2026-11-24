import { sb } from './sb.js';
import { S, esc, isMob, DONE, MGR, TECH, REMIND, nameOf, rerender } from './state.js';
import { drawEdit } from './lock.js';
import { initComposer } from './composer.js';
import { cardOf } from './list.js';
import { pcolor } from './pcolor.js';

const WRENCH =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';
const BRIEFCASE =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>';
const CAM =
  '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M9.2 4.5h5.6l1.5 2.2H19a2.5 2.5 0 0 1 2.5 2.5v8.3A2.5 2.5 0 0 1 19 20H5a2.5 2.5 0 0 1-2.5-2.5V9.2A2.5 2.5 0 0 1 5 6.7h2.7zM12 9.6a3.6 3.6 0 1 0 0 7.2a3.6 3.6 0 1 0 0-7.2z"/><circle cx="12" cy="13.2" r="2.1" fill="currentColor"/></svg>';
const UNTAKE =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="8" r="4"/><path d="M3 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 4 1.5"/><path d="M16 19h6"/></svg>';
const BACK =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';
const GEAR =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.66 5.19L9.80 2.45L14.20 2.45L14.34 5.19A7.2 7.2 0 0 1 16.72 6.57L19.17 5.32L21.37 9.13L19.07 10.63A7.2 7.2 0 0 1 19.07 13.37L21.37 14.87L19.17 18.68L16.72 17.43A7.2 7.2 0 0 1 14.34 18.81L14.20 21.55L9.80 21.55L9.66 18.81A7.2 7.2 0 0 1 7.28 17.43L4.83 18.68L2.63 14.87L4.93 13.37A7.2 7.2 0 0 1 4.93 10.63L2.63 9.13L4.83 5.32L7.28 6.57A7.2 7.2 0 0 1 9.66 5.19Z"/><circle cx="12" cy="12" r="2.8"/></svg>';
const SEND =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';

const CLOCK =
  '<svg class="clk" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const HOLD = '<svg class="hold-ring" aria-hidden="true"><rect x="1" y="1" rx="8" ry="8" pathLength="100"/></svg>';
const DONE_ICO =
  '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5"/></svg>';

const EVENTS = {
  creee: 'Intervention créée',
  demande_transfert: 'Demande de transfert',
  modifiee: 'Modifié',
  publiee: 'Intervention créée',
  prise_en_charge: 'Intervention prise en charge',
  resolue: 'Intervention terminée',
  validee: 'Validé',
  refusee: 'Refusé',
  commentaire: 'Commenté',
  photo: 'Photo ajoutée',
  liberee: "Ne prend plus l'intervention",
  reactivee: 'L’intervention n’est plus clôturée',
};
const STATUS_L = { prise_en_charge: 'En cours', resolue: 'Terminée', validee: 'Clôturée', brouillon: 'Brouillon' };
const PRIO_L = { haute: 'Urgent', urgente: 'Urgente' };
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

// Actions possibles selon le rôle et le statut (mêmes règles que l'app main, lot 408).
function actions(i) {
  const r = S.me.role,
    mgr = MGR.includes(r),
    mine = i.assignee_id === S.me.id,
    tech = TECH.includes(r);
  const a = [];
  if (i.status === 'brouillon' && (mgr || (['reception', 'technicien'].includes(r) && i.created_by === S.me.id)))
    a.push(['publier', 'Publier', 'primary']);
  if (i.status === 'publiee' && tech && !i.assignee_id && (!i.proposed_to || i.proposed_to === S.me.id))
    a.push(['prendre', "Commencer l'intervention", 'primary']);
  if (i.status === 'prise_en_charge' && (mine || ['directeur', 'responsable_tech'].includes(r)))
    a.push(['resoudre', "Terminer l'intervention", 'primary']);
  if (i.status === 'prise_en_charge' && mine)
    a.push(['liberer', UNTAKE, 'ghost ibtn', "Ne plus prendre l'intervention"]);
  if (i.status === 'prise_en_charge' && tech && i.assignee_id && !mine)
    a.push(['demander', "Demander l'intervention", 'ghost']);
  if (DONE.includes(i.status) && (mgr || mine)) a.push(['renvoyer', 'Renvoyer active', 'ghost']);
  return a;
}

// Modifiable par l'auteur, ou pour une programmée par l'assigné et les managers, tant que personne ne l'a prise.
const canEdit = i =>
  (i.created_by === S.me.id || (!!i.available_from && (i.proposed_to === S.me.id || MGR.includes(S.me.role)))) &&
  ['brouillon', 'publiee'].includes(i.status) &&
  !i.assignee_id;
// Clôture pour quelqu'un d'autre : directeur et responsable tech, sur une nouvelle non prise.
const canClose = i => ['directeur', 'responsable_tech'].includes(S.me.role) && i.status === 'publiee' && !i.assignee_id;

async function signedUrls(paths) {
  if (!paths.length) return {};
  const { data } = await sb.storage.from('photos').createSignedUrls(paths, 3600);
  return Object.fromEntries((data || []).map(d => [d.path, d.signedUrl]));
}

const n2 = n => String(n).padStart(2, '0');
const locTag = l => {
  const m = String(l || '')
    .trim()
    .match(/^(?:mobil[- ]?home|mh)\s*(\d+)$/i);
  return m ? 'MH ' + n2(m[1]) : String(l || '').trim();
};
const compactName = s => (/^responsable(\s+tech(nique)?)?$/i.test(String(s || '').trim()) ? 'Resp.tech' : s || '');
const roleKind = r => (TECH.includes(r) ? 'tech' : 'rec');
const roleOf = e => e.actor_role || S.team.find(m => m.user_id === e.actor_id)?.role || '';
const hm = d => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
function dayLbl(d) {
  const x = new Date(d),
    t = new Date(),
    k = v => v.toDateString();
  if (k(x) === k(t)) return "Aujourd'hui";
  t.setDate(t.getDate() - 1);
  if (k(x) === k(t)) return 'Hier';
  return x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}
function fmtAgo(d) {
  if (!d) return '';
  const x = new Date(d),
    now = new Date(),
    t = new Date(now);
  t.setHours(0, 0, 0, 0);
  const x0 = new Date(x);
  x0.setHours(0, 0, 0, 0);
  const n = Math.round((t - x0) / 864e5),
    m = Math.max(0, Math.floor((now - x) / 6e4));
  if (n === 0) {
    if (m < 1) return "À l'instant";
    if (m < 60) return `Il y a ${m} minute${m > 1 ? 's' : ''}`;
    const h = Math.floor(m / 60);
    return `Il y a ${h} heure${h > 1 ? 's' : ''}`;
  }
  if (n === 1) return `Hier à ${n2(x.getHours())}:${n2(x.getMinutes())}`;
  return `${x.getDate()} ${MONTHS[x.getMonth()]} · ${n2(x.getHours())}:${n2(x.getMinutes())}`;
}

const pnm = (n, t, r) => {
  const k = pcolor(n);
  return `<span class="pnm"><b style="--pb:${k.bg};--pf:${k.fg}">${roleKind(r) === 'tech' ? WRENCH : BRIEFCASE}${esc(compactName(n || '—'))}</b><span>${t}</span></span>`;
};
const sy = (cls, t, tx) => `<div class="sysl${cls}"><span class="tm">${t}</span><span class="tx">${tx}</span></div>`;

function phMsg(g, own, urls) {
  const ok = g.filter(x => urls[x.body]);
  if (!ok.length) return '';
  const e = g[0],
    n = ok.length,
    L = ok.map(x => urls[x.body]);
  return `<div class="msg prow${own ? ' own' : ''}">${pnm(e.actor_name, hm(g[g.length - 1].created_at), roleOf(e))}<div class="bub pbub"><span class="phpill" role="button" tabindex="0" data-ph="${esc(L.join(' '))}">${L.slice(
    0,
    3
  )
    .map(u => `<img src="${u}" alt="">`)
    .join('')}<span>${n} photo${n > 1 ? 's' : ''}</span></span></div></div>`;
}

function bubble(e, own, urls, it = {}) {
  const who = esc(compactName(e.actor_name || '—'));
  if (e.type === 'photo') return phMsg([e], own, urls);
  const cre = sy(' scre', hm(e.created_at), `${esc(compactName(e.actor_name || '—'))} a créé l'intervention`);
  if (['creee', 'publiee'].includes(e.type)) return cre;
  if (e.type === 'demande_transfert' && e.body) return sy('', '', `${who} · Demande d'intervention`);
  if (e.type === 'prise_en_charge' && /^Transférée par /.test(e.body || '')) {
    const to = (e.body.match(/ à (.*)$/) || [])[1] || '';
    return sy('', '', `${esc(compactName(to))} · Reprend l'intervention`);
  }
  if (e.type === 'modifiee' && e.body) {
    const P = ['Basse', 'Normale', 'Haute'];
    const skip = x => x === '—' || /^\d\d\/\d\d \d\d:\d\d/.test(x);
    return e.body
      .split('\n')
      .filter(l => {
        const m = l.match(/^a remplacé « ([\s\S]*) » par « ([\s\S]*) »$/);
        if (!m) return true;
        return (
          !(skip(m[1]) && skip(m[2])) &&
          !(P.includes(m[1]) && P.includes(m[2])) &&
          ![it.title, it.description].some(x => (x || '').trim() && m[2] === x)
        );
      })
      .map(l => sy('', hm(e.created_at), `${who} ${esc(l)}`))
      .join('');
  }
  if (e.type === 'resolue' && /^Réalisée par /.test(e.body || '')) {
    const n = e.body.slice(13);
    if (!S.team.some(m => n === (m.full_name || m.email))) return '';
    e = { ...e, body: '' };
  }
  if (e.type === 'resolue')
    return sy(
      ' scre',
      hm(e.created_at),
      `${esc(compactName(e.actor_name || '—'))} a terminé l'intervention${e.body ? `<span class="syb">« ${esc(e.body)} »</span>` : ''}`
    );
  if (e.type === 'reactivee')
    return (
      sy(
        '',
        hm(e.created_at),
        `${esc(EVENTS.reactivee)}${e.body ? `<span class="syb">« ${esc(e.body)} »</span>` : ''}`
      ) + (e.taker ? sy('', hm(e.created_at), `${esc(compactName(e.taker))} · Prend l'intervention`) : '')
    );
  if (e.type !== 'commentaire')
    return sy(
      '',
      hm(e.created_at),
      `${who} · ${esc(EVENTS[e.type] || e.type)}${e.body ? `<span class="syb">« ${esc(e.body)} »</span>` : ''}`
    );
  return `${e.cre ? cre : ''}<div class="msg prow${own ? ' own' : ''}">${pnm(e.actor_name, hm(e.created_at), roleOf(e))}<div class="bub"><span class="btxt">${esc(e.body || '')}</span></div></div>`;
}

function tagsOf(i) {
  const id = i.assignee_id || i.proposed_to;
  if (!id) return '';
  const m = S.team.find(x => x.user_id === id);
  return `<span class="cwho">${TECH.includes(m?.role) ? WRENCH : BRIEFCASE}<span>${esc(nameOf(id))}</span></span>`;
}

function hostModal() {
  return document.querySelector('.sim #app') || document.body;
}

function slotLine(i) {
  if (!i.available_from) return '';
  const f = new Date(i.available_from),
    until = new Date(i.available_until || f.getTime() + 9e5);
  const t0 = new Date();
  t0.setHours(0, 0, 0, 0);
  const n = Math.round((new Date(f).setHours(0, 0, 0, 0) - t0) / 864e5);
  const le = f.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const day = { '-1': 'Hier', 0: "Aujourd'hui", 1: 'Demain' }[n] || le;
  const hm = d => `${n2(d.getHours())}:${n2(d.getMinutes())}`;
  return `${day} ${hm(f)}–${hm(until)}`;
}

function doneScreen(msg, after) {
  const o = document.createElement('div');
  o.className = 'donescr';
  o.innerHTML = DONE_ICO + `<p>${msg}</p>`;
  hostModal().append(o);
  setTimeout(() => {
    o.remove();
    after();
  }, 800);
}

function zoomImg(src, list) {
  const urls = list && list.length ? list : [src];
  let i = Math.max(0, urls.indexOf(src));
  const o = document.createElement('div');
  o.className = 'phbig';
  const show = () => {
    o.innerHTML = `<img src="${urls[i]}" alt="Photo">`;
  };
  show();
  o.onclick = e => {
    if (e.target === o || urls.length < 2) return o.remove();
    i = (i + 1) % urls.length;
    show();
  };
  hostModal().append(o);
}

function closeChooser(id, doDelete, onDone) {
  const ms = S.team.filter(m => TECH.includes(m.role));
  const o = document.createElement('div');
  o.className = 'modal';
  o.innerHTML = `<div class="mbox cchoose"><p class="mq">Qui a pris en charge l'intervention ?</p>
    <div class="ctags">${ms.map(m => `<button type="button" class="cwho" data-u="${m.user_id}">${TECH.includes(m.role) ? WRENCH : BRIEFCASE}<span>${esc(m.full_name)}</span></button>`).join('')}<button type="button" class="cwho" data-u="">Quelqu'un d'autre</button></div>
    <input class="cother" type="text" placeholder="Nom de la personne" hidden>
    <button type="button" class="ghost danger cdel">Supprimer l'intervention</button>
    <div class="mbtns"><button type="button" class="ghost" data-r="0">Annuler</button><button type="button" class="primary" data-r="1">Clôturer</button></div></div>`;
  hostModal().append(o);
  const oth = o.querySelector('.cother');
  let sel = null;
  o.onclick = async e => {
    const b = e.target.closest('button');
    if (!b) {
      if (e.target === o) o.remove();
      return;
    }
    if (b.dataset.u != null) {
      sel = b.dataset.u;
      o.querySelectorAll('.ctags .cwho').forEach(x => x.classList.toggle('on', x === b));
      oth.hidden = sel !== '';
      if (sel === '') oth.focus();
      return;
    }
    if (b.classList.contains('cdel')) {
      o.remove();
      return doDelete();
    }
    if (b.dataset.r === '0') return o.remove();
    if (b.dataset.r === '1') {
      b.disabled = true;
      const { error } = await sb.rpc('close_for', {
        p_id: id,
        p_tech: sel || null,
        p_other: sel ? null : oth.value.trim(),
      });
      b.disabled = false;
      if (error) {
        let p = o.querySelector('.cchoose > .error');
        if (!p) {
          p = document.createElement('p');
          p.className = 'error';
          o.querySelector('.mbtns').before(p);
        }
        p.textContent = error.message;
        return;
      }
      o.remove();
      onDone();
    }
  };
}

function gearMenu(g, acts) {
  if (Date.now() - (g._shut || 0) < 500) return;
  document.querySelector('.xmenu')?.remove();
  const m = document.createElement('div');
  m.className = 'xmenu';
  m.innerHTML = acts
    .map(
      (a, i) =>
        `<button type="button" data-i="${i}"${a.classList.contains('danger') ? ' class="danger"' : ''}${a.getAttribute('aria-disabled') === 'true' ? ' disabled' : ''}>${esc(a.getAttribute('aria-label') || a.textContent.trim())}</button>`
    )
    .join('');
  hostModal().append(m);
  const r = g.getBoundingClientRect(),
    box = m.offsetParent?.getBoundingClientRect() || { left: 0, top: 0, width: innerWidth, height: innerHeight };
  const h = m.offsetHeight,
    W = box.width,
    H = box.height;
  m.style.left = Math.max(8, Math.min(r.right - box.left - m.offsetWidth, W - m.offsetWidth - 8)) + 'px';
  m.style.top =
    (r.bottom - box.top + 2 + h > H - 8 ? Math.max(8, r.top - box.top - 2 - h) : r.bottom - box.top + 2) + 'px';
  const close = () => {
    g._shut = Date.now();
    m.remove();
    document.removeEventListener('pointerdown', out, true);
    removeEventListener('scroll', close, true);
  };
  const out = e => {
    if (!m.contains(e.target)) close();
  };
  setTimeout(() => {
    document.addEventListener('pointerdown', out, true);
    addEventListener('scroll', close, true);
  }, 0);
  m.onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    close();
    const a = acts[+b.dataset.i];
    a._run ? a._run() : a.click();
  };
}

document.addEventListener(
  'click',
  e => {
    if (e.target.closest?.('a[data-edit][aria-disabled="true"]')) {
      e.preventDefault();
      e.stopPropagation();
    }
  },
  true
);

export async function renderDetail(el, id) {
  el.innerHTML = '<p>Chargement…</p>';
  const inline = !!el.closest('.unfold');
  const [{ data: i, error }, ev, ph] = await Promise.all([
    sb.from('interventions').select('*').eq('id', id).maybeSingle(),
    sb
      .from('intervention_events')
      .select('id, type, body, actor_id, actor_name, actor_role, created_at')
      .eq('intervention_id', id)
      .order('created_at')
      .order('id'),
    sb.from('intervention_photos').select('path, uploaded_by').eq('intervention_id', id).order('created_at'),
  ]);
  if (error || !i) return (el.innerHTML = `<p>${esc(error?.message || 'Intervention introuvable.')}</p>`);
  const photos = ph.data || [],
    urls = await signedUrls(photos.map(p => p.path));
  const events = ev.data || [],
    chat = S.me.role !== 'client';
  const closed = DONE.includes(i.status);
  const canComment = chat && !closed && (i.status !== 'brouillon' || i.created_by === S.me.id);
  const acts = actions(i),
    mgr = MGR.includes(S.me.role);
  const evs = events.filter(
    e =>
      !['validee', 'refusee'].includes(e.type) &&
      !(e.type === 'prise_en_charge' && /^Assignée à /.test(e.body || '')) &&
      !(e.type === 'creee' && events.some(x => x.type === 'publiee'))
  );
  {
    let tk = null;
    [...events]
      .sort((x, y) => new Date(x.created_at) - new Date(y.created_at))
      .forEach(e => {
        if (e.type === 'prise_en_charge') {
          const m = (e.body || '').match(/^(?:Assignée à |Transférée par .* à )(.*)$/);
          tk = m ? m[1] : e.actor_name;
        } else if (e.type === 'liberee') tk = null;
        else if (e.type === 'reactivee') e.taker = tk;
      });
  }

  const dsc = String(i.description || '').trim();
  const asCard = !inline && chat && isMob(); // mobile : la carte de la liste sert d'en-tête, comme l'appli tech
  if (chat) {
    const src = events.find(x => ['creee', 'publiee'].includes(x.type) && x.actor_id === i.created_by) || {};
    const ci = evs.findIndex(x => ['creee', 'publiee'].includes(x.type));
    const base = {
      actor_id: i.created_by,
      actor_role: src.actor_role,
      actor_name: src.actor_name || nameOf(i.created_by),
      created_at: ci >= 0 ? evs[ci].created_at : i.created_at,
    };
    const head =
      dsc && !asCard
        ? { ...base, type: 'commentaire', body: dsc, cre: 1 }
        : ci >= 0
          ? evs[ci]
          : { ...base, type: 'publiee' };
    if (ci >= 0) evs.splice(ci, 1);
    evs.unshift(head);
  }
  // Mobile : les photos jointes à la création quittent le fil et s'affichent en pastille sous la description.
  const cph = [];
  if (asCard) {
    const t0 = new Date(evs[0]?.created_at);
    evs
      .filter(
        e =>
          e.type === 'photo' &&
          e.actor_id === i.created_by &&
          urls[e.body] &&
          Math.abs(new Date(e.created_at) - t0) < 600000
      )
      .forEach(e => {
        cph.push(e);
        evs.splice(evs.indexOf(e), 1);
      });
  }
  const items = [];
  evs.forEach(e => {
    const g = items[items.length - 1];
    if (
      e.type === 'photo' &&
      g &&
      g[0].type === 'photo' &&
      g[0].actor_id === e.actor_id &&
      (g[0].actor_role || '') === (e.actor_role || '') &&
      new Date(e.created_at) - new Date(g[g.length - 1].created_at) < 120000 &&
      dayLbl(e.created_at) === dayLbl(g[0].created_at)
    )
      g.push(e);
    else items.push([e]);
  });
  let lastDay = '';
  const ownE = e => e.actor_id === S.me.id;
  const chatHtml = items
    .map(g => {
      const e = g[0],
        d = dayLbl(e.created_at),
        sep = d !== lastDay ? `<div class="cday">${d}</div>` : '';
      lastDay = d;
      return sep + (e.type === 'photo' ? phMsg(g, ownE(e), urls) : bubble(e, ownE(e), urls, i));
    })
    .join('');

  const phList = !chat ? photos.filter(p => urls[p.path]) : [];
  const photosHtml = phList.length
    ? `<div class="phc-w"><div class="phc">${phList.map(p => `<div class="phs"><a href="${urls[p.path]}" target="_blank" rel="noopener"><img src="${urls[p.path]}" alt="Photo"></a></div>`).join('')}</div>${phList.length > 3 ? `<button type="button" class="phc-a phc-p" aria-label="Photo précédente" hidden>‹</button><button type="button" class="phc-a phc-n" aria-label="Photo suivante">›</button>` : ''}${phList.length > 1 ? `<span class="phc-i">Photo ${Math.min(3, phList.length)}/${phList.length}</span>` : ''}</div>`
    : '';

  const pill = ['publiee', 'prise_en_charge'].includes(i.status)
    ? ''
    : STATUS_L[i.status]
      ? `<span class="pill">${STATUS_L[i.status]}</span>`
      : '';
  const prio = PRIO_L[i.priority] ? `<span class="prio p-${i.priority}">${PRIO_L[i.priority]}</span>` : '';
  const back = inline
    ? `<a href="#" class="back xback" aria-label="Replier">${BACK}</a>`
    : `<a href="#" class="back" aria-label="Retour">${BACK}</a>`;
  const card = asCard ? cardOf(i) : '';
  const cardHead = card ? `<div class="dcard">${back}<ul class="cards">${card}</ul></div>` : '';
  const editBtn = canEdit(i)
    ? `<a class="btn ghost" href="#i/${i.id}/modifier" data-edit="${i.id}" aria-label="Modifier l'intervention">Modifier</a>`
    : '';
  const actBtns = acts
    .map(
      ([a, l, c, lab]) =>
        `<button type="button" class="${c}" data-act="${a}"${lab ? ` aria-label="${lab}" title="${lab}"` : ''}>${l}</button>`
    )
    .join('');
  const closeBtn = canClose(i) ? '<button type="button" class="ghost" data-act="cloturer">Clôturer</button>' : '';
  const delBtn = mgr
    ? '<button type="button" class="ghost danger" id="del" aria-label="Supprimer l\'intervention">Supprimer</button>'
    : '';
  const dactHtml =
    editBtn || acts.length || closeBtn || delBtn
      ? `<div class="dact"><div class="actions">${editBtn}${actBtns}${closeBtn}${delBtn}</div></div>`
      : '';

  el.innerHTML = `
    <article class="detail${cardHead ? ' detail--card' : ''}">
      <div class="dfix">
        ${cardHead || `<div class="dtrow">${back}<h1 class="dtitle">${esc(i.title).replace(/ (?=[^ ]*$)/, '&nbsp;')}</h1></div>`}
        <section class="dtop${cardHead ? ' dtop--card' : ''}">
          <div class="dmeta3"><div class="drow"><span class="dloc">${i.location ? `<span class="ltag">${esc(locTag(i.location))}</span>` : ''}${i.assignee_id || i.proposed_to ? tagsOf(i) : ''}${i.status === 'publiee' ? '<span class="pill st-publiee">Nouveau</span>' : ''}<span class="ddate">${fmtAgo(i.created_at)}</span></span><span class="dright">${prio || pill ? `<span class="drt">${prio}${pill}</span>` : ''}</span></div>
            ${i.available_from || i.remind_minutes || i.client_presence ? `<p class="dslot">${i.available_from ? CLOCK + `<span>${esc(slotLine(i))}</span>` : i.client_presence ? '<span>Présence client requise</span>' : ''}${i.remind_minutes ? `<span class="dremind">${esc(REMIND[i.remind_minutes] || `${i.remind_minutes} min avant`)}</span>` : ''}</p>` : ''}</div>
          ${(!chat || cardHead) && dsc ? `<p class="ddesc">${esc(dsc)}</p>` : ''}
          ${
            cph.length
              ? `<div class="dph0"><span class="phpill" role="button" tabindex="0" data-ph="${esc(cph.map(e => urls[e.body]).join(' '))}">${cph
                  .slice(0, 3)
                  .map(e => `<img src="${urls[e.body]}" alt="">`)
                  .join('')}<span>${cph.length} photo${cph.length > 1 ? 's' : ''}</span></span></div>`
              : ''
          }
          ${photosHtml}
        </section>
      </div>
      ${dactHtml}
      <p class="error" id="acterr"></p>
      ${
        chat
          ? `<div class="chat2"><div class="chrono">${chatHtml}</div>
        ${canComment ? `<div class="cin"><span class="phadd cph" aria-label="Ajouter une photo"><input id="ph" type="file" accept="image/*" multiple>${CAM}</span><textarea id="cm" rows="1" placeholder="Ajouter un commentaire" maxlength="2000"></textarea><button type="button" class="csend" id="comment" aria-label="Envoyer">${SEND}</button></div>` : ''}
      </div>`
          : ''
      }
    </article>`;
  drawEdit();

  const fail = err => err && (el.querySelector('#acterr').textContent = err.message);
  const xb = el.querySelector('.xback');
  if (xb)
    xb.onclick = e => {
      e.preventDefault();
      el.closest('.unfold')?.previousElementSibling?.querySelector('a.card')?.click();
    };

  const row = el.querySelector('.dmeta3 .drow');
  const actEls = [...el.querySelectorAll('.dact .actions > a, .dact .actions > button')];
  if (row && actEls.length) {
    const g = document.createElement('button');
    g.type = 'button';
    g.className = 'xgear';
    g.setAttribute('aria-label', 'Actions');
    g.innerHTML = GEAR;
    row.append(g);
    el.querySelector('.detail')?.classList.add('xg');
    g.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      gearMenu(g, actEls);
    });
  }

  const phc = el.querySelector('.phc'),
    phi = el.querySelector('.phc-i');
  if (phc) {
    const step = () => (phc.firstElementChild?.offsetWidth || 0) + 8;
    const upd = () => {
      const s = step() || 1,
        i0 = Math.round(phc.scrollLeft / s);
      const vis = Math.max(1, Math.round((phc.clientWidth + 8) / s));
      if (phi) phi.textContent = `Photo ${Math.min(phc.children.length, i0 + vis)}/${phc.children.length}`;
      const p = el.querySelector('.phc-p'),
        n = el.querySelector('.phc-n');
      if (p) p.hidden = phc.scrollLeft <= 4;
      if (n) n.hidden = phc.scrollLeft + phc.clientWidth >= phc.scrollWidth - 4;
    };
    phc.addEventListener('scroll', upd, { passive: true });
    el.querySelectorAll('.phc-a').forEach(
      b =>
        (b.onclick = () => phc.scrollBy({ left: b.classList.contains('phc-n') ? step() : -step(), behavior: 'smooth' }))
    );
  }
  el.querySelectorAll('.phs a').forEach(
    a =>
      (a.onclick = e => {
        e.preventDefault();
        zoomImg(
          a.href,
          phList.map(p => urls[p.path])
        );
      })
  );
  el.querySelectorAll('.phpill').forEach(
    p =>
      (p.onclick = () => {
        const L = p.dataset.ph.split(' ');
        zoomImg(L[0], L);
      })
  );

  async function doDelete() {
    if (!confirm('Supprimer cette intervention ?')) return;
    const r = photos.length ? await sb.storage.from('photos').remove(photos.map(p => p.path)) : {};
    const { error } = r.error ? r : await sb.from('interventions').delete().eq('id', id);
    if (error) return fail(error);
    if (inline) {
      el.closest('.unfold')?.previousElementSibling?.querySelector('a.card')?.click();
      rerender();
    } else location.hash = '';
  }
  const del = el.querySelector('#del');
  if (del) del.onclick = doDelete;

  const foldOrList = () => {
    if (inline) {
      el.closest('.unfold')?.previousElementSibling?.querySelector('a.card')?.click();
      rerender();
    } else location.hash = '';
  };
  const act = async b => {
    if (b.dataset.act === 'cloturer') return closeChooser(id, doDelete, () => renderDetail(el, id));
    if (b.dataset.act === 'liberer' && !confirm("Se retirer de l'intervention ?")) return;
    b.disabled = true;
    const { error } =
      b.dataset.act === 'demander'
        ? await sb.rpc('request_transfer', { p_id: id })
        : await sb.rpc('transition', {
            p_id: id,
            p_action: b.dataset.act,
            p_comment: el.querySelector('#cm')?.value || '',
          });
    b.disabled = false;
    if (error) return fail(error);
    if (b.dataset.act === 'resoudre') return doneScreen('Intervention terminée', foldOrList);
    if (b.dataset.act === 'liberer') return doneScreen('Vous ne prenez plus cette intervention', foldOrList);
    renderDetail(el, id);
  };
  el.querySelectorAll('[data-act]').forEach(b => {
    b._run = () => act(b);
    if (b.dataset.act === 'liberer') {
      b.onclick = () => act(b);
      return;
    }
    if (inline || !['resoudre', 'cloturer', 'prendre'].includes(b.dataset.act)) {
      b.onclick = () => act(b);
      return;
    }
    b.insertAdjacentHTML('beforeend', HOLD);
    let tm = null;
    const stop = () => {
      clearTimeout(tm);
      tm = null;
      b.classList.remove('holding');
    };
    b.onpointerdown = e => {
      if (b.disabled) return;
      e.preventDefault();
      b.classList.add('holding');
      tm = setTimeout(() => {
        stop();
        act(b);
      }, 1000);
    };
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, stop));
    b.oncontextmenu = e => e.preventDefault();
    b.onclick = e => e.preventDefault();
  });

  if (!chat) return;
  sb.from('intervention_reads')
    .upsert({ user_id: S.me.id, intervention_id: id, last_read_at: new Date().toISOString() })
    .then(() => {});
  initComposer(el, { id, photos, fail, redraw: () => renderDetail(el, id) });
}
