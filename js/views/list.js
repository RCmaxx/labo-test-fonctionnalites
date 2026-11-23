import { sb } from '../sb.js?v=20261123193833';
import { state, assigneeName, isManager, isRealAdmin, role, ROLE_NAMES, compactName, memberRole, roleIco, assTag } from '../state.js?v=20261123193833';
import { $, $$, esc, errMsg, statusPill, fmtCreated, fmtAgo, fmtDate, STATUS, ROLES, confirmBox, toast, n2, stackSticky, ACTMSG, isDone, DONE_STATUSES, PIN, day0 } from '../ui.js?v=20261123193833';
import { go, render } from '../app.js?v=20261123193833';
import * as form from './form.js?v=20261123193833';
import { lockedByOther, loadLocks } from '../lock.js?v=20261123193833';

// Liste unique (lot 13) : mes interventions, signalées, prises par les autres, brouillons, puis terminées repliées.
const STATUSES = ['publiee', 'prise_en_charge']; // Lot 225 : la requête de liste exclut les clôturées.
// Lot 225 : clôturées (resolue, validee) chargées seulement à la demande (page Terminées, section des terminées,
// liste client, recherche), par pages de 50, de la plus récente à la plus ancienne ; gardées en mémoire entre deux rendus.
const DONE_ST = DONE_STATUSES, CPAGE = 50;
let CL = null; // { rows, more, stale, uid }
const closedQ = (me, a, b) => { let x = sb.from('interventions').select(COLS).in('status', DONE_ST); if (role() === 'client') x = x.eq('created_by', me); return x.order('resolved_at', { ascending: false, nullsFirst: false }).order('id').range(a, b); };
async function closedLoad(me, all) {
  if (!CL || CL.uid !== me) CL = { rows: [], more: true, stale: false, uid: me };
  const q = (a, b) => closedQ(me, a, b);
  if (CL.stale) { const n = Math.max(CL.rows.length, CPAGE); const { data, error } = await q(0, n - 1); if (error) return error; CL.rows = data; CL.more = data.length === n; CL.stale = false; }
  else if (!CL.rows.length && CL.more) { const { data, error } = await q(0, CPAGE - 1); if (error) return error; CL.rows = data; CL.more = data.length === CPAGE; }
  while (all && CL.more) { const { data, error } = await q(CL.rows.length, CL.rows.length + CPAGE - 1); if (error) return error; CL.rows.push(...data); CL.more = data.length === CPAGE; }
  return null;
}
async function closedMore(bt) {
  if (!CL || !CL.more || bt.disabled) return; bt.disabled = true;
  const { data, error } = await closedQ(ME, CL.rows.length, CL.rows.length + CPAGE - 1);
  if (error) { bt.disabled = false; return toast(errMsg(error), true); }
  const ids = new Set(CL.rows.map(r => r.id)); CL.rows.push(...data.filter(r => !ids.has(r.id))); CL.more = data.length === CPAGE;
  const sc = [mscr(), ...$$('.gcol')].map(e => [e, e.scrollTop]);
  if (LASTF && $('#rows')) await load(...LASTF);
  sc.forEach(([e, y]) => { if (e.isConnected) e.scrollTop = y; });
}
const COLS = 'id, title, location, description, status, priority, assignee_id, assignee_role, proposed_to, assigned_by, available_from, available_until, created_at, updated_at, validated_at, resolved_at, created_by, client_presence';

// Filtres de la recherche développée (aucun coché = tous les champs).
const SF = { titre: 'Titre', lieu: 'Lieu', desc: 'Description', tech: 'Technicien', rep: 'Signalé par', statut: 'Statut', date: 'Date' };
const RKEY = 'gi-recent-search';
const recent = () => { try { return JSON.parse(localStorage.getItem(RKEY)) || []; } catch { return []; } };
const remember = t => { if (t.length < 2) return; localStorage.setItem(RKEY, JSON.stringify([t, ...recent().filter(x => x.toLowerCase() !== t.toLowerCase())].slice(0, 6))); };

let DONE = false, PAGE = '';
// Lot 89 : mobile, liste gardée en mémoire et position de défilement restaurée au retour du détail.
let LASTF = null, MCACHE = {}, MY = null;
// Lot 106 : rechargement de la liste demandé par le volet (changement de statut) ; et nouveau rendu quand la disposition change (colonnes ↔ liste), cause des cartes pleine largeur.
addEventListener('gi:reload', () => { if (CL) CL.stale = true; if (LASTF && $('#rows')) load(...LASTF); });
const VW = () => document.documentElement.clientWidth; // Lot 154 : largeur de mise en page (le zoom au pincement sur iPad ne bascule plus l'affichage en une colonne).
{ let lay = null; const L = () => !document.body.classList.contains('tech') && VW() > 600; addEventListener('resize', () => { const v = L(); if (lay !== null && v !== lay && LASTF && $('#rows')) load(...LASTF); lay = v; }); new MutationObserver(() => { const v = L(); if (lay !== null && v !== lay && LASTF && $('#rows')) load(...LASTF); lay = v; }).observe(document.body, { attributes: true, attributeFilter: ['class'] }); lay = L(); }
const mscr = () => (VW() > 600 && document.getElementById('app')) || document.scrollingElement; // Lot 98 : en mobile simulé, #app défile (pied de page fixe).

export async function view(app, { q, done = false, page = '' }) {
  PAGE = page; if (CL) CL.stale = true; // Lot 225 : clôturées relues (mêmes pages) à chaque arrivée sur l'écran.
  CLOSED = { resolue: true, prog: page !== 'planifiees' && (done || document.body.classList.contains('tech') || VW() <= 600 || role() === 'client') };
  DONE = done;
  const searching = !done && q.has('recherche') && role() !== 'client';
  const f = { texte: q.get('texte') || '', sf: (q.get('sf') || '').split(',').filter(k => SF[k]) };

  app.innerHTML = `
    <div class="page">
      <div class="head${role() === 'client' ? ' hcli' : ''}${page === 'nouvelles' ? ' hnouv' : ''}">
        ${!done && !page && role() !== 'client' ? '' : `<h1>${done ? 'Interventions terminées' : page === 'nouvelles' ? (document.body.classList.contains('tech') ? 'Interventions' : 'Nouvelles interventions') : page === 'encours' ? 'En cours' : page === 'planifiees' ? 'Planifiées' : 'Interventions'}</h1>`}
        ${done ? '' : '<a class="btn primary" href="#/nouvelle" aria-label="Ajouter une intervention" title="Ajouter une intervention">Ajouter une intervention</a>'}
      </div>
      ${!searching && !done && !page && role() !== 'client' && document.body.classList.contains('tech') ? '<a class="msearch" href="#/interventions?recherche=1"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>Rechercher</a>' : ''}
      ${searching ? `<div class="tsearch" id="zq" contenteditable="plaintext-only" role="textbox" aria-label="Rechercher" data-ph="Rechercher" inputmode="text" enterkeyhint="done" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-form-type="other" data-lpignore="true">${esc(f.texte)}</div>
      <div class="sfilters" role="group" aria-label="Filtres de recherche">${Object.entries(SF).map(([k, v]) => `<button type="button" class="sf${f.sf.includes(k) ? ' on' : ''}" data-sf="${k}" aria-pressed="${f.sf.includes(k)}">${v}</button>`).join('')}</div>` : ''}
      ${searching ? '<p class="shint">Plusieurs mots : toutes les interventions qui contiennent chacun d\'eux. Accents et majuscules ignorés.</p><div class="scount" id="scount"></div>' : ''}
      <div id="rows"${!searching && page && document.body.classList.contains('tech') ? ' class="hcnt"' : ''}>${searching && !f.texte ? '' : (!searching && document.body.classList.contains('tech') && MCACHE[page || +done]) || '<p class="muted">Chargement…</p>'}</div>
    </div>`;

  let t;
  const apply = () => {
    const p = new URLSearchParams();
    if (searching) p.set('recherche', '1');
    if (f.texte) p.set('texte', f.texte);
    if (f.sf.length) p.set('sf', f.sf.join(','));
    history.replaceState(null, '', '#/interventions?' + p);
    load(f, searching);
  };
  const ts = $('#zq');
  if (ts) {
    ts.oninput = () => { if (!ts.textContent) ts.innerHTML = ''; f.texte = ts.textContent.trim(); clearTimeout(t); t = setTimeout(apply, 250); };
    ts.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); remember(f.texte); ts.blur(); } };
    ts.onblur = () => remember(f.texte);
    if (!f.texte) ts.focus();
    $$('.sfilters .sf').forEach(bt => (bt.onclick = () => {
      const k = bt.dataset.sf, on = !f.sf.includes(k);
      f.sf = on ? [...f.sf, k] : f.sf.filter(x => x !== k);
      bt.classList.toggle('on', on); bt.setAttribute('aria-pressed', String(on));
      apply();
    }));
  }
  if (MY == null && state.fnav != null) { MY = state.fnav; state.fnav = null; } // Lot 185
  if (MY != null && $('#rows .group')) mscr().scrollTop = MY;
  else if (MY != null) mscr().scrollTop = 0;
  await load(f, searching);
  // Lot 127 : après une actualisation pendant une création, formulaire remis à zéro et avertissement.
  sessionStorage.removeItem('gi:nwlost'); // Lot 130 : plus de message ni de réouverture après une actualisation.
}

// Dates en français : « 14 novembre », « 14 nov », « novembre », « 14/11 », « 14/11/2026 »…
const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
const norm = t => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '').replace(/\s+/g, ' ').trim();
function dateForms(iso) {
  const x = new Date(iso), d = x.getDate(), m = x.getMonth() + 1, y = x.getFullYear(), M = MOIS[m - 1];
  const p = n => String(n).padStart(2, '0');
  return [`${d} ${M} ${y}`, `${p(d)} ${M} ${y}`, `${d} ${M.slice(0, 3)} ${y}`, `${p(d)}/${p(m)}/${y}`, `${d}/${m}/${y}`, `${p(d)}-${p(m)}-${y}`, `${y}-${p(m)}-${p(d)}`, `${d}/${p(m)}/${y}`, `${p(d)}/${m}/${y}`];
}

// Texte replié (minuscules, sans accents) caractère par caractère : mêmes positions que l'original.
const fold = t => Array.from(String(t || ''), c => c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()[0] || c).join('');
const terms = txt => fold(txt).split(/\s+/).filter(Boolean);
const STATUT_TXT = { brouillon: 'brouillon', publiee: 'signale nouveau nouvelle a prendre', prise_en_charge: 'en cours pris', resolue: 'termine resolu', validee: 'valide termine' };
// Champs consultables d'une intervention.
function fields(r) {
  const e = REP[r.id];
  return {
    titre: r.title, lieu: r.location, desc: r.description,
    tech: r.assignee_id ? who(r) : '',
    rep: e ? `${e.actor_name || ''} ${ROLES[e.actor_role] || ''}` : '',
    statut: `${STATUS[r.status] || ''} ${STATUT_TXT[r.status] || ''}`,
  };
}
function dateHit(r, q) {
  const qn = norm(q).replace(/\b1er\b/, '1');
  return [r.created_at, r.updated_at, r.validated_at].filter(Boolean).some(d => dateForms(d).some(x => x.startsWith(qn) || x.includes(' ' + qn) || x.includes('/' + qn)));
}
function termHit(r, t, sf, F) {
  const on = k => !sf.length || sf.includes(k);
  if (Object.keys(F).some(k => on(k) && fold(F[k]).includes(t))) return true;
  if (on('lieu') && /^\d+$/.test(t) && (String(r.location || '').match(/\d+/g) || []).includes(t)) return true;
  return on('date') && dateHit(r, t);
}
// Correspondance : la phrase entière (utile pour les dates) ou chacun des mots.
function matches(r, txt, sf) {
  const F = fields(r), ts = terms(txt);
  if (!ts.length) return true;
  if ((!sf.length || sf.includes('date')) && dateHit(r, txt)) return true;
  return ts.every(t => termHit(r, t, sf, F));
}

// Volet « Terminées » replié par défaut à chaque ouverture de la liste.
let CLOSED = { resolue: true, prog: true };
// Lot 225 : temps réel. Derniers résultats bruts gardés pour un rechargement ciblé (seule la ligne modifiée est relue).
let RAW = null, PT = null, PEND = false;
const byCre = (a, b) => new Date(b.created_at) - new Date(a.created_at);
const byFin = (a, b) => new Date(b.resolved_at || 0) - new Date(a.resolved_at || 0);
const insSorted = (arr, r, cmp) => { const i = arr.findIndex(x => cmp(r, x) <= 0); if (i < 0) arr.push(r); else arr.splice(i, 0, r); };
function patchLoad() {
  clearTimeout(PT);
  PT = setTimeout(async () => {
    if (!LASTF || !$('#rows') || !RAW) return;
    // Détail déplié, appui long ou fenêtre ouverts : mise à jour différée pour ne rien fermer sous le doigt.
    if ($('#rows tr.xopen') || document.querySelector('.qtags, .qcatch, .nwin, .modal')) { PEND = true; PT = setTimeout(patchLoad, 2000); return; }
    PEND = false;
    const sc = [mscr(), ...$$('.gcol')].map(e => [e, e.scrollTop]);
    await load(LASTF[0], LASTF[1], true);
    sc.forEach(([e, y]) => { if (e.isConnected) e.scrollTop = y; });
  }, 150);
}
addEventListener('gi:itv', async e => {
  if (!RAW || !LASTF || !$('#rows')) return;
  const id = e.detail.id;
  const { data: r, error } = e.detail.type === 'DELETE' ? { data: null } : await sb.from('interventions').select(COLS).eq('id', id).maybeSingle();
  if (error || !RAW) return;
  RAW[0].data = (RAW[0].data || []).filter(x => x.id !== id);
  if (RAW[1]?.data) RAW[1].data = RAW[1].data.filter(x => x.id !== id);
  if (CL) CL.rows = CL.rows.filter(x => x.id !== id);
  if (r) {
    if (STATUSES.includes(r.status)) insSorted(RAW[0].data, r, byCre);
    else if (r.status === 'brouillon') { if (RAW[1]?.data && (isManager() || r.created_by === ME)) insSorted(RAW[1].data, r, byCre); }
    else if (DONE_ST.includes(r.status) && CL) insSorted(CL.rows, r, byFin);
  }
  patchLoad();
});
addEventListener('gi:itv-event', e => {
  const x = e.detail; if (!RAW || !x) return;
  if (['commentaire', 'photo'].includes(x.type) && RAW[5]?.data) RAW[5].data.push({ intervention_id: x.intervention_id, type: x.type, body: x.body, created_at: x.created_at, actor_id: x.actor_id, actor_role: x.actor_role });
  else if (['creee', 'publiee'].includes(x.type) && RAW[3]?.data) RAW[3].data.push({ intervention_id: x.intervention_id, type: x.type, actor_name: x.actor_name, actor_role: x.actor_role });
  else return;
  patchLoad();
});
addEventListener('gi:itv-photo', e => { if (!RAW || !e.detail || !RAW[2]?.data) return; RAW[2].data.push({ intervention_id: e.detail.intervention_id }); patchLoad(); });
// Repli (canal déconnecté) : rechargement complet lent.
addEventListener('gi:rt-poll', () => { if (CL) CL.stale = true; if (LASTF && $('#rows')) load(...LASTF); });

async function load(f, searching, patch) {
  const box = $('#rows'); LASTF = [f, searching];
  if (searching && !f.texte) {
    const sc = $('#scount'); if (sc) sc.textContent = '';
    const rc = recent();
    if (box) {
      box.classList.remove('srch');
      box.innerHTML = rc.length ? `<div class="srecent">Recherches récentes ${rc.map(x => `<button type="button" data-r="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : '';
      $$('.srecent button').forEach(bt => (bt.onclick = () => { const z = $('#zq'); z.textContent = bt.dataset.r; z.dispatchEvent(new Event('input')); }));
    }
    return;
  }
  const cols = COLS; // Lot 225 : colonnes des cartes, de la recherche, des filtres et des compteurs (pas de select *)
  // Lot 175 : toutes les requêtes de la liste partent en même temps (avant : 7 à la suite).
  const me = (await sb.auth.getSession()).data.session?.user?.id || (await sb.auth.getUser()).data.user.id; ME = me; if (!patch) loadLocks(); // Lot 223 : verrous d'édition pour le menu de l'appui long.
  const brq = (isManager() || role() === 'technicien') ? (() => { let q = sb.from('interventions').select(cols).eq('status', 'brouillon'); if (!isManager()) q = q.eq('created_by', me); return q.order('created_at', { ascending: false }).limit(300); })() : null;
  const mobv = document.body.classList.contains('tech') || VW() <= 600;
  const stdBoard = !mobv && !DONE && !searching && role() !== 'client';
  const needC = searching || DONE || role() === 'client' || (mobv && !PAGE);
  const day0iso = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); })();
  const todayQ = stdBoard ? sb.from('interventions').select(cols).in('status', DONE_ST).or(`resolved_at.gte.${day0iso},validated_at.gte.${day0iso}`).order('resolved_at', { ascending: false, nullsFirst: false }).limit(200) : Promise.resolve(null);
  const RES = patch && RAW ? RAW : await Promise.all([
    sb.from('interventions').select(cols).in('status', STATUSES).order('created_at', { ascending: false }).limit(500),
    brq || Promise.resolve(null),
    sb.from('intervention_photos').select('intervention_id').limit(5000),
    sb.from('intervention_events').select('intervention_id, type, actor_name, actor_role').in('type', ['creee', 'publiee']).order('created_at').limit(5000),
    sb.from('intervention_reads').select('intervention_id, last_read_at').eq('user_id', me),
    sb.from('intervention_events').select('intervention_id, type, body, created_at, actor_id, actor_role').in('type', ['commentaire', 'photo']).limit(5000),
    needC ? closedLoad(me, searching) : Promise.resolve(null),
    todayQ,
  ]);
  RAW = RES;
  const [r0, r1, { data: phr }, { data: ev }, { data: rd }, { data: ce }, cerr, rToday] = RES;
  let { data, error } = r0;
  if (!error && cerr) error = cerr;
  if (!error) state.listRows = new Map((data || []).concat(needC && CL ? CL.rows : []).map(r => [r.id, r])); // Lot 225 : haut du détail affiché tout de suite
  if (!error && needC && CL) { const ids = new Set(data.map(r => r.id)); data = data.concat(CL.rows.filter(r => !ids.has(r.id))); }
  if (!error && r1) { if (r1.error) error = r1.error; else data = data.concat(r1.data); }
  if (!error && rToday) { if (rToday.error) error = rToday.error; else { const ids = new Set((data || []).map(r => r.id)); data = (data || []).concat((rToday.data || []).filter(r => !ids.has(r.id))); } }
  if (!box || !$('#rows')) return;
  box.classList.toggle('dn', DONE);
  if (error) { box.innerHTML = `<p class="err">${esc(errMsg(error))}</p>`; return; }
  // Client : uniquement ses propres signalements (la RLS le garantit aussi).
  if (role() === 'client') data = (data || []).filter(r => r.created_by === me);
  PHI = new Set((phr || []).map(x => x.intervention_id));
  REP = {};
  (ev || []).forEach(e => { if (!REP[e.intervention_id] || e.type === 'creee') REP[e.intervention_id] = e; });
  // Lot 64 : messages non lus du tchat par intervention (même règle que le détail).
  UNR = {}; TOT = {};
  {
    const lr = Object.fromEntries((rd || []).map(x => [x.intervention_id, x.last_read_at]));
    // Lot 88 : la bulle de création (description, photos envoyées avec le formulaire) n'est pas un commentaire.
    const IR = Object.fromEntries((data || []).map(r => [r.id, r]));
    const isCrea = e => { const r = IR[e.intervention_id]; if (!r || e.actor_id !== r.created_by) return false; return e.type === 'commentaire' ? !!String(r.description || '').trim() && String(e.body || '').trim() === String(r.description).trim() : new Date(e.created_at) - new Date(r.created_at) < 120000; };
    (ce || []).filter(e => !isCrea(e)).forEach(e => { TOT[e.intervention_id] = (TOT[e.intervention_id] || 0) + 1; if (e.actor_id === me && (!isRealAdmin() || !e.actor_role || e.actor_role === role())) return; const l = lr[e.intervention_id]; if (!l || e.created_at > l) UNR[e.intervention_id] = (UNR[e.intervention_id] || 0) + 1; }); }
  if (!$('#rows')) return;
  // Heure de passage : les interventions programmées restent visibles ; seul « Commencer » attend le déverrouillage.
  if (searching) {
    data = data.filter(r => matches(r, f.texte, f.sf));
  }
  // Compte admin : « à moi » seulement sous le profil qui a pris l'intervention.
  const mine = r => r.assignee_id === me && (!isRealAdmin() || r.assignee_role === role());
  // Assignée à moi, pas encore acceptée (compte admin : au profil simulé du même rôle).
  // Lot 83 : mobile, seules les programmées des jours suivants restent dans leur onglet ; le jour J elles rejoignent les autres piles.
  const mob = document.body.classList.contains('tech') || VW() <= 600;
  const S = r => sched(r); // Lot 172 : mobile, toutes les planifiées (y compris le jour J) restent dans la page « Planifiées ».
  const pmine = r => r.status === 'publiee' && !S(r) && !!r.proposed_to && ['technicien', 'responsable_tech'].includes(role()) && (r.proposed_to === me || (isRealAdmin() && memberRole(r.proposed_to) === role()));
  const open = data.filter(r => !isDone(r));
  // Directeur / RT : interventions qu'ils ont assignées à quelqu'un.
  const dem = ['directeur', 'responsable_tech'].includes(role());
  const asked = r => dem && r.assigned_by === me && !mine(r) && !pmine(r) && !S(r);
  // Lot 54 : programmée assignée, le jour venu → « En cours » pour les autres profils.
  const groups = [
    ['mes', 'Mes interventions', open.filter(r => (r.status === 'prise_en_charge' && mine(r)) || pmine(r)).sort(byArrival)],
    ['dem', 'Mes demandes d\'intervention', open.filter(asked)],
    ['publiee', 'Nouvelles interventions', open.filter(r => r.status === 'publiee' && !pmine(r) && !asked(r)).sort(byArrival)], // Lot 309 : ordre de date seul, sans tri par priorité. Lot 279 : les programmées rejoignent les nouvelles (plus de catégorie ni de sous-catégories par jour).
    ['prise_en_charge', ['technicien', 'responsable_tech'].includes(role()) ? 'Autres interventions en cours' : 'En cours', open.filter(r => (r.status === 'prise_en_charge' && !mine(r) && !asked(r))).sort(byArrival)],
    // Lot 60 : les terminées ont leur propre page (restent trouvables par la recherche).
    // Lot 330 : les brouillons ne s'affichent plus en colonne ni dans le feed ; uniquement via le bouton Brouillon du formulaire.
    // Lot 332 : colonne standard « Terminées aujourd'hui » (resolved_at / validated_at du jour).
    ...(!mob && !DONE && !searching && role() !== 'client' ? [['auj', 'Terminées aujourd\'hui', data.filter(r => { if (!isDone(r)) return false; const d = new Date(r.resolved_at || r.validated_at || 0), n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate(); }).sort((a, b) => new Date(b.resolved_at || b.validated_at || 0) - new Date(a.resolved_at || a.validated_at || 0))]] : []),
    ...(searching ? [['resolue', 'Terminées', data.filter(r => isDone(r))]] : []),
  ].filter(([k, , rows]) => (k !== 'mes' || rows.length) && (k !== 'dem' || dem));
  // Lot 83 : mobile, l'onglet des programmées tout en bas du feed.
  if (mob) { const i = groups.findIndex(g => g[0] === 'prog'); if (i >= 0) groups.push(...groups.splice(i, 1)); }
  // Lot 159 : mobile, pages « Nouvelles » et « En cours » (pastilles du menu du bas).
  if (mob && !DONE && !searching && role() !== 'client') {
    const n = k => groups.filter(g => k.includes(g[0])).reduce((a, g) => a + g[2].length, 0);
    const NB = { n: n(['publiee']), c: n(['mes', 'prise_en_charge']), p: n(['prog']) };
    try { localStorage.setItem('gi_nb', JSON.stringify(NB)); } catch (e) {}
    document.querySelectorAll('#bnav .bpn').forEach(e => { e.textContent = NB.n; }); document.querySelectorAll('#bnav .bpc').forEach(e => { e.textContent = NB.c; }); document.querySelectorAll('#bnav .bpl').forEach(e => { e.textContent = NB.p; });
    if (PAGE === 'planifiees') groups.forEach(g => { if (g[0] === 'prog') g[1] = 'Planifiées'; }); // Lot 174 : sous-titre propre avec pastille.
    if (PAGE === 'nouvelles') { const all = groups.filter(g => ['publiee', 'mes', 'dem', 'prise_en_charge', 'prog'].includes(g[0])).flatMap(g => g[2]).sort(byArrival); groups.splice(0, groups.length, ['publiee', 'Interventions', all]); } // Lot 375 (FA 780) : mobile, toutes les cartes dans une seule colonne « Interventions ».
    const keep = PAGE === 'nouvelles' ? ['publiee'] : PAGE === 'encours' ? ['mes', 'prise_en_charge'] : PAGE === 'planifiees' ? ['prog'] : null;
    groups.splice(0, groups.length, ...groups.filter(g => keep ? keep.includes(g[0]) : !['publiee', 'mes', 'prise_en_charge', 'prog'].includes(g[0])));
    // Lot 160 : les terminées se rangent dans la page menu.
    if (!keep) { const fin = r => new Date(r.resolved_at || r.validated_at || r.updated_at); groups.push(['avant', 'Interventions terminées', data.filter(r => isDone(r)).sort((a, b) => fin(b) - fin(a))]); }
  }
  if (DONE) {
    const fin = r => new Date(r.resolved_at || r.validated_at || r.updated_at);
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const all = data.filter(r => isDone(r)).sort((a, b) => fin(b) - fin(a));
    // Lot 114 : « Terminées cette semaine » (lundi → hier) entre aujourd'hui et les autres.
    const w0 = new Date(d0); w0.setDate(w0.getDate() - (w0.getDay() + 6) % 7);
    // Lot 137 : plus de sous-catégories (aujourd'hui, jours de la semaine) : une seule colonne, tout à droite en version standard.
    groups.splice(0, groups.length, ['avant', 'Autres interventions terminées', all]);
  }
  // Client : une seule catégorie, ses propres commandes.
  if (role() === 'client' && !DONE) groups.splice(0, groups.length, ['dem', 'Mes demandes d\'intervention', data]);
  const hl = searching ? f.texte : '';
  // Recherche : une seule liste, sans titres de volets.
  if (searching) {
    const all = groups.flatMap(g => g[2]);
    box.innerHTML = all.length ? table(all, hl, f.sf) : '';
    box.classList.add('srch');
    const sc = $('#scount'); if (sc) sc.textContent = all.length ? `${all.length} résultat${all.length > 1 ? 's' : ''}` : 'Aucun résultat';
  } else {
    box.classList.remove('srch');
    // Lot 55 : version standard, 3 colonnes (Nouvelles | En cours | Programmées + Terminées) ; seule « Terminées » se plie.
    const std = !DONE && !document.body.classList.contains('tech') && VW() > 600 && role() !== 'client';
    const fold = k => document.body.classList.contains('tech') || (DONE && ['auj', 'sem', 'avant'].includes(k)); // Lot 96 : sous-catégories des terminées pliables partout. // Lot 91 : catégories pliables seulement sur mobile.
    const sec = ([k, label, rows]) => `<section class="group${fold(k) && CLOSED[k] ? ' closed' : ''}" data-g="${k}"><h2${fold(k) ? ` role="button" tabindex="0" aria-expanded="${!CLOSED[k]}"` : ''}>${DONE ? '' : `${GICO[k] || ''}<span class="count">${rows.length}</span>`}<span class="glab">${DONE ? (GICO[k] || '') : ''}${label}</span>${DONE ? '<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' : ''}</h2>
      ${!rows.length ? '' : table(rows, '', [], false, k === 'publiee', (k === 'prise_en_charge' || k === 'mes'))}${(k === 'avant' || (k === 'dem' && role() === 'client')) && CL?.more ? '<button type="button" class="ghost cmore">Voir plus</button>' : ''}</section>`;
    const shown = groups.filter(g => g[2].length || DONE || (std && (g[0] === 'prog' || g[0] === 'auj')));
    const COL = { mes: 0, dem: 0, publiee: 0, prise_en_charge: 1, auj: 2, prog: 2, resolue: 2 }; // Lot 332 : 3e colonne = Terminées aujourd'hui.
    if (PAGE && !shown.length) { box.innerHTML = '<p class="muted pempty">Aucune intervention pour le moment.</p>'; } else box.innerHTML = std ? `<div class="gcols">${[0, 1, 2].map(c => { const gs = shown.filter(g => COL[g[0]] === c), H = /<h2[\s\S]*?<\/h2>/; if (!gs.length) return '<div class="gcolw"><div class="gcol"></div></div>'; const s0 = sec(gs[0]); return `<div class="gcolw"><div class="gcol ghd"><section class="group" data-g="${gs[0][0]}">${s0.match(H)[0]}</section></div><div class="gcol">${s0.replace(H, '')}${gs.slice(1).map(sec).join('')}</div></div>`; }).join('')}</div>` : DONE && !document.body.classList.contains('tech') && VW() > 600 ? `<div class="gcols gdone">${['', '', 'avant'].map(k => `<div class="gcol">${shown.filter(g => g[0] === k).map(sec).join('')}</div>`).join('')}</div>` : shown.map(sec).join(''); // Lot 102 : terminées, défilement interne comme les colonnes.
    // Lot 65 : vue standard, bouton « Nouvelle intervention » au-dessus de « Nouvelles interventions », sans titre de page.
    { const hd = $('.page > .head'), hb = hd && hd.querySelector('.btn'); if (hd) hd.style.display = ''; if (hb) hb.style.display = ''; // Lot 97 : titre et bouton sur la même ligne. // Lot 94 : titre « Interventions » réaffiché.
    }
    // Lot 74 : hauteur des colonnes = bas de l'écran (défilement propre à chaque colonne).
    { const g = $('.gcol:not(.ghd)'); if (g) document.documentElement.style.setProperty('--gtop', Math.round(g.getBoundingClientRect().top + window.scrollY + 16) + 'px'); }
    $$('.gcol').forEach(c => stackSticky(c, '.group > h2', 0));
    // Lot 367 (FA 767) : mobile, icône de la page + compteur dans l'en-tête ; compteurs retirés de la page.
    { const pc = document.querySelector('#top .pcnt'), on = document.body.classList.contains('tech') && !!PAGE && shown.length > 0; box.classList.toggle('hcnt', on); state.pcnt = on ? (GICO[shown[0][0]] || '') + '<span class="pcn">' + shown.reduce((n, g) => n + g[2].length, 0) + '</span>' : ''; if (pc) pc.innerHTML = state.pcnt; if (on && shown.length === 1) box.querySelector('.group')?.classList.remove('closed'); }
    { const st = document.body.classList.contains('tech') && PAGE === 'encours'; box.classList.toggle('stk2', st); if (st) stk2(box); } // Lot 281 : mobile, sous-titres de En cours collants et empilés.
    gsbars();
    $$('#rows .group h2[role=button]').forEach(h => (h.onclick = h.onkeydown = e => {
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      // Lot 83 : seuls le texte et la pastille plient / déplient.
      if (e.type === 'click' && !e.target.closest('.glab, .count, .chev')) return;
      e.preventDefault();
      const g = h.parentElement, k = g.dataset.g;
      CLOSED[k] = !g.classList.contains('closed');
      g.classList.toggle('closed', CLOSED[k]);
      h.setAttribute('aria-expanded', String(!CLOSED[k]));
    }));
  }
  // Mobile : gris tant que le doigt est sur la ligne (survol souris en version standard).
  $$('#rows tr[data-id]').forEach(tr => {
    let t = null, x0 = 0, y0 = 0; const off = () => { clearTimeout(t); tr.classList.remove('press'); };
    // Gris différé (comme iOS) : un défilement qui démarre ne repeint pas la ligne.
    tr.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; clearTimeout(t); t = setTimeout(() => tr.classList.add('press'), 90); }, { passive: true });
    // Petit tremblement du doigt toléré ; un vrai défilement annule.
    tr.addEventListener('touchmove', e => { if (Math.hypot(e.touches[0].clientX - x0, e.touches[0].clientY - y0) > 10) off(); }, { passive: true });
    ['touchend', 'touchcancel'].forEach(k => tr.addEventListener(k, off, { passive: true }));
    // Lot 84 : survol souris (iPad avec trackpad compris) → carte mise en évidence.
    tr.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') tr.classList.add('hov'); });
    tr.addEventListener('pointerleave', () => tr.classList.remove('hov'));
  });
  // Lot 61 : vue standard, le détail se déplie sous sa carte (même largeur) au lieu d'ouvrir une page.
  const inl = !searching && role() !== 'client'; // Lot 165 : déploiement du détail dans la carte aussi en mobile.
  // Lot 71 : module du détail préchargé, données lancées dès l'appui (pointerdown).
  const dmod = import('./detail.js?v=20261123193833');
  $$('#rows tr[data-id]').forEach(tr => tr.addEventListener('pointerdown', () => { if (role() !== 'client' && !tr.classList.contains('xopen')) dmod.then(m => m.prefetch(tr.dataset.id)); }));
  // Lot 225 : plus de préchargement en tâche de fond des fiches affichées ; fiche complète chargée à l'ouverture (appui ou clic).
  // Lot 384 : fiches des cartes visibles préchargées en tâche de fond (12 max, une à une), dépliage sans attente.
  if (role() !== 'client') { const ids = $$('#rows tr[data-id]').filter(tr => tr.getBoundingClientRect().top < innerHeight * 2).slice(0, 12).map(tr => tr.dataset.id); const idle = window.requestIdleCallback || (f => setTimeout(f, 200)); clearTimeout(pfT); const tk = ++pfK; pfT = setTimeout(() => dmod.then(m => { const nx = () => { const id = ids.shift(); if (id && tk === pfK) idle(() => Promise.resolve(m.prefetch(id, 60000)).then(nx)); }; nx(); }), 3000); } // Lot 391 : démarré 3 s après le dernier affichage, pour ne pas ralentir le chargement
  qaInit();
  $$('#rows .cmore').forEach(b => (b.onclick = () => closedMore(b))); // Lot 225
  if (document.body.classList.contains('tech')) { if (MY != null) { mscr().scrollTop = MY; MY = null; } if (!searching) MCACHE[PAGE || +DONE] = box.innerHTML; }
  // Lot 82 : « Nouvelle intervention » s'ouvre en fenêtre par-dessus la liste (reste grisé).
  $$('#rows tr[data-id]').forEach(tr => (tr.onclick = async () => {
    if (role() === 'client') return; // Lot 225 : pas de détail d'intervention pour le client.
    if (inl) {
      const was = tr.classList.contains('xopen'), y = scrollY;
      // Lot 89c : colonne qui défile seule ; la fermeture laisse tout en place, l'ouverture remonte le fil pour montrer la carte entière.
      const col = tr.closest('.gcol'), cy = col ? col.scrollTop : 0;
      // Lot 65 : la page garde sa hauteur à la fermeture, sinon le navigateur la remonte (recentrage).
      // Lot 93 : la fermeture se replie (même durée que l'ouverture), rien d'autre ne bouge.
      if (was) { const xr = tr.nextElementSibling, xd = xr?.querySelector('.xdet'); if (!xd || tr._anim) return; const H = xd.offsetHeight; tr._anim = 1;
        fold3(XDUR, k => (xd.style.height = H * (1 - k) + 'px'), () => { xr.remove(); tr.classList.remove('xopen'); tr._anim = 0; }); return; }
      const t0 = tr.getBoundingClientRect().top, xo = $('#rows tr.xrow'), xoh = xo && col && xo.closest('.gcol') === col ? xo.offsetHeight : 0;
      // Lot 92 : plus d'espace ajouté en bas ; le défilement reste borné à la dernière carte.
      $$('#rows tr.xrow').forEach(x => x.remove()); $$('#rows tr.xopen').forEach(x => x.classList.remove('xopen'));
      if (col) { col.scrollTop = cy; const dt = tr.getBoundingClientRect().top - t0; if (dt) col.scrollTop += dt; }
      tr.classList.add('xopen');
      { const tb = tr.closest('table'); if (tb && tb.style.tableLayout !== 'fixed') { const r0 = tb.rows[0]; const ws = [...r0.cells].map(c => c.getBoundingClientRect().width); [...r0.cells].forEach((c, i) => c.style.width = ws[i] + 'px'); tb.style.width = tb.getBoundingClientRect().width + 'px'; tb.style.tableLayout = 'fixed'; } }
      tr.insertAdjacentHTML('afterend', '<tr class="xrow"><td><div class="xdet"></div></td><td class="xsp" colspan="3"></td></tr>');
      const { view: dv, prefetch } = await dmod; prefetch(tr.dataset.id);
      const xr = tr.nextElementSibling; await dv(xr.querySelector('.xdet'), { id: tr.dataset.id, inline: true });
      if (!col && tr.classList.contains('xopen')) requestAnimationFrame(() => { const xd = xr.querySelector('.xdet'), H = xd.offsetHeight; xd.style.height = '0px'; xd.style.overflow = 'hidden'; const sc = mscr(), s0 = sc.scrollTop, hb = (document.getElementById('bnav')?.offsetHeight || 0), vh = innerHeight - hb, tt = tr.getBoundingClientRect().top, d = Math.max(0, Math.min(tt - 70, tt + tr.offsetHeight + H + 8 - vh));
        fold3(XDUR, k => { xd.style.height = H * k + 'px'; if (d) sc.scrollTop = s0 + d * k; }, () => { xd.style.height = ''; xd.style.overflow = ''; }); });
      if (col && tr.classList.contains('xopen')) requestAnimationFrame(() => { const xd = xr.querySelector('.xdet'), H = xd.offsetHeight, c = col.getBoundingClientRect(), t = tr.getBoundingClientRect(), b = xr.getBoundingClientRect(), gs = [...col.querySelectorAll('.group')], gi = gs.indexOf(tr.closest('.group')), top = c.top + gs.slice(0, gi + 1).reduce((n, g) => n + (g.querySelector(':scope > h2')?.offsetHeight || 0) + 8, 0);
        const d = b.bottom - c.bottom > 0 ? Math.min(b.bottom - c.bottom + 8, t.top - top - 8) : t.top < top ? t.top - top - 8 : 0; const s0 = col.scrollTop; xd.style.height = '0px';
        fold3(XDUR, k => { xd.style.height = H * k + 'px'; if (d) col.scrollTop = s0 + d * k; }, () => (xd.style.height = '')); });
      return;
    }
    MY = mscr().scrollTop; MCACHE[PAGE || +DONE] = $('#rows').innerHTML;
    go('intervention/' + tr.dataset.id);
  }));
}

// Lot 93 : dépliage / repliage du détail, une seule courbe (hauteur et défilement ensemble).
const XDUR = 240; // Lot 384 : dépliage plus vif
function fold3(ms, step, done) { const t0 = performance.now(); const f = now => { const x = Math.min(1, (now - t0) / ms), k = 1 - Math.pow(1 - x, 3); step(k); if (x < 1) requestAnimationFrame(f); else done && done(); }; requestAnimationFrame(f); }

// Met en évidence chacun des mots recherchés (sans tenir compte des accents).
function mark(txt, q) {
  const s = String(txt || ''), ts = q ? terms(q) : [];
  if (!ts.length) return esc(s);
  const f = fold(s), on = new Array(s.length).fill(false);
  ts.forEach(t => { let i = f.indexOf(t); while (i >= 0) { for (let k = i; k < i + t.length; k++) on[k] = true; i = f.indexOf(t, i + t.length); } });
  let out = '', open = false;
  for (let k = 0; k < s.length; k++) {
    if (on[k] !== open) { out += on[k] ? '<mark>' : '</mark>'; open = on[k]; }
    out += esc(s[k]);
  }
  return out + (open ? '</mark>' : '');
}
// Extrait de description autour du premier mot trouvé.
function snippet(d, q) {
  const s = String(d || ''), f = fold(s), i = Math.min(...terms(q).map(t => f.indexOf(t)).filter(x => x >= 0));
  if (!isFinite(i)) return '';
  const a = Math.max(0, i - 30), b = Math.min(s.length, i + 80);
  return (a ? '…' : '') + mark(s.slice(a, b), q) + (b < s.length ? '…' : '');
}
// Recherche : ligne des autres champs trouvés (signalé par, technicien, statut).
function extra(r, q, sf) {
  const F = fields(r), ts = terms(q), on = k => !sf.length || sf.includes(k), out = [];
  const hit = v => ts.some(t => fold(v).includes(t));
  const e = REP[r.id];
  if (on('rep') && e && hit(F.rep)) out.push(`<span class="lbl">Signalé par</span> ${mark(compactName(e.actor_name), q)}`);
  if (on('tech') && F.tech && hit(F.tech)) out.push(`<span class="lbl">Technicien</span> ${mark(F.tech, q)}`);
  if (on('statut') && hit(F.statut)) out.push(`<span class="lbl">Statut</span> <mark>${esc(STATUS[r.status] || r.status)}</mark>`);
  if (on('date') && (dateHit(r, q) || ts.some(t => dateHit(r, t)))) out.push(`<span class="lbl">Créée le</span> ${esc(fmtDate(r.created_at))}`);
  return out.join(' · ');
}

// Lot 281 : mobile (réel et simulé), « Mes interventions » se fige sous le menu du haut, « Autres interventions en cours » se cale dessous.
const stk2 = box => {
  const set = () => { const a = document.getElementById('app'), sim = a && getComputedStyle(a).overflowY !== 'visible'; let y = sim ? 0 : (document.getElementById('top')?.getBoundingClientRect().bottom || 0); box.querySelectorAll(':scope > .group[data-g=mes] > h2, :scope > .group[data-g=prise_en_charge] > h2').forEach(h => { h.style.top = Math.floor(y) + 'px'; y += h.getBoundingClientRect().height; }); };
  set(); if (!box._stk2) { box._stk2 = 1; addEventListener('resize', () => { if (box.classList.contains('stk2')) set(); }); }
};
export function table(rows, hl = '', sf = [], pl = false, nv = false, ec = false) { // Lot 260 : ec = colonne En cours // Lot 257 (FA 726) : nv = colonne Nouvelles (étiquette de priorité)
  const sn = r => hl && (!sf.length || sf.includes('desc')) ? snippet(r.description, hl) : '';
  const ex = r => hl ? extra(r, hl, sf) : '';
  return `<table class="list">
    <thead><tr><th>Statut</th><th>Intervention</th><th>Lieu</th><th>Signalement</th></tr></thead>
    <tbody>${rows.map(r => `
            <tr data-id="${r.id}" tabindex="0" class="r-${r.status}${isDone(r) ? ' done' : ''}">
        <td></td>
        <td class="tdc">${chatIco(r.id)}${qa(r)}<span class="tl tp-${prio(r) || 'normale'}${/^[TVWYJ]/.test((r.title || '').trim()) ? ' tov' : ''}">${(() => { const w = (r.title || '').trim().split(/\s+/); const lw = w.pop() || ''; const hd = w.length > 1 ? w.slice(0, -1).join(' ') : ''; const pv = w.length ? w[w.length - 1] + ' ' + lw : lw; return `${hd ? `<span class="t">${mark(hd, hl)} </span>` : ''}<span class="nw"><span class="t">${mark(pv, hl).replace(/ (?=[^ <>]*$)/, "&nbsp;")}</span><span class="ico2">${PHI.has(r.id) ? CAMI : ''}</span></span>`; })()}</span><span class="sub lago lp-${prio(r) || 'normale'}">${r.location ? place(r.location, hl) : ''}${tag(r)}<span class="sdt">${new Date(r.created_at).toDateString() === new Date().toDateString() ? fmtAgo(r.created_at) : fmtCreated(r.created_at)}</span></span>${r.client_presence ? `<span class="sub sdl"><span class="sched">${HANDI}<span class="pres">Présence client</span></span></span>` : ''}${r.scheduled_date ? `<span class="sub">Prévue le ${fmtDate(r.scheduled_date)}</span>` : ''}${sn(r) ? `<span class="sub">${sn(r)}</span>` : ''}${ex(r) ? `<span class="sub">${ex(r)}</span>` : ''}</td>
        <td>${r.location ? place(r.location, hl) : '<span class="muted">—</span>'}</td>
        <td class="tend"></td>
      </tr>`).join('')}</tbody>
  </table>`;
}
// Compte admin : nom du profil qui a pris l'intervention.
const who = r => { const n = assigneeName(r); return r.assignee_role && Object.values(ROLE_NAMES).includes(n) ? ROLE_NAMES[r.assignee_role] : n; };
let REP = {}, UNR = {}, TOT = {}, pfK = 0, pfT; // pfK/pfT : préchargement des fiches en cours
const cnt = n => n > 99 ? '99+' : n;
const chatIco = id => TOT[id] ? `<span class="cbub${UNR[id] ? ' unr' : ''}" aria-label="${UNR[id] ? UNR[id] + ' non lus' : TOT[id] + ' commentaires'}"><b>${cnt(UNR[id] || TOT[id])}</b></span>` : '';
// Version J : signaleur en retrait (petit, en haut) ; dessous, décalée, le technicien en charge, « Nouveau », sinon le statut.
function tag(r) {
  let main;
  if (['prise_en_charge', 'resolue', 'validee'].includes(r.status) && r.assignee_id) main = `<span class="cwho cw-tech st-tag tk">${roleIco(r.assignee_role || memberRole(r.assignee_id))}<span>${esc(who(r))}</span></span>`;
  else if (r.status === 'publiee') main = `${r.proposed_to ? assTag(r.proposed_to) : ''}`;
  else main = statusPill(r.status);
  return main; // Lot 73 : commanditaire retiré des listes
}
// Lieu en étiquette : mobil-home → « MH 12 », lieux communs prédéfinis tels quels ; texte libre sans étiquette.
const COMMON = ['réception', 'camp saisonnier', 'sanitaire 1', 'sanitaire 2', 'scène', 'restaurant', 'bar', 'piscine', 'aire de jeux', 'parking', 'local technique'];
function place(l, hl) {
  const v = String(l).trim(), m = v.match(/^(?:mobil[- ]?home|mh)?\s*(\d+)$/i);
  if (m) return `<span class="ltag stacked"><span class="mhpre">MH</span><span class="mhnum">${mark(n2(m[1]), hl)}</span></span>`;
  return `<span class="ltag ptag">${PIN}${mark(v, hl)}</span>`;
}
// Lot 265 (FA 734) : icônes des sous-titres
const GICO = {publiee: '<span class="gico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/></svg></span>', prog: '<span class="gico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>', prise_en_charge: '<span class="gico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/></svg></span>', mes: '<span class="gico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/></svg></span>', auj: '<span class="gico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg></span>'};
// Lot 300 (FA 737) : présence client requise = icône Lucide « hand » juste après le titre, avant l'appareil photo (style : .thand dans app.css).
export const HANDI = '<span class="thand" aria-label="Présence client requise"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg></span>';
const CAMI = ''; // Lot 407 : appareil photo retiré des cartes d'intervention
let PHI = new Set();
// Lot 61 : toute intervention programmée non prise va dans « Interventions programmées » ; celles du jour en tête.
const sched = r => r.status === 'publiee' && !!r.available_from;
// Arrivée en haut de pile : création, puis (programmées) jour J, H-1 et H-30 min.
const arrival = r => { const c = new Date(r.created_at).getTime(); if (!r.available_from) return c; const f = new Date(r.available_from).getTime(), n = Date.now(); return Math.max(c, ...[day0(f), f - 36e5, f - 18e5].filter(t => t <= n)); };
const byArrival = (a, b) => arrival(b) - arrival(a);
const prio = r => r.priority;


// Lot 76 : barre de défilement fine, dessinée par l'appli (toujours visible quand la colonne déborde, même sur iPad).
function gsbars() {
  const wrap = $('.gcols'); if (!wrap) return;
  wrap.querySelectorAll('.gsb').forEach(x => x.remove());
  $$('.gcol', wrap).forEach(g => {
    const t = document.createElement('i'); t.className = 'gsb'; t.innerHTML = '<b></b>'; wrap.appendChild(t);
    const upd = () => {
      const sh = g.scrollHeight, ch = g.clientHeight;
      if (!g.isConnected || sh <= ch + 1) { t.hidden = true; return; }
      t.hidden = false;
      // Lot 78 : rail limité aux cartes (du haut de la première au bas de la dernière visible).
      const cs = $$('tr[data-id]', g).filter(c => c.getClientRects().length); if (!cs.length) { t.hidden = true; return; } // Lot 115.1 : pas de barre pour une colonne pliée.
      const gr = g.getBoundingClientRect(), f = cs[0].getBoundingClientRect(), l = cs[cs.length - 1].getBoundingClientRect();
      // Lot 91 : jamais à hauteur des titres empilés (sous le bas de la pile + sa bande de masquage).
      // Lot 105.11 : seulement les titres réellement empilés en ce moment (au repos, la barre part du haut de la 1re carte).
      const stk = $$('.group > h2', g).reduce((m, h) => { const r = h.getBoundingClientRect(), st = parseFloat(getComputedStyle(h).top) || 0; return g.scrollTop > 0 && r.top - gr.top <= st + 1 ? Math.max(m, r.bottom - gr.top + 24) : m; }, 0);
      const top = Math.max(stk, f.top - gr.top + g.scrollTop), bot = Math.min(ch, l.bottom - gr.top + g.scrollTop), h = Math.max(30, bot - top);
      t.style.left = (g.offsetLeft + g.offsetWidth - 23) + 'px'; t.style.top = (g.offsetTop + top) + 'px'; t.style.height = h + 'px';
      const th = Math.max(20, h * ch / sh); t.firstChild.style.height = th + 'px';
      // Rebond : le curseur raccourcit d'autant que le dépassement, sans sortir de sa barre.
      const mx = sh - ch, st = g.scrollTop, ov = st < 0 ? -st : st > mx ? st - mx : 0, tk = Math.max(8, th - ov);
      t.firstChild.style.height = tk + 'px';
      t.firstChild.style.transform = `translateY(${st <= 0 ? 0 : st >= mx ? h - tk : (st / mx) * (h - th)}px)`;
    };
    // Lot 358 : barre visible seulement pendant le défilement.
    let hid = 0; g.addEventListener('scroll', () => { upd(); t.classList.add('on'); clearTimeout(hid); hid = setTimeout(() => t.classList.remove('on'), 700); }, { passive: true });
    // Lot 105.10 : mesure dynamique ; la barre se recalcule dès qu'une carte, un groupe ou la colonne change de taille.
    let raf = 0; const sch = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; upd(); }); };
    const ro = new ResizeObserver(sch), obs = () => { ro.disconnect(); ro.observe(g); [...g.children, ...$$('.group, tr[data-id]', g)].forEach(e => ro.observe(e)); };
    new MutationObserver(() => { obs(); sch(); }).observe(g, { childList: true, subtree: true });
    obs(); upd();
  });
}

// Lot 80 : vue mobile, bouton d'action rapide sur la carte (main = prendre ; neutre = actions de l'intervention).
let ME = null;
const TECHR = () => ['technicien', 'responsable_tech'].includes(role());
const isMine = r => r.assignee_id === ME && (!isRealAdmin() || r.assignee_role === role());
const canTake = r => TECHR() && r.status === 'publiee' && !r.assignee_id && (!r.proposed_to || r.proposed_to === ME || (isRealAdmin() && (state.members || []).find(x => x.user_id === r.proposed_to)?.role === role()));
const qActs = r => { // Lot 132 : toutes les options de l'intervention, par appui long sur la carte.
  if (!r || role() === 'client') return [];
  const a = [], mgr = isManager(), mine = isMine(r), author = r.created_by === ME, R = role(), closed = isDone(r);
  if (r.status === 'brouillon' && (mgr || (['reception', 'technicien'].includes(R) && author))) a.push(['publier', 'Publier', 'primary']);
  if (canTake(r)) a.push(['prendre', 'Prendre l\'intervention', 'primary']);
  if (r.status === 'prise_en_charge') {
    if (mine || ['directeur', 'responsable_tech'].includes(R)) a.push(['resoudre', 'Terminer l\'intervention', 'primary']);
    if (mine) a.push(['liberer', 'Ne plus prendre l\'intervention', 'ghost']);
    if (TECHR() && r.assignee_id && !mine) a.push(['demander', 'Demander l\'intervention', 'ghost']);
  }
  if (closed && (mgr || mine)) a.push(['renvoyer', 'Renvoyer active', 'ghost']);
  if ((author || (!!r.available_from && (r.proposed_to === ME || mgr || isRealAdmin()))) && ['brouillon', 'publiee'].includes(r.status) && !r.assignee_id) a.push(['modifier', 'Modifier l\'intervention', 'ghost']);
  if (mgr) a.push(['supprimer', 'Supprimer l\'intervention', 'ghost danger']);
  return a;
};
const ROWS = new Map();
function qa(r) { ROWS.set(r.id, r); return ''; } // Lot 132 : plus de main ni de clé.
const qRun = async (id, a, quiet) => {
  if (a === 'modifier') return lockedByOther(id) ? undefined : go('intervention/' + id + '/modifier');
  if (a === 'supprimer') {
    if (!(await confirmBox('Voulez-vous vraiment supprimer cette intervention ?', 'Supprimer'))) return;
    const { data: ph } = await sb.from('intervention_photos').select('path').eq('intervention_id', id);
    if (ph?.length) await sb.storage.from('photos').remove(ph.map(p => p.path));
    const { error } = await sb.from('interventions').delete().eq('id', id);
    if (error) return toast(errMsg(error), true);
    toast('Intervention supprimée.'); return render();
  }
  const { error } = a === 'demander' ? await sb.rpc('request_transfer', { p_id: id }) : await sb.rpc('transition', { p_id: id, p_action: a, p_comment: '' });
  if (error) return toast(errMsg(error), true);
  // Lot 111 : « Intervention terminée » animée aussi depuis les étiquettes de la carte.
  if (a === 'resoudre') return (await import('./detail.js?v=20261123193833')).doneScreen('Intervention terminée', render);
  if (!quiet && a !== 'prendre') toast(ACTMSG(a)); render(); // Lot 116 : prise par appui long sans message.
};
function qaInit() { // Lot 132 : appui long sur toute la carte (vue mobile, réelle et simulée).
  if (role() === 'client') return; // Lot 225 : pas d'actions sur les cartes pour le client.
  if (!document.body.classList.contains('tech')) return;
  $$('#rows tr[data-id]').forEach(tr => {
    const id = tr.dataset.id; if (!qActs(ROWS.get(id)).length) return;
    let tm = null, ctl = null, x0 = 0, y0 = 0, fired = false;
    const stop = () => { clearTimeout(tm); tm = null; tr.classList.remove('press'); };
    tr.addEventListener('pointerdown', e => { fired = false; x0 = e.clientX; y0 = e.clientY; tr.classList.add('press'); clearTimeout(tm); tm = setTimeout(() => { tm = null; tr.classList.remove('press'); fired = true; try { tr.setPointerCapture(e.pointerId); } catch {} ctl = qTags(tr, id); }, 450); });
    tr.addEventListener('pointermove', e => { if (tm && Math.hypot(e.clientX - x0, e.clientY - y0) > 8) stop(); if (ctl) ctl.move(e.clientX, e.clientY); });
    tr.addEventListener('pointerup', e => { stop(); if (ctl) { const c = ctl; ctl = null; c.up(e.clientX, e.clientY); } });
    tr.addEventListener('pointercancel', () => { stop(); if (ctl) { ctl.up(-1, -1); ctl = null; } });
    tr.addEventListener('click', e => { if (fired) { fired = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    tr.addEventListener('contextmenu', e => e.preventDefault());
  });
}

const cellBox = tr => { const q = [...tr.children].map(x => x.getBoundingClientRect()).filter(x => x.height); return { left: Math.min(...q.map(x => x.left)), top: Math.min(...q.map(x => x.top)), bottom: Math.max(...q.map(x => x.bottom)), width: Math.max(...q.map(x => x.right)) - Math.min(...q.map(x => x.left)) }; };
function qTags(b, id, o = {}) {
  const tr = b.closest('tr');
  navigator.vibrate?.(10);
  const c = document.createElement('div'); c.className = 'qcatch qgrey'; document.body.append(c);
  const cl = cloneAt(tr, c, tr.getBoundingClientRect());
  const t = document.createElement('div'); t.className = 'qtags';
  { const bt = (o.items || qActs(ROWS.get(id))).map(([a, l, k]) => `<button class="${k}" data-a="${a}"${a === 'modifier' && lockedByOther(id) ? ' disabled' : ''}>${l}</button>`).join(''); t.innerHTML = o.q ? `<span class="qq">${o.q}</span>${bt}` : bt; if (o.q) t.classList.add('qline'); }
  document.body.append(t);
  // Position calculée sur la copie réellement affichée (identique en mobile réel et simulé).
  const r = cellBox(cl.querySelector('tr'));
  if (o.q && !document.body.classList.contains('tech')) t.style.width = r.width + 'px'; // Lot 97 : question + Oui/Non dans un seul bouton long, largeur de la carte.
  const h = t.offsetHeight, up = r.bottom + 8 + h > innerHeight - 8;
  t.style.left = Math.max(8, Math.min(r.left, innerWidth - t.offsetWidth - 8)) + 'px';
  t.style.top = (up ? Math.max(8, r.top - 8 - h) : r.bottom + 8) + 'px';
  if (up) t.classList.add('up');
  requestAnimationFrame(() => { c.classList.add('in'); t.classList.add('in'); });
  const at = (x, y) => $$('button', t).find(k => { const q = k.getBoundingClientRect(); return x >= q.left - 6 && x <= q.right + 6 && y >= q.top - 4 && y <= q.bottom + 4; });
  let shut = false, moved = false, x0 = null;
  const sw = e => { e.preventDefault(); e.stopPropagation(); };
  const out = e => { if (!t.contains(e.target)) { sw(e); close(); } };
  const close = () => {
    if (shut) return; shut = true;
    t.classList.remove('in'); t.style.pointerEvents = 'none'; setTimeout(() => t.remove(), 160);
    // Le voile reste un instant (transparent) pour absorber la fin du tap : rien dessous n'est touché ni sélectionné.
    cl.remove(); c.classList.remove('in');
    removeEventListener('scroll', close, true); ['pointerdown', 'touchstart', 'mousedown'].forEach(k => document.removeEventListener(k, out, true));
    const ev = ['click', 'mouseup', 'touchend', 'contextmenu', 'selectstart'];
    ev.forEach(k => document.addEventListener(k, sw, { capture: true, passive: false }));
    setTimeout(() => { c.remove(); ev.forEach(k => document.removeEventListener(k, sw, true)); getSelection?.().removeAllRanges(); }, 450);
  };
  const run = async a => { if (a === 'modifier' && !o.items && lockedByOther(id)) return; close(); if (o.pick) return o.pick(a); if (a === 'liberer' && !(await confirmBox('Se retirer de l\'intervention ?', 'Oui', { cancel: 'Non' }))) return; qRun(id, a); };
  let tapped = false;
  t.addEventListener('pointerdown', e => { tapped = true; if (!e.target.closest('button')) e.preventDefault(); });
  t.addEventListener('touchstart', () => { tapped = true; }, { passive: true });
  // Lot 83 : activation au relâcher du doigt (le click n'arrive pas toujours sur iOS après l'appui long).
  t.onclick = e => { if (!moved && !tapped) return; const k = e.target.closest('button'); if (k && !shut) run(k.dataset.a); };
  const t0 = Date.now();
  t.addEventListener('pointerup', e => { if (Date.now() - t0 < 400 && !moved) return; const k = e.target.closest('button') || at(e.clientX, e.clientY); if (k && !shut) { e.preventDefault(); run(k.dataset.a); } });
  t.addEventListener('touchend', e => { if (!moved && !tapped) return; const p = e.changedTouches[0], k = p && at(p.clientX, p.clientY); if (k && !shut) { e.preventDefault(); run(k.dataset.a); } }, { passive: false });
  setTimeout(() => { if (shut) return; addEventListener('scroll', close, true); ['pointerdown', 'touchstart', 'mousedown'].forEach(k => document.addEventListener(k, out, { capture: true, passive: false })); }, 50);
  return {
    move: (x, y) => { if (x0 == null) x0 = [x, y]; else if (Math.hypot(x - x0[0], y - x0[1]) > 14) moved = true; const k = moved ? at(x, y) : null; $$('button', t).forEach(z => z.classList.toggle('hot', z === k)); },
    // Lot 160 : relâcher sans avoir glissé ne déclenche rien (évite une clôture involontaire après l'appui long).
    up: (x, y) => { $$('button', t).forEach(z => z.classList.remove('hot')); const k = at(x, y); if (k && moved) run(k.dataset.a); },
  };
}

function cloneAt(tr, par, r) {
  const tb = document.createElement('table'); tb.className = 'list qclone';
  tb.innerHTML = '<tbody></tbody>'; tb.firstChild.appendChild(tr.cloneNode(true));
  Object.assign(tb.style, { left: r.left + 'px', top: r.top + 'px' }); tb.style.setProperty('width', r.width + 'px', 'important'); // Lot 154 : la largeur mobile des listes (!important) ne s'applique plus à la copie : carte centrée.
  par.appendChild(tb);
  const cr = tb.querySelector('tr').getBoundingClientRect();
  tb.style.left = (2 * r.left - cr.left) + 'px'; tb.style.top = (2 * r.top - cr.top) + 'px'; tb.style.setProperty('width', (r.width + tb.offsetWidth - cr.width) + 'px', 'important');
  return tb;
}

document.addEventListener('click', e => { const a = e.target.closest?.('a[href="#/nouvelle"]'); const app = document.getElementById('app'); if (!a || !app?.querySelector('#rows') || a.closest('.nwin')) return; e.preventDefault(); newWin(app); });
async function newWin(app) {
  const c = document.createElement('div'); c.className = 'qcatch qgrey nwin';
  const w = document.createElement('div'); w.className = 'nwbox'; c.append(w); app.append(c);
  const close = () => { c.remove(); sessionStorage.removeItem('gi:nwlost'); document.documentElement.classList.remove('nwlock'); removeEventListener('hashchange', close); };
  // Lot 125.1 : arrière-plan verrouillé tant que la fenêtre est ouverte (plus de défilement ni de glissement latéral de la page sur iPhone/iPad).
  document.documentElement.classList.add('nwlock');
  c.addEventListener('touchmove', e => { for (let el = e.target; el && el !== c; el = el.parentElement) { const cs = getComputedStyle(el), o = cs.overflowY, ox = cs.overflowX; if ((o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight + 1) return; if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1) return; } e.preventDefault(); }, { passive: false });
  // Lot 89 : fermeture sans rechargement ; après enregistrement, liste mise à jour en arrière-plan.
  c._done = changed => { close(); if (changed && LASTF && $('#rows')) load(...LASTF); };
  addEventListener('hashchange', close);
  c.addEventListener('click', e => { if (e.target.closest('a[href="#/"]')) { // Lot 125.2 : un appui hors du formulaire ne le ferme plus.
  e.preventDefault(); close(); } });
  await form.view(w, {});
  // Lot 125 : fenêtre ancrée par le haut (position figée à l'ouverture) : un changement de hauteur du contenu ne la fait plus sauter.
  const cs = getComputedStyle(c), pt = parseFloat(cs.paddingTop), pb = parseFloat(cs.paddingBottom), mt = document.body.classList.contains('tech') ? 0 : Math.max(0, (c.clientHeight - pt - pb - w.offsetHeight) / 2); /* Lot 134 : en mobile, ancrée en haut pour garder toute la hauteur */
  // Lot 140.11 : en mobile, fenêtre posée en bas de l'écran ; elle grandit vers le haut au fil du contenu (près du pouce).
  const mob = document.body.classList.contains('tech');
  c.style.alignItems = mob ? 'flex-end' : 'flex-start'; w.style.marginTop = mt + 'px'; w.style.maxHeight = (c.clientHeight - pt - pb - mt) + 'px'; if (mob) w.style.transformOrigin = '50% 100%';
  // Clavier ouvert : la fenêtre remonte au-dessus de la partie masquée (sinon, posée en bas, elle passerait sous le clavier).
  const vv = window.visualViewport; if (mob && vv) { const H0 = c.clientHeight - pt - pb - mt, kb = () => { if (!c.isConnected) { vv.removeEventListener('resize', kb); vv.removeEventListener('scroll', kb); return; } c.style.paddingBottom = ''; const k = Math.max(0, Math.round(c.getBoundingClientRect().bottom - (vv.offsetTop + vv.height))); c.style.paddingBottom = k ? (pb + k) + 'px' : ''; w.style.maxHeight = Math.max(160, H0 - k) + 'px'; }; vv.addEventListener('resize', kb); vv.addEventListener('scroll', kb); }
  requestAnimationFrame(() => c.classList.add('in'));
}

// Lot 256 (FA 722) : icônes photo et bulle à la suite du titre (dans .nw, insécables avec le dernier mot).
// Lot 107 : l'en-tête de la carte (appareil photo, bulle) se met à jour dès l'envoi d'un message ou d'une photo.
addEventListener('gi:bump', ({ detail: { id, n, ph } }) => {
  const tl = document.querySelector(`tr[data-id="${id}"] .tl`); TOT[id] = (TOT[id] || 0) + (n || 1); if (ph) PHI.add(id); if (!tl) return;
  const ic = tl.closest('tr').querySelector('.ico2'); if (!ic) return;
  if (ph && !ic.querySelector('.tcam')) ic.insertAdjacentHTML('afterbegin', CAMI);
  const td = tl.closest('td'), old = td.querySelector('.cbub'), h = chatIco(id); // Lot 372 : pastille au coin haut droit de la carte.
  if (old) old.outerHTML = h; else td.insertAdjacentHTML('afterbegin', h);
});
// Lot 137 : tchat ouvert = messages lus, la pastille rouge de la carte se met à jour aussitôt (liste affichée et liste mémorisée du mobile).
addEventListener('gi:read', ({ detail: { id } }) => {
  delete UNR[id];
  const fix = root => root.querySelectorAll(`tr[data-id="${id}"] .cbub`).forEach(b => (b.outerHTML = chatIco(id)));
  fix(document);
  for (const k in MCACHE) if (MCACHE[k]) { const d = document.createElement('div'); d.innerHTML = MCACHE[k]; fix(d); MCACHE[k] = d.innerHTML; }
});

// Lot 224 : en vue mobile (réelle et simulée), le bouton « + Nouvelle intervention » est rendu hors de la zone qui défile
// (copie directement sous <body>), pour rester fixe à 16 px au-dessus du pied de page, y compris pendant le glissement
// (Safari iOS déplace les éléments fixes placés dans un conteneur qui défile). L'original reste dans l'en-tête, masqué.
// Lot 226 : cause du 707 : la copie vivait dans un enveloppeur « display: contents » recréé au fil des rendus, et sa hauteur
// dépendait de --bnt, recalculée par JS depuis innerHeight (qui change quand la barre de Safari iOS se replie pendant le défilement).
// Désormais : un seul élément fixe, enfant direct de <body>, créé une fois, simplement affiché ou masqué ; hauteur en CSS pur.
{ let fp = null, f2 = null;
  // Lot 278 : rond noir déplaçable au doigt, aimanté au bord gauche/droit le plus proche, borné entre le menu du haut et le footer.
  const box2 = el => { const bn = document.getElementById('bnav'), tp = document.getElementById('top'), w = el.offsetWidth || 52, h = el.offsetHeight || 52, br = bn && !bn.hidden ? bn.getBoundingClientRect() : null, tr = tp && !tp.hidden ? tp.getBoundingClientRect() : null, l = br && br.width ? br.left : 0, r = br && br.width ? br.right : innerWidth;
    const fn = document.getElementById('fabn'), fr = fn && !fn.hidden ? fn.getBoundingClientRect() : null;
    return { x0: l + 4, x1: r - 4 - w, y0: (tr && tr.height ? tr.bottom : 0) + 12, y1: (br && br.height ? br.top : innerHeight) - 12 - h, yf: fr && fr.height ? fr.top - 12 - h : null }; };
  const put2 = (el, x, y) => { const b = box2(el); el.style.setProperty('left', Math.min(Math.max(x, b.x0), b.x1) + 'px', 'important'); const cx = Math.min(Math.max(x, b.x0), b.x1), yM = b.yf != null && cx > (b.x0 + b.x1) / 2 ? Math.min(b.y1, b.yf) : b.y1; el.style.setProperty('top', Math.min(Math.max(y, b.y0), yM) + 'px', 'important'); el.style.setProperty('right', 'auto', 'important'); el.style.setProperty('bottom', 'auto', 'important'); };
  const snap2 = el => { let p; try { p = JSON.parse(localStorage.getItem('gi_fab2') || 'null'); } catch (e) {} if (!p) return; const b = box2(el); put2(el, p.s === 'l' ? b.x0 : b.x1, b.y0 + p.y * Math.max(0, b.y1 - b.y0)); };
  const drag2 = el => { let st = null, mv = false; el.style.touchAction = 'none';
    el.addEventListener('pointerdown', e => { const r = el.getBoundingClientRect(); st = { x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top }; mv = false; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => { if (!st) return; if (!mv && Math.hypot(e.clientX - st.x, e.clientY - st.y) < 6) return; mv = true; el.style.transition = 'none'; put2(el, e.clientX - st.dx, e.clientY - st.dy); });
    const end = () => { if (!st) return; st = null; if (!mv) return; const b = box2(el), r = el.getBoundingClientRect(), left = r.left + r.width / 2 < (b.x0 + b.x1 + r.width) / 2; el.style.transition = 'left .25s cubic-bezier(.2,.8,.2,1), top .25s cubic-bezier(.2,.8,.2,1)'; put2(el, left ? b.x0 : b.x1, r.top);
      const y = (Math.min(Math.max(r.top, b.y0), b.y1) - b.y0) / Math.max(1, b.y1 - b.y0); try { localStorage.setItem('gi_fab2', JSON.stringify({ s: left ? 'l' : 'r', y })); } catch (e) {} el.addEventListener('click', ev => { ev.stopImmediatePropagation(); ev.preventDefault(); }, { capture: true, once: true }); setTimeout(() => { mv = false; }, 0); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    addEventListener('resize', () => { if (!el.hidden) snap2(el); }); };
  const sync = () => {
    const a = document.body.classList.contains('tech') && document.querySelector('#app .page > .head:not(.hcli) > a.btn.primary[href="#/nouvelle"]');
    if (a) a.style.setProperty('display', 'none', 'important');
    if (!fp) { fp = document.createElement('a'); fp.id = 'fabn'; fp.className = 'btn primary'; fp.href = '#/nouvelle'; fp.setAttribute('aria-label', 'Nouvelle intervention'); fp.hidden = true; }
    if (fp.parentNode !== document.body) document.body.append(fp);
    if (fp.hidden !== !a) fp.hidden = !a; if (!f2) { f2 = document.createElement('a'); f2.id = 'fab2'; f2.className = 'btn primary'; f2.href = '#/'; f2.setAttribute('aria-label', 'Action'); f2.addEventListener('click', e => e.preventDefault()); drag2(f2); } if (f2.parentNode !== document.body) document.body.append(f2); if (f2.hidden !== !a) { f2.hidden = !a; if (a) requestAnimationFrame(() => snap2(f2)); }
  };
  let q = false; const kick = () => { if (q) return; q = true; queueMicrotask(() => { q = false; sync(); }); };
  const go2 = () => { const app = document.getElementById('app'); if (!app) return setTimeout(go2, 50); new MutationObserver(kick).observe(app, { childList: true, subtree: true }); new MutationObserver(kick).observe(document.body, { attributes: true, attributeFilter: ['class'] }); sync(); };
  go2(); }
