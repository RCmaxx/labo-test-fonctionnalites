"""Compare une page de labo avec la même page de l'appli tech (mesures Chrome, vue iPad 1361 px).

Usage : python3 tools/diff.py [route] [--role admin|technicien] [--tech CHEMIN] [--width 1361]
Exemple : python3 tools/diff.py '#terminees'
Affiche seulement les écarts des éléments présents des deux côtés (--all : aussi ceux d'un seul côté) : position, taille, police, couleurs, coins. Captures dans /tmp/diff_labo.png et /tmp/diff_tech.png.
"""
import argparse, shutil, subprocess, sys, tempfile, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
JS = """() => {
  const out = [], seen = {};
  for (const e of document.querySelectorAll('#app *')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || e.closest('[hidden]') || !e.offsetParent && getComputedStyle(e).position !== 'fixed') continue;
    const own = [...e.childNodes].filter(c => c.nodeType === 3).map(c => c.textContent.replace(/\\s+/g, ' ').trim()).join(' ').trim();
    if (!own) continue;
    const c = getComputedStyle(e), k = own.slice(0, 40);
    seen[k] = (seen[k] || 0) + 1;
    out.push({ k: k + ' #' + seen[k], x: r.left, y: r.top, w: r.width, h: r.height, fs: c.fontSize, fw: c.fontWeight,
      color: c.color, bg: c.backgroundColor, rad: c.borderRadius });
  }
  return out;
}"""

def serve(src, mock, role, port):
    d = Path(tempfile.mkdtemp(prefix='diff_'))
    for n in ('index.html', 'js', 'css'):
        (shutil.copytree if (src / n).is_dir() else shutil.copy)(src / n, d / n)
    text = mock.read_text()
    (d / 'js' / 'sb.js').write_text(text.replace("role: 'technicien'", f"role: '{role}'", 1))
    p = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '-d', str(d)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return p, d

def measure(pw, port, route, width, shot):
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': width, 'height': 1020})
    pg.goto(f'http://localhost:{port}/index.html'); pg.wait_for_timeout(3000)
    if route != '#':
        pg.evaluate(f"location.hash='{route}'")
    pg.wait_for_timeout(4000)
    pg.screenshot(path=shot)
    r = pg.evaluate(JS); b.close(); return {e['k']: e for e in r}

def main():
    a = argparse.ArgumentParser()
    a.add_argument('route', nargs='?', default='#')
    a.add_argument('--role', default='admin')
    a.add_argument('--tech', default=str(ROOT.parent / 'gestion-interventions'))
    a.add_argument('--all', action='store_true', help='affiche aussi les éléments présents d\'un seul côté')
    a.add_argument('--width', type=int, default=1361)
    o = a.parse_args()
    pl, dl = serve(ROOT, ROOT / 'tools/mocks/sb-labo.js', o.role, 8201)
    pt, dt = serve(Path(o.tech), ROOT / 'tools/mocks/sb-tech.js', o.role, 8202)
    time.sleep(1)
    try:
        with sync_playwright() as pw:
            L = measure(pw, 8201, o.route, o.width, '/tmp/diff_labo.png')
            T = measure(pw, 8202, o.route, o.width, '/tmp/diff_tech.png')
    finally:
        for p, d in ((pl, dl), (pt, dt)): p.kill(); shutil.rmtree(d, ignore_errors=True)
    n = 0
    for k, t in T.items():
        l = L.get(k)
        if not l:
            if o.all: print(f'MANQUE dans labo : {k}'); n += 1
            continue
        d = [f'{f} tech={t[f]:.0f} labo={l[f]:.0f}' for f in 'xywh' if abs(t[f] - l[f]) > 1]
        d += [f'{f} tech={t[f]} labo={l[f]}' for f in ('fs', 'fw', 'color', 'bg', 'rad') if t[f] != l[f]]
        if d: print(f'{k} : ' + ' | '.join(d)); n += 1
    if o.all:
        for k in L.keys() - T.keys(): print(f'EN PLUS dans labo : {k}'); n += 1
    print(f'{n} écart(s) sur {len(T)} éléments comparés')

main()
