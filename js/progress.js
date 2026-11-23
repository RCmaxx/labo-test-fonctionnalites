// Jauge d'avancement du chantier (labo uniquement) : lit progress.json toutes les 20 s.
const el = document.createElement('div');
el.id = 'xp';
el.innerHTML = '<div class="xp-bar"><i></i><b></b></div><span></span>';
document.head.insertAdjacentHTML('beforeend', `<style>
#xp{position:fixed;left:50%;bottom:calc(10px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9999;width:min(320px,80vw);text-align:center;pointer-events:none;font:700 11px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#7A3D00}
#xp .xp-bar{position:relative;height:16px;border-radius:8px;background:#2B1A0A;border:2px solid #7A3D00;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.25)}
#xp i{position:absolute;inset:0 auto 0 0;width:0;background:linear-gradient(#FFC27A,#FF9A3C 55%,#E8821F);transition:width .8s cubic-bezier(.2,.8,.2,1)}
#xp b{position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-size:10px;text-shadow:0 1px 0 #000}
#xp span{display:block;margin-top:4px}
</style>`);
document.body.append(el);
async function tick() {
  try {
    const { mission, pct } = await (await fetch('progress.json', { cache: 'no-store' })).json();
    el.querySelector('i').style.width = pct + '%';
    el.querySelector('b').textContent = pct + ' %';
    el.querySelector('span').textContent = mission;
  } catch {} // jauge facultative : on ignore une lecture ratée
}
tick();
setInterval(tick, 20000);
