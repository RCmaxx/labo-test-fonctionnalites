import { sb } from './sb.js?v=20261123155224';
import { state, loadMember, role, isRealAdmin, isAdmin, ROLE_NAMES, PNAME, memberName } from './state.js?v=20261123155224';
import { $, esc, toast, errMsg, ROLES, avatar, confirmBox } from './ui.js?v=20261123155224';
import * as auth from './views/auth.js?v=20261123155224';
import * as list from './views/list.js?v=20261123155224';
import * as detail from './views/detail.js?v=20261123155224';
import * as form from './views/form.js?v=20261123155224';
import * as settings from './views/settings.js?v=20261123155224';
import { startRealtime, stopRealtime } from './rt.js?v=20261123155224';

const app = $('#app');
const PHONE = matchMedia('(max-width: 600px)');
const top = $('#top');

// Routes publiques (sans session) et privées (avec entreprise).
const PUBLIC = {
  connexion: auth.login,
  inscription: auth.signup,
  'mot-de-passe': auth.forgot,
  invitation: auth.invitation,
};

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(qs || '') };
}

export function go(path) {
  if (location.hash === '#/' + path) render();
  else location.hash = '#/' + path;
}

const initials = n => String(n || '').replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

function header() {
  // Sélecteur : admin, ou admin passé sur un compte de test réel (Tech bis / Client) pour pouvoir revenir.
  const REAL = { bis: ['tech.bis@test.local', 'Antoine'], cli: ['client@test.local', 'Client'] };
  const onReal = !!state.member && !!localStorage.getItem(ADM) && Object.keys(REAL).find(k => REAL[k][0] === state.user?.email);
  // Vue mobile : admin en RT/Directeur mobile, ou compte Client avec le drapeau MOB.
  const mob = !!state.member && localStorage.getItem(MOB) === role() && (isRealAdmin() || role() === 'client');
  if (state.member && !mob) localStorage.removeItem(MOB);
  // Vrai mobile (≤ 600 px) = même affichage que le mobile simulé sur iPad, pour tous les rôles (lot 89).
  document.body.classList.toggle('tech', !!state.member && (role() === 'technicien' || mob || PHONE.matches));
  if (!state.member) { top.hidden = true; const bn = document.getElementById('bnav'); if (bn) bn.hidden = true; return; }
  top.hidden = false;
  const r = role();
  const cur = parseHash().parts[0] || '';
  const onBis = !!onReal;
  if (!isRealAdmin() && !onBis) localStorage.removeItem(ADM);
  const pick = isRealAdmin() || onBis;
  const dispName = isRealAdmin() ? PNAME[r] : (state.member.full_name || state.member.email);
  const avName = mob && r === 'client' ? 'Client mobile' : r === 'client' ? 'Client' : dispName;
  const q = parseHash().q;
  const searching = r !== 'client' && ['', 'interventions'].includes(cur) && q.has('recherche');
  const I = {
    list: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    done: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 9.8"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  };
  const ico = k => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;
  // Barre de navigation du bas (toutes les pages) : icônes à la place des noms.
  let bn = document.getElementById('bnav');
  if (!bn) { bn = document.createElement('nav'); bn.id = 'bnav'; app.after(bn); }
  const tech = document.body.classList.contains('tech');
  bn.hidden = !tech;
  bn.innerHTML = !tech ? '' : `
    <a href="#/" aria-label="Interventions" class="${['', 'interventions', 'intervention', 'nouvelle'].includes(cur) ? 'on' : ''}">${ico('list')}</a>
    ${r === 'client' ? '' : (() => { let nb = {}; try { nb = JSON.parse(localStorage.getItem('gi_nb') || '{}'); } catch (e) {} return `<a href="#/nouvelles" aria-label="Nouvelles interventions" class="${cur === 'nouvelles' ? 'on' : ''}"><span class="bpill bpn">${nb.n ?? ''}</span></a>`; })()}
    ${isRealAdmin() ? `<a href="#/parametres" aria-label="Profils" class="${['parametres', 'equipe'].includes(cur) ? 'on' : ''}">${ico('gear')}</a>` : ''}`;
  // Lot 177 : indicateur animé qui glisse vers l'onglet actif.
  if (tech) {
    const on = bn.querySelector('a.on'), pos = window.__bpos;
    if (on) {
      const ind = document.createElement('i'); ind.className = 'bind'; bn.prepend(ind);
      const set = o => { ind.style.left = o.left + 'px'; ind.style.width = o.width + 'px'; };
      const now = { left: on.offsetLeft, width: on.offsetWidth };
      if (pos) { set(pos); ind.getBoundingClientRect(); requestAnimationFrame(() => { ind.style.transition = 'left .28s cubic-bezier(.3,.8,.3,1), width .28s cubic-bezier(.3,.8,.3,1)'; set(now); }); } else set(now);
      window.__bpos = now;
    }
  }
  top.innerHTML = `
    <div class="bar">
      ${tech ? `<span class="ptit">${({ nouvelles: 'Interventions', encours: 'En cours', planifiees: 'Planifiées', terminees: 'Terminées', routines: 'Routines', parametres: 'Profils', equipe: 'Profils', nouvelle: 'Nouvelle intervention', intervention: 'Intervention' })[cur] || 'Interventions'}</span><span class="pcnt">${['nouvelles', 'encours', 'planifiees'].includes(cur) ? (window.__pcnt || '') : ''}</span>${['nouvelles', 'encours'].includes(cur) ? '' : `<button type="button" class="burg" aria-label="Compte" aria-expanded="false"><span class="av" aria-hidden="true" style="background:${avatar(avName, undefined, r).bg}">${avatar(avName, undefined, r).e}</span></button>`}<div class="tmenu">` : ''}
      <span class="brand">Labo</span>
      ${tech ? '' : `<nav>
        <a href="#/" class="${!searching && ['', 'interventions', 'intervention', 'nouvelle'].includes(cur) ? 'on' : ''}">Interventions</a>
        ${r === 'client' ? '' : `<a href="#/terminees" class="${cur === 'terminees' ? 'on' : ''}">Terminées</a>`}
        ${r === 'client' ? '' : `<a href="#/routines" class="${cur === 'routines' ? 'on' : ''}">Routines</a>`}
        ${isRealAdmin() ? `<a href="#/parametres" class="${['parametres', 'equipe'].includes(cur) ? 'on' : ''}">Profils</a>` : ''}
        ${r === 'client' ? '' : `<a href="#/interventions?recherche=1" class="ico${searching ? ' on' : ''}" aria-label="Rechercher">${ico('search')}</a>`}
      </nav>`}
      <div class="who">
        <div class="acct${pick ? ' pick' : ''}">
          <span class="av" aria-hidden="true" style="background:${avatar(avName, undefined, r).bg}">${avatar(avName, undefined, r).e}</span>
          <span class="acc-t"><b>${esc(dispName)}</b>${pick ? '' : `<i>${ROLES[r]}</i>`}</span>
          ${pick ? `<svg class="chev" width="10" height="10" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <select id="asrole" aria-label="Voir en tant que">${Object.entries(ROLE_NAMES).filter(([k]) => k !== 'client').map(([k, v]) => `<option value="${k}" ${!onBis && !mob && k === r ? 'selected' : ''}>${avatar(PNAME[k], undefined, k).e} ${PNAME[k]} · ${v}</option>`).join('')}<option value="responsable_tech|m" ${mob && r === 'responsable_tech' ? 'selected' : ''}>${avatar(PNAME.responsable_tech).e} ${PNAME.responsable_tech} · RT mobile</option><option value="directeur|m" ${mob && r === 'directeur' ? 'selected' : ''}>${avatar(PNAME.directeur, undefined, 'directeur').e} ${PNAME.directeur} · Directeur mobile</option><option value="bis" ${onReal === 'bis' ? 'selected' : ''}>${avatar('Antoine').e} Antoine · Tech</option><option value="cli|m" ${onReal === 'cli' && mob ? 'selected' : ''}>${avatar('Client mobile').e} Client mobile</option></select>` : ''}
        </div>
        <button class="ghost" id="logout">Déconnexion</button>
      </div>${tech ? '</div>' : ''}
    </div>`;
  // Lot 365 : mobile, camping + profil + déconnexion dans le menu du compte ; titre de page en haut. Lot 367 (FA 766) : l'avatar ouvre ce menu (plus de symbole burger).
  { const bg = top.querySelector('.burg'); if (bg) bg.onclick = e => { e.stopPropagation(); const o = top.classList.toggle('mopen'); bg.setAttribute('aria-expanded', String(o)); }; if (!window.__mclose) { window.__mclose = 1; document.addEventListener('click', e => { const t = document.getElementById('top'); if (t?.classList.contains('mopen') && !e.target.closest('.tmenu')) { t.classList.remove('mopen'); t.querySelector('.burg')?.setAttribute('aria-expanded', 'false'); } }); } }
  $('#logout').onclick = async () => { localStorage.removeItem(ADM); localStorage.removeItem(MOB); localStorage.removeItem(ACT); await sb.auth.signOut(); go('connexion'); };
  // Retour au compte admin enregistré avant le passage sur un compte de test réel.
  const backToAdmin = async () => {
    const { data, error } = await sb.auth.setSession(JSON.parse(localStorage.getItem(ADM)));
    localStorage.removeItem(ADM);
    if (error) { toast('Session admin expirée : reconnectez-vous.', true); await sb.auth.signOut(); go('connexion'); return false; }
    await refreshSession(data.session);
    return true;
  };
  const sel = $('#asrole');
  if (sel) sel.onchange = async () => {
    sel.disabled = true;
    const [rk, rm] = sel.value.split('|');
    if (REAL[rk]) {
      const [em, nm] = REAL[rk];
      if (state.user?.email !== em) {
        if (onBis && !(await backToAdmin())) return; // compte de test → autre compte de test : on repasse par l'admin
        const cur = (await sb.auth.getSession()).data.session;
        if (cur && isRealAdmin()) localStorage.setItem(ADM, JSON.stringify({ access_token: cur.access_token, refresh_token: cur.refresh_token }));
        // Lot 291 : aucun mot de passe côté client. La fonction serveur as-test-user vérifie que l'appelant
        // est un administrateur réel et renvoie un jeton de lien magique pour le compte de test (liste blanche).
        const back = async msg => { toast(msg, true); sel.disabled = false; render(); };
        if (!cur || !isRealAdmin()) return back('Réservé aux administrateurs.');
        const { data: fx, error: fe } = await sb.functions.invoke('as-test-user', { body: { email: em } });
        if (fe || !fx?.token_hash) {
          let m = fx?.error; try { m = m || (await fe?.context?.json())?.error; } catch { /* réponse sans JSON */ }
          localStorage.removeItem(ADM);
          return back(m || `Connexion au compte ${nm} impossible.`);
        }
        const { data: vo, error: ve } = await sb.auth.verifyOtp({ token_hash: fx.token_hash, type: 'magiclink' });
        if (ve || !vo?.session) {
          // Échange refusé : la session admin reste en place, on recharge simplement le compte connecté.
          const { data: s2 } = await sb.auth.getSession();
          localStorage.removeItem(ADM);
          await refreshSession(s2.session);
          return back(errMsg(ve) || `Connexion au compte ${nm} impossible.`);
        }
        await refreshSession(vo.session);
      }
      if (rm) localStorage.setItem(MOB, 'client'); else localStorage.removeItem(MOB);
      toast(rm ? 'Connecté en tant que Client mobile.' : `Connecté en tant que ${nm}.`);
      window.__gopen = 0; // Lot 207 : passage en mobile simulé → « Nouvelles interventions ».
      go('');
      return render();
    }
    if (onBis && !(await backToAdmin())) return;
    const [pr, pm] = sel.value.split('|');
    if (pm) localStorage.setItem(MOB, pr); else localStorage.removeItem(MOB);
    const { error } = await sb.rpc('set_acting_role', { p_role: pr });
    if (error) {
      // Profil affiché désynchronisé de la session : on recharge le compte réellement connecté.
      const { data } = await sb.auth.getSession();
      await refreshSession(data.session);
      toast(errMsg(error), true);
      return render();
    }
    localStorage.setItem(ACT, pr);
    await loadMember();
    toast(pr === 'admin' ? 'Vous êtes de nouveau administrateur.' : `Vous voyez l'appli en tant que ${pm ? sel.selectedOptions[0].text : ROLE_NAMES[pr]}.`);
    window.__gopen = 0; // Lot 207 : passage en mobile simulé → « Nouvelles interventions ».
    render();
  };
}

const ADM = 'gi-admin-sess', MOB = 'gi-mobile-role', ACT = 'gi-acting-role';
// Lot 293 : le rôle simulé (members.acting_role) est stocké côté serveur, donc partagé par tous les appareils
// et onglets du même compte admin. Le choix fait sur CET appareil est mémorisé localement et réimposé à chaque
// (re)chargement de session : un changement fait ailleurs (autre appareil, tests) ne ressort plus au rechargement.
async function syncActing() {
  if (!isRealAdmin()) return;
  const want = localStorage.getItem(ACT), cur = state.member.acting_role || 'admin';
  if (!want) { localStorage.setItem(ACT, cur); return; }
  if (want === cur) return;
  const { error } = await sb.rpc('set_acting_role', { p_role: want });
  if (error) { localStorage.setItem(ACT, cur); return; }
  await loadMember();
}
let rendering = 0;
export async function render() {
  const n = ++rendering;
  const { parts, q } = parseHash();
  const key = parts[0] || '';
  if (state.recovery) { top.hidden = true; return auth.newPassword(app); }

  if (!state.user) {
    top.hidden = true;
    const view = PUBLIC[key] || auth.login;
    if (!PUBLIC[key] && key) history.replaceState(null, '', '#/connexion');
    return view(app, { q });
  }
  if (!state.member) {
    window.__gopen = 0;
    top.hidden = true;
    if (key === 'invitation' || sessionStorage.getItem('invite')) return auth.invitation(app, { q });
    return auth.onboarding(app);
  }
  header();
  // Lot 206 : mobile (vrai et simulé) : chaque ouverture de l'app (démarrage, connexion, retour) arrive sur « Nouvelles interventions ».
  if (!window.__gopen && role() !== 'client' && document.body.classList.contains('tech')) { window.__gopen = 1; if (key !== 'nouvelles' && key !== 'invitation' && !(key === 'intervention' && parts[1])) return go('nouvelles'); }
  if (n !== rendering) return;
  try {
    if (key === '' || key === 'interventions') return await list.view(app, { q });
    if (key === 'planifiees') return go('nouvelles'); // Lot 279 : page Planifiées retirée.
    if (key === 'nouvelles' || key === 'encours') { if (role() === 'client') return go(''); return await list.view(app, { q, page: key }); }
    if (key === 'terminees') { if (role() === 'client') return go(''); return await list.view(app, { q, done: true }); }
    if (key === 'nouvelle') return await form.view(app, {});
    if (key === 'intervention' && role() === 'client') return go(''); // Lot 225 : le client n'a accès qu'à sa page.
    if (key === 'intervention' && parts[2] === 'modifier') return await form.view(app, { id: parts[1] });
    if (key === 'intervention') return await detail.view(app, { id: parts[1] });
    if (key === 'equipe') return go('parametres');
    if (key === 'parametres') return await settings.view(app);
    if (key === 'routines') { if (role() === 'client') return go(''); app.innerHTML = '<div class="page"><div class="head"><h1>Routines</h1></div></div>'; return; }
    if (key === 'invitation') { sessionStorage.removeItem('invite'); return go(''); }
    if (PUBLIC[key]) return go('');
    app.innerHTML = '<p class="pad muted">Page introuvable.</p>';
  } catch (e) {
    app.innerHTML = `<p class="pad err">${esc(errMsg(e))}</p>`;
  }
}

async function refreshSession(session) {
  state.session = session;
  state.user = session?.user || null;
  await loadMember();
  await syncActing();
  // Création différée de l'entreprise (inscription avec confirmation e-mail).
  if (state.user && !state.member && !sessionStorage.getItem('invite')) {
    const md = state.user.user_metadata || {};
    if (md.org_name && !md.invite) {
      const { error } = await sb.rpc('create_organization', { p_name: md.org_name, p_full_name: md.full_name || '' });
      if (!error) await loadMember();
    }
  }
  // Lot 225 : un seul canal temps réel par client connecté (transferts, interventions, messages, photos).
  if (state.user && state.member) { startRealtime({ transfers: checkTransfers, reminders: loadReminders }); loadReminders(); } else stopRealtime();
}

sb.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') state.recovery = true;
  if (event === 'SIGNED_IN' && session?.user?.id === state.user?.id) return;
  if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
    // Hors du callback (recommandation supabase-js : pas d'await ici).
    setTimeout(async () => { await refreshSession(session); render(); }, 0);
  }
});

window.addEventListener('hashchange', render);
PHONE.addEventListener('change', () => render());

// Glissement depuis le bord gauche = retour : la page suit le doigt, l'écran précédent apparaît dessous.
const SNAP = {}, STACK = [location.hash || '#/'];
window.addEventListener('hashchange', e => {
  const old = '#' + (e.oldURL.split('#')[1] || '/'), cur = location.hash || '#/';
  SNAP[old] = app.innerHTML;
  if (STACK[STACK.length - 2] === cur) STACK.pop(); else STACK.push(cur);
});
let sw = null, under = null, raf = 0, lastX = 0;
const atRoot = () => ['', 'interventions'].includes(parseHash().parts[0] || '');
// Page parente dans l'arborescence (pas l'historique du navigateur).
function parentHash() {
  const { parts } = parseHash();
  if (parts[0] === 'intervention' && parts[2] === 'modifier') return '#/intervention/' + parts[1];
  return '#/';
}
const EDGE = 44;
// Zone visible de l'appli (le cadre téléphone en mode tech sur iPad, sinon l'écran).
const frame = () => { const sh = document.body.classList.contains('tech') && document.documentElement.clientWidth > 600 ? document.getElementById('shell') : null; return sh ? sh.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight }; };
function underlay() {
  const r = frame();
  under = document.createElement('div');
  under.id = 'under';
  under.setAttribute('aria-hidden', 'true');
  under.innerHTML = `<div class="under-in">${SNAP[parentHash()] || ''}</div><div class="under-dim"></div>`;
  Object.assign(under.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  under.querySelector('.under-in').style.paddingTop = getComputedStyle(app).paddingTop;
  document.body.appendChild(under);
  sw.w = r.width;
}
// Position (0…1) : page suit le doigt, page précédente en parallaxe et assombrie (comme iOS).
function paint(x, w, anim) {
  const p = Math.min(1, x / w), tr = anim ? 'transform .35s cubic-bezier(.32,.72,0,1)' : 'none';
  app.style.transition = tr; app.style.transform = `translate3d(${x}px,0,0)`;
  if (!under) return;
  const inn = under.querySelector('.under-in'), dim = under.querySelector('.under-dim');
  inn.style.transition = tr; inn.style.transform = `translate3d(${-30 * (1 - p)}%,0,0)`;
  dim.style.transition = anim ? 'opacity .35s cubic-bezier(.32,.72,0,1)' : 'none'; dim.style.opacity = String(.12 * (1 - p));
}
function endSwipe() {
  app.style.transition = 'none'; app.style.transform = '';
  document.body.classList.remove('swiping');
  under?.remove(); under = null;
}
// Safari iOS (hors appli écran d'accueil) a déjà son propre balayage retour : on n'ajoute pas le nôtre, sinon pages superposées.
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const SWIPE_BACK = false;
const NATIVE_BACK = IOS && !(navigator.standalone || matchMedia('(display-mode: standalone)').matches);
document.addEventListener('touchstart', e => {
  // Balayage retour désactivé : seul le bouton retour ramène en arrière.
  if (!SWIPE_BACK) { sw = null; return; }
  // Page racine (liste) : rien à faire, pas de mesure de mise en page au début du défilement.
  // Lot 53 : balayage seulement d'une page fille vers sa mère (jamais sur une zone qui défile à l'horizontale).
  if (e.target.closest?.('.phc, .pstrip, .dstrip, .wsheet, .phsheet, .phbig')) { sw = null; return; }
  const t = e.touches[0], r = frame();
  const ox = t.clientX - r.left;
  // Départ uniquement depuis le bord gauche (24 px) ; sur Safari iOS, ce bord reste au geste natif.
  sw = e.touches.length === 1 && ox <= 24 && !NATIVE_BACK && !atRoot() ? { x: t.clientX, y: t.clientY, t: Date.now(), on: false, v: 0, lt: Date.now(), lx: t.clientX } : null;
}, { passive: true });
// Écouteur passif : le défilement vertical n'est jamais bloqué (touch-action: pan-y gère l'horizontal).
document.addEventListener('touchmove', e => {
  if (!sw) return;
  const t = e.touches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y;
  if (!sw.on) {
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) { sw = null; return; }
    if (dx > 8) { sw.on = true; document.body.classList.add('swiping'); underlay(); }
    else return;
  }
  const now = Date.now(); sw.v = (t.clientX - sw.lx) / Math.max(1, now - sw.lt); sw.lx = t.clientX; sw.lt = now;
  lastX = Math.max(0, dx);
  if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (sw?.on) paint(lastX, sw.w, false); });
}, { passive: true });
const finish = e => {
  if (!sw) return;
  const s = sw; sw = null;
  if (!s.on) return;
  cancelAnimationFrame(raf); raf = 0;
  const dx = Math.max(0, ((e.changedTouches[0] || {}).clientX ?? s.x) - s.x);
  const done = e.type === 'touchend' && (dx > s.w * 0.4 || (s.v > 0.35 && dx > 20)) && s.v > -0.2;
  paint(done ? s.w : 0, s.w, true);
  setTimeout(() => {
    if (!done) return endSwipe();
    app.style.visibility = 'hidden';
    // On garde l'écran précédent affiché jusqu'au rendu réel, sans flash.
    const mo = new MutationObserver(() => { mo.disconnect(); requestAnimationFrame(() => { endSwipe(); app.style.visibility = ''; }); });
    mo.observe(app, { childList: true });
    setTimeout(() => { mo.disconnect(); if (under) { endSwipe(); app.style.visibility = ''; } }, 800);
    const dest = parentHash();
    history.replaceState(null, '', dest);
    render();
  }, 350);
};
document.addEventListener('touchend', finish, { passive: true });
// Lot 53 : les onglets remplacent l'entrée d'historique, le retour (geste natif compris) ne glisse donc pas d'un onglet à l'autre.
document.addEventListener('click', e => {
  const a = e.target.closest?.('#bnav a, .bar nav a');
  if (!a || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  // Lot 185 : changement de page par le footer : la page s'ouvre en haut, sauf Terminées qui reprend où on s'était arrêté.
  if (a.closest('#bnav') && location.hash !== a.getAttribute('href')) { const sc = document.documentElement.clientWidth > 600 ? app : document.scrollingElement; const isT = h => /^(#\/?)?(terminees|interventions)?(\?.*)?$/.test(h || ''); if (isT(location.hash)) window.__tsy = sc.scrollTop; window.__fnav = isT(a.getAttribute('href')) ? (window.__tsy || 0) : 0; }
  if (location.hash !== a.getAttribute('href')) location.replace(a.getAttribute('href'));
});
document.addEventListener('touchcancel', finish, { passive: true });

// Rappels : quand une intervention programmée se déverrouille, bandeau dans l'appli (techniciens et RT).
const NKEY = 'gi-rappels-vus';
// Lot 225 : liste des rappels relue au démarrage et à chaque changement d'intervention (temps réel), puis contrôlée
// localement toutes les 30 s (horloge seule, sans requête).
let REMS = [], remT = null;
function loadReminders() {
  clearTimeout(remT);
  remT = setTimeout(async () => {
    if (!state.user || !['technicien', 'responsable_tech'].includes(role())) { REMS = []; return; }
    const { data, error } = await sb.from('interventions').select('id, title, available_from, remind_minutes').eq('status', 'publiee').not('remind_minutes', 'is', null).not('available_from', 'is', null);
    if (!error) { REMS = data || []; checkReminders(); }
  }, 400);
}
function checkReminders() {
  if (!state.user || !['technicien', 'responsable_tech'].includes(role())) return;
  const data = REMS;
  let seen; try { seen = JSON.parse(localStorage.getItem(NKEY)) || []; } catch { seen = []; }
  const now = Date.now();
  (data || []).forEach(r => {
    const u = new Date(r.available_from) - r.remind_minutes * 6e4;
    if (u > now || now - u > 12 * 36e5 || seen.includes(r.id)) return;
    seen.push(r.id);
    const n = document.createElement('div');
    n.className = 'notif';
    n.innerHTML = `<b>Rappel</b> « ${r.title.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))} » est disponible`;
    n.onclick = () => { n.remove(); go('intervention/' + r.id); };
    (document.getElementById('shell') || document.body).appendChild(n);
    setTimeout(() => n.remove(), 10000);
  });
  localStorage.setItem(NKEY, JSON.stringify(seen.slice(-200)));
}
setInterval(checkReminders, 30000); // contrôle local, sans requête

// Lot 59 : demande de transfert reçue par celui qui a pris l'intervention, affichée par-dessus n'importe quelle page.
const asked = new Set();
async function checkTransfers() {
  if (!state.user || document.hidden) return;
  const uid = state.user.id; // Lot 291 : la session peut changer pendant les await (changement de compte).
  const { data } = await sb.from('transfer_requests').select('id, requester_id, requester_role, intervention_id, interventions(title)').eq('holder_id', uid).eq('status', 'en_attente').order('created_at');
  for (const q of data || []) {
    if (asked.has(q.id)) continue;
    asked.add(q.id);
    const t = q.interventions?.title;
    const ok = await confirmBox(`${esc(String(memberName(q.requester_id, q.requester_role) || '').split(/[\s@]/)[0])} demande l'intervention${t ? ` « ${esc(t)} »` : ''}. Transférer ?`, 'Oui', { cancel: 'Non', danger: false });
    const { error } = await sb.rpc('answer_transfer', { p_req: q.id, p_ok: ok });
    if (error) { toast(errMsg(error), true); continue; }
    if (ok) render();
  }
  // Refus : le demandeur est prévenu une fois.
  const { data: no } = await sb.from('transfer_requests').select('id, holder_id').eq('requester_id', uid).eq('status', 'refusee').eq('requester_seen', false);
  for (const q of no || []) {
    if (asked.has(q.id)) continue;
    asked.add(q.id);
    await sb.rpc('ack_transfer', { p_req: q.id });
    await new Promise(res => {
      const o = document.createElement('div'); o.className = 'modal';
      o.innerHTML = `<div class="mbox"><p class="mq">${esc(String(memberName(q.holder_id) || '').split(' ')[0])} n'a pas accepté votre demande</p><div class="mbtns"><button class="primary" data-r="1">OK</button></div></div>`;
      (document.querySelector('#shell') || document.body).appendChild(o);
      o.onclick = e => { if (!e.target.closest('button') && e.target !== o) return; o.remove(); res(); };
    });
  }
}
// Lot 225 : plus de polling 8 s ; transferts relus sur événement temps réel (et au retour sur la page).
document.addEventListener('visibilitychange', checkTransfers);

(async () => {
  const { data } = await sb.auth.getSession();
  await refreshSession(data.session);
  // Nettoie ?code=... laissé par les liens e-mail.
  if (location.search) history.replaceState(null, '', location.pathname + location.hash);
  render();
  setTimeout(loadReminders, 1500);
})();

// Lot 106 : avertissement avant rechargement quand un texte est en cours de saisie.
{ let dirty = false;
  document.addEventListener('input', e => { if (e.target.closest?.('.cef, textarea, input[type=text], input[type=search]:not(.tsearch)')) dirty = true; }, true);
  addEventListener('hashchange', () => { dirty = false; });
  document.addEventListener('submit', () => { dirty = false; }, true);
  addEventListener('beforeunload', e => { if (window.__giReload || (navigator.maxTouchPoints > 1 && /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent)) || !dirty || ![...document.querySelectorAll('#app .cef, #app textarea, #app input[type=text]')].some(x => (x.value ?? x.innerText ?? '').trim())) return; e.preventDefault(); e.returnValue = 'Attention, recharger la page fera perdre le texte en cours.'; return e.returnValue; }); }

// Lot 206 : retour dans l'app (cache Safari, appli rouverte après 5 min) → « Nouvelles interventions » en mobile.
addEventListener('pageshow', e => { if (e.persisted) { window.__gopen = 0; render(); } });
{ let hid = 0; document.addEventListener('visibilitychange', () => { if (document.hidden) hid = Date.now(); else if (hid && Date.now() - hid > 300000) { window.__gopen = 0; render(); } }); }
// Lot 211 : bouton + calé à 16 px au-dessus du footer réel (mobile réel et simulé)
(() => {
  let ro, cur;
  const upd = () => {
    const bn = document.getElementById('bnav');
    if (bn && bn !== cur) { cur = bn; ro && ro.disconnect(); ro = new ResizeObserver(upd); ro.observe(bn); }
    if (!bn || !bn.offsetHeight) return;
    const t = bn.getBoundingClientRect().top;
    document.documentElement.style.setProperty('--bnt', Math.round(innerHeight - t) + 'px');
  };
  addEventListener('resize', upd); addEventListener('hashchange', () => setTimeout(upd, 50));
  new MutationObserver(() => requestAnimationFrame(upd)).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  upd();
})();
