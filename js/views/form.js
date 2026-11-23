import { sb } from '../sb.js?v=20261123155224';
import { state, isManager, isRealAdmin, role, memberName } from '../state.js?v=20261123155224';
import { $, esc, toast, errMsg, busy, formData, confirmBox, PRIORITY, cef, initCef, sbar, WRENCH, BRIEFCASE, padMH, CLOCK, fmtAgo } from '../ui.js?v=20261123155224';
import { uploadPhotos, photoTray } from '../photos.js?v=20261123155224';
import { slotTxt, table, pslotR } from './list.js?v=20261123155224';
import { go } from '../app.js?v=20261123155224';
import { takeLock } from '../lock.js?v=20261123155224';

// Création / modification d'une intervention (gestionnaires).
export async function view(app, { id }) {
  let it = { title: '', location: '', description: '', priority: 'normale' };
  if (id && role() === 'client') return go(''); // Lot 225 : le client n'accède qu'à sa page.
  if (id) {
    const { data, error } = await sb.from('interventions').select('*').eq('id', id).single();
    if (error) throw error;
    it = data;
    // Lot 225 : auteur ; planifiée : personne assignée, responsables et admins (même règle que la RLS itv_update).
    if (it.created_by !== state.user.id && !(it.available_from && (it.proposed_to === state.user.id || isManager() || isRealAdmin()))) { app.innerHTML = '<p class="pad muted">Seul l\'auteur de l\'intervention peut la modifier.</p>'; return; }
    // Lot 223 : verrou d'édition (un seul utilisateur modifie l'intervention à la fois).
    const lk = await takeLock(id); if (!lk.ok) { app.innerHTML = `<p class="pad muted">${esc(lk.name || 'Quelqu\'un')} modifie déjà cette intervention.</p>`; return; }
  }
  // Lot 125.2 : brouillon auto du formulaire de création, restauré après une actualisation.
  const DK = id ? null : 'gi:dr:new';
  if (DK) localStorage.removeItem(DK); // Lot 127 : plus de restauration (formulaire restauré inutilisable sur iPad) ; voir list.js.
  const cli = role() === 'client'; // Lot 101 : interface client.
  const backHref = it.status === 'brouillon' ? (document.body.classList.contains('tech') ? '#/nouvelles' : '#/') : (id ? '#/intervention/' + id : '#/');
  const NFROW = `<div class="nf-row"><div class="nf">${cef('title', (it.title || '').slice(0, 70), cli ? 'Titre de l\'intervention' : 'Titre')}</div>
        <div class="nf ac">
          <div class="nf">${cef('location', it.location, 'Lieu', { attrs: 'data-max="21" data-maxw="Camp saisonnier" aria-autocomplete="list" aria-expanded="false" autocapitalize="off" autocorrect="off" spellcheck="false"' })}</div>
          <ul class="ac-list" role="listbox" hidden></ul>
        </div></div>`;
  app.innerHTML = `
    <div class="page narrow">
      <div class="head"><div class="hl">${id ? `<a href="${backHref}" class="back" aria-label="Retour"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></a>` : ''}<h1${id ? '' : ' class="fnew"'}>${id ? 'Modifier l\'intervention' : 'Nouvelle intervention'}</h1></div>${id ? '' : '<button type="button" class="back fx" aria-label="Fermer"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg></button>'}</div>
      <form id="f" class="nform${cli ? ' fcli' : ''}${id ? '' : ' stp1'}" autocomplete="off">
        ${`<div class="nf ndesc0"><div class="nbox">${NFROW}<div class="npv"></div></div></div>`}
        <fieldset class="nf seg"><legend>Priorité</legend>
          ${Object.entries(PRIORITY).map(([k, v]) => `<label><input type="radio" name="priority" value="${k}" ${k === it.priority ? 'checked' : ''}><span>${v}</span></label>`).join('')}
        </fieldset>
        <div class="ndrow"><div class="ncol">
        ${(!id || (it.status === 'publiee' && !it.assignee_id)) && ['directeur', 'responsable_tech'].includes(role()) ? `<fieldset class="nf seg assign"><legend>Assigner à un technicien</legend>
          ${(state.members || []).filter(m => m.role === 'technicien' || (m.role === 'responsable_tech' && role() === 'directeur')).map(m => `<label><input type="checkbox" name="assign" value="${m.user_id}" ${it.proposed_to === m.user_id ? 'checked' : ''}><span class="cwho">${m.role === 'technicien' ? WRENCH : BRIEFCASE}<span>${esc(memberName(m.user_id))}</span></span></label>`).join('')}
        </fieldset>` : ''}
        <fieldset class="nf hpsw hpt" id="hp"><legend>Passage</legend>
          <label><input type="radio" name="passage" value="now" ${(it.available_from || it.client_presence) ? '' : 'checked'}><span>Passage libre</span></label><label><input type="radio" name="passage" value="slot" ${(it.available_from || it.client_presence) ? 'checked' : ''}><span>Présence client requise</span></label><span class="hptx">Présence client requise</span><button type="button" class="hpsw2" role="switch" aria-label="Présence client requise"></button><span class="hpcr"><button type="button" class="hpclk" aria-label="Choisir le créneau"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></button><span class="hpv"></span></span>
        </fieldset>
        <div class="nf slot" ${it.available_from ? '' : 'hidden'}><input type="hidden" name="slot_d" value="${dIn(it.available_from)}"><input type="hidden" name="slot_a" value="${tIn(it.available_from)}"><input type="hidden" name="slot_b" value="${tIn(it.available_until)}">
          <button type="button" class="ghost wsum"></button>
          <div class="wsheet" hidden><div class="wbox"><button type="button" class="wx" aria-label="Fermer">×</button><div class="wheels"><div class="wcol w-d"><span class="wh">Jour</span><div class="wheel" data-k="slot_d">${DAYS(it.available_from).map(([v, l]) => `<div class="wi" data-v="${v}">${l}</div>`).join('')}</div></div><div class="wcol"><span class="wh">De</span><div class="wheel" data-k="slot_a">${TIMES.map(t => `<div class="wi" data-v="${t}">${t}</div>`).join('')}</div></div><div class="wcol"><span class="wh">À</span><div class="wheel" data-k="slot_b">${TIMES.map(t => `<div class="wi" data-v="${t}">${t}</div>`).join('')}</div></div><div class="wband" aria-hidden="true"></div></div><button type="button" class="primary wok">Valider</button><button type="button" class="ghost">Retirer le créneau</button></div></div></div>
        </div>${`<div class="nf dsq">${cef('description', it.description, cli ? 'Décrivez votre demande en quelques lignes' : 'Description', { multi: true, attrs: 'data-lines="10"' })}</div>`}</div>
        ${`<div class="nf nph${id ? ' pedit' : ''}">Photos
          <div class="pstrip"><div class="ptray"></div><label class="padd" aria-label="Ajouter des photos"><input name="photos" type="file" accept="image/*" multiple hidden><span>+</span></label></div>
        </div>`}
        <div class="nactions">
          <button type="submit" class="primary" value="${id ? 'save' : 'publier'}">${id ? 'Enregistrer' : 'Suivant'}</button>
          ${id || !(isManager() || role() === 'technicien' || cli) ? '' : '<span class="bdwrap"><button type="submit" class="ghost" value="brouillon" hidden tabindex="-1"></button><button type="button" class="ghost bdchev" aria-haspopup="menu" aria-expanded="false" aria-label="Brouillons"></button><button type="button" class="ghost bdsave">Brouillon +</button></span>'}
          ${id && it.status === 'brouillon' ? '<button type="button" class="ghost danger bddel-form">Supprimer</button>' : ''}
          <a class="btn ghost" href="${backHref}">Annuler</a>
        </div>
      </form>
    </div>`;

  initCef($('#f')); sbar($('#f [data-name=description]'));
  // Lot 332 : compteur + chevron (menu des brouillons) à gauche ; « Brouillon + » enregistre.
  { const wrap = $('#f .bdwrap'), chev = wrap?.querySelector('.bdchev'), save = wrap?.querySelector('.bdsave'), db = wrap?.querySelector('button[value=brouillon]');
    if (wrap && chev) {
      const DCHEV = '<svg class="chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5L6 8L9.5 4.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      const TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
      let rows = [];
      const paint = () => { chev.setAttribute('aria-label', 'Brouillons, ' + rows.length); chev.innerHTML = '<span class="bdcount">' + rows.length + '</span>' + DCHEV; };
      paint();
      const delDraft = async id => {
        if (!(await confirmBox('Voulez-vous vraiment supprimer ce brouillon ?', 'Supprimer'))) return false;
        const { error } = await sb.from('interventions').delete().eq('id', id);
        if (error) { toast(errMsg(error), true); return false; }
        toast('Brouillon supprimé.');
        return true;
      };
      const openDraftsMenu = () => {
        document.querySelector('.xmenu')?.remove();
        const m = document.createElement('div'); m.className = 'xmenu bdmenu';
        m.innerHTML = rows.map(r => '<div class="bdrow"><button type="button" data-id="' + esc(r.id) + '">' + esc((r.title || '').trim().slice(0, 70) || 'Sans titre') + '</button><button type="button" class="bddel" data-del="' + esc(r.id) + '" aria-label="Supprimer">' + TRASH + '</button></div>').join('') || '<button type="button" disabled>Aucun brouillon</button>';
        document.body.append(m);
        const r = chev.getBoundingClientRect(), h = m.offsetHeight, w = m.offsetWidth;
        const left = Math.max(8, Math.min(r.right - w, (window.innerWidth || document.documentElement.clientWidth) - w - 8));
        const space = (window.innerHeight || document.documentElement.clientHeight);
        m.style.left = left + 'px';
        m.style.top = (r.bottom + 2 + h > space - 8 ? Math.max(8, r.top - 2 - h) : r.bottom + 2) + 'px';
        chev.setAttribute('aria-expanded', 'true');
        const close = () => { chev.setAttribute('aria-expanded', 'false'); m.remove(); document.removeEventListener('pointerdown', out, true); removeEventListener('scroll', close, true); };
        const out = e => { if (!m.contains(e.target) && e.target !== chev && !chev.contains(e.target) && !e.target.closest('.modal')) close(); };
        setTimeout(() => { document.addEventListener('pointerdown', out, true); addEventListener('scroll', close, true); }, 0);
        m.onclick = async e => {
          const del = e.target.closest('.bddel');
          if (del) {
            e.preventDefault(); e.stopPropagation();
            const did = del.dataset.del; close();
            if (await delDraft(did)) { rows = rows.filter(x => x.id !== did); paint(); }
            return;
          }
          const t = e.target.closest('button'); if (!t || t.disabled) return;
          const nid = t.dataset.id; close();
          if (nid) go('intervention/' + nid + '/modifier');
        };
      };
      chev.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openDraftsMenu(); });
      if (save) save.addEventListener('click', e => { e.preventDefault(); if (db && !db.disabled) $('#f').requestSubmit(db); });
      (async () => {
        let q = sb.from('interventions').select('id, title').eq('status', 'brouillon');
        if (!isManager()) q = q.eq('created_by', state.user.id);
        const { data } = await q.order('created_at', { ascending: false }).limit(300);
        if (!chev.isConnected) return;
        rows = data || [];
        paint();
      })();
    } }
  // Lot 154 : en modification, quitter (flèche retour ou Annuler) avec un changement non enregistré demande confirmation ; en version standard, retour à la vue en colonnes.
  if (id) { const fm = $('#f'), snap = () => JSON.stringify(formData(fm)); let s0 = null; setTimeout(() => { s0 = snap(); }, 400);
    const std = !document.body.classList.contains('tech') && document.documentElement.clientWidth > 600;
    app.querySelectorAll('a.back, a.nactions a.btn.ghost').forEach(a => {
      a.addEventListener('click', async e => { if (s0 === null || snap() === s0) return; e.preventDefault(); if (await confirmBox('Attention, votre modification ne sera pas enregistrée.', 'Quitter', { cancel: 'Rester' })) location.hash = a.getAttribute('href'); });
    });
    const dbn = fm.querySelector('.bddel-form');
    if (dbn) dbn.onclick = async () => {
      if (!(await confirmBox('Voulez-vous vraiment supprimer ce brouillon ?', 'Supprimer'))) return;
      const { error } = await sb.from('interventions').delete().eq('id', id);
      if (error) return toast(errMsg(error), true);
      toast('Brouillon supprimé.');
      go(document.body.classList.contains('tech') ? 'nouvelles' : '');
    };
  }
  // Lot 61 : la case Titre mesure la longueur de 35 caractères (texte courant), plus ses marges intérieures.
  { const tt = $('#f [data-name=title]'), cs = getComputedStyle(tt), cx = document.createElement('canvas').getContext('2d'); cx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    tt.style.width = Math.ceil(cx.measureText('Fuite d\'eau sous l\'évier cuisine B4').width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth) + 2) + 'px'; tt.style.maxWidth = '100%'; }
  // Lot 105.6 : le compteur est à côté du texte de la 2e ligne, dans la même case, sans chevauchement.
  // Lot 105.5 : l'espace tapé en fin de 1re case est conservé (la 2e case s'ouvre) ; compteur gris hors du texte.
  // Lot 105.4 : la 2e case n'apparaît (et n'occupe de place) que quand la 1re est remplie.
  // Lot 105.2 : titre limité à 70 caractères (pas à la largeur des lettres) ; 2 cases visibles dès le début ; la suite passe au mot près dans la seconde ; compteur à partir de 5 restants.
  { const t1 = $('#f [data-name=title]'), w = document.createElement('div'), t2 = document.createElement('div'), cnt = document.createElement('span');
    const cs = getComputedStyle(t1), cx = document.createElement('canvas').getContext('2d'); cx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    w.className = 'ttw'; t2.className = 'cef tt2'; t2.contentEditable = 'plaintext-only'; t2.setAttribute('role', 'textbox'); t2.setAttribute('aria-label', 'Suite du titre'); t2.spellcheck = false; t2.setAttribute('autocapitalize', 'off'); t2.setAttribute('autocorrect', 'off'); const tb2 = document.createElement('div'); tb2.className = 'tb2'; tb2.style.width = t1.style.width; tb2.style.maxWidth = '100%';
    cnt.className = 'tcnt'; cnt.setAttribute('aria-hidden', 'true'); t1.before(w); tb2.append(t2, cnt); w.append(t1, tb2); { // Lot 109 : Description sous la case intervention (même largeur, ~2× sa hauteur) ; Assigner et Heure de passage côte à côte dessous.
      const dq = $('#f .dsq'), nd = $('#f .ndesc0'); if (dq && nd) { dq.classList.replace('dsq', 'ndsc'); nd.after(dq); const d = dq.querySelector('.cef'); requestAnimationFrame(() => requestAnimationFrame(() => { if (!d) return; const F = $('#f'); // Lot 124 : bloc 2 à la hauteur définitive du bloc 3 dès son apparition ; le texte défile à l'intérieur.
        const fit = () => { const n = F.querySelector('.nb3'); if (!n || dq.__anim) return; let h; if (getComputedStyle(n).display === 'none') { n.classList.add('m3'); h = n.offsetHeight; n.classList.remove('m3'); } else h = n.offsetHeight; if (h && dq.style.height !== h + 'px') dq.style.height = h + 'px'; };
        dq.__fit = fit; fit(); new MutationObserver(fit).observe(F, { attributes: true, attributeFilter: ['class'] }); if (window.ResizeObserver) { const ro = new ResizeObserver(fit); ro.observe(F); const n = F.querySelector('.nb3'); if (n) ro.observe(n); } })); } // Lot 121 : bloc 2 réduit à une ligne / rouvert avec une transition douce.
      $('#f .ndrow')?.classList.add('nd2'); } { const pr = $('#f fieldset.seg:not(.assign):not(#hp)'); if (pr) { if (!pr.querySelector('input:checked')) { const nm = pr.querySelector('input[value=normale]'); if (nm) nm.checked = true; } // Lot 115 : Normale par défaut.
      const row = document.createElement('div'); row.className = 'ttrow'; w.before(row); row.append(w, pr); pr.classList.add('prc');
      // Lot 108 : vue standard, petit bouton « Priorité » ; au survol on glisse entre Faible, Normale et Haute.
      // Lot 110 : mobile, bouton « Priorité » qui se déplie verticalement (Faible, Normale, Haute).
      // Lot 116 : un seul fonctionnement partout (standard et mobile) : un appui ouvre, un choix ferme ; « Priorité » tant que rien n'est choisi.
      { const tech = document.body.classList.contains('tech'), pw = document.createElement('div'); pw.className = tech ? 'prw prv' : 'prw'; pr.before(pw); pw.innerHTML = '<button type="button" class="prb">Priorité</button>'; pw.append(pr);
        // Lot 263 (FA 728) : libellés Urgent / Important / À faire (PRIORITY), plus de « Faible ».
        // Lot 117.1 : plus de menu ; chaque appui passe à la priorité suivante (Faible → Normale → Haute → Faible), avec sa couleur.
        let picked = !!id; const btn = pw.querySelector('.prb'), ins = [...pr.querySelectorAll('input')];
        const lab = () => { const c = ins.find(x => x.checked), v = picked && c ? c.nextElementSibling.textContent : ''; btn.className = 'prb' + (v ? ' pk p-' + c.value : ''); btn.innerHTML = v ? `<small>Priorité</small><span>${v}</span>` : 'Priorité'; }; lab(); // Lot 140.6 : en modification, la valeur enregistrée s'affiche dès l'ouverture (l'appel était resté dans le commentaire). Lot 139.3 : « Priorité élevée » (valeur enregistrée inchangée : 'haute'), même hiérarchie que Faible et Normale. lab();
        btn.addEventListener('mousedown', e => e.preventDefault()); /* Lot 297 : plus de preventDefault sur pointerdown : sous WebKit tactile (iPhone, iPad, mobile simulé) il annulait le clic, la priorité ne changeait pas ; mousedown suffit à garder le focus. */ btn.onclick = e => { e.preventDefault(); const y = scrollY; requestAnimationFrame(() => { if (scrollY !== y) scrollTo(0, y); }); const k = ins.findIndex(x => x.checked); (ins[picked ? (k + 1) % ins.length : 0]).checked = true; picked = true; lab(); $('#f').dataset.prio = ins.find(x => x.checked).value; /* Lot 282 (FA 739) */ }; } } }
    const raw = e => e.innerText.replace(/\u00a0/g, ' ').replace(/\n/g, '');
    const fits = x => cx.measureText(x).width <= t1.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const join = () => { const a = raw(t1), b = raw(t2); return b ? a.replace(/\s+$/, '') + (t2.dataset.cut ? '' : ' ') + b.replace(/^\s+/, '') : a; };
    const split = f => { if (fits(f)) { delete t2.dataset.cut; return [f, '']; } let k = 1; while (k < f.length && fits(f.slice(0, k + 1))) k++; let c = f.lastIndexOf(' ', k); if (c <= 0) { c = k; t2.dataset.cut = '1'; } else delete t2.dataset.cut; const r = f.slice(c), b = r.replace(/^\s+/, '') || (/\s/.test(r) ? ' ' : ''); return [f.slice(0, c).replace(/\s+$/, ''), b]; };
    const caret = () => { const sl = getSelection(); if (!sl.rangeCount) return null; const r = sl.getRangeAt(0), el = [t1, t2].find(e => e.contains(r.endContainer)); if (!el) return null; const q = document.createRange(); q.selectNodeContents(el); q.setEnd(r.endContainer, r.endOffset); const o = q.toString().length; return el === t1 ? o : raw(t1).replace(/\s+$/, '').length + 1 + o; };
    const put = (el, o) => { el.focus(); const n = el.firstChild; const r = document.createRange(); if (n) r.setStart(n, Math.min(o, n.length)); else r.setStart(el, 0); r.collapse(true); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); };
    const flow = (keep) => { const g = keep ? caret() : null; let f = join(); if (f.length > 70) f = f.slice(0, 70); const [a, b] = split(f); const ch = raw(t1) !== a || raw(t2) !== b; if (raw(t1) !== a) t1.textContent = a; if (raw(t2) !== b) t2.textContent = b;
      const L = join().length, left = 70 - L; cnt.textContent = left <= 10 ? String(left) : ''; w.classList.toggle('lim', left <= 10); w.classList.toggle('two', !!b); tb2.style.display = b ? '' : 'none'; if (!b && document.activeElement === t2) { put(t1, raw(t1).length); return; }
      if (ch && g != null) { if (g <= a.length || !b) put(t1, Math.min(g, a.length)); else put(t2, g - a.length - 1 + (b === ' ' ? 1 : 0)); } };
    Object.defineProperty(t1, 'value', { get: join, set: v => { t1.textContent = v || ''; t2.textContent = ''; flow(false); }, configurable: true });
        [t1, t2].forEach(e => { e.addEventListener('input', () => flow(true)); e.addEventListener('keydown', ev => { if (ev.key === 'Enter') ev.preventDefault(); }); });
    t2.addEventListener('keydown', ev => { if (ev.key !== 'Backspace') return; const sl = getSelection(); if (!sl.isCollapsed || caret() !== raw(t1).replace(/\s+$/, '').length + 1) return; ev.preventDefault(); const a = raw(t1).replace(/\s+$/, ''); t1.textContent = a.slice(0, -1); put(t1, a.length - 1); flow(true); });
    t2.addEventListener('beforeinput', ev => { if (ev.inputType === 'deleteContentBackward' && !raw(t2).trim()) { ev.preventDefault(); put(t1, raw(t1).length); } }); // Lot 122 : Effacer dans la 2e case vide ramène à la fin de la 1re.
    t1.addEventListener('beforeinput', ev => { if (ev.inputType.startsWith('insert') && join().length - getSelection().toString().length + (ev.data || '').length > 70) ev.preventDefault(); });
    t2.addEventListener('beforeinput', ev => { if (ev.inputType.startsWith('insert') && join().length - getSelection().toString().length + (ev.data || '').length > 70) ev.preventDefault(); });
    flow(false); if (window.ResizeObserver) new ResizeObserver(() => flow(false)).observe(t1); }
  // Lot 103.2 : aperçu de la carte, titre pleine largeur et date/heure en direct.
  // Lot 105.8 : Modifier reprend la carte du formulaire de création (titre, lieu, date de signalement).
  // Lot 105.3 : date juste après le lieu, sur la même ligne.
  { const n = $('#f .nbox .npv'), ac = $('#f .nbox .nf.ac'); if (n && ac) { const r = document.createElement('div'); r.className = 'nlr'; ac.before(r); r.append(ac, n); } }
  { const npv = $('#f .npv'); let last = '', tm = 0;
    const upd = () => {
      if (!npv || !npv.isConnected) return clearInterval(tm);
      const sl = $('#hp input:checked')?.value === 'slot', fd = $('#f [name=slot_d]')?.value, a = $('#f [name=slot_a]')?.value, b = $('#f [name=slot_b]')?.value;
      const r = sl && fd && a ? { available_from: new Date(`${fd}T${a}`).toISOString(), available_until: new Date(b ? new Date(`${fd}T${b}`).getTime() : new Date(`${fd}T${a}`).getTime() + 9e5).toISOString() } : null;
      const h = `<span class="sdt">${(n => `${n.getDate()} ${n.toLocaleDateString('fr-FR', { month: 'long' })} ${p2(n.getHours())}:${p2(n.getMinutes())}`)(id && it.created_at ? new Date(it.created_at) : new Date())}</span>${r ? `<span class="sched">${CLOCK}${slotTxt(r)}</span>` : ''}`;
      if (h !== last) { last = h; npv.innerHTML = h; }
    };
    if (npv) { upd(); tm = setInterval(upd, 250); } }
  // Heure de passage : la fourchette s'affiche seulement si elle est choisie.
  document.querySelectorAll('#hp input').forEach(r => (r.onchange = () => { $('#f .slot').hidden = $('#hp input:checked').value !== 'slot'; }));
  // Roues défilantes (type iOS) : jour, début, fin facultative. La valeur centrée est retenue.
  const IH = () => $('.wsheet .wi').offsetHeight || 36;
  const wheels = [...document.querySelectorAll('.wsheet .wheel')];
  const V = w => [...w.children].filter(x => !x.hidden);
  const pick = w => {
    const items = V(w), i = Math.max(0, Math.min(items.length - 1, Math.round(w.scrollTop / IH())));
    const prev = $(`#f [name=${w.dataset.k}]`).value, next = items[i].dataset.v;
    items.forEach((x, k) => x.classList.toggle('sel', k === i));
    $(`#f [name=${w.dataset.k}]`).value = next;
    // Lot 330 (FA 749) : changer de jour règle l'horaire sur 8 h (puis noPast si déjà passé).
    if (w.dataset.k === 'slot_d' && !placing && prev && next && prev !== next) {
      $('#f [name=slot_a]').value = '08:00';
      const wa = wheels.find(x => x.dataset.k === 'slot_a'), k = wa ? [...wa.children].findIndex(x => x.dataset.v === '08:00') : -1;
      if (wa && k >= 0) { wa.scrollTo({ top: k * IH() }); [...wa.children].forEach((x, j) => x.classList.toggle('sel', j === k)); }
      const ib = $('#f [name=slot_b]'); if (ib) ib.value = TIMES.find(tm => tm > '08:00') || '';
    }
    noPast(w);
  };
  // Lot 117.6 : pas de créneau antérieur à la date de l'intervention (maintenant en création, date de création en modification).
  const T0 = () => id && it.created_at ? new Date(it.created_at) : new Date();
  const isPast = (d, t) => !!(d && t) && new Date(`${d}T${t}`) < T0();
  let npBusy = false, placing = false, lastA = null;
  const noPast = src => { if (npBusy) return; npBusy = true; try {
    const d = $('#f [name=slot_d]').value;
    wheels.filter(w => w.dataset.k !== 'slot_d').forEach(w => [...w.children].forEach(x => x.classList.toggle('past', !!x.dataset.v && isPast(d, x.dataset.v))));
    const wa = wheels.find(w => w.dataset.k === 'slot_a'), wd = wheels.find(w => w.dataset.k === 'slot_d');
    if (wa && isPast(d, $('#f [name=slot_a]').value)) {
      const k = [...wa.children].findIndex(x => !x.classList.contains('past'));
      if (k >= 0) { wa.scrollTo({ top: k * IH(), behavior: 'smooth' }); [...wa.children].forEach((x, j) => x.classList.toggle('sel', j === k)); $('#f [name=slot_a]').value = wa.children[k].dataset.v; }
      else if (wd) { const j = [...wd.children].findIndex(x => x.dataset.v > d); if (j >= 0) { wd.scrollTo({ top: j * IH(), behavior: 'smooth' }); [...wd.children].forEach((x, q) => x.classList.toggle('sel', q === j)); $('#f [name=slot_d]').value = wd.children[j].dataset.v; } }
    }
    // Lot 118.5 : la colonne « À » ne propose que des heures après l'heure de début.
    const wb = wheels.find(w => w.dataset.k === 'slot_b'), a0 = $('#f [name=slot_a]').value;
    if (wb) { [...wb.children].forEach(x => { x.hidden = !!x.dataset.v && !!a0 && x.dataset.v <= a0; });
      const ib = $('#f [name=slot_b]'), nx = () => TIMES.find(t => t > a0) || ''; if (ib.value && a0 && ib.value <= a0) ib.value = nx(); if (src?.dataset?.k === 'slot_a' && !placing && lastA !== null && a0 !== lastA) ib.value = nx(); if (!ib.value && a0) ib.value = nx(); /* Lot 263 (FA 730) : fin toujours remplie (début + 15 min, modifiable), y compris en modification d'une intervention sans fin ; plus de choix « — ». */ /* Lot 226 : cause du 708 : l'heure de début proposée à l'ouverture (placing) ne remplissait jamais la fin ; valider cette heure gardait « — ». */ if (src?.dataset?.k === 'slot_a') lastA = a0; // Lot 122 / 222 : « À » propose aussitôt le créneau suivant l'heure choisie (modifiable).
      const k = Math.max(0, V(wb).findIndex(x => x.dataset.v === ib.value)); V(wb).forEach((x, j) => x.classList.toggle('sel', j === k)); if (Math.abs(wb.scrollTop - k * IH()) > 2) wb.scrollTop = k * IH(); }
  } finally { npBusy = false; } };
  const place = () => { placing = true; try { place0(); } finally { placing = false; } }; const place0 = () => wheels.forEach(w => {
    const inp = $(`#f [name=${w.dataset.k}]`);
    if (w.dataset.k === 'slot_a' && !inp.value) { const n = new Date(); const q = `${p2(n.getHours())}:${p2(Math.ceil(n.getMinutes() / 15) * 15 % 60)}`; inp.value = TIMES.find(t => t >= q) || '09:00'; }
    const i = Math.max(0, V(w).findIndex(x => x.dataset.v === inp.value));
    w.scrollTop = i * IH(); pick(w);
  });
  wheels.forEach(w => {
    let t; w.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => { if (w.offsetParent) pick(w); }, 60); }, { passive: true });
    w.onclick = e => { const it = e.target.closest('.wi'); if (it) w.scrollTo({ top: V(w).indexOf(it) * IH(), behavior: 'smooth' }); };
  });
  // Sélecteur en fenêtre : s'ouvre au choix « Fourchette horaire » ou au toucher du résumé, se ferme avec Valider.
  const sheet = $('#f .wsheet'), sumb = $('#f .wsum');
  document.querySelectorAll('.wsheet').forEach(x => x !== sheet && x.remove());
  (document.querySelector('#shell') || document.body).appendChild(sheet); // hors du formulaire animé, pour rester fixe
  const sumTxt = () => {
    const a = $('#f [name=slot_a]').value, b = $('#f [name=slot_b]').value, d = $('.wsheet .wheel[data-k=slot_d] .wi.sel')?.textContent || '';
    sumb.innerHTML = a && done ? `${esc(`${d} ${b ? `entre ${a} et ${b}` : `à partir de ${a}`}`)}<span class="wpen" aria-label="Modifier"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></span>` : 'Choisir le créneau';
  };
  // Lot 117.5 : le créneau choisi s'affiche à la place de « Présence requise » sur l'interrupteur (pas de ligne en plus) ; toucher l'option déjà choisie rouvre le sélecteur.
  const hsl = $('#hp input[value=slot] + span'), sumTx0 = sumTxt;
  { const hp = $('#hp'); if (hp) { const mv = hp._mv = () => { const l = hp.querySelector('input:checked')?.closest('label'); if (l) { hp.style.setProperty('--hl', l.offsetLeft + 'px'); hp.style.setProperty('--hw', l.offsetWidth + 'px'); } }; hp.addEventListener('change', mv); const ro = new ResizeObserver(mv); ro.observe(hp); hp.querySelectorAll('label').forEach(l => ro.observe(l)); document.fonts.ready.then(mv); } } // Lot 125.2 : interrupteur Passage à deux options côte à côte, largeur au plus juste.
  const hh = t => t.replace(/^0/, '').replace(':00', 'h').replace(':', 'h'); // Lot 127 : créneau compact (« Demain 9h–10h30 ») pour tenir sur une ligne.
  const sumTxt2 = () => { sumTx0(); const a = $('#f [name=slot_a]').value, b = $('#f [name=slot_b]').value, fd = $('#f [name=slot_d]').value, d = $('.wsheet .wheel[data-k=slot_d] .wi.sel')?.textContent || '', on = !!(a && done && $('#hp input[value=slot]').checked); if (hsl) hsl.textContent = on ? `${d.replace(/ [^ ]+$/, m => /\d/.test(d) ? '' : m)} ${hh(a)}${b ? '–' + hh(b) : ''}` : 'Présence client requise'; { const v = $('#hp .hpv'); if (v) { if (on && fd) { const html = pslotR({ available_from: new Date(`${fd}T${a}`).toISOString(), available_until: new Date(b ? new Date(`${fd}T${b}`).getTime() : new Date(`${fd}T${a}`).getTime() + 9e5).toISOString() }); const hr = (html.match(/<strong>(.*?)<\/strong>/) || [])[1]; const day = html.replace(/<strong>[\s\S]*?<\/strong>/, '').replace(/<[^>]+>/g, '').trim(); v.innerHTML = '<span class="hpvd">' + day + '</span>' + (hr ? '<span class="hpvh">' + hr + '</span>' : ''); } else v.textContent = ''; v.parentElement?.querySelector('.thand')?.remove(); } } $('#hp')?._mv?.(); };
  // Créneau validé au moins une fois ; valeurs gardées pour annuler à la fermeture.
  let done = !!it.available_from, saved = null;
  const KS = ['slot_d', 'slot_a', 'slot_b'];
  const openSheet = () => { saved = KS.map(k => $(`#f [name=${k}]`).value); sheet.hidden = false; pos(); requestAnimationFrame(place); };
  // Lot 121 : fenêtre du créneau à droite du bouton de passage (dessous s'il n'y a pas la place), plus petite.
  const pos = () => { const bx = sheet.querySelector('.wbox'), hp = $('#hp'); sheet.classList.add('pop'); if (!hp || !bx) return; const r = hp.getBoundingClientRect(), sr = sheet.getBoundingClientRect(), w = bx.offsetWidth, h = bx.offsetHeight; let l = r.right + 8 - sr.left, t = r.bottom - h - sr.top; // Lot 123 : bas de la fenêtre aligné sur le bas du bouton.
    { const br = bx.getBoundingClientRect(), k = br.height / h || 1, dm = [...bx.querySelectorAll('.wheel[data-k=slot_d] .wi')].find(x => x.textContent.trim() === 'Demain'), ok = bx.querySelector('.wok'); if (dm && ok) { const a = dm.getBoundingClientRect(), o = ok.getBoundingClientRect(), y = ((a.top + a.height / 2 + o.top + o.height / 2) / 2 - br.top) / k; t = r.top + r.height / 2 - y - sr.top; } } // Lot 126 : le bouton tombe à mi-chemin entre la ligne « Demain » et « Valider ».
   
 if (l + w > sr.width - 8) { l = r.right - w - sr.left; t = r.bottom + 8 - sr.top; } bx.style.left = Math.max(8, Math.min(l, sr.width - w - 8)) + 'px'; bx.style.top = Math.max(8, Math.min(t, sr.height - h - 8)) + 'px'; };
  const closeSheet = () => {
    sheet.hidden = true;
    if (saved) KS.forEach((k, i) => { $(`#f [name=${k}]`).value = saved[i]; });
    if (!done && !$('#hp')?.classList.contains('hpt')) { const n = $('#hp input[value=now]'); n.checked = true; $('#f .slot').hidden = true; }
    sumTxt2();
  };
  $('.wsheet .wx').onclick = closeSheet;
  sheet.onclick = e => { if (e.target === sheet) closeSheet(); };
  sumb.onclick = openSheet;
  $('.wsheet .wok').onclick = () => {
    const a = $('#f [name=slot_a]').value, b = $('#f [name=slot_b]').value;
    if (b && b <= a) return toast('L\'heure de fin doit suivre l\'heure de début.', true);
    if (isPast($('#f [name=slot_d]').value, a)) return toast('Ce créneau est déjà passé.', true);
    done = true; saved = null; sheet.hidden = true; sumTxt2();
  };
  // Lot 747 (FA 747) : retirer le créneau (vidage slot_d/a/b, détail et horloge sans créneau).
  $('.wsheet button.ghost').onclick = () => { KS.forEach(k => { $(`#f [name=${k}]`).value = ''; }); done = false; saved = null; sheet.hidden = true; sumTxt2(); };
  if (!$('#f .slot').hidden && it.available_from) { requestAnimationFrame(() => { sheet.hidden = false; place(); sheet.hidden = true; sumTxt2(); }); }
  else sumTxt2();
  document.querySelectorAll('#hp input').forEach(r => r.addEventListener('change', () => { if (r.value === 'slot' && r.checked && !$('#hp')._sw) openSheet(); sumTxt2(); }));
  // Lot 282 (FA 740) : « Présence client requise » + interrupteur ; horloge active seulement si activé, elle ouvre le créneau.
  { const hp = $('#hp'), sw = hp.querySelector('.hpsw2'), ck = hp.querySelector('.hpclk'), syn = () => { const on = $('#hp input[value=slot]').checked; sw.setAttribute('aria-checked', String(on)); hp.classList.toggle('on', on); ck.disabled = !on; };
    sw.onclick = () => { const r = $(`#hp input[value=${$('#hp input[value=slot]').checked ? 'now' : 'slot'}]`); r.checked = true; hp._sw = 1; r.dispatchEvent(new Event('change', { bubbles: true })); hp._sw = 0; syn(); };
    ck.onclick = () => { if (!ck.disabled) openSheet(); }; hp.addEventListener('change', syn); syn(); }
  // Lot 282 (FA 739) : priorité choisie = couleur des suggestions et du lieu.
  { const fm = $('#f'), sp = () => { const v = fm.querySelector('input[name=priority]:checked')?.value; if (v) fm.dataset.prio = v; else delete fm.dataset.prio; }; fm.querySelectorAll('input[name=priority]').forEach(r => r.addEventListener('change', sp)); if (id) sp(); }
  $('#hp input[value=slot]').closest('label').addEventListener('click', () => { if ($('#hp input[value=slot]').checked && done) openSheet(); });
  // Photos choisies : nombre affiché dans la zone d'ajout.
  const ph = $('#f [name=photos]');
  const strip = $('#f .pstrip');
  const picked = ph ? photoTray(ph, $('#f .ptray'), f => { $('#f .padd').hidden = f.length >= 10; requestAnimationFrame(() => strip.scrollTo({ left: strip.scrollWidth, behavior: 'smooth' })); }, 10, true) : []; // Lot 140.5 : flèches en plein écran.

  // Lot 87 : croix de fermeture (création). Non vide dès qu'un champ diffère de sa valeur par défaut.
  const snap = () => JSON.stringify(formData($('#f'))) + '|' + picked.length;
  let snap0 = null; setTimeout(() => { snap0 = snap(); }, 0);
  const leave = changed => { sessionStorage.removeItem('gi:nwlost'); const nw = app.closest?.('.nwin'); if (nw?._done) return nw._done(changed); go(''); };
  const fx = $('.head .fx');
  const tryClose = async () => {
    const leaveDraft = () => go(document.body.classList.contains('tech') ? 'nouvelles' : '');
    if (snap0 === null || snap() === snap0) return id ? (it.status === 'brouillon' ? leaveDraft() : go('intervention/' + id)) : leave(false);
    const dr = $('#f [value=brouillon]');
    const r = await quitBox(!!dr);
    if (r === 'draft') $('#f').requestSubmit(dr); else if (r === 'quit') (id ? (it.status === 'brouillon' ? leaveDraft() : go('intervention/' + id)) : leave(false));
  };
  if (fx) fx.onclick = tryClose;
  // Lot 182 : un appui en dehors du formulaire le ferme (confirmation identique à la croix s'il n'est pas vide).
  const nwo = app.closest?.('.nwin');
  if (nwo) nwo.addEventListener('click', e => { if (e.target === nwo && !document.querySelector('.modal')) tryClose(); });
  else if (id) { const pg = app.querySelector('.page'), ac = new AbortController(); addEventListener('hashchange', () => ac.abort(), { once: true }); app.addEventListener('click', e => { if ((e.target === app || e.target === pg) && pg?.isConnected) tryClose(); }, { signal: ac.signal }); }

  // Lieu : numéros → mobil-homes (« 34 » → 34, 134, 234…) ; texte → lieux prédéfinis. Le texte libre est gardé tel quel.
  const COMMON = ['Réception', 'Camp saisonnier', 'Sanitaire 1', 'Sanitaire 2', 'Scène', 'Restaurant', 'Bar', 'Piscine', 'Aire de jeux', 'Parking', 'Local technique', 'Laverie', 'Épicerie', 'Snack', 'Spa', 'Salle de sport', 'Terrain multisport', 'Mini-golf', 'Accueil', 'Entrée / barrière', 'Lingerie', 'Cuisine du restaurant', 'Salle commune'];
  let places = [];
  sb.from('places').select('label, num').order('num', { ascending: true, nullsFirst: false }).order('label').limit(2000)
    .then(({ data }) => { places = data || []; if (document.activeElement === loc && loc.value) loc.oninput(); });
  document.querySelectorAll('#f [name=assign]').forEach(c => c.addEventListener('change', () => { if (c.checked) document.querySelectorAll('#f [name=assign]').forEach(o => { if (o !== c) o.checked = false; }); }));
  const loc = $('#f [data-name=location]'), ul = $('#f .ac-list');
  // Lieu choisi : affiché en étiquette dans le champ (hors saisie).
  // Lot 220 : suggestions au style des étiquettes de lieu (épingle masquée en mobile).
  const LPIN = '<svg class="pin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-4.8 7-11a7 7 0 1 0-14 0c0 6.2 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>';
  // Lot 222 : lieu choisi et suggestions = étiquette de lieu de la carte (badge MH empilé pour les mobil-homes) ; le texte inséré reste le libellé.
  const mhN = v => (String(v).trim().match(/^(?:mh|mobil[- ]?home)?\s*(\d+)$/i) || [])[1];
  const tagIn = v => { const n = mhN(v); return n ? `<span class="mhpre">MH</span><span class="mhnum">${esc(String(n).padStart(2, '0'))}</span>` : `${LPIN}<span class="ltx">${esc(v)}</span>`; };
  const liH = l => `<li role="option" class="${mhN(l) ? 'lmh stacked' : 'lpt'}" data-v="${esc(l)}">${tagIn(l)}</li>`;
  const ltag = document.createElement('span'); ltag.className = 'ltag loc-tag'; loc.after(ltag);
  // Lot 118.2 : le lieu choisi n'est plus éditable au toucher ; une petite croix le retire.
  const ce0 = loc.getAttribute('contenteditable') || 'plaintext-only';
  const syncTag = () => { const v = loc.value.trim(), on = !!v && document.activeElement !== loc; ltag.innerHTML = `${tagIn(v)}<button type="button" class="lx" aria-label="Retirer le lieu">×</button>`; ltag.classList.toggle('stacked', !!mhN(v)); ltag.classList.toggle('ptag', !mhN(v)); ltag.hidden = !on; loc.classList.toggle('tagged', on); if (on) loc.style.setProperty('--tagw', (ltag.offsetWidth + 20) + 'px'); else loc.style.removeProperty('--tagw'); loc.setAttribute('contenteditable', on ? 'false' : ce0); };
  ltag.addEventListener('click', e => { if (!e.target.closest('.lx')) return; e.preventDefault(); e.stopPropagation(); loc.setAttribute('contenteditable', ce0); loc.value = ''; ltag.hidden = true; loc.classList.remove('tagged'); loc.focus(); loc.dispatchEvent(new Event('input', { bubbles: true })); });
  // Lieu déjà présent dans le titre : proposé en premier à l'entrée dans le champ.
  const fromTitle = () => {
    const t = $('#f [data-name=title]').value.toLowerCase();
    if (!t) return [];
    const nums = [...t.matchAll(/(?:mh|mobil[- ]?home)?\s*(\d+)/g)].map(m => m[1]);
    const byNum = places.filter(p => p.num != null && nums.includes(String(p.num))).map(p => p.label);
    const byName = [...new Set([...COMMON, ...places.filter(p => p.num == null).map(p => p.label)])].filter(l => l && (t.includes(l.toLowerCase()) || l.toLowerCase().split(/[\s'-]+/).some(w => w.length >= 4 && !/^\d+$/.test(w) && t.split(/[\s'-]+/).some(x => x.length >= 4 && (x.startsWith(w) || w.startsWith(x))))));
    return [...new Set([...byNum, ...byName])];
  };
  loc.addEventListener('focus', () => {
    if (loc.value.trim()) return;
    const hits = fromTitle().slice(0, 4);
    if (!hits.length) return;
    ul.innerHTML = hits.map(liH).join('');
    ul.hidden = false; loc.setAttribute('aria-expanded', 'true'); plUl();
  });
  loc.addEventListener('focus', syncTag); loc.addEventListener('blur', syncTag); syncTag();
  const close = () => { ul.hidden = true; loc.setAttribute('aria-expanded', 'false'); $('#f')?.classList.remove('acon'); };
  loc.oninput = () => {
    const v = loc.value.trim().toLowerCase();
    if (!v) return close();
    // Autocomplétion MH uniquement pour un numéro (« 34 », « MH 34 », « mobil-home 34 »).
    const m = v.match(/^(?:mh|mobil[- ]?home)?\s*(\d+)$/);
    let hits;
    if (m) {
      const digits = m[1];
      const rank = p => { const n = String(p.num ?? ''); return n === digits ? 0 : n.endsWith(digits) ? 1 : n.startsWith(digits) ? 2 : 3; };
      hits = places.filter(p => p.num != null && String(p.num).endsWith(digits)).sort((x, y) => rank(x) - rank(y) || x.num - y.num).map(p => padMH(p.label));
    } else {
      const extra = places.filter(p => p.num == null).map(p => p.label);
      hits = [...new Set([...COMMON, ...extra])].filter(l => l.toLowerCase().split(/[\s'/-]+/).some(w => w.startsWith(v)) || l.toLowerCase().startsWith(v)).sort((x, y) => x.toLowerCase().indexOf(v) - y.toLowerCase().indexOf(v));
    }
    // Lot 126.1 : moins de suggestions, et seulement les plus proches ; leur nombre augmente quand la saisie se précise.
    hits = hits.slice(0, m ? (m[1].length < 2 ? 3 : 4) : (v.length < 3 ? 3 : 5));
    if (!hits.length) return close();
    ul.innerHTML = hits.map(liH).join('');
    ul.hidden = false; loc.setAttribute('aria-expanded', 'true'); plUl();
  };
  let pk = 0; loc.addEventListener('focus', e => { if (Date.now() - pk < 800) { e.stopImmediatePropagation(); loc.blur(); } }, true);
  // Lot 122 : choix au relâchement du doigt, sans clic fantôme ni changement de focus (le clic fantôme d'iOS retombait sur l'élément sous la liste fermée).
  // Lot 124 : liste des lieux en position fixe, hors de la fenêtre : elle ne change plus la hauteur ni le défilement de « Nouvelle intervention » (à-coup vu sur iPad).
  // Lot 140.1 / 140.7 : étiquettes proposées sur la même ligne, à droite du champ ; la date est masquée tant qu'elles sont affichées. Standard : sans cadre. Mobile : cadre blanc ajusté au plus près des étiquettes.
  function plUl() { const r = loc.getBoundingClientRect(), bx = loc.closest('.nbox') || $('#f'), bc = getComputedStyle(bx), bb = bx.getBoundingClientRect(), R = bb.right - parseFloat(bc.borderRightWidth) - parseFloat(bc.paddingRight);
    $('#f').classList.add('acon'); ul.style.width = ''; Object.assign(ul.style, { position: 'fixed', right: 'auto', margin: '0', zIndex: '80', left: '0px', top: '0px', maxWidth: 'none' });
    const q0 = ul.getBoundingClientRect(), ox = q0.left, oy = q0.top, uc = getComputedStyle(ul), padT = parseFloat(uc.paddingTop) + parseFloat(uc.borderTopWidth), padR = parseFloat(uc.paddingRight) + parseFloat(uc.borderRightWidth);
    const li0 = ul.querySelector('li'), lh = li0 ? li0.offsetHeight : 26, X = r.right + 8, mw = R - X, side = mw >= 90;
    const L = side ? X : r.left, T = side ? r.top + (r.height - lh) / 2 - padT : r.bottom + 4;
    Object.assign(ul.style, { left: (L - ox) + 'px', top: (T - oy) + 'px', maxWidth: (side ? mw : R - r.left) + 'px' });
    const q = ul.getBoundingClientRect(); let mx = 0; ul.querySelectorAll('li').forEach(li => { mx = Math.max(mx, li.getBoundingClientRect().right); }); if (mx && mx + padR < q.right - .5) ul.style.width = Math.ceil(mx + padR - q.left) + 'px';
    ul.style.maxHeight = Math.max(120, innerHeight - T - 16) + 'px'; }
  addEventListener('scroll', () => { if (!ul.hidden) plUl(); }, true); addEventListener('resize', () => { if (!ul.hidden) plUl(); });
  const pickLi = li => { const y = scrollY, w0 = loc.offsetWidth; pk = Date.now(); loc.classList.add('lpick'); setTimeout(() => loc.classList.remove('lpick'), 800); loc.value = li.dataset.v ?? li.textContent; close(); loc.blur(); syncTag(); if (scrollY !== y) scrollTo(0, y);
    // Lot 123 : la case s'élargit en douceur et la puce apparaît en fondu (plus d'à-coup de largeur).
    const w1 = loc.offsetWidth; if (document.body.classList.contains('tech')) return; /* Lot 140.10 : en mobile, l'étiquette remplace le champ à l'instant du choix (plus de fondu ni d'élargissement progressif, qui laissaient un vide). */ ltag.classList.remove('lin'); void ltag.offsetWidth; ltag.classList.add('lin');
    if (Math.abs(w1 - w0) > 1) { loc.style.setProperty('width', w0 + 'px', 'important'); void loc.offsetWidth; loc.style.setProperty('transition', 'width .25s ease', 'important'); loc.style.setProperty('width', w1 + 'px', 'important'); setTimeout(() => { loc.style.removeProperty('transition'); loc.style.removeProperty('width'); }, 300); } };
  let t0 = null; ul.addEventListener('touchstart', e => { t0 = e.touches[0] ? [e.touches[0].clientX, e.touches[0].clientY] : null; }, { passive: true });
  ul.addEventListener('touchend', e => { const li = e.target.closest('li'), t = e.changedTouches[0]; if (!li || !t0 || Math.hypot(t.clientX - t0[0], t.clientY - t0[1]) > 10) return; e.preventDefault(); pickLi(li); }, { passive: false });
  ul.onpointerdown = e => { if (e.target.closest('li')) e.preventDefault(); }; ul.onmousedown = e => e.preventDefault();
  ul.onclick = e => { const li = e.target.closest('li'); if (li && Date.now() - pk > 600) pickLi(li); };
  loc.onblur = () => setTimeout(close, 120);
  loc.onkeydown = e => { if (e.key === 'Escape') close(); };

  // Lot 117.2 : « Suivant » (ex « Créer et publier ») grisé tant que titre, priorité choisie et lieu ne sont pas remplis (et créneau valide si présence requise).
  // Lot 117.3 : bloc 3 compact (passage, créneau, photos, technicien) dans un seul cadre, en création.
  { const f3 = $('#f'), nr = f3.querySelector('.ndrow'), np = f3.querySelector('.nph'); if (nr && np) { const b3 = document.createElement('div'); b3.className = 'nb3'; nr.before(b3); b3.append(nr); b3.append(np); np.querySelector('.ptray')?.insertAdjacentHTML('afterend', '<div class="pslots" aria-hidden="true">' + `<i class="pslot">${PCAM}</i>`.repeat(5) + '</div>'); b3.querySelector('.assign')?.insertAdjacentHTML('beforebegin', '<span class="aplus" aria-hidden="true">+</span>'); const L = document.createElement('div'); L.className = 'nb3l'; { const as = b3.querySelector('.assign'); if (as) { as.insertAdjacentHTML('beforebegin', '<button type="button" class="asgb">+ Assigner à un technicien</button>'); const ab = as.previousElementSibling; // Lot 123 : les choix s'ouvrent dans une petite fenêtre sous le bouton, sans déplacer la mise en page.
      const shut = () => { L.classList.remove('aopen'); document.removeEventListener('pointerdown', out, true); }; const out = e => { if (!e.target.closest?.('.asx label') && !ab.contains(e.target)) shut(); };
      as.querySelector('legend')?.insertAdjacentHTML('afterend', '<label class="anone"><input type="checkbox"><span class="cwho"><span>Non assigné</span></span></label>'); as.addEventListener('change', e => { if (e.target.closest('.anone')) { as.querySelectorAll('input[name=assign]').forEach(i => (i.checked = false)); e.target.checked = false; } }); // Lot 127 : option « Non assigné ».
      ab.insertAdjacentHTML('beforebegin', '<span class="asgt">Intervention assignée à :</span>'); const T0 = ab.textContent, nm = () => { const v = [...as.querySelectorAll('input[name=assign]:checked')].map(i => i.closest('label').querySelector('.cwho').outerHTML); L.classList.toggle('asgd', !!v.length); if (v.length) ab.innerHTML = v.join(' '); else ab.textContent = T0; }; nm(); // Lot 128 : « Intervention assignée à : » + étiquette avec l icône du rôle.
       as.addEventListener('change', () => { nm(); shut(); }); // Lot 124 : le bouton affiche le technicien choisi.
      const wc = () => { const m = as.scrollTop + 54; as.querySelectorAll('label').forEach(l => l.classList.toggle('wc', Math.abs(l.offsetTop + 18 - m) < 18)); }; as.addEventListener('scroll', wc, { passive: true }); // Lot 126 : ligne centrale mise en valeur.
      // Lot 138.2 : le bouton devient, à la même hauteur, une ligne d'étiquettes ; « Assigner à un technicien » reste fixe à gauche, les étiquettes défilent à l'horizontale ; un appui hors d'une étiquette rend le bouton.
      { const sx = document.createElement('div'); sx.className = 'asx'; sx.append(...as.querySelectorAll(':scope > label')); as.append(sx); } // Lot 139.8 : plus d'intitulé dans la ligne ouverte : « Non assigné » puis les techniciens.
      ab.onclick = e => { e.preventDefault(); if (L.classList.contains('aopen')) return shut(); const at = L.classList.contains('asgd') ? L.querySelector('.asgt') : null, lr = L.getBoundingClientRect(), br = ab.getBoundingClientRect(), x0 = Math.min(br.left, at ? at.getBoundingClientRect().left : br.left) - lr.left - L.clientLeft;
       as.style.top = (br.top - lr.top - L.clientTop - 1) + 'px'; as.style.left = x0 + 'px'; as.style.width = (L.clientWidth - parseFloat(getComputedStyle(L).paddingRight) - x0) + 'px'; as.style.height = (ab.offsetHeight + 2) + 'px'; /* Lot 140.4 */ L.classList.add('aopen'); const sx = as.querySelector('.asx'); sx.scrollLeft = 0; as.querySelector('input:checked')?.closest('label')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
       document.addEventListener('pointerdown', out, true); }; } } // Lot 122 : un seul bouton « + Assigner à un technicien », qui déplie les choix.
     b3.prepend(L); L.append(...[b3.querySelector('#hp'), b3.querySelector('.aplus'), b3.querySelector('.asgt'), b3.querySelector('.asgb'), b3.querySelector('.assign'), b3.querySelector('.nph')].filter(Boolean));
     // Lot 139.7 : le « + » sort de la bande qui défile : toujours entier et visible, seule la bande (photos + cases) défile.
     // Lot 139.5 : autant de cases pointillées qu'il en tient dans la ligne (mobile compris) ; en mobile, le bloc 3 est recentré (marges gauche et droite égales).
     { const pa = np.querySelector('.padd'), st = np.querySelector('.pstrip'), tray = np.querySelector('.ptray'), ps = np.querySelector('.pslots');
       if (pa && st && ps) { [...np.childNodes].forEach(x => x.nodeType === 3 && x.remove()); st.before(pa); ps.innerHTML = `<i class="pslot">${PCAM}</i>`.repeat(10);
         const lay = () => { if (!L.isConnected || !L.clientWidth) return; const tech = document.body.classList.contains('tech'), G = parseFloat(getComputedStyle(np).columnGap) || 0, S = 50;
           L.style.paddingLeft = L.style.paddingRight = ''; np.style.paddingLeft = np.style.paddingRight = ''; const W = L.clientWidth, a = pa.offsetWidth + G, fit = Math.max(0, Math.floor((W - a + G) / (S + G)));
           if (tech && fit) { const ex = W - a - (fit * S + (fit - 1) * G); if (ex > 1) np.style.paddingLeft = np.style.paddingRight = (ex / 2) + 'px'; }
           const k = Math.max(0, fit - tray.children.length); [...ps.children].forEach((x, i) => x.style.setProperty('display', i < k ? 'flex' : 'none', 'important')); ps.style.setProperty('display', k ? 'flex' : 'none', 'important'); };
         L.__lay = lay; new ResizeObserver(lay).observe(L); new MutationObserver(lay).observe(tray, { childList: true }); requestAnimationFrame(lay); } } } }
  if (DK) { const f = $('#f'), MSG = 'Attention, actualiser la page fera perdre le contenu en cours de création';
    const save = () => { if (window.__giReload || !document.contains(f) || snap0 === null) return; if (snap() !== snap0) sessionStorage.setItem('gi:nwlost', '1'); else sessionStorage.removeItem('gi:nwlost'); };
    let tm; const later = () => { clearTimeout(tm); tm = setTimeout(save, 250); }; f.addEventListener('input', later); f.addEventListener('change', later);
        const bu = e => { if (window.__giReload) return; if (!document.contains(f)) { removeEventListener('beforeunload', bu); removeEventListener('pagehide', save); return; } save(); if ((navigator.maxTouchPoints > 1 && /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent))) return; /* Lot 129.1 : Safari iPad/iPhone annule l'actualisation sans afficher de message ; on la laisse passer (toast au retour). */ if (snap0 !== null && snap() !== snap0) { e.preventDefault(); e.returnValue = MSG; return MSG; } };
    addEventListener('beforeunload', bu); addEventListener('pagehide', save); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); }); }
  { const f = $('#f'), pb = f.querySelector('button[value=publier]'); let st = 1;
    const ok1 = d => (d.title || '').trim() && (d.location || '').trim(); // Lot 129 : priorité facultative.
    let chk = () => {}; // Lot 297 : déclaré ici (et non dans « if (pb) ») : l'appui sur la carte du bloc 1 l'appelait hors de portée (ReferenceError, bouton non recalculé).
    // Carte du bloc 1 (rendu liste) ; un appui dessus rend le bloc 1 modifiable, un appui ailleurs le referme s'il est complet.
    const sum1 = () => { const d = formData(f); f.querySelector('.fsum')?.remove(); f.querySelector('.ndesc0').insertAdjacentHTML('beforebegin', `<div class="fsum" role="button" tabindex="0" aria-label="Modifier"><section class="group">${table([{ id: 'nouvelle', status: 'publiee', title: d.title.trim().slice(0, 70), location: (d.location || '').trim(), priority: d.priority, created_at: new Date().toISOString() }])}</section></div>`); f.classList.remove('ed1'); };
    // Bloc 2 : mis en forme seulement s'il a une description ; un appui dessus le rend modifiable.
    const sum2 = () => { const v = (formData(f).description || '').trim(); if (f.querySelector('.ndsc')?.contains(document.activeElement)) document.activeElement.blur(); /* Lot 140.8 : Safari (iPhone/iPad) ne retire pas le focus d'un bouton touché : la case masquée gardait le focus, et le 1er appui sur le bloc 2 ne faisait rien (focus déjà « posé »). */ { const o = f.querySelector('.fsum2'); o?._sbt?.remove(); o?.remove(); } f.classList.remove('ed2', 'hs2'); if (!v) return; f.querySelector('.ndsc')?.insertAdjacentHTML('afterbegin', `<div class="fsum2" role="button" tabindex="0" aria-label="Modifier">${esc(v)}</div>`); f.classList.add('hs2'); sbar(f.querySelector('.fsum2')); }; // Lot 140.2 : même barre unique que la case en saisie.
    f.addEventListener('focusin', e => { if (f.classList.contains('stp3') && e.target.closest('.ndsc .cef')) f.classList.add('ed2'); }); // Lot 139.4 : iPhone/iPad n'acceptent le focus (clavier, curseur) que pendant l'appui lui-même : un focus différé (setTimeout) était ignoré, il fallait un 2e appui.
    // On rend donc le bloc modifiable puis on donne le focus tout de suite, dans le même appui, curseur en fin de texte.
    const fnow = el => { if (!el) return; if (document.activeElement === el) el.blur(); void el.offsetHeight; el.focus({ preventScroll: true }); if (el.isContentEditable) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); } };
    f.addEventListener('click', e => { if (e.target.closest('.fsum2')) { f.classList.add('ed2'); fnow(f.querySelector('.ndsc .cef')); } });
    f.addEventListener('pointerdown', e => { if (f.classList.contains('ed2') && !e.target.closest('.ndsc .cef, .fsum2')) sum2(); }, true);
    f.addEventListener('click', e => { if (e.target.closest('.fsum')) { f.classList.add('ed1'); setTimeout(() => f.querySelector('#f [data-name=title]')?.focus(), 30); setTimeout(chk); } });
    f.addEventListener('pointerdown', e => { if (f.classList.contains('ed1') && !e.target.closest('.ndesc0, .ac-list, button[value=publier]') && ok1(formData(f))) { sum1(); setTimeout(chk); } }, true);
    if (pb) { chk = () => { const d = formData(f), sl = d.passage === 'slot', a = f.slot_a?.value, b = f.slot_b?.value;
        pb.disabled = (st < 2 || f.classList.contains('ed1')) && !ok1(d) || st > 2 && (!d.passage || (sl && a && b && b <= a)); // Lot 330 (FA 752) : présence sans horaire n'empêche plus de créer.
        const db = f.querySelector('button[value=brouillon]'); if (db) { db.disabled = !(d.title || '').trim() && !(d.location || '').trim(); const s = f.querySelector('.bdsave'); if (s) s.disabled = db.disabled; } };
      ['input', 'change', 'keyup'].forEach(t => f.addEventListener(t, () => setTimeout(chk), true));
      f.addEventListener('click', e => { if (e.target.closest('.prb, .ac-list')) setTimeout(chk, 30); }, true);
      document.querySelector('.wsheet')?.addEventListener('click', () => setTimeout(chk, 60), true); // Lot 117.8 : la feuille créneau est hors du formulaire.
      // Lot 117.2 : étapes. Suivant (bloc 1) : le bloc 1 se résume en carte comme dans la liste, le bloc 2 (description) apparaît ; Suivant (bloc 2, description facultative) : le bloc 3 apparaît.
      pb.addEventListener('click', e => { if (st > 2) return; e.preventDefault(); if (pb.disabled) return; const d = formData(f);
        if (f.classList.contains('ed1')) return sum1();
        if (st === 1) { sum1();
          f.classList.replace('stp1', 'stp2'); st = 2; setTimeout(() => f.querySelector('.ndsc .cef')?.focus(), 50); }
        else { const ds = f.querySelector(':scope > .ndsc'), h0 = ds ? ds.getBoundingClientRect() : null; sum2(); f.classList.replace('stp2', 'stp3'); st = 3; pb.textContent = 'Créer et publier'; smooth3(ds, h0); } // grisé tant qu'aucun passage n'est choisi (photos et technicien facultatifs)
        chk(); });
      chk(); } }
  // Lot 220 : bloc 2 réduit en douceur, le bloc 3 apparaît en fondu (mobile et standard).
  function smooth3(ds, r0) { const f = $('#f'), b3 = f.querySelector('.nb3'); if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const D = 360, E = 'cubic-bezier(.22,.8,.24,1)';
    let moved = false, sideOn = false;
    if (ds && ds.isConnected && r0 && getComputedStyle(ds).display !== 'none') { ds.__anim = false; ds.__fit?.(); ds.__anim = true; const r1 = ds.getBoundingClientRect(), dw = Math.abs(r1.width - r0.width) > 1, dh = Math.abs(r1.height - r0.height) > 1;
      if (r0.height > 0 && (dw || dh)) { moved = true; const P = ['width', 'height', 'max-width', 'min-width', 'max-height', 'flex', 'overflow', 'transition'], S = (k, v) => ds.style.setProperty(k, v, 'important'), T = [];
        // Lot 224 : pendant que le bloc 2 rétrécit, le bloc 3 attend hors du flux à sa place finale (à droite) ;
        // avant, il passait sous le bloc 2 (bloc 2 encore trop large), y apparaissait en fondu puis sautait à droite.
        let side = null; const fpos = f.style.position;
        if (dw && b3) { const rb = b3.getBoundingClientRect(), rf = f.getBoundingClientRect(); if (rb.height && rb.top < r1.bottom - 1 && rb.left >= r1.right - 1) side = { l: rb.left - rf.left - f.clientLeft, t: rb.top - rf.top - f.clientTop, w: rb.width, mb: Math.max(0, rb.height - r1.height) }; }
        const B = (k, v) => b3.style.setProperty(k, v, 'important'), BP = ['position', 'left', 'top', 'width', 'margin'];
        if (side) { sideOn = true; if (getComputedStyle(f).position === 'static') f.style.position = 'relative'; B('position', 'absolute'); B('left', side.l + 'px'); B('top', side.t + 'px'); B('width', side.w + 'px'); B('margin', '0'); if (side.mb) { S('margin-bottom', side.mb + 'px'); P.push('margin-bottom'); } }
        S('overflow', 'hidden');
        // Lot 226 : cause du 706 : le résumé du bloc 2 suivait la largeur animée : son texte se recoupait à chaque image et des lignes (et la barre) surgissaient en bas du bloc avant l'arrivée du bloc 3. Il garde dès le départ sa taille finale ; le bloc 2 se contente de le rogner.
        const sm = ds.querySelector('.fsum2'), smr = sm ? sm.getBoundingClientRect() : null, SM = ['flex', 'width', 'height', 'max-height', 'overflow'];
        if (sm && smr.width) { SM.forEach(k => sm.style.setProperty(k, k === 'flex' ? '0 0 auto' : k === 'width' ? smr.width + 'px' : k === 'overflow' ? 'hidden' : smr.height + 'px', 'important')); if (sm._sbt) sm._sbt.style.visibility = 'hidden'; }
        if (dw) { S('max-width', 'none'); S('min-width', '0'); S('flex', `0 0 ${r0.width}px`); S('width', r0.width + 'px'); T.push('width', 'flex-basis'); }
        if (dh) { S('max-height', 'none'); S('height', r0.height + 'px'); T.push('height'); }
        void ds.offsetHeight; S('transition', T.map(k => `${k} ${D}ms ${E}`).join(', '));
        if (dw) { S('flex', `0 0 ${r1.width}px`); S('width', r1.width + 'px'); }
        if (dh) S('height', r1.height + 'px');
        setTimeout(() => { P.forEach(k => ds.style.removeProperty(k)); if (sm) { SM.forEach(k => sm.style.removeProperty(k)); if (sm._sbt) sm._sbt.style.visibility = ''; } if (side) { BP.forEach(k => b3.style.removeProperty(k)); f.style.position = fpos; } ds.__anim = false; ds.__fit?.(); }, D + 40); } else ds.__anim = false; }
    // Lot 224 : en standard, fondu du bloc 3 lancé quand le bloc 2 ne le chevauche plus (mobile inchangé).
    b3?.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: moved ? 260 : D, delay: moved ? (sideOn ? 240 : 160) : 0, easing: E, fill: 'backwards' }); }
  $('#f').onsubmit = e => {
    e.preventDefault();
    const d = formData(e.target);
    if (!d.title.trim()) { toast('Le titre est obligatoire.', true); return $('#f [data-name=title]').focus(); }
    const mode = e.submitter?.value;
    const row = {
      title: d.title.trim().slice(0, 70), location: (d.location || '').trim(), description: (d.description || '').trim(),
      priority: d.priority, available_from: null, available_until: null,
      client_presence: d.passage === 'slot', // Lot 300 (FA 737) : interrupteur « Présence client requise » enregistré.
    };
    if (d.passage === 'slot') { // Lot 330 (FA 752) : présence client requise sans horaire : on enregistre le flag, sans bloquer.
      const fd = e.target.slot_d.value, a = e.target.slot_a.value, b = e.target.slot_b.value;
      if (fd && a) {
        if (b && b <= a) { toast('L\'heure de fin doit suivre l\'heure de début.', true); return; }
        if (new Date(`${fd}T${a}`) < (id && it.created_at ? new Date(it.created_at) : new Date(Date.now() - 6e4))) { toast('Ce créneau est déjà passé.', true); return; }
        row.available_from = new Date(`${fd}T${a}`).toISOString();
        row.available_until = new Date(b ? new Date(`${fd}T${b}`).getTime() : new Date(`${fd}T${a}`).getTime() + 9e5).toISOString(); // Lot 263 (FA 730) : jamais de créneau sans fin (début + 15 min par défaut).
      }
    }
    busy(e.submitter, async () => {
      try {
        let iid = id;
        if (id) {
          const { error } = await sb.from('interventions').update(row).eq('id', id);
          if (error) throw error;
          if ($('#f .assign')) {
            const who = $('#f [name=assign]:checked')?.value || null;
            if (who !== (it.proposed_to || null)) { const a = await sb.rpc('assign_tech', { p_id: id, p_tech: who }); if (a.error) throw a.error; }
          }
          if (picked.length) await uploadPhotos(id, [...picked]);
          if ((d.comment || '').trim()) {
            const c = await sb.rpc('add_comment', { p_id: id, p_body: d.comment.trim() });
            if (c.error) throw c.error;
          }
        } else {
          const { data, error } = await sb.from('interventions').insert({ ...row, org_id: state.member.org_id }).select('id').single();
          if (error) throw error;
          iid = data.id;
          const files = [...picked];
          if (files.length) await uploadPhotos(iid, files);
          if (mode === 'publier') {
            const r = await sb.rpc('transition', { p_id: iid, p_action: 'publier', p_comment: '' });
            if (r.error) throw r.error;
            const who = $('#f [name=assign]:checked')?.value;
            if (who) { const a = await sb.rpc('assign_tech', { p_id: iid, p_tech: who }); if (a.error) throw a.error; }
          }
        }
        toast(id ? 'Intervention enregistrée.' : mode === 'publier' ? 'Intervention publiée.' : 'Brouillon enregistré.');
        // Création programmée : proposer un rappel (l'intervention se déverrouille à ce moment).
        if (!id && row.available_from) {
          const m = await askReminder();
          if (m) { const u = await sb.from('interventions').update({ remind_minutes: m }).eq('id', iid); if (u.error) toast(errMsg(u.error), true); else toast('Rappel programmé.'); }
        }
        sessionStorage.removeItem('gi:nwlost');
        if (id) go('intervention/' + iid); else leave(true);
      } catch (err) { toast(errMsg(err), true); }
    });
  };
}

const TIMES = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`);
// Fenêtre « Programmer un rappel ? » puis délai avant l'intervention. Renvoie des minutes ou null.
const REM = [[15, '15 min avant'], [30, '30 min avant'], [60, '1 h avant'], [120, '2 h avant'], [1440, '1 jour avant']];
function askReminder() {
  return new Promise(res => {
    const o = document.createElement('div');
    o.className = 'modal';
    o.innerHTML = `<div class="mbox"><p class="mq">Programmer un rappel ?</p><div class="mbtns"><button class="ghost" data-r="non">Non</button><button class="primary" data-r="oui">Oui</button></div></div>`;
    (document.querySelector('#shell') || document.body).appendChild(o);
    o.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.r === 'non') { o.remove(); return res(null); }
      if (b.dataset.r === 'oui') { o.querySelector('.mbox').innerHTML = `<p class="mq">Combien de temps avant l'intervention ?</p><div class="mlist">${REM.map(([m, l]) => `<button class="ghost" data-m="${m}">${l}</button>`).join('')}</div>`; return; }
      if (b.dataset.m) { o.remove(); res(+b.dataset.m); }
    };
  });
}
// 60 jours à partir d'aujourd'hui (plus le jour déjà enregistré s'il est passé).
const DAYS = cur => {
  const out = [], t = new Date(); t.setHours(0, 0, 0, 0);
  const W = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'], M = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const lab = (x, i) => i === 0 ? 'Aujourd\'hui' : i === 1 ? 'Demain' : `${W[x.getDay()]} ${x.getDate()} ${M[x.getMonth()]}`;
  if (cur && dIn(cur) < dIn()) { const x = new Date(cur); out.push([dIn(cur), lab(x, -1)]); }
  for (let i = 0; i < 60; i++) { const x = new Date(t); x.setDate(t.getDate() + i); out.push([dIn(x), lab(x, i)]); }
  return out;
};
const p2 = n => String(n).padStart(2, '0');
const dIn = v => { const x = v ? new Date(v) : new Date(); return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`; };
const tIn = v => { if (!v) return ''; const x = new Date(v); return `${p2(x.getHours())}:${p2(x.getMinutes())}`; };

// Lot 87 : quitter la création (brouillon / quitter / annuler).
function quitBox(draft) {
  return new Promise(res => {
    const o = document.createElement('div'); o.className = 'modal';
    o.innerHTML = `<div class="mbox"><p class="mq">Voulez-vous quitter la création d'une nouvelle intervention ?</p><div class="mbtns mb3">${draft ? '<button class="primary" data-r="draft">Enregistrer en brouillon</button>' : ''}<button class="ghost" data-r="quit">Quitter sans enregistrer</button><button class="ghost" data-r="">Annuler</button></div></div>`;
    (document.querySelector('#shell') || document.body).appendChild(o);
    o.onclick = e => { const b = e.target.closest('button'); if (!b && e.target !== o) return; o.remove(); res(b?.dataset.r || ''); };
  });
}
// Lot 138.3 : appareil photo de l'application (même dessin que le bouton photo du tchat), en gris clair dans chaque case photo vide.
const PCAM = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>';
