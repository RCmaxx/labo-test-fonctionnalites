import { p2, hostModal } from './state.js';
export const dIn = v => {
  const x = v ? new Date(v) : new Date();
  return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`;
};
export const TIMES = Array.from({ length: 96 }, (_, i) => `${p2(Math.floor(i / 4))}:${p2((i % 4) * 15)}`);

// Roues date / début / fin : sélection au défilement, créneaux passés grisés, fin toujours après le début.
const vis = w => [...w.children].filter(x => !x.hidden);
const mark = (items, k) => items.forEach((x, j) => x.classList.toggle('sel', j === k));

// État partagé par les roues : formulaire, roues, hauteur d'une ligne, et drapeaux anti-boucle.
function wheelCtx(f, sheet, isPast) {
  const wheels = [...sheet.querySelectorAll('.wheel')];
  return {
    f,
    isPast,
    wheels,
    wheel: k => wheels.find(w => w.dataset.k === k),
    IH: () => sheet.querySelector('.wi')?.offsetHeight || 36,
    placing: false,
    npBusy: false,
    lastA: null,
  };
}

function goTo(c, w, k) {
  w.scrollTo({ top: k * c.IH(), behavior: 'smooth' });
  mark([...w.children], k);
  c.f[w.dataset.k].value = w.children[k].dataset.v;
}

// Début déjà passé : premier horaire libre, sinon jour suivant.
function skipPast(c, d) {
  const wa = c.wheel('slot_a'),
    wd = c.wheel('slot_d');
  const k = [...wa.children].findIndex(x => !x.classList.contains('past'));
  if (k >= 0) return goTo(c, wa, k);
  const j = wd ? [...wd.children].findIndex(x => x.dataset.v > d) : -1;
  if (j >= 0) goTo(c, wd, j);
}

// Fin : jamais avant le début ; suit le début quand on le change.
function fitEnd(c, src) {
  const { f } = c,
    wb = c.wheel('slot_b'),
    a0 = f.slot_a.value;
  [...wb.children].forEach(x => {
    x.hidden = !!x.dataset.v && !!a0 && x.dataset.v <= a0;
  });
  const nx = () => TIMES.find(t => t > a0) || '';
  const fromA = src?.dataset?.k === 'slot_a';
  if (f.slot_b.value && a0 && f.slot_b.value <= a0) f.slot_b.value = nx();
  if (fromA && !c.placing && c.lastA !== null && a0 !== c.lastA) f.slot_b.value = nx();
  if (!f.slot_b.value && a0) f.slot_b.value = nx();
  if (fromA) c.lastA = a0;
  const k = Math.max(
    0,
    vis(wb).findIndex(x => x.dataset.v === f.slot_b.value)
  );
  mark(vis(wb), k);
  if (Math.abs(wb.scrollTop - k * c.IH()) > 2) wb.scrollTop = k * c.IH();
}

// Grise les créneaux passés du jour choisi et remet début / fin d'aplomb.
function noPast(c, src) {
  if (c.npBusy) return;
  c.npBusy = true;
  try {
    const d = c.f.slot_d.value;
    c.wheels
      .filter(w => w.dataset.k !== 'slot_d')
      .forEach(w =>
        [...w.children].forEach(x => x.classList.toggle('past', !!x.dataset.v && c.isPast(d, x.dataset.v)))
      );
    if (c.wheel('slot_a') && c.isPast(d, c.f.slot_a.value)) skipPast(c, d);
    if (c.wheel('slot_b')) fitEnd(c, src);
  } finally {
    c.npBusy = false;
  }
}

// Nouveau jour : on repart de 8 h.
function resetDay(c) {
  const { f } = c,
    wa = c.wheel('slot_a');
  f.slot_a.value = '08:00';
  const k = wa ? [...wa.children].findIndex(x => x.dataset.v === '08:00') : -1;
  if (k >= 0) {
    wa.scrollTo({ top: k * c.IH() });
    mark([...wa.children], k);
  }
  f.slot_b.value = TIMES.find(tm => tm > '08:00') || '';
}

// La roue s'est arrêtée : on lit la ligne choisie.
function pick(c, w) {
  const items = vis(w),
    idx = Math.max(0, Math.min(items.length - 1, Math.round(w.scrollTop / c.IH())));
  const prev = c.f[w.dataset.k].value,
    next = items[idx]?.dataset.v || '';
  mark(items, idx);
  c.f[w.dataset.k].value = next;
  if (w.dataset.k === 'slot_d' && !c.placing && prev && next && prev !== next) resetDay(c);
  noPast(c, w);
}

// Place chaque roue sur la valeur du formulaire (début : prochain quart d'heure si vide).
function place(c) {
  c.placing = true;
  try {
    c.wheels.forEach(w => {
      if (w.dataset.k === 'slot_a' && !c.f.slot_a.value) {
        const n = new Date(),
          q = `${p2(n.getHours())}:${p2((Math.ceil(n.getMinutes() / 15) * 15) % 60)}`;
        c.f.slot_a.value = TIMES.find(t => t >= q) || '09:00';
      }
      const idx = Math.max(
        0,
        vis(w).findIndex(x => x.dataset.v === c.f[w.dataset.k].value)
      );
      w.scrollTop = idx * c.IH();
      pick(c, w);
    });
  } finally {
    c.placing = false;
  }
}

function initWheels(f, sheet, isPast) {
  const c = wheelCtx(f, sheet, isPast);
  c.wheels.forEach(w => {
    let tm;
    w.addEventListener(
      'scroll',
      () => {
        clearTimeout(tm);
        tm = setTimeout(() => {
          if (w.offsetParent) pick(c, w);
        }, 60);
      },
      { passive: true }
    );
    w.onclick = e => {
      const it = e.target.closest('.wi');
      if (it) w.scrollTo({ top: vis(w).indexOf(it) * c.IH(), behavior: 'smooth' });
    };
  });
  return { place: () => place(c) };
}

// Fenêtre des roues : posée contre le bouton du créneau, à l'intérieur de l'écran.
function popPosition(sheet, hp) {
  const bx = sheet.querySelector('.wbox');
  sheet.classList.add('pop');
  if (!bx) return;
  const r = hp.getBoundingClientRect(),
    sr = sheet.getBoundingClientRect(),
    w = bx.offsetWidth,
    h = bx.offsetHeight;
  let l = r.right + 8 - sr.left,
    t = r.bottom - h - sr.top;
  if (l + w > sr.width - 8) {
    l = r.right - w - sr.left;
    t = r.bottom + 8 - sr.top;
  }
  bx.style.left = Math.max(8, Math.min(l, sr.width - w - 8)) + 'px';
  bx.style.top = Math.max(8, Math.min(t, sr.height - h - 8)) + 'px';
}

// Texte du créneau choisi, ex. « Demain 09:00–09:15 ».
function slotText(f, sheet) {
  const lab = sheet.querySelector('.wheel[data-k=slot_d] .wi.sel')?.textContent;
  const d = new Date(f.slot_d.value + 'T00:00'),
    t = new Date();
  t.setHours(0, 0, 0, 0);
  const n = Math.round((d - t) / 864e5);
  const day =
    lab ||
    (n === 0
      ? "Aujourd'hui"
      : n === 1
        ? 'Demain'
        : d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }));
  return `${day} ${f.slot_a.value}${f.slot_b.value ? '–' + f.slot_b.value : ''}`;
}

const KS = ['slot_d', 'slot_a', 'slot_b'];

// Boutons de la feuille : fermer, valider, retirer le créneau. `st` garde `done` (créneau validé) et `saved`.
function bindSheet(f, sheet, st, { err, isPast, paintSlot, setPassage }) {
  const closeSheet = () => {
    sheet.hidden = true;
    if (st.saved)
      KS.forEach((k, j) => {
        f[k].value = st.saved[j];
      });
    if (!st.done) setPassage(false);
    paintSlot();
  };
  sheet.querySelector('.wx').onclick = closeSheet;
  sheet.onclick = e => {
    if (e.target === sheet) closeSheet();
  };
  sheet.querySelector('.wok').onclick = () => {
    if (f.slot_b.value && f.slot_b.value <= f.slot_a.value)
      return (err.textContent = "L'heure de fin doit suivre l'heure de début.");
    if (isPast(f.slot_d.value, f.slot_a.value)) return (err.textContent = 'Ce créneau est déjà passé.');
    err.textContent = '';
    st.done = true;
    st.saved = null;
    sheet.hidden = true;
    paintSlot();
  };
  sheet.querySelector('.wrm').onclick = () => {
    KS.forEach(k => {
      f[k].value = '';
    });
    st.done = false;
    st.saved = null;
    sheet.hidden = true;
    setPassage(false);
  };
}

// Sélecteur de créneau (date, heure, passage) du formulaire : roues de défilement dans une feuille.
/** Branche le sélecteur sur le formulaire `f` ; rend ce dont le reste du formulaire a besoin. */
export function initSlotPicker(f, { id, i, r, slotOn, err }) {
  const hp = f.querySelector('#hp'),
    clk = f.querySelector('.hpclk'),
    hpv = f.querySelector('.hpv'),
    sheet = f.querySelector('.wsheet');
  document.querySelectorAll('.wsheet').forEach(x => x !== sheet && x.remove());
  hostModal().append(sheet);
  addEventListener('hashchange', () => sheet.remove(), { once: true });
  const st = { done: !!i.available_from, saved: null };
  const T0 = () => (id && i.created_at ? new Date(i.created_at) : new Date());
  const isPast = (d, t) => !!(d && t) && new Date(`${d}T${t}`) < T0();
  const { place } = initWheels(f, sheet, isPast);
  const paintSlot = () => {
    const on = hp.classList.contains('on') && st.done && f.slot_d.value && f.slot_a.value;
    hpv.textContent = on ? slotText(f, sheet) : '';
  };
  const setPassage = on => {
    hp.classList.toggle('on', on);
    f.querySelector('[name=passage][value=slot]').checked = on;
    f.querySelector('[name=passage][value=now]').checked = !on;
    hp.querySelector('.hpsw2').setAttribute('aria-checked', on);
    clk.disabled = !on;
    if (on && !f.slot_d.value) f.slot_d.value = dIn();
    paintSlot();
  };
  const openSheet = () => {
    st.saved = KS.map(k => f[k].value);
    sheet.hidden = false;
    popPosition(sheet, hp);
    requestAnimationFrame(place);
  };
  bindSheet(f, sheet, st, { err, isPast, paintSlot, setPassage });
  hp.querySelector('.hpsw2').onclick = () => {
    const on = !hp.classList.contains('on');
    setPassage(on);
    if (on) openSheet();
  };
  clk.onclick = () => {
    if (!clk.disabled) openSheet();
  };
  if (slotOn && i.available_from) {
    requestAnimationFrame(() => {
      sheet.hidden = false;
      place();
      sheet.hidden = true;
      paintSlot();
    });
  } else paintSlot();

  return {
    hp,
    sheet,
    paintSlot,
    place,
    setPassage,
    get done() {
      return st.done;
    },
    set done(v) {
      st.done = v;
    },
  };
}
