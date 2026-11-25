// Balayage latéral entre les trois onglets du mobile : Terminées | Interventions | Mes interventions (comme l'appli tech).
// Pendant le geste, la page suit le doigt et l'onglet voisin (son dernier affichage, gardé par la liste) arrive à côté.
// Au relâché, ce même affichage prend la place de la page, puis l'onglet est affiché normalement et se met à jour.
import { S, isMob } from './state.js';
import { lastView } from './list.js';

const TB = ['#', '#nouvelles', '#mes'];
const EXCL =
  '.phc, .pstrip, .dstrip, .wsheet, .phsheet, .phbig, input, textarea, [contenteditable], dialog, .modal, .cardpop';
const EASE = 'cubic-bezier(.2,.8,.2,1)',
  MS = 220;
const norm = h => h || '#';

export function initTabs({ app }) {
  const main = () => app.querySelector('main');
  const on = () => !!S.me && S.me.role !== 'client' && isMob() && !!main();
  const view = h => lastView(h.slice(1));

  // Pastille de la barre du bas entre deux onglets (f : 0 → 1).
  const pill = (from, to, f, anim) => {
    const bar = app.querySelector('.tabbar'),
      ind = bar?.querySelector('.tabbar__ind'),
      a = bar?.querySelector(`a[href="${from}"]`),
      b = bar?.querySelector(`a[href="${to}"]`);
    if (!ind || !a || !b) return;
    ind.style.transition = anim ? `left ${MS}ms ${EASE}, width ${MS}ms ${EASE}` : 'none';
    ind.style.left = a.offsetLeft + (b.offsetLeft - a.offsetLeft) * f + 'px';
    ind.style.width = a.offsetWidth + (b.offsetWidth - a.offsetWidth) * f + 'px';
  };
  // Image du voisin collée à côté de la page.
  const side = (h, dir) => {
    const m = main(),
      w = document.createElement('div');
    w.className = 'tabnb';
    w.setAttribute('aria-hidden', 'true');
    w.innerHTML = view(h);
    Object.assign(w.style, {
      position: 'absolute',
      top: '0',
      left: dir * m.clientWidth + 'px',
      width: m.clientWidth + 'px',
    });
    m.append(w);
  };
  const move = (x, anim) => {
    const m = main();
    m.style.transition = anim ? `transform ${MS}ms ${EASE}` : 'none';
    m.style.transform = `translate3d(${x}px,0,0)`;
  };
  const end = () => {
    const m = main();
    m?.querySelector(':scope > .tabnb')?.remove();
    if (m) m.style.transition = m.style.transform = '';
    document.body.classList.remove('dragtab');
  };
  let busy = 0;
  const go = (from, to, dir) => {
    busy = 1;
    move(-dir * main().clientWidth, true);
    pill(from, to, 1, true);
    setTimeout(() => {
      const m = main(),
        w = m.querySelector(':scope > .tabnb');
      if (w?.childNodes.length) m.replaceChildren(...w.childNodes);
      end();
      (document.querySelector('.sim #app') || document.scrollingElement).scrollTop = 0;
      busy = 0;
      location.replace(to);
    }, MS);
  };
  const back = (from, to) => {
    busy = 1;
    move(0, true);
    if (to) pill(from, from, 0, true);
    setTimeout(() => {
      end();
      busy = 0;
    }, MS);
  };

  let g = null;
  document.addEventListener(
    'touchstart',
    e => {
      g = null;
      if (!on() || busy || e.touches.length !== 1 || e.target.closest?.(EXCL) || document.querySelector('.pmenu'))
        return;
      const i = TB.indexOf(norm(location.hash));
      if (i < 0) return;
      const t = e.touches[0];
      g = { x: t.clientX, y: t.clientY, i, on: 0, dx: 0, v: 0, lx: t.clientX, lt: Date.now(), w: main().clientWidth };
    },
    { passive: true }
  );
  document.addEventListener(
    'touchmove',
    e => {
      if (!g) return;
      const t = e.touches[0],
        dx = t.clientX - g.x,
        dy = t.clientY - g.y;
      if (!g.on) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) return (g = null);
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        g.on = 1;
        g.dir = dx < 0 ? 1 : -1;
        g.to = TB[g.i + g.dir];
        document.body.classList.add('dragtab');
        if (g.to) side(g.to, g.dir);
      }
      const now = Date.now();
      g.v = (t.clientX - g.lx) / Math.max(1, now - g.lt);
      g.lx = t.clientX;
      g.lt = now;
      g.dx = g.to ? dx : dx * 0.3;
      move(g.dx, false);
      if (g.to) pill(TB[g.i], g.to, Math.min(1, Math.abs(g.dx) / g.w), false);
    },
    { passive: true }
  );
  const up = e => {
    if (!g) return;
    const s = g;
    g = null;
    if (!s.on) return;
    const far = Math.abs(s.dx) > s.w * 0.25,
      flick = Math.abs(s.v) > 0.35 && Math.sign(s.v) === -s.dir && Math.abs(s.dx) > 24;
    if (e.type === 'touchend' && s.to && Math.sign(s.dx) === -s.dir && (far || flick)) go(TB[s.i], s.to, s.dir);
    else back(TB[s.i], s.to);
  };
  document.addEventListener('touchend', up, { passive: true });
  document.addEventListener('touchcancel', up, { passive: true });

  // Boutons de la barre du bas entre ces onglets : même glissement.
  document.addEventListener(
    'click',
    e => {
      const a = e.target.closest?.('.tabbar a[href]');
      if (!a || !on() || busy) return;
      const to = norm(a.getAttribute('href')),
        from = norm(location.hash),
        i = TB.indexOf(from),
        n = TB.indexOf(to);
      if (i < 0 || n < 0 || i === n || !view(to)) return;
      e.preventDefault();
      e.stopPropagation();
      const dir = n > i ? 1 : -1;
      document.body.classList.add('dragtab');
      side(to, dir);
      go(from, to, dir);
    },
    true
  );
}
