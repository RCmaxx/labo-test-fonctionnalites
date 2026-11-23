export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'on' + (err ? ' err' : '');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.className = ''), 3500);
}

// Traduit les erreurs Supabase courantes.
export function errMsg(e) {
  const m = e?.message || String(e);
  const map = {
    'Invalid login credentials': 'E-mail ou mot de passe incorrect.',
    'Email not confirmed': 'Adresse e-mail non confirmée : ouvrez le lien reçu par e-mail.',
    'User already registered': 'Un compte existe déjà avec cette adresse.',
  };
  for (const k in map) if (m.includes(k)) return map[k];
  if (/Password should be/i.test(m)) return 'Mot de passe trop court (8 caractères minimum).';
  if (/rate limit/i.test(m)) return 'Trop de tentatives, réessayez dans quelques minutes.';
  return m;
}

export const ROLES = {
  admin: 'Administrateur',
  directeur: 'Directeur',
  responsable_tech: 'Resp.tech',
  technicien: 'Technicien',
  reception: 'Réception',
  client: 'Client',
};

export const STATUS = {
  brouillon: 'Brouillon',
  publiee: 'Signalé',
  prise_en_charge: 'En cours',
  resolue: 'Clôturé',
  validee: 'Terminé',
};

export const ACTMSG = a => ({ prendre: 'Intervention prise en charge.', resoudre: 'Intervention terminée.', liberer: 'Vous ne prenez plus cette intervention.', publier: 'Intervention publiée.', renvoyer: 'Intervention renvoyée parmi les actives.', cloturer: 'Intervention clôturée.', demander: 'Demande envoyée.' })[a] || 'Modification enregistrée.';
// Lot 287 : source unique des statuts « terminée ».
export const DONE_STATUSES = ['resolue', 'validee'];
export const isDone = r => DONE_STATUSES.includes(r && r.status);
export const PRIORITY = { basse: 'À faire', normale: 'Important', haute: 'Urgent' }; // Lot 263 (FA 728) : libellés affichés (valeurs en base inchangées)

export const EVENTS = {
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
  liberee: 'Ne prend plus l\'intervention',
  reactivee: 'L’intervention n’est plus clôturée',
};

// Heure « 09:05 ».
export const hm = d => { const x = new Date(d); return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`; };
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export function fmtDate(d) {
  if (!d) return '';
  const x = new Date(d.length === 10 ? d + 'T00:00:00' : d);
  return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
}
export function fmtDateTime(d) {
  if (!d) return '';
  const x = new Date(d);
  return `${x.getDate()} ${MONTHS[x.getMonth()]} · ${hm(x)}`;
}
// Date de création : « Aujourd'hui / Hier / Avant-hier à HH:MM », puis la date seule.
export function fmtCreated(d) {
  if (!d) return '';
  const x = new Date(d), t = new Date(); t.setHours(0, 0, 0, 0);
  const x0 = new Date(x); x0.setHours(0, 0, 0, 0);
  const n = Math.round((t - x0) / 86400000), h = hm(x);
  return n === 0 ? `Aujourd'hui à ${h}` : n === 1 ? `Hier à ${h}` : n === 2 ? `Avant-hier à ${h}` : `${x.getDate()} ${x.toLocaleDateString('fr-FR', { month: 'long' })}${x.getFullYear() !== t.getFullYear() ? ' ' + x.getFullYear() : ''}`; // Lot 106 : mois en toutes lettres.
}
// Chronologie : « il y a X minutes / heures » le jour même, « Hier à HH:MM », sinon date et heure.
// Lot 321 : majuscule initiale standardisée sur toutes les mentions (À l'instant, Il y a…, dates).
export const fmtAgo = d => { const s = fmtAgo0(d); return s.charAt(0).toUpperCase() + s.slice(1); };
function fmtAgo0(d) {
  const x = new Date(d), now = new Date(), t = new Date(now); t.setHours(0, 0, 0, 0);
  const x0 = new Date(x); x0.setHours(0, 0, 0, 0);
  const n = Math.round((t - x0) / 864e5), m = Math.max(0, Math.floor((now - x) / 6e4));
  if (n === 0) { if (m < 1) return 'À l\'instant'; if (m < 60) return `il y a ${m} minute${m > 1 ? 's' : ''}`; const h = Math.floor(m / 60); return `il y a ${h} heure${h > 1 ? 's' : ''}`; }
  if (n === 1) return `Hier à ${hm(x)}`;
  return fmtDateTime(d);
}
// Créneaux (available_from / available_until).
export const day0 = d => new Date(d).setHours(0, 0, 0, 0);
const dayN = d => Math.round((day0(d) - day0(Date.now())) / 864e5);
const dayLong = d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
// Lot 263 (FA 730) : fin d'affichage = fin enregistrée, sinon début + 15 min (données anciennes sans fin ; la base n'est pas modifiée).
const endOf = r => r.available_until || new Date(new Date(r.available_from).getTime() + 9e5).toISOString();
const hh = d => { const x = new Date(d); return x.getMinutes() ? `${x.getHours()} h ${String(x.getMinutes()).padStart(2, '0')}` : `${x.getHours()}`; };
const hfr = d => { const x = new Date(d), m = x.getMinutes(); return `${x.getHours()}h${m ? String(m).padStart(2, '0') : ''}`; };
// Lot 53 : « Aujourd'hui / Demain / Hier entre 17 et 18 h », « 20 novembre entre … », plus ancien « 12 novembre ».
export const slot = r => {
  const f = new Date(r.available_from), n = dayN(f);
  if (n < -1) return dayLong(f);
  const day = { '-1': 'Hier', 0: 'Aujourd\'hui', 1: 'Demain' }[n] || dayLong(f);
  const a = hh(f), b = hh(endOf(r));
  const H = x => /h/.test(x) ? x : `${x} h`;
  return /h/.test(a) || /h/.test(b) ? `${day} entre ${H(a)} et ${H(b)}` : `${day} entre ${a} et ${b} h`;
};
// Lot 280 (FA 738) : jour relatif + créneau, seule l'heure en gras (« Aujourd'hui <strong>9h - 11h</strong> »).
export const pslotR = r => {
  const f = new Date(r.available_from), d = { '-2': 'Avant-hier', '-1': 'Hier', 0: 'Aujourd\'hui', 1: 'Demain', 2: 'Après-demain' }[dayN(f)] || dayLong(f);
  if (!f.getHours() && !f.getMinutes() && !r.available_until) return `${d} dans la journée`;
  return `${d} <strong>${hfr(f)} - ${hfr(endOf(r))}</strong>`;
};
export const CLOCK = '<svg class="clk" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Intervention programmée"><circle cx="12" cy="12" r="9" fill="#fff"/><path d="M12 7v5l3 2"/></svg>';

export const statusPill = s => `<span class="pill st-${s}">${STATUS[s] || s}</span>`;

// Désactive un bouton pendant une action asynchrone.
export async function busy(btn, fn) {
  if (btn) btn.disabled = true;
  try { return await fn(); } finally { if (btn) btn.disabled = false; }
}

export function formData(form) {
  const d = Object.fromEntries(new FormData(form).entries());
  form.querySelectorAll('.cef[data-name]').forEach(el => (d[el.dataset.name] = el.value));
  return d;
}

// Champ texte sans barre AutoFill iOS (clé, carte, position) : Safari ignore autocomplete="off"
// sur les input/textarea, on utilise donc une zone éditable en texte brut.
export function cef(name, value, ph, { multi = false, attrs = '' } = {}) {
  return `<div class="cef${multi ? ' multi' : ''}" contenteditable="plaintext-only" role="textbox" ${multi ? 'aria-multiline="true"' : 'enterkeyhint="next"'} data-name="${name}" data-ph="${esc(ph)}" aria-label="${esc(ph)}" autocorrect="off" autocapitalize="sentences" spellcheck="false" autocomplete="off" data-form-type="other" data-lpignore="true" ${attrs}>${esc(value || '')}</div>`;
}
// Lot 57 : barre de défilement toujours visible quand le texte dépasse sa case (iOS masque la barre native).
export function sbar(el) {
  if (!el || el._sb) return; el._sb = 1;
  const p = el.parentElement; if (getComputedStyle(p).position === 'static') p.style.position = 'relative';
  const t = document.createElement('i'); t.className = 'sbt'; t.setAttribute('aria-hidden', 'true'); p.appendChild(t); el._sbt = t;
  const u = () => {
    const sh = el.scrollHeight, ch = el.clientHeight;
    if (sh <= ch + 1) { t.hidden = true; return; }
    t.hidden = false; const h = Math.max(18, ch * ch / sh);
    t.style.height = h + 'px'; t.style.top = (el.offsetTop + 3 + (el.scrollTop / (sh - ch)) * (ch - h - 6)) + 'px'; t.style.left = (el.offsetLeft + el.offsetWidth - 6) + 'px';
  };
  el.addEventListener('scroll', u, { passive: true }); el.addEventListener('input', u);
  if (window.ResizeObserver) new ResizeObserver(u).observe(el); u();
}
export function initCef(root = document) {
  root.querySelectorAll('.cef').forEach(el => {
    Object.defineProperty(el, 'value', { get: () => el.innerText.replace(/\u00a0/g, ' ').replace(/\n$/, ''), set: v => { el.textContent = v; }, configurable: true });
    el.addEventListener('input', () => { if (!el.textContent) el.innerHTML = ''; });
    if (!el.classList.contains('multi')) el.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
    // Nombre maximal de lignes affichées (data-lines) : au-delà, la saisie est refusée.
    const ml = +el.dataset.lines;
    if (ml) { let prev = el.value; el.addEventListener('input', () => { const cs = getComputedStyle(el), lh = parseFloat(cs.lineHeight) || 20; const h = el.scrollHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom); if (h > lh * ml + 2) { el.textContent = prev; const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); } else prev = el.value; }); }
    // Longueur maximale (data-max).
    const max = +el.dataset.max;
    if (max) {
      el.addEventListener('beforeinput', e => { if (e.inputType.startsWith('insert') && el.value.length - (getSelection().toString().length) + (e.data || '').length > max) e.preventDefault(); });
      el.addEventListener('input', () => { if (el.value.length > max) { el.textContent = el.value.slice(0, max); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); } });
    }
    // Largeur maximale (data-maxw) : le texte ne peut pas dépasser la largeur générée par ce modèle dans l'étiquette Lieu (12 px, gras 700).
    const mw = el.dataset.maxw;
    if (mw) {
      const cx = document.createElement('canvas').getContext('2d'), wd = t => { cx.font = '700 12px ' + getComputedStyle(document.body).fontFamily; return cx.measureText(t).width; };
      let prev = el.value;
      el.addEventListener('input', () => { if (wd(el.value) > wd(mw) + 0.5) { el.textContent = prev; const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); } else prev = el.value; });
    }
  });
}

// Clé à molette des étiquettes technicien (orange).
export const WRENCH = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';
export const PIN = '<svg class="pin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-4.8 7-11a7 7 0 1 0-14 0c0 6.2 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>';
export const BRIEFCASE = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>';

// Couleur propre à chaque profil (cercle de fonction du tchat) : rang du prénom dans l'équipe (ordre d'arrivée), jamais deux fois la même jusqu'à 14 membres.
// Lot 222 : jaune #F5C518 (prénom #8A6A00, sous AA) retiré ; rang décalé d'un cran pour que les autres membres gardent leur couleur.
export const PCOL = ['#2F7FE0', '#E5484D', '#2EA44F', '#F2802E', '#8E4EC6', '#E93D82', '#12A594', '#8D5B3E', '#A3D133', '#1F3A93', '#5BC8E8', '#B5179E', '#6B7280', '#7D7A12'];
const PLIGHT = ['#A3D133', '#5BC8E8'];
const shade = (h, k) => '#' + [1, 3, 5].map(i => Math.round(parseInt(h.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
const PROS = new WeakMap();
export function pcolor(name, members = [], pnames = {}) {
  let r = PROS.get(members);
  if (!r) {
    r = []; const add = n => { n = String(n || '').trim().toLowerCase(); if (n && !r.includes(n)) r.push(n); };
    members.forEach(m => m.role === 'admin' ? ['directeur', 'technicien', 'responsable_tech', 'reception'].forEach(k => add(pnames[k])) : add(m.full_name || m.email));
    PROS.set(members, r);
  }
  const k = String(name || '').trim().toLowerCase();
  let i = r.indexOf(k);
  if (i < 0) { let h = 0; for (const c of k) h = (h * 31 + c.codePointAt(0)) >>> 0; i = h; }
  const bg = PCOL[(i + PCOL.length - 1) % PCOL.length];
  // Bleu : teinte exacte de la maquette validée.
  const X = { '#2F7FE0': ['#fff', '#1F63B8'] }[bg];
  return { bg, fg: X ? X[0] : PLIGHT.includes(bg) ? shade(bg, .24) : '#fff', nm: X ? X[1] : shade(bg, .65) };
}

// Petite fenêtre de confirmation (Annuler / action).
export function confirmBox(msg, ok, { cancel = 'Annuler', danger = true } = {}) {
  return new Promise(res => {
    const o = document.createElement('div');
    o.className = 'modal';
    o.innerHTML = `<div class="mbox"><p class="mq">${msg}</p><div class="mbtns"><button class="ghost" data-r="0">${cancel}</button><button class="primary${danger ? ' danger-fill' : ''}" data-r="1">${ok}</button></div></div>`;
    (document.querySelector('#shell') || document.body).appendChild(o);
    o.onclick = e => { const b = e.target.closest('button'); if (!b && e.target !== o) return; o.remove(); res(b?.dataset.r === '1'); };
  });
}

// Avatars : émoji sur fond uni propre à chaque profil (lot 40), sinon paire de la liste de secours.
const AVF = { 'Raphaël': ['🦉', '#E6E0F5'], 'Julien': ['🦊', '#FFD9CC'], 'Thomas': ['🐻', '#DDEBD9'], 'Antoine': ['🐼', '#E6E6E6'], 'Léa': ['👤', '#E6E6E6'], 'Client': ['🐨', '#FFE3D1'], 'Client mobile': ['🐨', '#F5C4A8'] };
const AVL = [['🐢','#DFF2E1'],['🐙','#F7DCE8'],['🐝','#FFF1C2'],['🐬','#D6EEF8'],['🦄','#EEDDF7'],['🐸','#E3F3D0'],['🦝','#E4E8EE'],['🦋','#DCE3FB'],['🐞','#FBDCDC'],['🦔','#EFE4D6']];
export function avatar(name, idx, role) {
  const k = String(name || '');
  let a = role === 'directeur' && k === 'Raphaël' ? ['🦁', '#FCE7C8'] : AVF[k];
  if (!a) { let h = 0; for (const c of k) h = (h * 31 + c.codePointAt(0)) >>> 0; a = AVL[h % AVL.length]; /* même avatar partout : dépend du seul prénom, jamais de la position dans une liste */ }
  const bg = a[1];
  return { e: a[0], bg, html: `<span class="avt" style="background:${bg}" aria-hidden="true">${a[0]}</span>` };
}

// Visionneuse : photo en grand sur la page, fermée au toucher.
export function zoomImg(src, list) {
  const o = document.createElement('div'); o.className = 'phbig';
  // Lot 140.5 : flèches gauche et droite pour passer d'une photo à l'autre parmi celles déjà chargées.
  const L = (list || []).length > 1 ? list : null; let i = L ? Math.max(0, L.indexOf(src)) : 0;
  const AR = d => `<button type="button" class="ph-nav ph-${d < 0 ? 'p' : 'n'}" aria-label="${d < 0 ? 'Photo précédente' : 'Photo suivante'}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d < 0 ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'}"/></svg></button>`;
  o.innerHTML = `<img src="${src}" alt="Photo"><button type="button" class="ph-x" aria-label="Fermer">×</button>${L ? AR(-1) + AR(1) : ''}`;
  const im = o.querySelector('img'), mv = d => { i = (i + d + L.length) % L.length; im.src = L[i]; };
  o.onclick = e => { const n = e.target.closest('.ph-nav'); if (n) { e.stopPropagation(); return mv(n.classList.contains('ph-p') ? -1 : 1); } o.remove(); };
  document.body.appendChild(o);
}

// Lot 74 : numéros de mobil-home sur deux chiffres (01…09).
export const n2 = n => String(n).padStart(2, '0');
export const padMH = s => String(s).replace(/^((?:mh|mobil[- ]?home)\s*)(\d)\s*$/i, (_, a, d) => a + '0' + d);

// Lot 88 : titres collants empilés dans un conteneur qui défile (top cumulé = hauteurs des titres précédents).
export function stackSticky(box, sel, gap = 0) {
  const set = () => { let y = 0; box.querySelectorAll(sel).forEach(h => { h.style.top = Math.floor(y) + 'px'; y += h.getBoundingClientRect().height + gap; }); }; // Lot 222 : bandes jointives (hauteurs fractionnaires, chevauchement < 1 px dans la marge basse)
  set(); if (!box._stk) { box._stk = new ResizeObserver(set); box._stk.observe(box); }
}

