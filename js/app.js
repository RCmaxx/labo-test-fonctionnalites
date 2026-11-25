import { sb } from './sb.js';
import { S, app, route, isMob, setSim, avatar, VERSION, esc, ROLES, PNAME } from './state.js';
import { renderLogin, renderForgot, renderSignup, renderOrg, renderInvitation, renderMe, signOut } from './auth.js';
import { renderSettings } from './settings.js';
import { renderList } from './list.js';
import { renderDetail } from './detail.js';
import { renderForm } from './form.js';
import { startLive, stopLive } from './live.js';
import { drawAlerts, toast } from './alerts.js';
import { loadCounts, paintCounts } from './counts.js';
import { initTabs } from './tabs.js';
import { openMine } from './mine.js';

const SEARCH =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';
const LIST =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
const GEAR =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
const USERS =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M21 20c0-2.6-1.6-4.8-4-5.6"/></svg>';
const CHEV =
  '<svg class="chev" width="10" height="10" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SHORT = {
  admin: 'Admin',
  directeur: 'Directeur',
  responsable_tech: 'Resp.tech',
  technicien: 'Tech',
  reception: 'Réception',
};
const ADM = 'lab-admin-sess';
const REAL = { bis: ['tech.bis@test.local', 'Antoine'], cli: ['client@test.local', 'Client'] };
// Titre de la barre du haut ; la racine (#, Terminées sur mobile) garde « Interventions », comme l'appli tech.
const titleOf = pg => TITLES[pg] || 'Interventions';
const TITLES = {
  nouvelles: 'Interventions',
  mes: 'Mes interventions',
  encours: 'En cours',
  terminees: 'Terminées',
  recherche: 'Interventions', // comme l'appli tech : le titre ne change pas pendant la recherche
  parametres: 'Profils',
  equipe: 'Profils',
  compte: 'Mon compte',
  nouvelle: 'Nouvelle intervention',
  i: 'Intervention',
  routines: 'Routines',
};

let opening = true; // prochain affichage = ouverture de l'appli
async function render() {
  const [page, id] = route();
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (page === 'invitation') return renderInvitation(id, session);
  if (!session)
    return page === 'mot-de-passe' ? renderForgot() : page === 'inscription' ? renderSignup() : renderLogin();
  if (!S.me) {
    const uid = session.user.id;
    const [{ data: m, error }, t] = await Promise.all([
      sb.from('members').select('full_name, role, acting_role, org_id').eq('user_id', uid).maybeSingle(),
      sb.from('members').select('user_id, full_name, role'),
    ]);
    if (error) return renderLogin(error.message);
    if (!m) {
      // Compte créé depuis « Créer un compte entreprise » : l'entreprise est créée à la première connexion.
      const md = session.user.user_metadata || {};
      if (
        md.org_name &&
        !(await sb.rpc('create_organization', { p_name: md.org_name, p_full_name: md.full_name || '' })).error
      )
        return render();
      return renderOrg(session.user);
    }
    const { data: org } = await sb.from('organizations').select('name').eq('id', m.org_id).maybeSingle();
    S.me = {
      id: uid,
      email: session.user.email,
      full_name: m.full_name,
      org_id: m.org_id,
      real: m.role,
      role: (m.role === 'admin' && m.acting_role) || m.role,
    };
    S.org = org;
    S.team = t.data || [];
    startLive(show);
    opening = true;
  }
  const r = S.me.role,
    admin = S.me.real === 'admin',
    cli = r === 'client';
  // Comme l'appli tech : un technicien a toujours la vue mobile (cadre téléphone sur grand écran).
  setSim(r === 'technicien' || !!localStorage.labosim);
  // Comme l'appli tech : sur mobile, chaque ouverture (lancement, connexion, retour après 5 min) arrive sur « Interventions ».
  if (opening) {
    opening = false;
    if (isMob() && !cli && !['nouvelles', 'i', 'invitation'].includes(page)) return location.replace('#nouvelles');
  }
  const disp = admin ? PNAME[r] || S.me.full_name : S.me.full_name || S.me.email;
  const av = avatar(admin && r === 'client' ? 'Client' : disp, r);
  const pick = admin;
  const roles = Object.entries(ROLES).filter(([k]) => k !== 'client');
  const mob = !!localStorage.labosim; // choix « mobile » enregistré (le cadre sim n'existe que sur grand écran)
  // Profils proposés, comme l'appli tech : avatar, prénom et rôle court.
  const lab = (name, k, txt) => `${avatar(name, k).e} ${esc(name)} · ${txt}`;
  const sel = pick
    ? `<select id="asrole" aria-label="Voir en tant que">
    ${roles.map(([k]) => `<option value="${k}" ${k === r && !mob ? 'selected' : ''}>${lab(PNAME[k], k, SHORT[k])}</option>`).join('')}
    <option value="responsable_tech|m" ${mob && r === 'responsable_tech' ? 'selected' : ''}>${lab(PNAME.responsable_tech, 'responsable_tech', 'RT mobile')}</option>
    <option value="directeur|m" ${mob && r === 'directeur' ? 'selected' : ''}>${lab(PNAME.directeur, 'directeur', 'Directeur mobile')}</option>
    <option value="bis"${S.me.email === REAL.bis[0] ? ' selected' : ''}>${lab(REAL.bis[1], 'technicien', 'Tech')}</option>
    <option value="cli|m"${S.me.email === REAL.cli[0] ? ' selected' : ''}>${avatar('Client mobile').e} Client mobile</option>
  </select>`
    : '';
  const [pg] = route();
  const ptit = titleOf(pg);
  app.innerHTML = `<nav class="topbar">
    <span class="ptit">${esc(ptit)}</span>
    <span class="pcnt"></span>
    <span class="brand">${esc(S.org?.name || '')}</span>
    <nav class="tnav">
      <a href="#">Interventions</a>
      ${cli ? '' : '<a href="#terminees">Terminées</a>'}
      ${cli ? '' : '<a href="#routines">Routines</a>'}
      ${admin ? '<a href="#parametres">Profils</a>' : ''}
      ${cli ? '' : `<a href="#recherche" class="ico-search" aria-label="Rechercher">${SEARCH}</a>`}
    </nav>
    <div class="who">
      <b class="who__org">${esc(S.org?.name || '')}</b>
      <div class="acct${pick ? ' acct--pick' : ''}">
        <span class="av" style="background:${av.bg}" aria-hidden="true">${av.e}</span>
        <span class="acc-t"><b>${esc(disp)}</b>${pick ? '' : `<i>${esc(ROLES[r] || r)}</i>`}</span>
        ${pick ? CHEV + sel : ''}
      </div>
      ${S.me.role === 'admin' ? '<a href="#compte">Mon compte</a>' : ''}
      <button type="button" class="ghost" id="logout">Déconnexion</button>
    </div>
  </nav>
  <small class="lotv">${VERSION}</small>
  <aside class="alerts" id="alerts"></aside>
  <main></main>
  ${cli ? '' : '<a class="fabm" href="#mes" id="fabm" aria-label="Mes interventions"></a>'}
  <a class="fab${cli ? ' fab--cli' : ''}" href="#nouvelle" aria-label="Nouvelle intervention">+</a>
  <nav class="tabbar">
    <i class="tabbar__ind" aria-hidden="true"></i>
    <a href="#" aria-label="Terminées">${LIST}</a>
    ${cli ? '' : '<a href="#nouvelles" aria-label="Nouvelles interventions"><span class="tabbar__n" id="tabn"></span></a><a href="#mes" aria-label="Mes interventions"><span class="tabbar__m" id="tabm"></span></a>'}
    ${admin ? `<a href="#parametres" aria-label="Profils">${USERS}</a>` : ''}
    <button type="button" class="tabbar__gear" id="gear" aria-label="Compte et profil" aria-expanded="false">${GEAR}</button>
  </nav>`;
  drawAlerts();
  paintCounts();
  loadCounts();
  app.querySelector('#logout').onclick = () => signOut();
  app.querySelector('#gear').onclick = e => {
    e.stopPropagation();
    const on = app.querySelector('.topbar').classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', String(on));
  };
  // + de la vue standard : la création s'ouvre en fenêtre par-dessus la liste (voir show()).
  app.addEventListener('click', e => e.target.closest('.gadd') && sessionStorage.setItem('gi-plus', '1'));
  // Bulle « mes interventions » : sur mobile, panneau du bas (comme l'appli tech) au lieu de changer de page.
  app.querySelector('#fabm')?.addEventListener('click', e => {
    if (!isMob()) return;
    e.preventDefault();
    openMine();
  });
  const asr = app.querySelector('#asrole');
  if (asr) asr.onchange = () => pickRole(asr);
  // Mobile, comme l'appli tech : profils en boutons visibles dans le menu du rouage.
  if (asr) {
    const box = document.createElement('div');
    box.className = 'mprof';
    box.innerHTML =
      '<span class="mprof__h">Changer de profil</span>' +
      [...asr.options]
        .map(
          o =>
            `<button type="button" data-v="${esc(o.value)}"${o.selected ? ' class="on" aria-current="true"' : ''}>${esc(o.text)}</button>`
        )
        .join('');
    app.querySelector('#logout').before(box);
    box.onclick = e => {
      const b = e.target.closest('button');
      if (!b || b.classList.contains('on') || asr.disabled) return;
      asr.value = b.dataset.v;
      asr.dispatchEvent(new Event('change'));
    };
  }
  return show();
}

async function backToAdmin() {
  const raw = localStorage.getItem(ADM);
  if (!raw) return false;
  const { data, error } = await sb.auth.setSession(JSON.parse(raw));
  localStorage.removeItem(ADM);
  if (error) {
    localStorage.labosim = '';
    document.documentElement.classList.remove('sim');
    await sb.auth.signOut();
    stopLive();
    S.me = null;
    return false;
  }
  stopLive();
  S.me = null;
  S.org = null;
  return !!data.session;
}

async function pickRole(sel) {
  sel.disabled = true;
  const [rk, mob] = sel.value.split('|');
  const setMob = on => {
    setSim(on);
    localStorage.labosim = on ? '1' : '';
  };
  if (REAL[rk]) {
    const [em] = REAL[rk];
    if (S.me.email !== em) {
      if (localStorage.getItem(ADM) && !(await backToAdmin())) {
        location.hash = '';
        return render();
      }
      const cur = (await sb.auth.getSession()).data.session;
      if (cur && S.me.real === 'admin')
        localStorage.setItem(ADM, JSON.stringify({ access_token: cur.access_token, refresh_token: cur.refresh_token }));
      if (!cur || S.me.real !== 'admin') {
        sel.disabled = false;
        return;
      }
      const { data: fx, error: fe } = await sb.functions.invoke('as-test-user', { body: { email: em } });
      if (fe || !fx?.token_hash) {
        localStorage.removeItem(ADM);
        sel.disabled = false;
        return toast(fx?.error || `Connexion au compte ${REAL[rk][1]} impossible.`, true); // message de l'appli tech
      }
      const { data: vo, error: ve } = await sb.auth.verifyOtp({ token_hash: fx.token_hash, type: 'magiclink' });
      if (ve || !vo?.session) {
        localStorage.removeItem(ADM);
        sel.disabled = false;
        return render();
      }
      stopLive();
      S.me = null;
      S.org = null;
    }
    setMob(!!mob);
    location.hash = '';
    toast(mob ? 'Connecté en tant que Client mobile.' : `Connecté en tant que ${REAL[rk][1]}.`);
    return render();
  }
  if (localStorage.getItem(ADM) && S.me.email !== (await sb.auth.getSession()).data.session?.user?.email) {
    if (!(await backToAdmin())) return render();
  }
  const { error } = await sb.rpc('set_acting_role', { p_role: rk });
  if (error) {
    sel.disabled = false;
    return toast(error.message, true);
  }
  setMob(!!mob);
  // Message de l'appli tech après un changement de profil.
  toast(
    rk === 'admin'
      ? 'Vous êtes de nouveau administrateur.'
      : `Vous voyez l'appli en tant que ${mob ? sel.selectedOptions[0].text : SHORT[rk]}.`
  );
  S.me = null;
  S.org = null;
  render();
}

// Indicateur qui glisse vers l'onglet actif de la barre du bas (la position précédente est gardée d'un rendu à l'autre).
let indPos = null;
function moveIndicator() {
  const bar = app.querySelector('.tabbar'),
    ind = bar?.querySelector('.tabbar__ind'),
    on = bar?.querySelector('a.on');
  if (!ind) return;
  ind.hidden = !on;
  if (!on) return;
  const set = p => {
    ind.style.left = p.left + 'px';
    ind.style.width = p.width + 'px';
  };
  const now = { left: on.offsetLeft, width: on.offsetWidth };
  if (indPos && !ind.dataset.ready) {
    set(indPos); // nouvelle barre : on repart de l'ancienne position pour glisser
    ind.getBoundingClientRect();
  }
  ind.style.transition =
    indPos && ind.dataset.ready
      ? 'left 0.28s cubic-bezier(0.3, 0.8, 0.3, 1), width 0.28s cubic-bezier(0.3, 0.8, 0.3, 1)'
      : 'none';
  ind.dataset.ready = '1';
  if (indPos && ind.style.transition === 'none') {
    requestAnimationFrame(() => {
      ind.style.transition = 'left 0.28s cubic-bezier(0.3, 0.8, 0.3, 1), width 0.28s cubic-bezier(0.3, 0.8, 0.3, 1)';
      set(now);
    });
  } else set(now);
  indPos = now;
}
// Les pastilles de la barre du bas changent de largeur quand les compteurs arrivent : on recale l'indicateur.
document.addEventListener('labo:counts', moveIndicator);

function show() {
  loadCounts();
  const el = app.querySelector('main'),
    [page, id, sub] = route();
  if (!el) return;
  app.dataset.page = page || '';
  const cur = ['compte', 'nouvelles', 'mes', 'terminees', 'recherche', 'parametres', 'routines'].includes(page)
    ? '#' + page
    : '';
  app.querySelectorAll('.tnav a, .tabbar a, .who a').forEach(a => a.classList.toggle('on', a.hash === cur));
  moveIndicator();
  const pt = app.querySelector('.ptit');
  if (pt) pt.textContent = titleOf(page);
  if (['terminees', 'recherche', 'parametres'].includes(page) && S.me.role === 'client') {
    location.hash = '';
    return;
  }
  if (page === 'parametres') {
    if (S.me.real !== 'admin') {
      location.hash = '';
      return;
    }
    return renderSettings(el);
  }
  if (page === 'compte') return renderMe(el);
  // Routines : page vide pour l'instant, comme dans l'appli tech.
  if (page === 'routines') {
    if (S.me.role === 'client') return (location.hash = '');
    el.innerHTML = '<div class="account"><h1>Routines</h1></div>';
    return;
  }
  if (page === 'nouvelle') {
    // Vue standard, comme l'appli tech : fenêtre par-dessus la liste quand on vient du +, page seule sinon (lien direct).
    const fromPlus = sessionStorage.getItem('gi-plus');
    sessionStorage.removeItem('gi-plus');
    if (isMob() || !fromPlus) return renderForm(el);
    return renderList(el).then(() => {
      el.insertAdjacentHTML('beforeend', '<div class="nmodal"><div class="nbox"></div></div>');
      const m = el.querySelector('.nmodal');
      m.onclick = e => e.target === m && m.querySelector('.fx')?.click();
      renderForm(m.firstChild);
    });
  }
  if (page === 'i') {
    if (S.me.role === 'client') {
      location.hash = '';
      return;
    }
    return sub === 'modifier' ? renderForm(el, id) : renderDetail(el, id);
  }
  renderList(el);
}

initTabs({ app }); // balayage entre onglets (js/tabs.js)
const LISTS = ['', 'nouvelles', 'mes'];
// Entre deux onglets de liste, seul le contenu change (pas de reconstruction de l'en-tête ni de la barre du bas).
// Ouverture d'une fiche depuis une liste (mobile), comme l'appli tech : l'image de la liste reste affichée pendant
// le chargement, puis la fiche arrive par la droite pendant que la liste part à gauche en s'assombrissant.
function pushOut() {
  const m = app.querySelector('main');
  if (!m || !isMob() || matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const r = m.getBoundingClientRect(),
    o = document.createElement('div');
  o.className = 'pushout';
  o.setAttribute('aria-hidden', 'true');
  o.innerHTML = `<div class="pushout__in">${m.innerHTML}</div><div class="pushout__dim"></div>`;
  Object.assign(o.style, {
    left: r.left + 'px',
    top: r.top + 'px',
    width: r.width + 'px',
    height: innerHeight - r.top + 'px',
  });
  document.body.append(o);
  return () => {
    const fresh = app.querySelector('main');
    fresh?.classList.add('slide-in');
    o.classList.add('is-back');
    requestAnimationFrame(() => requestAnimationFrame(() => o.classList.add('is-gone')));
    setTimeout(() => {
      o.remove();
      fresh?.classList.remove('slide-in');
    }, 450);
  };
}
addEventListener('hashchange', e => {
  const from = (e.oldURL.split('#')[1] || '').split('/')[0];
  if (S.me && app.querySelector('main') && LISTS.includes(from) && LISTS.includes(route()[0])) return show();
  const go = S.me && LISTS.includes(from) && route()[0] === 'i' ? pushOut() : null;
  const done = render();
  if (go) Promise.resolve(done).finally(go);
});
addEventListener('labo:render', render);
// Retour dans l'appli après 5 min (ou depuis le cache de Safari) : nouvelle ouverture.
let hidden = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hidden = Date.now();
  else if (hidden && Date.now() - hidden > 300000 && S.me) {
    opening = true;
    render();
  }
});
addEventListener('pageshow', e => {
  if (e.persisted && S.me) {
    opening = true;
    render();
  }
});
// Menu du compte (mobile) : fermé dès qu'on touche ailleurs, comme l'appli tech.
document.addEventListener('click', e => {
  const bar = app.querySelector('.topbar.open');
  if (!bar || e.target.closest('.who, #gear')) return;
  bar.classList.remove('open');
  app.querySelector('#gear')?.setAttribute('aria-expanded', 'false');
});
render();
