import { p2, hostModal } from './state.js';
export const dIn = v => {
  const x = v ? new Date(v) : new Date();
  return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`;
};
export const TIMES = Array.from({ length: 96 }, (_, i) => `${p2(Math.floor(i / 4))}:${p2((i % 4) * 15)}`);

// Roues date / début / fin : sélection au défilement, créneaux passés grisés, fin toujours après le début.
function initWheels(f, sheet, isPast) {
  const wheels = [...sheet.querySelectorAll('.wheel')];
  const wheel = k => wheels.find(w => w.dataset.k === k);
  const IH = () => sheet.querySelector('.wi')?.offsetHeight || 36;
  const vis = w => [...w.children].filter(x => !x.hidden);
  const mark = (items, k) => items.forEach((x, j) => x.classList.toggle('sel', j === k));
  let placing = false,
    npBusy = false,
    lastA = null;
  const goTo = (w, k) => {
    w.scrollTo({ top: k * IH(), behavior: 'smooth' });
    mark([...w.children], k);
    f[w.dataset.k].value = w.children[k].dataset.v;
  };
  // Début déjà passé : premier horaire libre, sinon jour suivant.
  const skipPast = d => {
    const wa = wheel('slot_a'),
      wd = wheel('slot_d');
    const k = [...wa.children].findIndex(x => !x.classList.contains('past'));
    if (k >= 0) return goTo(wa, k);
    const j = wd ? [...wd.children].findIndex(x => x.dataset.v > d) : -1;
    if (j >= 0) goTo(wd, j);
  };
  // Fin : jamais avant le début ; suit le début quand on le change.
  const fitEnd = src => {
    const wb = wheel('slot_b'),
      a0 = f.slot_a.value;
    [...wb.children].forEach(x => {
      x.hidden = !!x.dataset.v && !!a0 && x.dataset.v <= a0;
    });
    const nx = () => TIMES.find(t => t > a0) || '';
    const fromA = src?.dataset?.k === 'slot_a';
    if (f.slot_b.value && a0 && f.slot_b.value <= a0) f.slot_b.value = nx();
    if (fromA && !placing && lastA !== null && a0 !== lastA) f.slot_b.value = nx();
    if (!f.slot_b.value && a0) f.slot_b.value = nx();
    if (fromA) lastA = a0;
    const k = Math.max(
      0,
      vis(wb).findIndex(x => x.dataset.v === f.slot_b.value)
    );
    mark(vis(wb), k);
    if (Math.abs(wb.scrollTop - k * IH()) > 2) wb.scrollTop = k * IH();
  };
  const noPast = src => {
    if (npBusy) return;
    npBusy = true;
    try {
      const d = f.slot_d.value;
      wheels
        .filter(w => w.dataset.k !== 'slot_d')
        .forEach(w =>
          [...w.children].forEach(x => x.classList.toggle('past', !!x.dataset.v && isPast(d, x.dataset.v)))
        );
      if (wheel('slot_a') && isPast(d, f.slot_a.value)) skipPast(d);
      if (wheel('slot_b')) fitEnd(src);
    } finally {
      npBusy = false;
    }
  };
  const pick = w => {
    const items = vis(w),
      idx = Math.max(0, Math.min(items.length - 1, Math.round(w.scrollTop / IH())));
    const prev = f[w.dataset.k].value,
      next = items[idx]?.dataset.v || '';
    mark(items, idx);
    f[w.dataset.k].value = next;
    if (w.dataset.k === 'slot_d' && !placing && prev && next && prev !== next) {
      f.slot_a.value = '08:00'; // nouveau jour : on repart de 8 h
      const wa = wheel('slot_a'),
        k = wa ? [...wa.children].findIndex(x => x.dataset.v === '08:00') : -1;
      if (k >= 0) {
        wa.scrollTo({ top: k * IH() });
        mark([...wa.children], k);
      }
      f.slot_b.value = TIMES.find(tm => tm > '08:00') || '';
    }
    noPast(w);
  };
  const place = () => {
    placing = true;
    try {
      wheels.forEach(w => {
        if (w.dataset.k === 'slot_a' && !f.slot_a.value) {
          const n = new Date(),
            q = `${p2(n.getHours())}:${p2((Math.ceil(n.getMinutes() / 15) * 15) % 60)}`;
          f.slot_a.value = TIMES.find(t => t >= q) || '09:00';
        }
        const idx = Math.max(
          0,
          vis(w).findIndex(x => x.dataset.v === f[w.dataset.k].value)
        );
        w.scrollTop = idx * IH();
        pick(w);
      });
    } finally {
      placing = false;
    }
  };
  wheels.forEach(w => {
    let tm;
    w.addEventListener(
      'scroll',
      () => {
        clearTimeout(tm);
        tm = setTimeout(() => {
          if (w.offsetParent) pick(w);
        }, 60);
      },
      { passive: true }
    );
    w.onclick = e => {
      const it = e.target.closest('.wi');
      if (it) w.scrollTo({ top: vis(w).indexOf(it) * IH(), behavior: 'smooth' });
    };
  });
  return { place };
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
  let slotDone = !!i.available_from,
    saved = null;
  const T0 = () => (id && i.created_at ? new Date(i.created_at) : new Date());
  const isPast = (d, t) => !!(d && t) && new Date(`${d}T${t}`) < T0();
  const { place } = initWheels(f, sheet, isPast);
  const KS = ['slot_d', 'slot_a', 'slot_b'];
  const paintSlot = () => {
    const on = hp.classList.contains('on') && slotDone && f.slot_d.value && f.slot_a.value;
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
    saved = KS.map(k => f[k].value);
    sheet.hidden = false;
    popPosition(sheet, hp);
    requestAnimationFrame(place);
  };
  const closeSheet = () => {
    sheet.hidden = true;
    if (saved)
      KS.forEach((k, j) => {
        f[k].value = saved[j];
      });
    if (!slotDone) setPassage(false);
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
    slotDone = true;
    saved = null;
    sheet.hidden = true;
    paintSlot();
  };
  sheet.querySelector('.wrm').onclick = () => {
    KS.forEach(k => {
      f[k].value = '';
    });
    slotDone = false;
    saved = null;
    sheet.hidden = true;
    setPassage(false);
  };
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
      return slotDone;
    },
    set done(v) {
      slotDone = v;
    },
  };
}
