import { sb } from '../sb.js?v=20261123193833';
import { state, role, isManager, isRealAdmin, memberName, assigneeName, compactName, roleKind, PNAME, roleIco, assTag } from '../state.js?v=20261123193833';
import { $, $$, esc, toast, errMsg, busy, statusPill, PRIORITY, EVENTS, initCef, fmtAgo, confirmBox, WRENCH, BRIEFCASE, zoomImg, hm, sbar, n2, ACTMSG, pcolor, isDone } from '../ui.js?v=20261123193833';
import { uploadPhotos, signedUrls, photoTray } from '../photos.js?v=20261123193833';
import { go, render } from '../app.js?v=20261123193833';
import { lockedByOther, peekLock } from '../lock.js?v=20261123193833';

// Lot 71 : chargement lancé dès l'appui sur la carte (avant le clic), consommé une seule fois.
const PRE = new Map();
async function load(id, noChat) {
  const [{ data: it, error }, { data: events }, { data: photos }] = await Promise.all([
    sb.from('interventions').select('*').eq('id', id).maybeSingle(),
    noChat ? Promise.resolve({ data: [] }) : sb.from('intervention_events').select('*').eq('intervention_id', id).order('created_at').order('id'),
    sb.from('intervention_photos').select('*').eq('intervention_id', id).order('created_at'),
  ]);
  return { it, error, events, photos, urls: await signedUrls((photos || []).map(p => p.path)) };
}
export function prefetch(id, ttl = 8000) {
  if (PRE.has(id)) return PRE.get(id);
  const p = load(id, role() === 'client').catch(() => null);
  PRE.set(id, p); setTimeout(() => PRE.get(id) === p && PRE.delete(id), ttl);
  return p;
}

// Lot 225 : ligne de titre du détail (retour, titre, priorité), aussi affichée seule pendant le chargement.
const dtrow = (it, inline) => {
  const back = inline ? '<a href="#/" class="back xback" aria-label="Replier"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></a>' : '<a href="#/" class="back" aria-label="Retour"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></a>';
  return `<div class="dtrow">${back}<h1 class="dtitle">${esc(it.title).replace(/ (?=[^ ]*$)/, "&nbsp;")}</h1></div>`;
};
export async function view(app, { id, inline = false }) {
  if (role() === 'client') { app.innerHTML = ''; return go(''); } // Lot 225 : pas de détail d'intervention pour le client.
  const noChat = role() === 'client';
  const pre = PRE.get(id); PRE.delete(id);
  // Lot 225 : fiche complète chargée à l'ouverture seulement ; en page, le haut déjà connu (carte de la liste) s'affiche tout de suite.
  const P = (pre && pre.then(x => x || load(id, noChat))) || load(id, noChat);
  const k0 = !inline && state.listRows?.get(id);
  if (k0 && !(await Promise.race([P, new Promise(r => setTimeout(() => r(null), 40))]))) app.innerHTML = `<div class="page dpage${noChat ? '' : ' dmob'}"><div class="dfix dbg-${k0.status}">${dtrow(k0, inline)}</div></div>`;
  const { it, error, events, photos, urls } = await P;
  if (error) throw error;
  if (!it) { app.innerHTML = '<p class="pad muted">Intervention introuvable.</p>'; return; }

  // Création + publication = une seule entrée « Signalement ».
  // « Validation » retirée du parcours : plus affichée dans la chronologie.
  // Les photos (création comprise) sont des messages du tchat.
  const evs = (events || []).filter(e => !['validee', 'refusee'].includes(e.type) && !(e.type === 'prise_en_charge' && /^Assignée à /.test(e.body || '')) && !(e.type === 'creee' && (events || []).some(x => x.type === 'publiee')));
  // Lot 214 : après « n'est plus clôturée », rappeler qui reprend l'intervention.
  { let tk = null; [...(events || [])].sort((x, y) => new Date(x.created_at) - new Date(y.created_at)).forEach(e => { if (e.type === 'prise_en_charge') { const m = (e.body || '').match(/^(?:Assignée à |Transférée par .* à )(.*)$/); tk = m ? m[1] : e.actor_name; } else if (e.type === 'liberee') tk = null; else if (e.type === 'reactivee') e.taker = tk; }); }
  const me = state.user.id, r = role(), mgr = isManager();
  // Compte admin : « à moi » seulement sous le profil qui a pris l'intervention.
  const mine = it.assignee_id === me && (!isRealAdmin() || it.assignee_role === r);
  const closed = isDone(it);
  // Auteur : le créateur ; pour le compte admin, seulement sous le profil qui a créé.
  const ce = (events || []).find(x => x.type === 'creee') || (events || []).find(x => x.type === 'publiee') || {};
  const author = it.created_by === me && (!isRealAdmin() || !ce.actor_role || ce.actor_role === r);
  // Commentaires : tout membre sur une intervention ouverte (brouillon : l'auteur).
  const canComment = !noChat && !closed && (it.status !== 'brouillon' || author);
  // Intervention programmée : modifiable par tout membre.
  // Plus modifiable une fois prise en charge (tous rôles).
  const canEdit = (author || (!!it.available_from && (it.proposed_to === me || mgr || isRealAdmin()))) && // Lot 225 : règle de la RLS itv_update
    ['brouillon', 'publiee'].includes(it.status) && !it.assignee_id;
  const lkO = canEdit ? await peekLock(it.id) : null; // Lot 223 : « Modifier » grisé si quelqu'un d'autre modifie déjà.
  // Assignation (non acceptée) à moi ; compte admin : au profil simulé du même rôle.
  const pm = !!it.proposed_to && (it.proposed_to === me || (isRealAdmin() && (state.members || []).find(x => x.user_id === it.proposed_to)?.role === r));
  const actions = [];
  if ((mgr || (['reception', 'technicien'].includes(r) && author)) && it.status === 'brouillon') actions.push(['publier', 'Publier', 'primary']);
  if (['technicien', 'responsable_tech'].includes(r) && it.status === 'publiee' && !it.assignee_id && (!it.proposed_to || pm)) { actions.push(['prendre', 'Commencer l\'intervention', 'primary']); }
  if ((mine || ['directeur', 'responsable_tech'].includes(r)) && it.status === 'prise_en_charge') actions.push(['resoudre', 'Terminer l\'intervention', 'primary']);
  if (mine && it.status === 'prise_en_charge') actions.push(['liberer', UNTAKE, 'ghost ibtn']);
  // Lot 59 : demander une intervention déjà prise par quelqu'un d'autre.
  if (['technicien', 'responsable_tech'].includes(r) && it.status === 'prise_en_charge' && it.assignee_id && !mine) actions.push(['demander', 'Demander l\'intervention', 'ghost']);
  // Lot 84 : intervention terminée remise en statut actif.
  if (closed && (mgr || mine)) actions.push(['renvoyer', 'Renvoyer active', 'ghost']);
  // Lot 82 : en vue mobile, ces actions passent par la main / « ••• » de la carte.
  // Lot 90 : en mobile aussi, toutes les actions sont proposées (dans le menu du rouage).

  const ownE = e => e.actor_id === me && (!isRealAdmin() || !e.actor_role || e.actor_role === r);
  const pill = ['publiee', 'prise_en_charge'].includes(it.status) ? '' : statusPill(it.status);
  const myPh = (photos || []).filter(p => p.uploaded_by === me).length;
  // Client (sans tchat) : les photos restent en carrousel dans le détail.
  const phList = noChat ? (photos || []).filter(p => urls[p.path]) : [];
  const photosHtml = phList.length ? `<div class="phc-w"><div class="phc">${phList.map(p => `<div class="phs"><a href="${urls[p.path]}" target="_blank" rel="noopener"><img src="${urls[p.path]}" alt="Photo"></a></div>`).join('')}</div>${phList.length > 3 ? `<button type="button" class="phc-a phc-p" aria-label="Photo précédente" hidden>‹</button><button type="button" class="phc-a phc-n" aria-label="Photo suivante">›</button>` : ''}${phList.length > 1 ? `<span class="phc-i">Photo ${Math.min(3, phList.length)}/${phList.length}</span>` : ''}</div>` : '';
  let lastDay = '';
  // Lot 77 : photos envoyées ensemble (même auteur, moins de 2 min d'écart) regroupées en une série sur une ligne.
  // Description affichée en premier message du tchat (toutes les interventions, anciennes comprises).
  const dsc = String(it.description || '').trim();
  // Lot 86 : « Intervention créée » et la description fusionnés en une seule bulle, en tête du tchat.
  const src = (events || []).find(x => ['creee', 'publiee'].includes(x.type) && x.actor_id === it.created_by) || {};
  const ci = evs.findIndex(x => ['creee', 'publiee'].includes(x.type));
  if (!noChat) {
    const base = { actor_id: it.created_by, actor_role: src.actor_role, actor_name: src.actor_name || memberName?.(it.created_by), created_at: ci >= 0 ? evs[ci].created_at : it.created_at };
    const head = dsc ? { ...base, type: 'commentaire', body: dsc, cre: 1 } : ci >= 0 ? evs[ci] : { ...base, type: 'publiee' };
    if (ci >= 0) evs.splice(ci, 1);
    evs.unshift(head);
  }
  const items = [];
  evs.forEach(e => { const g = items[items.length - 1];
    if (e.type === 'photo' && g && g[0].type === 'photo' && g[0].actor_id === e.actor_id && (g[0].actor_role || '') === (e.actor_role || '') && new Date(e.created_at) - new Date(g[g.length - 1].created_at) < 120000 && dayLbl(e.created_at) === dayLbl(g[0].created_at)) g.push(e);
    else items.push([e]); });
  const chatHtml = items.map(g => { const e = g[0], d = dayLbl(e.created_at), sep = d !== lastDay ? `<div class="cday">${d}</div>` : ''; lastDay = d;
    return sep + (e.type === 'photo' ? phMsg(g, ownE(e), urls) : bubble(e, ownE(e), urls, it)); }).join('');

  const chatHtml2 = noChat ? '' : `<div class="chat2"><div class="chrono">${chatHtml}</div>
        ${canComment ? `<div class="cin"><span class="phadd cph" aria-label="Ajouter une photo"><input id="ph" type="file" accept="image/*" multiple hidden>${CAM}</span><textarea id="cm" rows="1" placeholder="Ajouter un commentaire" maxlength="2000"></textarea><button class="csend" id="comment" aria-label="Envoyer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button></div>` : ''}
      </div>`;
  const dactHtml = actions.length || canEdit || mgr ? `<div class="dact"><div class="actions solo">${canEdit ? `<a class="btn ghost" href="#/intervention/${it.id}/modifier" data-edit="${it.id}" aria-label="Modifier l'intervention"${lkO ? ' aria-disabled="true" tabindex="-1"' : ''}>Modifier</a>` : ''}${actions.map(([a, l, c]) => `<button class="${c}" data-act="${a}"${a === 'liberer' ? ' aria-label="Ne plus prendre l\'intervention" title="Ne plus prendre l\'intervention"' : ''}>${l}</button>`).join('')}${mgr ? '<button class="ghost danger" id="del" aria-label="Supprimer l\'intervention">Supprimer</button>' : ''}</div></div>` : '';
  const bg = `dbg-${it.status}`;
  app.innerHTML = `
    <div class="page dpage${noChat ? '' : ' dmob'}">
      <div class="dfix ${bg}">
      ${dtrow(it, inline)}
      <section class="dtop">
        <div class="dmeta3"><div class="drow"><span class="dloc lp-${it.priority || 'normale'}">${it.location ? `<span class="ltag">${esc(locTag(it.location))}</span>` : ''}${it.assignee_id ? tagsOf(it, events) : it.status === 'publiee' ? `${it.proposed_to ? assTag(it.proposed_to) : ''}<span class="pill st-publiee">Nouveau</span>` : ''}<span class="ddate">${fmtAgo(it.created_at)}</span></span><span class="dright">${(['haute', 'urgente'].includes(it.priority) || pill) ? `<span class="drt">${['haute', 'urgente'].includes(it.priority) ? `<span class="prio p-${it.priority}">${PRIORITY[it.priority]}</span>` : ''}${pill}</span>` : ''}</span></div></div>
        ${String(it.description || '').trim() && noChat ? `<p class="ddesc">${esc(it.description)}</p>` : ''}
        ${photosHtml}
      </section>
      ${noChat ? dactHtml : ''}
      </div>
      ${noChat ? '' : dactHtml + chatHtml2}
    </div>`;
  // Tchat : ouverture sur le dernier message.
  requestAnimationFrame(() => { const ch = app.querySelector('.chat2 .chrono'); if (ch) ch.scrollTop = ch.scrollHeight; });
  // Lecture du tchat retenue par utilisateur (table intervention_reads).
  let readDone = false;
  const markRead = () => { if (readDone || noChat) return; readDone = true; dispatchEvent(new CustomEvent('gi:read', { detail: { id } })); sb.from('intervention_reads').upsert({ user_id: me, intervention_id: id, last_read_at: new Date().toISOString() }).then(() => {}); };
  markRead();
  sbar($('.ddesc'));
  const xb = app.querySelector('.xback'); if (xb) xb.onclick = e => { e.preventDefault(); app.closest('tr.xrow')?.previousElementSibling?.click(); };
  // Lot 86 : vue standard dépliée, rouage à droite de l'étiquette de statut ; ses actions remplacent les boutons du détail.
  { const tr = (inline && app.closest('tr.xrow')?.previousElementSibling) || null;
    tr?.querySelectorAll('.xgear').forEach(x => x.remove()); app.classList.remove('xg');
    const acts = [...app.querySelectorAll('.dact .actions > a, .dact .actions > button')];
    // Lot 90 : même rouage dans le détail en page (mobile réel et simulé, Terminées…), à droite du titre.
    const host = tr ? (tr.querySelector('.tl')?.closest('td') || tr.cells[tr.cells.length - 1]) : !inline ? (app.querySelector('.dmeta3 .drow') || app.querySelector('.dtrow')) : null; // Lot 139.2 : rouage sur la ligne des étiquettes, à droite, centré sur elles.
    app.querySelector('.dtrow > .xgear, .dfix > .xgear, .drow > .xgear')?.remove();
    if (host && acts.length) {
      const g = document.createElement('button'); g.type = 'button'; g.className = 'xgear'; g.setAttribute('aria-label', 'Actions');
      g.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.66 5.19L9.80 2.45L14.20 2.45L14.34 5.19A7.2 7.2 0 0 1 16.72 6.57L19.17 5.32L21.37 9.13L19.07 10.63A7.2 7.2 0 0 1 19.07 13.37L21.37 14.87L19.17 18.68L16.72 17.43A7.2 7.2 0 0 1 14.34 18.81L14.20 21.55L9.80 21.55L9.66 18.81A7.2 7.2 0 0 1 7.28 17.43L4.83 18.68L2.63 14.87L4.93 13.37A7.2 7.2 0 0 1 4.93 10.63L2.63 9.13L4.83 5.32L7.28 6.57A7.2 7.2 0 0 1 9.66 5.19Z"/><circle cx="12" cy="12" r="2.8"/></svg>'; // Lot 257 (FA 727) : rouage épuré, style des icônes photo/bulle.
      host.append(g); if (host.classList.contains('dfix') && getComputedStyle(host).position === 'static') { host.style.position = 'relative'; host.style.top = '0'; }
      app.classList.add('xg');
      g.addEventListener('pointerdown', e => e.stopPropagation());
      g.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); gearMenu(g, acts); });
    } }
  drawLine();
  initCef(app);
  const cm = $('#cm');
  if (cm) cm.oninput = () => { cm.style.height = 'auto'; cm.style.height = Math.min(120, cm.scrollHeight) + 'px'; };
  // Lot 66 : en volet déplié, on rafraîchit le volet sur place (la liste n'est pas redessinée).
  const rr = () => inline ? view(app, { id, inline: true }) : render();
  const cb = $('#comment');
  if (cb) cb.onclick = e => busy(e.target, async () => {
    if (!cm.value.trim()) return toast('Le commentaire est vide.', true);
    const { error } = await sb.rpc('add_comment', { p_id: id, p_body: cm.value });
    if (error) return toast(errMsg(error), true);
    cm.blur(); dispatchEvent(new CustomEvent('gi:bump', { detail: { id, n: 1 } })); rr();
    // Lot 166 : mobile, inter dépliée : clavier replié, la ligne de commentaire vient se caler juste au-dessus du menu du bas.
    if (inline && document.body.classList.contains('tech')) setTimeout(() => {
      const c = app.querySelector('.cin'); if (!c) return;
      const nav = document.querySelector('#bnav'), lim = nav ? nav.getBoundingClientRect().top : innerHeight;
      const d = c.getBoundingClientRect().bottom - (lim - 8); if (Math.abs(d) < 2) return;
      let sc = document.scrollingElement;
      for (let el = app.parentElement; el; el = el.parentElement) { const o = getComputedStyle(el).overflowY; if ((o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight) { sc = el; break; } }
      sc.scrollBy({ top: d, behavior: 'smooth' });
    }, 450);
  });
  const act = b => b.dataset.act === 'cloturer' ? closeChooser(id, doDelete) : busy(b, async () => {
    if (b.dataset.act === 'demander') { const { error } = await sb.rpc('request_transfer', { p_id: id }); return error ? toast(errMsg(error), true) : toast('Demande envoyée.'); }
    const { error } = await sb.rpc('transition', { p_id: id, p_action: b.dataset.act, p_comment: cm ? cm.value : '' });
    if (error) return toast(errMsg(error), true);
    if (b.dataset.act === 'resoudre') return doneScreen('Intervention terminée');
    if (b.dataset.act === 'liberer') return doneScreen('Vous ne prenez plus cette intervention');
    // Lot 106 : vue standard, la carte quitte aussitôt son ancienne catégorie et la liste se redessine.
    if (inline && $('#rows')) { const tr = app.closest('tr.xrow'); tr?.previousElementSibling?.remove(); tr?.remove(); toast(ACTMSG(b.dataset.act)); return dispatchEvent(new Event('gi:reload')); }
    toast(ACTMSG(b.dataset.act)); rr();
  });
  $$('[data-act]').forEach(b => {
    b._run = b.dataset.act === 'liberer' ? async () => { if (await confirmBox('Se retirer de l\'intervention ?', 'Oui', { cancel: 'Non' })) act(b); } : () => act(b);
    if (b.dataset.act === 'liberer') { b.onclick = async () => { if (await confirmBox('Se retirer de l\'intervention ?', 'Oui', { cancel: 'Non' })) act(b); }; return; }
    if (inline || !['resoudre', 'cloturer', 'prendre'].includes(b.dataset.act)) { b.onclick = () => act(b); return; }
    // Terminer / Ne plus prendre : appui maintenu 1 s (contour qui se dessine), relâcher avant annule.
    b.insertAdjacentHTML('beforeend', '<svg class="hold-ring" aria-hidden="true"><rect x="1" y="1" rx="8" ry="8" pathLength="100"/></svg>');
    let tm = null;
    const stop = () => { clearTimeout(tm); tm = null; b.classList.remove('holding'); };
    b.onpointerdown = e => { if (b.disabled) return; e.preventDefault(); b.classList.add('holding'); tm = setTimeout(async () => { stop(); if (b.dataset.act === 'liberer' && !(await confirmBox('Voulez-vous vraiment rendre l\'intervention ?', 'Oui', { cancel: 'Non' }))) return; act(b); }, 1000); };
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, stop));
    b.oncontextmenu = e => e.preventDefault();
    b.onclick = e => e.preventDefault();
  });
  // Photos : vignettes à valider (suppression possible), puis envoi.
  // Photo du fil : agrandie en plein écran au toucher.
  $$('.cthumb').forEach(im => im.onclick = () => zoomImg(im.src));
  $$('.phpill').forEach(p => p.onclick = () => { const L = p.dataset.ph.split(' '); zoomImg(L[0], L); });
  $$('.phs a').forEach(a => a.onclick = e => { e.preventDefault(); zoomImg(a.href); });
  const phc = $('.phc'), phi = $('.phc-i');
  if (phc) {
    const step = () => (phc.firstElementChild?.offsetWidth || 0) + 8;
    const upd = () => {
      const i = Math.round(phc.scrollLeft / (step() || 1));
      const vis = Math.max(1, Math.round((phc.clientWidth + 8) / (step() || 1)));
      if (phi) phi.textContent = `Photo ${Math.min(phc.children.length, i + vis)}/${phc.children.length}`;
      const p = $('.phc-p'), n = $('.phc-n');
      if (p) p.hidden = phc.scrollLeft <= 4;
      if (n) n.hidden = phc.scrollLeft + phc.clientWidth >= phc.scrollWidth - 4;
    };
    phc.addEventListener('scroll', upd, { passive: true });
    $$('.phc-a').forEach(b => b.onclick = () => phc.scrollBy({ left: b.classList.contains('phc-n') ? step() : -step(), behavior: 'smooth' }));
  }
  // Lot 139.1 : une photo envoyée ne peut plus être supprimée (plus de croix ni de suppression).
  document.querySelectorAll('.phsheet').forEach(x => x.remove());
  const phs = $$('input#ph');
  if (phs.length) {
    const sh = document.createElement('div');
    sh.className = 'phsheet'; sh.hidden = true;
    sh.innerHTML = '<div class="pstrip"><div class="ptray"></div><button type="button" class="padd" data-add aria-label="Ajouter des photos"><span>+</span></button></div><div class="actions"><button type="button" class="ghost" data-x>Annuler</button><button type="button" class="primary" data-ok>Envoyer</button></div>';
    // Lot 138.4 : le « + » reste aussi en version mobile (ajoute d'autres photos à l'envoi en attente).
    document.body.appendChild(sh);
    const tray = sh.querySelector('.ptray');
    const files = photoTray(phs, tray, f => { sh.hidden = !f.length; }, 10 - myPh);
    if (sh.querySelector('[data-add]')) sh.querySelector('[data-add]').onclick = () => phs[phs.length - 1].click();
    sh.querySelector('[data-x]').onclick = () => { files.splice(0); tray.innerHTML = ''; sh.hidden = true; };
    const ok = sh.querySelector('[data-ok]');
    ok.onclick = () => busy(ok, async () => {
      try { const n = await uploadPhotos(id, [...files]); sh.remove(); dispatchEvent(new CustomEvent('gi:bump', { detail: { id, n, ph: 1 } })); toast(n > 1 ? `${n} photos ajoutées.` : 'Photo ajoutée.'); rr(); }
      catch (err) { toast(errMsg(err), true); }
    });
    window.addEventListener('hashchange', () => sh.remove(), { once: true });
  }
  const del = $('#del');
  async function doDelete() {
    if (!(await confirmBox('Voulez-vous vraiment supprimer cette intervention ?', 'Supprimer'))) return;
    const paths = (photos || []).map(p => p.path);
    if (paths.length) await sb.storage.from('photos').remove(paths);
    const { error } = await sb.from('interventions').delete().eq('id', id);
    if (error) return toast(errMsg(error), true);
    toast('Intervention supprimée.');
    go('');
  }
  if (del) del.onclick = () => busy(del, doDelete);
}

// Étiquettes de la Chronologie, comme dans l'appli gestion : orange + clé à molette pour la technique, bleu + mallette pour les autres.
// Écran « Intervention terminée » quelques secondes, puis retour à la liste.
export function doneScreen(msg, after) {
  const o = document.createElement('div');
  o.className = 'donescr';
  o.innerHTML = '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5"/></svg><p>' + msg + '</p>';
  (document.querySelector('#shell') || document.body).appendChild(o);
  setTimeout(() => { o.remove(); after ? after() : go(''); }, 800);
}
const CWI = {
  tech: WRENCH,
  cli: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>',
  rec: BRIEFCASE,
};

const CAM = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M9.2 4.5h5.6l1.5 2.2H19a2.5 2.5 0 0 1 2.5 2.5v8.3A2.5 2.5 0 0 1 19 20H5a2.5 2.5 0 0 1-2.5-2.5V9.2A2.5 2.5 0 0 1 5 6.7h2.7zM12 9.6a3.6 3.6 0 1 0 0 7.2a3.6 3.6 0 1 0 0-7.2z"/><circle cx="12" cy="13.2" r="2.1" fill="currentColor"/></svg>'; // Lot 280 (FA 735) : même dessin que l'icône photo des cartes.
// Lieu court : « MH 12 » pour un mobil-home, sinon le lieu tel quel.
const locTag = l => { const m = String(l).trim().match(/^(?:mobil[- ]?home|mh)?\s*(\d+)$/i); return m ? 'MH ' + n2(m[1]) : String(l).trim(); };
// Clôture d'une intervention non prise : qui l'a faite (membre, ou « Autres » + nom), ou suppression.
function closeChooser(id, doDelete) {
  const ms = (state.members || []).filter(m => ['technicien', 'responsable_tech'].includes(m.role));
  const o = document.createElement('div');
  o.className = 'modal';
  o.innerHTML = `<div class="mbox cchoose"><p class="mq">Qui a pris en charge l'intervention ?</p>
    <div class="ctags">${ms.map(m => `<button type="button" class="cwho" data-u="${m.user_id}">${['technicien', 'responsable_tech'].includes(m.role) ? WRENCH : BRIEFCASE}<span>${esc(memberName(m.user_id))}</span></button>`).join('')}<button type="button" class="cwho" data-u="">Quelqu'un d'autre</button></div>
    <input class="cother" type="text" placeholder="Nom de la personne" hidden>
    <button type="button" class="ghost danger cdel">Supprimer l'intervention</button>
    <div class="mbtns"><button type="button" class="ghost" data-r="0">Annuler</button><button type="button" class="primary" data-r="1">Clôturer</button></div></div>`;
  (document.querySelector('#shell') || document.body).appendChild(o);
  const ok = o.querySelector('[data-r="1"]'), oth = o.querySelector('.cother');
  let sel = null;
  const upd = () => {}; // Lot 61 : auteur facultatif.
  oth.oninput = upd;
  o.onclick = async e => {
    const b = e.target.closest('button');
    if (!b) { if (e.target === o) o.remove(); return; }
    if (b.dataset.u != null) {
      sel = b.dataset.u;
      o.querySelectorAll('.ctags .cwho').forEach(x => x.classList.toggle('on', x === b));
      oth.hidden = sel !== ''; if (sel === '') oth.focus();
      return upd();
    }
    if (b.classList.contains('cdel')) { o.remove(); return doDelete(); }
    if (b.dataset.r === '0') return o.remove();
    if (b.dataset.r === '1') busy(b, async () => {
      const { error } = await sb.rpc('close_for', { p_id: id, p_tech: sel || null, p_other: sel ? null : oth.value.trim() });
      if (error) return toast(errMsg(error), true);
      o.remove(); doneScreen('Intervention clôturée');
    });
  };
}

// Étiquette = auteur de l'action (orange/clé : tech ; bleu : réception) ; l'action en gris dessous.
// Tchat : message en bulle, les miens à droite, ceux des autres à gauche (étiquette nom au-dessus).
const UNTAKE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="8" r="4"/><path d="M3 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 4 1.5"/><path d="M16 19h6"/></svg>';
function dayLbl(d) { const x = new Date(d), t = new Date(); const k = v => v.toDateString(); if (k(x) === k(t)) return 'Aujourd\'hui'; t.setDate(t.getDate() - 1); if (k(x) === k(t)) return 'Hier'; return x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }); }
// Tchat : événements en ligne centrée grise, messages en bulles (les miens à droite, en noir).
// Rôle d'un prénom affiché (destinataire d'un transfert) : membre réel, sinon profil de l'admin.
function roleOfName(n) {
  const m = state.members.find(x => x.role !== 'admin' && (x.full_name || x.email) === n);
  return m ? m.role : (Object.keys(PNAME).find(k => k !== 'admin' && PNAME[k] === n) || '');
}
// Refonte du tchat : cercle de fonction coloré propre au profil + bulle (prénom coloré et heure en tête).
const pc = n => pcolor(n, state.members || [], PNAME);
const pav = (n, w, c = 'pav') => { const k = pc(n); return `<span class="${c}" style="background:${k.bg};color:${k.fg}" aria-hidden="true">${CWI[w] || ''}</span>`; };
// Lot 385 (FA 786) : prénom en étiquette grise avec icône (clé : technicien ; attaché-case : direction, réception).
const pnm = (n, t, r) => `<span class="pnm"><b>${roleIco(r)}${esc(compactName(n || '—'))}</b><span>${t}</span></span>`;
// Lot 222 (L1) : ligne automatique = heure en colonne (.tm) + texte (.tx) ; même texte, même ordre.
const sy = (cls, t, tx) => `<div class="sysl${cls}"><span class="tm">${t}</span><span class="tx">${tx}</span></div>`;
function phMsg(g, own, urls) {
  const ok = g.filter(x => urls[x.body]); if (!ok.length) return '';
  const e = g[0], n = ok.length, L = ok.map(x => urls[x.body]);
  // Lot 385 (FA 786) : pastille compteur (vignettes rondes superposées + « N photos ») ; un appui ouvre la galerie.
  return `<div class="msg prow${own ? ' own' : ''}">${pnm(e.actor_name, hm(g[g.length - 1].created_at), e.actor_role)}<div class="bub pbub"><span class="phpill" role="button" tabindex="0" data-ph="${esc(L.join(' '))}">${L.slice(0, 3).map(u => `<img src="${u}" alt="">`).join('')}<span>${n} photo${n > 1 ? 's' : ''}</span></span></div></div>`;
}
function bubble(e, own, urls, it = {}) {
  const w = roleKind(e.actor_role);
  const who = esc(compactName(e.actor_name || '—'));
  if (e.type === 'photo') return phMsg([e], own, urls);
  // Création : petite ligne système centrée « Prénom a créé l'intervention · HH:MM ».
  const cre = sy(' scre', hm(e.created_at), `${esc(compactName(e.actor_name || '—'))} a créé l'intervention`);
  if (['creee', 'publiee'].includes(e.type)) return cre;
  // Lot 65 : transferts sans doublon (pas de libellé générique en plus du texte).
  if (e.type === 'demande_transfert' && e.body) return sy('', '', `${who} · Demande d'intervention`);
  if (e.type === 'prise_en_charge' && /^Transférée par /.test(e.body || '')) { const to = (e.body.match(/ à (.*)$/) || [])[1] || ''; const tw = roleKind(roleOfName(to)); return sy('', '', `${esc(compactName(to))} · Reprend l'intervention`); }
  // Lot 93 : modification détaillée, une ligne « X a remplacé Y par Z » par champ.
  // Lot 118.3 : les changements de créneau n'apparaissent plus non plus.
  // Lot 111 : les modifications de titre, description et priorité n'apparaissent plus (anciens messages compris).
  if (e.type === 'modifiee' && e.body) return e.body.split('\n').filter(l => { const m = l.match(/^a remplacé « ([\s\S]*) » par « ([\s\S]*) »$/); if (!m) return true; const P = ['Basse', 'Normale', 'Haute']; const S = x => x === '—' || /^\d\d\/\d\d \d\d:\d\d/.test(x); return !(S(m[1]) && S(m[2])) && !(P.includes(m[1]) && P.includes(m[2])) && ![it.title, it.description].some(x => (x || '').trim() && m[2] === x); }).map(l => sy('', hm(e.created_at), `${who} ${esc(l)}`)).join('');
  // Lot 110.3 : « Réalisée par … » (clôture d'une intervention non prise) n'apparaît pas ; clôture par « Quelqu'un d'autre » : aucune ligne (110.4).
  if (e.type === 'resolue' && /^Réalisée par /.test(e.body || '')) { const n = e.body.slice(13); if (!(state.members || []).some(m => n === (m.full_name || m.email))) return ''; e = { ...e, body: '' }; }
  if (e.type === 'resolue') return sy(' scre', hm(e.created_at), `${esc(compactName(e.actor_name || '—'))} a terminé l'intervention${e.body ? `<span class="syb">« ${esc(e.body)} »</span>` : ''}`);
  // Lot 385 (FA 785) : rétablissement sans le nom de la personne qui l'a fait.
  if (e.type === 'reactivee') return sy('', hm(e.created_at), `${esc(EVENTS.reactivee)}${e.body ? `<span class="syb">« ${esc(e.body)} »</span>` : ''}`) + (e.taker ? sy('', hm(e.created_at), `${esc(compactName(e.taker))} · Prend l'intervention`) : '');
  if (e.type !== 'commentaire') return sy('', hm(e.created_at), `${who} · ${esc(EVENTS[e.type] || e.type)}${e.body ? `<span class="syb">« ${esc(e.body)} »</span>` : ''}`);
  return `${e.cre ? cre : ''}<div class="msg prow${own ? ' own' : ''}">${pnm(e.actor_name, hm(e.created_at), e.actor_role)}<div class="bub"><span class="btxt">${esc(e.body || '')}</span></div></div>`;
}
function tagsOf(it, events) {
  const e = (events || []).find(x => x.type === 'creee') || (events || []).find(x => x.type === 'publiee') || {};
  const w = roleKind(e.actor_role);
  return it.assignee_id ? `<span class="cwho cw-tech tk">${CWI.tech}<span>${esc(assigneeName(it))}</span></span>` : it.proposed_to ? assTag(it.proposed_to) : '';
}
function step(e, last, urls) {
  const w = roleKind(e.actor_role);
  const ago = fmtAgo(e.created_at), act = `${EVENTS[e.type] || e.type} ${/^\d/.test(ago) ? 'le ' + ago : ago.charAt(0).toLowerCase() + ago.slice(1)}`;
  const body = e.type === 'photo'
    ? (urls[e.body] ? `<img class="cthumb" src="${urls[e.body]}" alt="Photo">` : '')
    : e.body ? `<p class="ctx">${esc(e.body)}</p>` : '';
  return `<div class="cstep${last ? ' last' : ''}"><div class="dot"></div><div class="cbody">
    <div class="crow"><span class="clab">${e.type === 'commentaire' ? '<i class="cdot-c" aria-hidden="true"></i>' : ''}<span class="cwho cw-${w}">${CWI[w]}<span>${esc(compactName(e.actor_name || '—'))}</span></span></span><span class="cwhen">${esc(act)}</span></div>${body}</div></div>`;
}

// Trait vertical d'un centre de point à l'autre (comme la Chronologie de l'appli hôtel).
function drawLine() {
  const c = $('.chrono'); if (!c || !c.querySelector('.chrono-line')) return;
  const ln = c.querySelector('.chrono-line'), d = c.querySelectorAll('.cstep .dot');
  if (d.length < 2) { ln.style.height = '0'; return; }
  const cr = c.getBoundingClientRect(), a = d[0].getBoundingClientRect(), z = d[d.length - 1].getBoundingClientRect();
  const y0 = (a.top + a.bottom) / 2 - cr.top, y1 = (z.top + z.bottom) / 2 - cr.top;
  ln.style.left = ((a.left + a.right) / 2 - cr.left - 0.5) + 'px';
  ln.style.top = y0 + 'px';
  ln.style.height = (y1 - y0) + 'px';
  c.querySelectorAll('img').forEach(img => img.complete || img.addEventListener('load', drawLine, { once: true }));
}
window.addEventListener('resize', drawLine);

// Lot 137 : zone de commentaire jamais cachée par le clavier iOS ni par sa barre de raccourcis (iPad avec clavier physique).
// --kb = hauteur masquée en bas de l'écran ; colonnes et pages du détail raccourcies d'autant, puis la zone est ramenée à l'écran.
const VV = window.visualViewport;
function kbSync() {
  const k = VV ? Math.max(0, Math.round(document.documentElement.clientHeight - VV.height - VV.offsetTop)) : 0;
  document.documentElement.style.setProperty('--kb', k + 'px');
  document.body.classList.toggle('kbo', k > 80 && document.activeElement?.id === 'cm'); // Lot 194 : footer masqué pendant la frappe clavier ouvert
}
function cinShow() {
  const m = document.activeElement; if (!m || m.id !== 'cm') return;
  kbSync();
  requestAnimationFrame(() => {
    // Lot 189 : plus de scrollIntoView (sauts sur iOS) : on ne recale que si la zone est réellement cachée, en haut ou en bas.
    const c = m.closest('.cin') || m, r = c.getBoundingClientRect();
    const top = VV ? VV.offsetTop : 0; let bot = VV ? VV.offsetTop + VV.height : innerHeight;
    const nv = document.getElementById('bnav'), nr = nv && nv.offsetParent !== null ? nv.getBoundingClientRect() : null; if (nr && nr.height && nr.top < bot) bot = nr.top; // Lot 194 : le footer ne masque plus le champ
    let d = r.bottom - bot + 8; if (d <= 0) { d = r.top - top - 8; if (d >= 0) return; }
    // Lot 200 : vue standard (colonnes) : la carte entière remonte en haut de sa colonne, le tchat n'est plus coupé sous l'en-tête.
    const gc = !document.body.classList.contains('tech') && c.closest('.gcol'), tr = c.closest('tr'), hd = tr && tr.previousElementSibling;
    if (gc && hd && hd.matches('tr[data-id]')) { gc.scrollTop += hd.getBoundingClientRect().top - gc.getBoundingClientRect().top; return; }
    for (let el = c.parentElement; el; el = el.parentElement) { const o = getComputedStyle(el).overflowY; if ((o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight) { el.scrollTop += d; return; } }
    scrollBy(0, d);
  });
}
// Lot 137 : clavier refermé (message envoyé, appui ailleurs) : la page mobile revient en place, le pied de page reste en bas.
function cinReset() {
  kbSync();
  const a = document.activeElement;
  if (a && a.matches?.('input, textarea, [contenteditable]')) return;
  if (document.body.classList.contains('tech') && document.querySelector('#app .dpage.dmob') && !document.querySelector('#app .xdet')) scrollTo(0, 0);
}
let vvH = VV ? VV.height : 0;
VV?.addEventListener('resize', () => { const big = Math.abs(VV.height - vvH) > 120; vvH = VV.height; if (document.activeElement?.id === 'cm') { kbSync(); if (big) cinShow(); } else cinReset(); }); // Lot 189 : seule l'ouverture du clavier recale, pas la barre Safari
// Lot 187 : curseur dans le commentaire : faire défiler le tchat ne fait plus sauter la page (le défilement du viewport ne relance plus le recalage).
let chatTouch = 0;
document.addEventListener('touchstart', e => { if (e.target.closest?.('.chat2 .chrono')) chatTouch = Date.now(); }, { passive: true });
document.addEventListener('touchmove', e => { if (e.target.closest?.('.chat2 .chrono')) chatTouch = Date.now(); }, { passive: true });
VV?.addEventListener('scroll', () => { if (document.activeElement?.id === 'cm') kbSync(); else cinReset(); }); // Lot 189 : défiler avec le clavier ouvert ne recale plus rien
document.addEventListener('focusin', e => { if (e.target.id === 'cm') { cinShow(); setTimeout(cinShow, 300); setTimeout(cinShow, 700); } });
document.addEventListener('focusout', e => { if (e.target.id === 'cm') { setTimeout(cinReset, 60); setTimeout(cinReset, 400); } });
// Lot 137 : un appui dans la zone de texte y place toujours le curseur (focus forcé si le navigateur ne l'a pas donné).
document.addEventListener('touchend', e => { const m = e.target.closest?.('#cm'); if (m && document.activeElement !== m) m.focus(); }, { passive: true });

// Lot 223 : état du bouton « Modifier » tenu à jour avec les verrous d'édition (contrôle toutes les 20 s).
addEventListener('gi:locks', () => document.querySelectorAll('a[data-edit]').forEach(a => { if (lockedByOther(a.dataset.edit)) { a.setAttribute('aria-disabled', 'true'); a.tabIndex = -1; } else { a.removeAttribute('aria-disabled'); a.removeAttribute('tabindex'); } }));
document.addEventListener('click', e => { if (e.target.closest?.('a[data-edit][aria-disabled="true"]')) { e.preventDefault(); e.stopPropagation(); } }, true);
function gearMenu(g, acts) {
  // Lot 106 : nouvel appui sur le rouage = fermeture du menu.
  if (Date.now() - (g._shut || 0) < 500) return;
  document.querySelector('.xmenu')?.remove();
  const m = document.createElement('div'); m.className = 'xmenu';
  m.innerHTML = acts.map((a, i) => `<button type="button" data-i="${i}"${a.classList.contains('danger') ? ' class="danger"' : ''}${a.getAttribute('aria-disabled') === 'true' ? ' disabled' : ''}>${esc(a.getAttribute('aria-label') || a.textContent.trim())}</button>`).join('');
  document.body.append(m);
  const r = g.getBoundingClientRect(), h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + 'px'; // Lot 122 : coin supérieur droit du menu juste sous le rouage.
  m.style.top = (r.bottom + 2 + h > innerHeight - 8 ? Math.max(8, r.top - 2 - h) : r.bottom + 2) + 'px';
  const close = () => { g._shut = Date.now(); m.remove(); document.removeEventListener('pointerdown', out, true); removeEventListener('scroll', close, true); };
  const out = e => { if (!m.contains(e.target)) close(); };
  setTimeout(() => { document.addEventListener('pointerdown', out, true); addEventListener('scroll', close, true); }, 0);
  m.onclick = e => { const b = e.target.closest('button'); if (!b) return; close(); const a = acts[+b.dataset.i]; a._run ? a._run() : a.click(); };
}
