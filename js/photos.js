import { sb } from './sb.js?v=20261123201223';
import { toast, zoomImg, confirmBox } from './ui.js?v=20261123201223';
import { state } from './state.js?v=20261123201223';

// Envoie des photos dans le bucket privé "photos" : <org_id>/<intervention_id>/<uuid>.<ext>
// Réduit la photo (2000 px max, JPEG) pour un envoi rapide ; garde l'original si la conversion échoue.
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
    return b && b.size < file.size ? b : file;
  } catch { return file; }
}

export async function uploadPhotos(interventionId, files) {
  await Promise.all(files.map(async file => {
    const f = await shrink(file);
    const ext = f === file ? ((file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')) : 'jpg';
    const path = `${state.member.org_id}/${interventionId}/${crypto.randomUUID()}.${ext}`;
    const up = await sb.storage.from('photos').upload(path, f, { contentType: f.type || 'image/jpeg' });
    if (up.error) throw up.error;
    const ins = await sb.from('intervention_photos').insert({ intervention_id: interventionId, path });
    if (ins.error) throw ins.error;
  }));
  return files.length;
}

// Sélection de photos : vignettes avec suppression avant envoi. Renvoie la liste vivante des fichiers.
export function photoTray(input, tray, onChange, max = 10, nav = false) {
  const files = [];
  const draw = () => {
    tray.querySelectorAll('img').forEach(i => URL.revokeObjectURL(i.src));
    tray.innerHTML = files.map((f, i) => `<span class="pt"><img src="${URL.createObjectURL(f)}" alt=""><button type="button" class="pt-x" data-i="${i}" aria-label="Retirer la photo">×</button></span>`).join('');
    tray.hidden = !files.length;
    // Lot 297 : clic posé sur chaque photo (et non délégué au bandeau) : sans cible cliquable, Chrome tactile reportait l'appui sur la croix voisine (« Supprimer ? » au lieu de l'agrandissement).
    tray.querySelectorAll('.pt img').forEach(im => { im.onclick = () => zoomImg(im.src, nav ? [...tray.querySelectorAll('.pt img')].map(x => x.src) : null); });
    onChange && onChange(files);
  };
  [].concat(input).forEach(inp => inp.addEventListener('change', () => { const room = Math.max(0, max - files.length), add = [...inp.files]; if (add.length > room) toast(`${max <= 0 ? 'Limite atteinte : ' : ''}10 photos maximum par intervention.`, true); files.push(...add.slice(0, room)); inp.value = ''; draw(); }));
  tray.addEventListener('click', async e => { const b = e.target.closest('.pt-x'); if (b) { if (await confirmBox('Supprimer ?', 'Oui', { cancel: 'Non' })) { files.splice(+b.dataset.i, 1); draw(); } return; } });
  return files;
}

export async function signedUrls(paths) {
  if (!paths.length) return {};
  const { data } = await sb.storage.from('photos').createSignedUrls(paths, 3600);
  return Object.fromEntries((data || []).map(d => [d.path, d.signedUrl]));
}
