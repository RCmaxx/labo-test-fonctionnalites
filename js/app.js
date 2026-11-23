import { sb } from './sb.js?v=1795462919';

const ACCOUNTS = ['admin.a', 'resp.a', 'tech.a', 'tech.bis', 'client'];
const ROLES = { admin: 'Admin', directeur: 'Directeur', responsable_tech: 'Responsable tech', technicien: 'Technicien', reception: 'Réception', client: 'Client' };
const PRIORITY = { basse: 'Basse', normale: 'Normale', haute: 'Haute', urgente: 'Urgente' };
const DONE = ['resolue', 'validee'];
const STATUS = { brouillon: 'Brouillon', publiee: 'Nouvelle', prise_en_charge: 'En cours', resolue: 'Terminée', validee: 'Validée' };
const REMIND = { 15: '15 min avant', 30: '30 min avant', 60: '1 h avant', 120: '2 h avant', 1440: '1 jour avant' };
const MGR = ['admin', 'directeur', 'responsable_tech'], TECH = ['technicien', 'responsable_tech'];
const PAGE = 50; // terminées chargées par page
const VERSION = 'v8';
const app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const fmt = d => d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '';
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const options = (map, sel) => Object.entries(map).map(([k, v]) => `<option value="${k}" ${String(k) === String(sel) ? 'selected' : ''}>${v}</option>`).join('');
const route = () => location.hash.slice(1).split('/'); // [page, id, sous-page]
let me = null; // { id, email, full_name, org_id, role (affiché), real (rôle réel) }
let team = []; // membres de l'entreprise : { user_id, full_name, role }
const nameOf = id => team.find(m => m.user_id === id)?.full_name || 'Quelqu’un';

async function render() {
  const [page, id] = route();
  const { data: { session } } = await sb.auth.getSession();
  if (page === 'invitation') return renderInvitation(id, session);
  if (!session) return renderLogin();
  if (!me) {
    const uid = session.user.id;
    const [{ data: m, error }, t] = await Promise.all([
      sb.from('members').select('full_name, role, acting_role, org_id').eq('user_id', uid).maybeSingle(),
      sb.from('members').select('user_id, full_name, role'),
    ]);
    if (error) return renderLogin(error.message);
    if (!m) return renderOrg(session.user);
    me = { id: uid, email: session.user.email, full_name: m.full_name, org_id: m.org_id, real: m.role, role: m.role === 'admin' && m.acting_role || m.role };
    team = t.data || [];
    startLive();
  }
  app.innerHTML = `<nav><a href="#">Interventions</a> · <a href="#nouvelle">Nouvelle intervention</a> · <a href="#compte">Mon compte</a> · ${VERSION}</nav><aside id="alerts"></aside><main></main>`;
  drawAlerts();
  show();
}

// Affiche la page demandée dans <main> (aussi rappelée par le temps réel).
function show() {
  const el = app.querySelector('main'), [page, id, sub] = route();
  if (!el) return;
  page === 'compte' ? renderMe(el) : page === 'nouvelle' ? renderForm(el)
    : page === 'i' ? (sub === 'modifier' ? renderForm(el, id) : renderDetail(el, id)) : renderList(el);
}

function renderLogin(error = '', intro = '') {
  app.innerHTML = `${intro}
    <h1>Connexion</h1><p>${VERSION}</p>
    <form id="login">
      <label>Compte <select name="email">${ACCOUNTS.map(a => `<option value="${a}@test.local">${a}</option>`).join('')}</select></label>
      <label>Mot de passe <input name="password" type="password" required autocomplete="current-password"></label>
      <button>Se connecter</button>
      <p>${esc(error)}</p>
    </form>`;
  app.querySelector('#login').onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.auth.signInWithPassword(Object.fromEntries(new FormData(e.target)));
    error ? renderLogin(error.message, intro) : render();
  };
}

async function signOut() { await sb.auth.signOut(); stopLive(); me = null; location.hash = ''; render(); }

// Compte connecté sans entreprise : création de la sienne.
function renderOrg(user) {
  app.innerHTML = `
    <h1>Créer votre entreprise</h1>
    <p>Le compte ${esc(user.email)} n'est rattaché à aucune entreprise. Créez-la, ou ouvrez le lien d'invitation reçu.</p>
    <form>
      <label>Nom de l'entreprise <input name="org" required maxlength="120"></label>
      <label>Votre nom <input name="name" required maxlength="12"></label>
      <button>Créer l'entreprise</button><p></p>
    </form>
    <button id="out">Se déconnecter</button>`;
  app.querySelector('#out').onclick = signOut;
  app.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.rpc('create_organization', { p_name: e.target.org.value.trim(), p_full_name: e.target.name.value.trim() });
    error ? e.target.querySelector('p').textContent = error.message : render();
  };
}

// Lien d'invitation : #invitation/<token>.
async function renderInvitation(token, session) {
  const { data, error } = await sb.rpc('invitation_info', { p_token: token });
  const inv = data?.[0];
  if (!inv) return app.innerHTML = `<h1>Invitation</h1><p>${esc(error?.message || 'Invitation invalide, expirée ou déjà utilisée.')}</p><a href="#">Connexion</a>`;
  const intro = `<h1>Invitation</h1><p>Rejoindre ${esc(inv.org_name)} en tant que ${ROLES[inv.role] || esc(inv.role)} (${esc(inv.email)}).</p>`;
  if (!session) return renderLogin('', intro);
  app.innerHTML = `${intro}
    <form><label>Votre nom <input name="name" required maxlength="12"></label> <button>Accepter l'invitation</button><p></p></form>`;
  app.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.rpc('accept_invitation', { p_token: token, p_full_name: e.target.name.value.trim() });
    if (error) return e.target.querySelector('p').textContent = error.message;
    stopLive(); me = null; location.hash = '';
  };
}

async function renderMe(el) {
  const admin = me.role === 'admin';
  el.innerHTML = `
    <h1>Mon compte</h1>
    <p>Nom : ${esc(me.full_name) || '—'}</p>
    <p>E-mail : ${esc(me.email)}</p>
    <p>Rôle : ${esc(ROLES[me.role] || me.role || 'aucun')}</p>
    ${me.real === 'admin' ? `<form id="acting"><label>Voir en tant que <select name="role">${options(ROLES, me.role)}</select></label> <button>Changer</button><p></p></form>` : ''}
    ${admin ? `<section><h2>Invitations</h2>
      <form id="invite"><label>E-mail <input name="email" type="email" required></label>
        <label>Rôle <select name="role">${options(ROLES, 'technicien')}</select></label> <button>Créer l'invitation</button><p></p></form>
      <ul id="invs"><li>Chargement…</li></ul></section>` : ''}
    <button id="out">Se déconnecter</button>`;
  el.querySelector('#out').onclick = signOut;
  const acting = el.querySelector('#acting');
  if (acting) acting.onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.rpc('set_acting_role', { p_role: e.target.role.value });
    if (error) return e.target.querySelector('p').textContent = error.message;
    stopLive(); me = null; render();
  };
  if (!admin) return;
  const link = t => `${location.origin}${location.pathname}#invitation/${t}`;
  const { data: invs, error } = await sb.from('invitations').select('id, email, role, token, expires_at').is('accepted_at', null).order('created_at', { ascending: false });
  el.querySelector('#invs').innerHTML = error ? `<li>${esc(error.message)}</li>` : invs.map(i => `<li>${esc(i.email)} · ${ROLES[i.role]} · expire le ${fmt(i.expires_at)}
    · <a href="${link(i.token)}">lien</a> <button data-revoke="${i.id}">Annuler</button></li>`).join('') || '<li>Aucune invitation en attente.</li>';
  el.querySelectorAll('[data-revoke]').forEach(b => b.onclick = async () => {
    const { error } = await sb.from('invitations').delete().eq('id', b.dataset.revoke);
    error ? b.after(` ${error.message}`) : renderMe(el);
  });
  el.querySelector('#invite').onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.from('invitations')
      .insert({ org_id: me.org_id, email: e.target.email.value.trim().toLowerCase(), role: e.target.role.value, invited_by: me.id }).select('token').single();
    error ? e.target.querySelector('p').textContent = error.message : renderMe(el);
  };
}

let search = '', doneN = PAGE; // recherche et nombre de terminées gardés entre deux affichages
async function renderList(el) {
  el.innerHTML = `<h1>Interventions</h1><p><label>Rechercher <input type="search" id="q" value="${esc(search)}"></label></p><div id="rows"><p>Chargement…</p></div>`;
  const cols = 'id, title, location, description, status, priority, assignee_id, created_by, created_at, resolved_at, validated_at';
  const scope = q => me.role === 'client' ? q.eq('created_by', me.id) : q;
  const [open, done, reads, msgs] = await Promise.all([
    scope(sb.from('interventions').select(cols).not('status', 'in', `(${DONE})`)).order('created_at', { ascending: false }),
    scope(sb.from('interventions').select(cols).in('status', DONE)).order('resolved_at', { ascending: false, nullsFirst: false }).order('id').limit(doneN),
    sb.from('intervention_reads').select('intervention_id, last_read_at').eq('user_id', me.id),
    sb.from('intervention_events').select('intervention_id, created_at').in('type', ['commentaire', 'photo']).neq('actor_id', me.id).order('created_at', { ascending: false }).limit(5000),
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
      ['Brouillons', o.filter(r => r.status === 'brouillon' && (me.role !== 'technicien' || r.created_by === me.id))],
      ['Mes interventions', o.filter(r => r.status === 'prise_en_charge' && r.assignee_id === me.id)],
      ['Nouvelles interventions', o.filter(r => r.status === 'publiee')],
      ['En cours', o.filter(r => r.status === 'prise_en_charge' && r.assignee_id !== me.id)],
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

// Actions possibles selon le rôle et le statut (mêmes règles que l'app main, lot 408).
function actions(i) {
  const r = me.role, mgr = MGR.includes(r), mine = i.assignee_id === me.id, tech = TECH.includes(r);
  const a = [];
  if (i.status === 'brouillon' && (mgr || (['reception', 'technicien'].includes(r) && i.created_by === me.id))) a.push(['publier', 'Publier']);
  if (i.status === 'publiee' && tech && !i.assignee_id && (!i.proposed_to || i.proposed_to === me.id)) a.push(['prendre', "Commencer l'intervention"]);
  if (i.status === 'prise_en_charge' && (mine || ['directeur', 'responsable_tech'].includes(r))) a.push(['resoudre', "Terminer l'intervention"]);
  if (i.status === 'prise_en_charge' && mine) a.push(['liberer', "Ne plus prendre l'intervention"]);
  if (i.status === 'prise_en_charge' && tech && i.assignee_id && !mine) a.push(['demander', "Demander l'intervention"]);
  if (DONE.includes(i.status) && (mgr || mine)) a.push(['renvoyer', 'Renvoyer active']);
  return a;
}

// Modifiable par l'auteur, ou pour une programmée par l'assigné et les managers, tant que personne ne l'a prise.
const canEdit = i => (i.created_by === me.id || (!!i.available_from && (i.proposed_to === me.id || MGR.includes(me.role))))
  && ['brouillon', 'publiee'].includes(i.status) && !i.assignee_id;
// Clôture pour quelqu'un d'autre : directeur et responsable tech, sur une nouvelle non prise.
const canClose = i => ['directeur', 'responsable_tech'].includes(me.role) && i.status === 'publiee' && !i.assignee_id;

// Envoie les photos dans le stockage puis les rattache à l'intervention (un message photo s'ajoute au tchat). Renvoie la première erreur.
async function uploadPhotos(iid, files) {
  for (const file of files) {
    const path = `${me.org_id}/${iid}/${crypto.randomUUID()}.${(file.name.split('.').pop() || 'jpg').toLowerCase()}`;
    const { error } = await sb.storage.from('photos').upload(path, file, { contentType: file.type || 'image/jpeg' })
      .then(r => r.error ? r : sb.from('intervention_photos').insert({ intervention_id: iid, path }));
    if (error) return error;
  }
}

// Liens signés des photos : chemin → URL.
async function signedUrls(paths) {
  if (!paths.length) return {};
  const { data } = await sb.storage.from('photos').createSignedUrls(paths, 3600);
  return Object.fromEntries((data || []).map(d => [d.path, d.signedUrl]));
}

async function renderForm(el, id) {
  // Verrou d'édition : une seule personne modifie à la fois.
  const by = id && await takeLock(id);
  if (by) return el.innerHTML = `<p>${esc(by)} modifie déjà cette intervention.</p>`;
  const [cur, places, techs] = await Promise.all([
    id ? sb.from('interventions').select('*').eq('id', id).maybeSingle() : { data: { priority: 'normale' } },
    sb.from('places').select('label').order('num', { nullsFirst: false }).order('label').limit(2000),
    sb.from('members').select('user_id, full_name, role').in('role', me.role === 'directeur' ? TECH : ['technicien']),
  ]);
  const i = cur.data;
  if (!i) return el.innerHTML = `<p>${esc(cur.error?.message || 'Intervention introuvable.')}</p>`;
  const mgr = MGR.includes(me.role);
  const from = i.available_from ? new Date(i.available_from) : null, until = i.available_until ? new Date(i.available_until) : null;
  const day = d => d ? d.toLocaleDateString('sv') : '', hm = d => d ? d.toTimeString().slice(0, 5) : '';
  el.innerHTML = `
    <h1>${id ? "Modifier l'intervention" : 'Nouvelle intervention'}</h1>
    <form>
      <p><label>Titre <input name="title" required maxlength="70" value="${esc(i.title)}"></label></p>
      <p><label>Lieu <input name="location" list="places" value="${esc(i.location)}"></label>
        <datalist id="places">${(places.data || []).map(p => `<option value="${esc(p.label)}">`).join('')}</datalist></p>
      <p><label>Description <textarea name="description">${esc(i.description)}</textarea></label></p>
      <fieldset><legend>Priorité</legend>${Object.entries(PRIORITY).map(([k, v]) =>
        `<label><input type="radio" name="priority" value="${k}" ${k === i.priority ? 'checked' : ''}> ${v}</label>`).join(' ')}</fieldset>
      ${mgr ? `<p><label>Assigner à <select name="assign"><option value="">Personne</option>${(techs.data || []).map(t =>
        `<option value="${t.user_id}" ${t.user_id === i.proposed_to ? 'selected' : ''}>${esc(t.full_name)}</option>`).join('')}</select></label></p>` : ''}
      <fieldset><legend>Passage</legend>
        <label><input type="checkbox" name="presence" ${i.client_presence || from ? 'checked' : ''}> Présence client requise</label>
        <label>Jour <input type="date" name="d" value="${day(from)}"></label>
        <label>De <input type="time" name="a" step="900" value="${hm(from)}"></label>
        <label>À <input type="time" name="b" step="900" value="${hm(until)}"></label>
        <label>Rappel <select name="remind"><option value="">Aucun</option>${options(REMIND, i.remind_minutes)}</select></label>
      </fieldset>
      <p><label>Photos (10 max) <input type="file" name="photos" accept="image/*" multiple></label></p>
      ${id ? '<button value="save">Enregistrer</button>' : '<button value="draft">Brouillon</button> <button value="publier">Créer et publier</button>'}
      <p id="ferr"></p>
    </form>`;
  el.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target)), err = el.querySelector('#ferr');
    const row = { title: f.title.trim(), location: f.location.trim(), description: f.description.trim(), priority: f.priority,
      client_presence: !!f.presence, available_from: null, available_until: null, remind_minutes: null };
    if (f.presence && f.d && f.a) {
      if (f.b && f.b <= f.a) return err.textContent = "L'heure de fin doit suivre l'heure de début.";
      row.available_from = new Date(`${f.d}T${f.a}`).toISOString();
      if (!id && new Date(row.available_from) < Date.now() - 6e4) return err.textContent = 'Ce créneau est déjà passé.';
      row.available_until = new Date(f.b ? `${f.d}T${f.b}` : new Date(row.available_from).getTime() + 9e5).toISOString(); // fin par défaut : début + 15 min
      row.remind_minutes = +f.remind || null; // rappel seulement pour une intervention programmée
    }
    const files = [...e.target.photos.files];
    if (files.length > 10) return err.textContent = '10 photos maximum par intervention.';
    const mode = e.submitter?.value, who = f.assign || null;
    const run = async () => {
      if (id) {
        let r = await sb.from('interventions').update(row).eq('id', id);
        if (!r.error && mgr && who !== (i.proposed_to || null)) r = await sb.rpc('assign_tech', { p_id: id, p_tech: who });
        return [r.error, id];
      }
      const { data, error } = await sb.from('interventions').insert({ ...row, org_id: me.org_id }).select('id').single();
      if (error || mode !== 'publier') return [error, data?.id];
      let r = await sb.rpc('transition', { p_id: data.id, p_action: 'publier', p_comment: '' });
      if (!r.error && who) r = await sb.rpc('assign_tech', { p_id: data.id, p_tech: who });
      return [r.error, data.id];
    };
    let [error, iid] = await run();
    if (!error && files.length) error = await uploadPhotos(iid, files);
    error ? err.textContent = error.message : location.hash = `i/${iid}`;
  };
}

async function renderDetail(el, id) {
  el.innerHTML = '<p>Chargement…</p>';
  const [{ data: i, error }, ev, ph] = await Promise.all([
    sb.from('interventions').select('*').eq('id', id).maybeSingle(),
    sb.from('intervention_events').select('type, body, actor_name, created_at').eq('intervention_id', id).order('created_at').order('id'),
    sb.from('intervention_photos').select('path, uploaded_by').eq('intervention_id', id).order('created_at'),
  ]);
  if (error || !i) return el.innerHTML = `<p>${esc(error?.message || 'Intervention introuvable.')}</p>`;
  const photos = ph.data || [], urls = await signedUrls(photos.map(p => p.path));
  const img = path => urls[path] ? `<a href="${urls[path]}"><img src="${urls[path]}" alt="Photo" width="160"></a>` : '';
  const events = ev.data || [], chat = me.role !== 'client'; // le client n'a pas de tchat : ses photos s'affichent à part
  const acts = actions(i), mgr = MGR.includes(me.role);
  const line = e => `<li><b>${esc(e.actor_name)}</b> · ${fmt(e.created_at)}<br>${e.type === 'photo' ? img(e.body) : esc(e.body)}</li>`;
  const closers = team.filter(m => TECH.includes(m.role));
  el.innerHTML = `
    <article>
      <h1>${esc(i.title)}</h1>
      <dl>
        <dt>Statut</dt><dd>${STATUS[i.status] || esc(i.status)}</dd>
        <dt>Priorité</dt><dd>${PRIORITY[i.priority] || ''}</dd>
        <dt>Lieu</dt><dd>${esc(i.location) || '—'}</dd>
        <dt>Créée le</dt><dd>${fmt(i.created_at)}</dd>
        ${i.available_from ? `<dt>Créneau</dt><dd>${fmt(i.available_from)} – ${fmt(i.available_until)}</dd>` : ''}
        ${i.remind_minutes ? `<dt>Rappel</dt><dd>${REMIND[i.remind_minutes] || `${i.remind_minutes} min avant`}</dd>` : ''}
      </dl>
      <p>${esc(i.description) || 'Pas de description.'}</p>
      ${canEdit(i) ? `<p id="edit" data-id="${i.id}"></p>` : ''}
      ${acts.length || mgr ? `<p>${acts.map(([a, l]) => `<button data-act="${a}">${l}</button>`).join(' ')} ${mgr ? '<button id="del">Supprimer</button>' : ''}</p>` : ''}
      ${canClose(i) ? `<details><summary>Clôturer</summary><form id="close">
        <label>Qui a fait l'intervention ? <select name="tech">${closers.map(m => `<option value="${m.user_id}">${esc(m.full_name)}</option>`).join('')}<option value="">Quelqu'un d'autre</option></select></label>
        <label>Nom de la personne <input name="other"></label> <button>Clôturer</button></form></details>` : ''}
      <p id="acterr"></p>
      ${!chat && photos.length ? `<section><h2>Photos</h2>${photos.map(p => img(p.path)).join('')}</section>` : ''}
      ${chat ? `<section>
        <h2>Tchat</h2>
        <ul>${events.filter(e => ['commentaire', 'photo'].includes(e.type)).map(line).join('') || '<li>Aucun message.</li>'}</ul>
        <form id="chat"><textarea name="body" maxlength="2000"></textarea>
          <label>Photos <input type="file" name="photos" accept="image/*" multiple></label> <button>Envoyer</button><p></p></form>
      </section>` : ''}
      <section>
        <h2>Historique</h2>
        <ul>${events.filter(e => !['commentaire', 'photo'].includes(e.type)).map(e => `<li>${fmt(e.created_at)} · ${esc(e.type)} · ${esc(e.actor_name)}${e.body ? ` · ${esc(e.body)}` : ''}</li>`).join('') || '<li>Aucun événement.</li>'}</ul>
      </section>
    </article>`;
  drawEdit();
  const fail = error => error && (el.querySelector('#acterr').textContent = error.message);
  el.querySelectorAll('[data-act]').forEach(b => b.onclick = async () => {
    const { error } = b.dataset.act === 'demander' ? await sb.rpc('request_transfer', { p_id: id })
      : await sb.rpc('transition', { p_id: id, p_action: b.dataset.act, p_comment: '' });
    fail(error) || renderDetail(el, id);
  });
  const del = el.querySelector('#del');
  if (del) del.onclick = async () => {
    if (!confirm('Supprimer cette intervention ?')) return;
    // Photos du stockage d'abord, puis la ligne (qui emporte photos, tchat et historique).
    const r = photos.length ? await sb.storage.from('photos').remove(photos.map(p => p.path)) : {};
    const { error } = r.error ? r : await sb.from('interventions').delete().eq('id', id);
    fail(error) || (location.hash = '');
  };
  const close = el.querySelector('#close');
  if (close) close.onsubmit = async e => {
    e.preventDefault();
    const tech = e.target.tech.value || null;
    const { error } = await sb.rpc('close_for', { p_id: id, p_tech: tech, p_other: tech ? null : e.target.other.value.trim() });
    fail(error) || renderDetail(el, id);
  };
  if (!chat) return;
  // Tchat ouvert = lu (sans message d'erreur : le labo refuse l'écriture).
  sb.from('intervention_reads').upsert({ user_id: me.id, intervention_id: id, last_read_at: new Date().toISOString() }).then(() => {});
  el.querySelector('#chat').onsubmit = async e => {
    e.preventDefault();
    const body = e.target.body.value.trim(), files = [...e.target.photos.files], out = e.target.querySelector('p');
    if (!body && !files.length) return out.textContent = 'Le message est vide.';
    if (files.length > 10 - photos.filter(p => p.uploaded_by === me.id).length) return out.textContent = '10 photos maximum par intervention.';
    let error = body && (await sb.rpc('add_comment', { p_id: id, p_body: body })).error;
    if (!error && files.length) error = await uploadPhotos(id, files);
    error ? out.textContent = error.message : renderDetail(el, id);
  };
}

// Verrou d'édition (expire seul côté base après 2 min sans renouvellement).
const LOCKS = new Map(); // intervention_id → { by, name, until }
const lockOf = id => { const l = LOCKS.get(id); return l && l.until > Date.now() && l.by !== me?.id ? l : null; };
let held = null, renew = null;
async function loadLocks() {
  if (!me) return;
  const { data, error } = await sb.rpc('edit_locks');
  if (error) return;
  LOCKS.clear();
  data.forEach(l => LOCKS.set(l.intervention_id, { by: l.editing_by, name: l.editing_name, until: Date.now() + l.secs_left * 1000 }));
  drawEdit();
}
// « Modifier » sur la fiche ouverte : lien, ou texte si quelqu'un d'autre modifie.
function drawEdit() {
  const p = document.getElementById('edit');
  if (!p) return;
  const l = lockOf(p.dataset.id);
  p.innerHTML = l ? `Modifier (${esc(l.name || 'quelqu’un')} modifie en ce moment)` : `<a href="#i/${p.dataset.id}/modifier">Modifier</a>`;
}
// Prend le verrou ; renvoie le nom de celui qui le tient déjà, sinon rien. En cas d'erreur, on ne bloque pas.
async function takeLock(id) {
  releaseLock();
  const { data, error } = await sb.rpc('edit_lock', { p_id: id, p_action: 'take' });
  if (error) return;
  const l = data?.[0] || {};
  if (!l.ok) return l.editing_name || 'Quelqu’un';
  held = id;
  renew = setInterval(() => sb.rpc('edit_lock', { p_id: id, p_action: 'take' }).then(() => {}), 45000);
}
function releaseLock() {
  if (!held) return;
  sb.rpc('edit_lock', { p_id: held, p_action: 'release' }).then(() => {});
  held = null; clearInterval(renew);
}
setInterval(() => document.visibilityState === 'visible' && loadLocks(), 20000);
addEventListener('hashchange', () => held && location.hash !== `#i/${held}/modifier` && releaseLock());
addEventListener('pagehide', releaseLock);

// Bandeau d'alertes : demandes de transfert, refus, rappels.
let transfers = [], refused = [], reminders = [];
const SEEN = 'labo-rappels-vus';
const seen = () => JSON.parse(localStorage.getItem(SEEN) || '[]');
// Rappel échu depuis moins de 12 h et pas encore vu.
const due = r => { const t = new Date(r.available_from) - r.remind_minutes * 6e4; return t <= Date.now() && Date.now() - t < 432e5 && !seen().includes(r.id); };
function drawAlerts() {
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
async function checkTransfers() {
  if (!me) return;
  const [p, r] = await Promise.all([
    sb.from('transfer_requests').select('id, requester_id, interventions(title)').eq('holder_id', me.id).eq('status', 'en_attente').order('created_at'),
    sb.from('transfer_requests').select('id, holder_id').eq('requester_id', me.id).eq('status', 'refusee').eq('requester_seen', false),
  ]);
  transfers = p.data || []; refused = r.data || [];
  drawAlerts();
}
async function loadReminders() {
  if (!TECH.includes(me?.role)) return reminders = [];
  const { data } = await sb.from('interventions').select('id, title, available_from, remind_minutes')
    .eq('status', 'publiee').not('remind_minutes', 'is', null).not('available_from', 'is', null);
  reminders = data || [];
  drawAlerts();
}

// Temps réel : un canal par session ; la vue ouverte se rafraîchit (sauf formulaire ou saisie en cours).
let live = null, wait = null;
function refresh() {
  clearTimeout(wait);
  wait = setTimeout(() => {
    const [page, , sub] = route(), f = document.activeElement;
    if (page === 'nouvelle' || page === 'compte' || sub === 'modifier' || (f?.closest('main') && f.value)) return;
    show();
  }, 300);
}
function startLive() {
  stopLive();
  live = sb.channel('labo')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'interventions' }, () => { loadReminders(); refresh(); })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'intervention_events' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transfer_requests' }, checkTransfers)
    .subscribe();
  loadReminders(); checkTransfers(); loadLocks();
}
function stopLive() { if (live) sb.removeChannel(live); live = null; }

addEventListener('hashchange', render);
render();
