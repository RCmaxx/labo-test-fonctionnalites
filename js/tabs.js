// Onglets « vivants » (Terminées, Interventions, Mes interventions) et balayage latéral — mobile.
// Principe : quand on quitte un onglet, le contenu de <main> (éléments vivants, avec leurs écouteurs) est mis de côté ;
// l'onglet voisin est collé à côté pendant le geste, puis remis en place sans rendu ni chargement.
import { S, isMob } from './state.js';

const TB = ['#', '#nouvelles', '#mes'];
const EXCL = '.phc, .pstrip, .dstrip, .wsheet, .phsheet, .phbig, input, textarea, [contenteditable], dialog, .modal, .cardpop';
const EASE = 'cubic-bezier(.2,.8,.2,1)', MS = 230;
const norm = h => (!h || h === '#') ? '#' : h;

export function initTabs({ app }) {
  const STASH = {};              // hash -> fragment d'éléments vivants
  let busy = 0, warming = 0, skip = 0, done = '';
  const main = () => app.querySelector('main');
  const tech = () => !!S.me && S.me.role !== 'client' && isMob() && !!main();
  const loaded = () => { const rw = main()?.querySelector('#rows'); return !!rw && !!rw.textContent.trim() && !/^Chargement/.test(rw.textContent.trim()); };
  const scroller = () => document.querySelector('.sim #app') || document.scrollingElement;
  const toTop = () => { scroller().scrollTop = 0; };

  // Met la page `from` de côté et remet celle de `to` (collée à côté pendant un geste, ou gardée en réserve).
  function swap(from, to) {
    const m = main(), wrap = m.querySelector(':scope > .tabnb');
    if (loaded()) {
      const fr = document.createDocumentFragment();
      [...m.childNodes].filter(n => n !== wrap).forEach(n => fr.append(n));
      STASH[from] = fr;
    }
    let src = null;
    if (wrap) { src = document.createDocumentFragment(); while (wrap.firstChild) src.append(wrap.firstChild); wrap.remove(); STASH[to] = null; delete STASH[to]; }
    else if (STASH[to]) { src = STASH[to]; delete STASH[to]; }
    if (src) { m.append(src); skip = 1; toTop(); }
    return !!src;
  }
  window.addEventListener('hashchange', e => {
    const old = norm('#' + (e.oldURL.split('#')[1] || '')), cur = norm(location.hash);
    if (done === cur) { done = ''; return; }
    if (!tech() || old === cur || !TB.includes(old) || !TB.includes(cur)) return;
    swap(old, cur);
  });

  // Colle la page voisine (éléments vivants) à côté de la page courante, alignée sur ce qui est visible.
  const attach = (h, dir) => {
    const m = main(), w = document.createElement('div'), W = m.clientWidth, sim = document.querySelector('.sim #app');
    const hostTop = sim ? sim.getBoundingClientRect().top : 0;
    w.className = 'tabnb'; w.setAttribute('aria-hidden', 'true');
    Object.assign(w.style, { position: 'absolute', top: Math.max(0, hostTop - m.getBoundingClientRect().top) + 'px', left: (dir * W) + 'px', width: W + 'px' });
    while (STASH[h].firstChild) w.append(STASH[h].firstChild);
    m.append(w); return w;
  };
  const detach = h => { const w = main()?.querySelector(':scope > .tabnb'); if (!w) return; while (w.firstChild) STASH[h].append(w.firstChild); w.remove(); };
  const clean = () => { const m = main(); if (m) { m.style.transition = ''; m.style.transform = ''; } document.body.classList.remove('dragtab'); busy = 0; };
  const commit = to => {
    const from = norm(location.hash), m = main(); m.style.transition = 'none'; swap(from, to); m.style.transform = '';
    document.body.classList.remove('dragtab'); busy = 0; done = to; location.replace(to === '#' ? '#' : to);
  };
  const slide = (from, to, dir, w) => {   // glissement automatique (relâché ou bouton de la barre du bas)
    busy = 1; document.body.classList.add('dragtab'); const m = main(); m.style.transition = `transform .22s ${EASE}`; m.style.transform = `translate3d(${-dir * w}px,0,0)`;
    setTimeout(() => commit(to), MS);
  };

  // Geste au doigt : la page suit le doigt, la voisine arrive à côté.
  let g = null;
  document.addEventListener('touchstart', e => {
    g = null; if (!tech() || busy || warming || e.touches.length !== 1 || document.querySelector('.cardpop')) return;
    if (e.target.closest?.(EXCL)) return;
    const i = TB.indexOf(norm(location.hash)); if (i < 0) return;
    const t = e.touches[0]; g = { x: t.clientX, y: t.clientY, i, on: 0, dx: 0, v: 0, lx: t.clientX, lt: Date.now(), w: main().clientWidth || innerWidth };
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!g) return; const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y, m = main();
    if (!g.on) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { g = null; return; }
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      g.on = 1; g.dir = dx < 0 ? 1 : -1; g.n = g.i + g.dir; g.ok = g.n >= 0 && g.n < TB.length; g.live = g.ok && !!STASH[TB[g.n]];
      document.body.classList.add('dragtab'); m.style.transition = 'none'; m.style.transform = 'translate3d(0,0,0)'; if (g.live) attach(TB[g.n], g.dir);
    }
    const now = Date.now(); g.v = (t.clientX - g.lx) / Math.max(1, now - g.lt); g.lx = t.clientX; g.lt = now;
    g.dx = g.ok ? dx : dx * .3; m.style.transform = `translate3d(${g.dx}px,0,0)`;
  }, { passive: true });
  const end = e => {
    if (!g) return; const s = g; g = null; if (!s.on) return;
    const go = e.type === 'touchend' && s.ok && (Math.abs(s.dx) > s.w * .25 || (Math.abs(s.v) > .35 && Math.sign(s.v) === -s.dir && Math.abs(s.dx) > 24 && Math.sign(s.dx) === -s.dir));
    if (go) { slide(TB[s.i], TB[s.n], s.dir, s.w); return; }
    const m = main(); busy = 1; m.style.transition = `transform .22s ${EASE}`; m.style.transform = 'translate3d(0,0,0)';
    setTimeout(() => { if (s.live) detach(TB[s.n]); clean(); }, MS);
  };
  document.addEventListener('touchend', end, { passive: true }); document.addEventListener('touchcancel', end, { passive: true });

  // Boutons de la barre du bas : même glissement que le geste.
  document.addEventListener('click', e => {
    const a = e.target.closest?.('.tabbar a[href]'); if (!a || !tech() || busy || warming) return;
    const to = norm(a.getAttribute('href')), from = norm(location.hash), i = TB.indexOf(from), n = TB.indexOf(to);
    if (i < 0 || n < 0 || i === n || !STASH[to] || !loaded()) return;
    e.preventDefault(); e.stopPropagation(); const dir = n > i ? 1 : -1; attach(to, dir); slide(from, to, dir, main().clientWidth || innerWidth);
  }, true);

  // Préchargement : les trois onglets sont visités une fois, en cachette, pour être prêts avant le premier geste.
  const ready = () => new Promise(res => { const t0 = Date.now(), iv = setInterval(() => { if (loaded() || Date.now() - t0 > 2500) { clearInterval(iv); res(); } }, 60); });
  async function warm() {
    const home = norm(location.hash); if (!tech() || !TB.includes(home)) return;
    const miss = TB.filter(h => h !== home && !STASH[h]); if (!miss.length || !loaded()) return;
    warming = 1; document.body.classList.add('warming'); main().style.visibility = 'hidden';
    try {
      for (const h of miss) { location.replace(h); await ready(); await new Promise(r => setTimeout(r, 150)); }
      if (norm(location.hash) !== home) { location.replace(home); await ready(); await new Promise(r => setTimeout(r, 100)); }
    } finally { warming = 0; document.body.classList.remove('warming'); const m = main(); if (m) m.style.visibility = ''; }
  }
  setTimeout(() => { const iv = setInterval(() => { if (!tech() || !loaded()) return; clearInterval(iv); warm(); }, 400); }, 1500);

  return {
    consumeSkip: () => { const s = skip; skip = 0; return !!s; },   // show() : page remise vivante, pas de rendu
    reset: () => { for (const k in STASH) delete STASH[k]; },       // données modifiées, changement de compte ou d'affichage
  };
}
