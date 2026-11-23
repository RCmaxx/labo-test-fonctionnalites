// Lot 291 : « Voir en tant que » vers un compte de test réel, sans aucun mot de passe côté client.
// L'appelant doit être un administrateur réel (members.role = 'admin', indépendamment de acting_role).
// Seuls les comptes de test de la liste blanche, membres de la même entreprise, sont accessibles.
// Renvoie un hashed_token de lien magique, que le client échange avec auth.verifyOtp.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED = new Set(["tech.bis@test.local", "client@test.local"]);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Non authentifié." }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: u, error: ue } = await admin.auth.getUser(jwt);
    if (ue || !u?.user) return json({ error: "Session invalide." }, 401);

    let email = "";
    try { email = String((await req.json())?.email || "").trim().toLowerCase(); } catch { /* corps vide */ }
    if (!ALLOWED.has(email)) return json({ error: "Compte non autorisé." }, 403);

    const { data: me } = await admin.from("members").select("org_id, role").eq("user_id", u.user.id).maybeSingle();
    if (!me || me.role !== "admin") return json({ error: "Réservé aux administrateurs." }, 403);
    const { data: target } = await admin.from("members").select("user_id").eq("org_id", me.org_id).eq("email", email).maybeSingle();
    if (!target) return json({ error: "Compte de test introuvable dans votre entreprise." }, 404);

    const { data: link, error: le } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (le || !link?.properties?.hashed_token) return json({ error: "Connexion au compte de test impossible." }, 500);
    return json({ token_hash: link.properties.hashed_token });
  } catch (_e) {
    return json({ error: "Erreur interne." }, 500);
  }
});
