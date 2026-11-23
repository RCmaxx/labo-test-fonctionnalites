import { sb } from './sb.js?v=20261123215119';
import { S, esc, options, PRIORITY, REMIND, MGR, TECH } from './state.js?v=20261123215119';
import { takeLock } from './lock.js?v=20261123215119';

// Réduit la photo (1600 px max, JPEG ~0,8) pour un envoi plus léger ; garde l'original si la conversion échoue ou n'apporte rien.
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
    bmp.close?.();
    return b && b.size < file.size ? b : file;
  } catch { return file; }
}

// Envoie les photos dans le stockage puis les rattache à l'intervention (un message photo s'ajoute au tchat). Renvoie la première erreur.
export async function uploadPhotos(iid, files) {
  for (const file of files) {
    const f = await shrink(file);
    const ext = f === file ? ((file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg') : 'jpg';
    const path = `${S.me.org_id}/${iid}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from('photos').upload(path, f, { contentType: f.type || 'image/jpeg' })
      .then(r => r.error ? r : sb.from('intervention_photos').insert({ intervention_id: iid, path }));
    if (error) return error;
  }
}

export async function renderForm(el, id) {
  // Verrou d'édition : une seule personne modifie à la fois.
  const by = id && await takeLock(id);
  if (by) return el.innerHTML = `<p>${esc(by)}</p>`;
  const [cur, places, techs] = await Promise.all([
    id ? sb.from('interventions').select('*').eq('id', id).maybeSingle() : { data: { priority: 'normale' } },
    sb.from('places').select('label').order('num', { nullsFirst: false }).order('label').limit(2000),
    sb.from('members').select('user_id, full_name, role').in('role', S.me.role === 'directeur' ? TECH : ['technicien']),
  ]);
  const i = cur.data;
  if (!i) return el.innerHTML = `<p>${esc(cur.error?.message || 'Intervention introuvable.')}</p>`;
  const mgr = MGR.includes(S.me.role);
  const from = i.available_from ? new Date(i.available_from) : null, until = i.available_until ? new Date(i.available_until) : null;
  const day = d => d ? d.toLocaleDateString('sv') : '', hm = d => d ? d.toTimeString().slice(0, 5) : '';
  el.innerHTML = `
    <h1>${id ? "Modifier l'intervention" : 'Nouvelle intervention'}</h1>
    <form class="panel iform">
      <p><label>Titre <input name="title" required maxlength="70" value="${esc(i.title)}"></label></p>
      <p><label>Lieu <input name="location" list="places" value="${esc(i.location)}"></label>
        <datalist id="places">${(places.data || []).map(p => `<option value="${esc(p.label)}">`).join('')}</datalist></p>
      <p><label>Description <textarea name="description">${esc(i.description)}</textarea></label></p>
      <fieldset class="choices"><legend>Priorité</legend>${Object.entries(PRIORITY).map(([k, v]) =>
        `<label class="choice choice--${k}"><input type="radio" name="priority" value="${k}" ${k === i.priority ? 'checked' : ''}> ${v}</label>`).join('')}</fieldset>
      ${mgr ? `<p><label>Assigner à <select name="assign"><option value="">Personne</option>${(techs.data || []).map(t =>
        `<option value="${t.user_id}" ${t.user_id === i.proposed_to ? 'selected' : ''}>${esc(t.full_name)}</option>`).join('')}</select></label></p>` : ''}
      <fieldset class="slot"><legend>Passage</legend>
        <label class="check"><input type="checkbox" name="presence" ${i.client_presence || from ? 'checked' : ''}> Présence client requise</label>
        <label>Jour <input type="date" name="d" value="${day(from)}"></label>
        <label>De <input type="time" name="a" step="900" value="${hm(from)}"></label>
        <label>À <input type="time" name="b" step="900" value="${hm(until)}"></label>
        <label>Rappel <select name="remind"><option value="">Aucun</option>${options(REMIND, i.remind_minutes)}</select></label>
      </fieldset>
      <p><label>Photos (10 max) <input type="file" name="photos" accept="image/*" multiple></label></p>
      <p class="actions">${id ? '<button class="primary" value="save">Enregistrer</button>' : '<button value="draft">Brouillon</button><button class="primary" value="publier">Créer et publier</button>'}</p>
      <p class="error" id="ferr"></p>
    </form>`;
  el.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target)), err = el.querySelector('#ferr');
    const row = { title: f.title.trim(), location: f.location.trim(), description: f.description.trim(), priority: f.priority,
      client_presence: !!f.presence, available_from: null, available_until: null, remind_minutes: null };
    if (f.presence && f.d && f.a) {
      if (f.b && f.b <= f.a) return err.textContent = "L'heure de fin doit suivre l'heure de début.";
      row.available_from = new Date(`${f.d}T${f.a}`).toISOString();
      if (!id && new Date(row.available_from) < Date.now() - 6e4) return err.textContent = 'Ce créneau est déjà passé.';
      row.available_until = new Date(f.b ? `${f.d}T${f.b}` : new Date(row.available_from).getTime() + 9e5).toISOString(); // fin par défaut : début + 15 min
      row.remind_minutes = +f.remind || null; // rappel seulement pour une intervention programmée
    }
    const files = [...e.target.photos.files];
    if (files.length > 10) return err.textContent = '10 photos maximum par intervention.';
    const mode = e.submitter?.value, who = f.assign || null;
    const run = async () => {
      if (id) {
        let r = await sb.from('interventions').update(row).eq('id', id);
        if (!r.error && mgr && who !== (i.proposed_to || null)) r = await sb.rpc('assign_tech', { p_id: id, p_tech: who });
        return [r.error, id];
      }
      const { data, error } = await sb.from('interventions').insert({ ...row, org_id: S.me.org_id }).select('id').single();
      if (error || mode !== 'publier') return [error, data?.id];
      let r = await sb.rpc('transition', { p_id: data.id, p_action: 'publier', p_comment: '' });
      if (!r.error && who) r = await sb.rpc('assign_tech', { p_id: data.id, p_tech: who });
      return [r.error, data.id];
    };
    let [error, iid] = await run();
    if (!error && files.length) error = await uploadPhotos(iid, files);
    error ? err.textContent = error.message : location.hash = `i/${iid}`;
  };
}
