import { sb } from './sb.js';
import { S } from './state.js';
import { uploadPhotos, photoTray } from './form.js';
import { hostModal } from './slot.js';

// Zone de saisie du tchat : commentaire, photos, envoi, et décalage du clavier mobile.
/** Branche la saisie (`#cm`, `#comment`, `#ph`) de la fiche `el`. `rerender` redessine la fiche après un envoi. */
export function initComposer(el, { id, photos, fail, redraw }) {
  const cm = el.querySelector('#cm'),
    cb = el.querySelector('#comment'),
    phInp = el.querySelector('#ph');
  if (cm)
    cm.oninput = () => {
      cm.style.height = 'auto';
      cm.style.height = Math.min(120, cm.scrollHeight) + 'px';
    };
  document.querySelectorAll('.phsheet').forEach(x => x.remove());
  if (phInp) {
    const myPh = photos.filter(p => p.uploaded_by === S.me.id).length;
    const sh = document.createElement('div');
    sh.className = 'phsheet';
    sh.hidden = true;
    sh.innerHTML =
      '<div class="pstrip"><div class="ptray"></div><button type="button" class="padd" data-add aria-label="Ajouter des photos"><span>+</span></button></div><div class="actions"><button type="button" class="ghost" data-x>Annuler</button><button type="button" class="primary" data-ok>Envoyer</button></div>';
    hostModal().append(sh);
    const tray = sh.querySelector('.ptray');
    const files = photoTray(
      phInp,
      tray,
      f => {
        sh.hidden = !f.length;
      },
      10 - myPh
    );
    sh.querySelector('[data-add]').onclick = () => phInp.click();
    sh.querySelector('[data-x]').onclick = () => {
      files.splice(0);
      tray.innerHTML = '';
      sh.hidden = true;
    };
    sh.querySelector('[data-ok]').onclick = async () => {
      const ok = sh.querySelector('[data-ok]');
      ok.disabled = true;
      const err = await uploadPhotos(id, [...files]);
      ok.disabled = false;
      if (err) return fail(err);
      sh.remove();
      redraw();
    };
    addEventListener('hashchange', () => sh.remove(), { once: true });
  }
  if (cb)
    cb.onclick = async () => {
      const body = cm.value.trim(),
        out = el.querySelector('#acterr');
      if (!body) return (out.textContent = 'Le message est vide.');
      cb.disabled = true;
      const { error } = await sb.rpc('add_comment', { p_id: id, p_body: body });
      cb.disabled = false;
      error ? (out.textContent = error.message) : redraw();
    };
}

const VV = window.visualViewport;
function kbSync() {
  const k = VV ? Math.max(0, Math.round(document.documentElement.clientHeight - VV.height - (VV.offsetTop || 0))) : 0;
  document.documentElement.style.setProperty('--kb', k + 'px');
}
function cinShow() {
  const m = document.activeElement;
  if (m?.id !== 'cm') return;
  kbSync();
  requestAnimationFrame(() => {
    const c = m.closest('.cin') || m,
      r = c.getBoundingClientRect();
    let bot = VV ? VV.offsetTop + VV.height : innerHeight;
    const nav = document.querySelector('.tabbar');
    if (nav && nav.offsetParent) bot = Math.min(bot, nav.getBoundingClientRect().top);
    const d = r.bottom - bot + 8;
    if (d > 0) (document.scrollingElement || document.documentElement).scrollBy(0, d);
  });
}
VV?.addEventListener('resize', () => {
  if (document.activeElement?.id === 'cm') {
    kbSync();
    cinShow();
  } else kbSync();
});
document.addEventListener('focusin', e => {
  if (e.target.id === 'cm') {
    cinShow();
    setTimeout(cinShow, 300);
  }
});
document.addEventListener('focusout', e => {
  if (e.target.id === 'cm') setTimeout(kbSync, 60);
});
