export const p2 = n => String(n).padStart(2, '0');
export const dIn = v => {
  const x = v ? new Date(v) : new Date();
  return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`;
};
export const TIMES = Array.from({ length: 96 }, (_, i) => `${p2(Math.floor(i / 4))}:${p2((i % 4) * 15)}`);
export const hostModal = () => document.querySelector('.sim #app') || document.body;

// Sélecteur de créneau (date, heure, passage) du formulaire : roues de défilement dans une feuille.
/** Branche le sélecteur sur le formulaire `f` ; rend ce dont le reste du formulaire a besoin. */
export function initSlotPicker(f, { id, i, r, slotOn, err }) {
  const hp = f.querySelector('#hp'),
    clk = f.querySelector('.hpclk'),
    hpv = f.querySelector('.hpv');
  const sheet = f.querySelector('.wsheet');
  document.querySelectorAll('.wsheet').forEach(x => x !== sheet && x.remove());
  hostModal().append(sheet);
  addEventListener('hashchange', () => sheet.remove(), { once: true });
  const wheels = [...sheet.querySelectorAll('.wheel')];
  const IH = () => sheet.querySelector('.wi')?.offsetHeight || 36;
  const vis = w => [...w.children].filter(x => !x.hidden);
  let placing = false,
    npBusy = false,
    lastA = null,
    slotDone = !!i.available_from,
    saved = null;
  const T0 = () => (id && i.created_at ? new Date(i.created_at) : new Date());
  const isPast = (d, t) => !!(d && t) && new Date(`${d}T${t}`) < T0();
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
      const wa = wheels.find(w => w.dataset.k === 'slot_a'),
        wd = wheels.find(w => w.dataset.k === 'slot_d');
      if (wa && isPast(d, f.slot_a.value)) {
        const k = [...wa.children].findIndex(x => !x.classList.contains('past'));
        if (k >= 0) {
          wa.scrollTo({ top: k * IH(), behavior: 'smooth' });
          [...wa.children].forEach((x, j) => x.classList.toggle('sel', j === k));
          f.slot_a.value = wa.children[k].dataset.v;
        } else if (wd) {
          const j = [...wd.children].findIndex(x => x.dataset.v > d);
          if (j >= 0) {
            wd.scrollTo({ top: j * IH(), behavior: 'smooth' });
            [...wd.children].forEach((x, q) => x.classList.toggle('sel', q === j));
            f.slot_d.value = wd.children[j].dataset.v;
          }
        }
      }
      const wb = wheels.find(w => w.dataset.k === 'slot_b'),
        a0 = f.slot_a.value;
      if (wb) {
        [...wb.children].forEach(x => {
          x.hidden = !!x.dataset.v && !!a0 && x.dataset.v <= a0;
        });
        const nx = () => TIMES.find(t => t > a0) || '';
        if (f.slot_b.value && a0 && f.slot_b.value <= a0) f.slot_b.value = nx();
        if (src?.dataset?.k === 'slot_a' && !placing && lastA !== null && a0 !== lastA) f.slot_b.value = nx();
        if (!f.slot_b.value && a0) f.slot_b.value = nx();
        if (src?.dataset?.k === 'slot_a') lastA = a0;
        const k = Math.max(
          0,
          vis(wb).findIndex(x => x.dataset.v === f.slot_b.value)
        );
        vis(wb).forEach((x, j) => x.classList.toggle('sel', j === k));
        if (Math.abs(wb.scrollTop - k * IH()) > 2) wb.scrollTop = k * IH();
      }
    } finally {
      npBusy = false;
    }
  };
  const pick = w => {
    const items = vis(w),
      idx = Math.max(0, Math.min(items.length - 1, Math.round(w.scrollTop / IH())));
    const prev = f[w.dataset.k].value,
      next = items[idx]?.dataset.v || '';
    items.forEach((x, k) => x.classList.toggle('sel', k === idx));
    f[w.dataset.k].value = next;
    if (w.dataset.k === 'slot_d' && !placing && prev && next && prev !== next) {
      f.slot_a.value = '08:00';
      const wa = wheels.find(x => x.dataset.k === 'slot_a'),
        k = wa ? [...wa.children].findIndex(x => x.dataset.v === '08:00') : -1;
      if (wa && k >= 0) {
        wa.scrollTo({ top: k * IH() });
        [...wa.children].forEach((x, j) => x.classList.toggle('sel', j === k));
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
  const setPassage = on => {
    hp.classList.toggle('on', on);
    f.querySelector('[name=passage][value=slot]').checked = on;
    f.querySelector('[name=passage][value=now]').checked = !on;
    hp.querySelector('.hpsw2').setAttribute('aria-checked', on);
    clk.disabled = !on;
    if (on && !f.slot_d.value) f.slot_d.value = dIn();
    paintSlot();
  };
  const paintSlot = () => {
    if (!hp.classList.contains('on') || !slotDone || !f.slot_d.value || !f.slot_a.value) {
      hpv.textContent = '';
      return;
    }
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
    hpv.textContent = `${day} ${f.slot_a.value}${f.slot_b.value ? '–' + f.slot_b.value : ''}`;
  };
  const KS = ['slot_d', 'slot_a', 'slot_b'];
  const pos = () => {
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
  };
  const openSheet = () => {
    saved = KS.map(k => f[k].value);
    sheet.hidden = false;
    pos();
    requestAnimationFrame(place);
  };
  const closeSheet = () => {
    sheet.hidden = true;
    if (saved)
      KS.forEach((k, i) => {
        f[k].value = saved[i];
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
