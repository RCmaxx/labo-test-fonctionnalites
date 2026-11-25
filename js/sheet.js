export function openInterventionSheet(opener, renderContent) {
  if (document.querySelector('.itv-sheet')) return;
  const sheet = document.createElement('div');
  sheet.className = 'itv-sheet';
  sheet.innerHTML = `<section class="itv-panel" role="dialog" aria-modal="true" aria-label="Fiche intervention">
    <header class="itv-controls">
      <button type="button" class="itv-grip" aria-expanded="false" aria-label="Agrandir la fiche"></button>
      <button type="button" class="itv-close" aria-label="Fermer la fiche">×</button>
    </header>
    <div class="itv-content"><p class="pad muted" role="status">Chargement…</p></div>
    <footer class="itv-footer"></footer>
  </section>`;
  const content = sheet.querySelector('.itv-content');
  const grip = sheet.querySelector('.itv-grip');
  const closeButton = sheet.querySelector('.itv-close');
  const background = [...document.querySelectorAll('#app')].filter(el => !el.inert);
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  const close = (restoreFocus = true) => {
    listeners.abort();
    sheet.remove();
    sheet.dispatchEvent(new Event('itv:close'));
    background.forEach(el => { el.inert = false; });
    if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
  };
  const expand = value => {
    sheet.classList.toggle('expanded', value);
    grip.setAttribute('aria-expanded', String(value));
    grip.setAttribute('aria-label', value ? 'Réduire la fiche' : 'Agrandir la fiche');
    if (value) sheet.dispatchEvent(new Event('itv:expand'));
    else content.scrollTop = 0;
  };
  background.forEach(el => { el.inert = true; });
  document.body.append(sheet);
  closeButton.focus({ preventScroll: true });
  closeButton.onclick = () => close();
  sheet.onclick = e => { if (e.target === sheet) close(); };
  grip.onclick = () => expand(!sheet.classList.contains('expanded'));
  let startY = null;
  grip.onpointerdown = e => { startY = e.clientY; grip.setPointerCapture(e.pointerId); };
  grip.onpointercancel = () => { startY = null; };
  grip.onpointerup = e => {
    if (startY === null) return;
    const dy = e.clientY - startY;
    startY = null;
    if (Math.abs(dy) < 30) return;
    const toggle = grip.onclick;
    grip.onclick = e => e.preventDefault();
    setTimeout(() => { grip.onclick = toggle; }, 0);
    if (dy < 0) expand(true);
    else close();
  };
  let previewStart = null;
  content.onpointerdown = e => {
    if (!e.isPrimary || e.button !== 0 || sheet.classList.contains('expanded')
      || e.target.closest('button, a, input, textarea, [role="button"]')) return;
    previewStart = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  content.onpointercancel = () => { previewStart = null; };
  content.onpointerup = e => {
    if (previewStart?.id !== e.pointerId) return;
    const up = previewStart.y - e.clientY;
    const sideways = Math.abs(previewStart.x - e.clientX);
    previewStart = null;
    if (Math.abs(up) < 36 || Math.abs(up) <= sideways) return;
    if (up > 0) expand(true);
    else close();
  };
  let expandedTouch = null;
  content.addEventListener('touchstart', e => {
    expandedTouch = null;
    if (!sheet.classList.contains('expanded') || content.scrollTop > 1 || e.touches.length !== 1
      || e.target.closest('button, a, input, textarea, [role="button"]')
      || e.target.closest('.chrono')?.scrollTop > 1) return;
    const touch = e.touches[0];
    expandedTouch = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  content.addEventListener('touchcancel', () => { expandedTouch = null; }, { passive: true });
  content.addEventListener('touchend', e => {
    const start = expandedTouch;
    expandedTouch = null;
    if (!start || content.scrollTop > 1) return;
    const touch = [...e.changedTouches].find(point => point.identifier === start.id);
    if (!touch) return;
    const down = touch.clientY - start.y;
    if (down >= 48 && down > Math.abs(touch.clientX - start.x)) close();
  }, { passive: true });
  document.addEventListener('keydown', e => {
    if (!sheet.contains(document.activeElement)) return;
    if (e.key === 'Escape') close();
    if (e.key !== 'Tab') return;
    const controls = [...sheet.querySelectorAll('button, a[href], textarea, [tabindex="0"]')]
      .filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
    const edge = e.shiftKey ? controls[0] : controls.at(-1);
    if (document.activeElement === edge) {
      e.preventDefault();
      (e.shiftKey ? controls.at(-1) : controls[0])?.focus();
    }
  }, options);
  addEventListener('hashchange', () => close(false), options);
  renderContent(content, sheet).catch(error => {
    if (!sheet.isConnected) return;
    const status = document.createElement('p');
    status.className = 'pad err';
    status.textContent = error.message || 'Impossible de charger la fiche.';
    content.replaceChildren(status);
    sheet.querySelector('.itv-footer').replaceChildren();
  });
}
