/* Montevia — configuration publique Supabase.
   Cette clé est la clé « publishable » du projet : elle est prévue
   pour le navigateur. Ne jamais mettre ici une clé service_role/secret. */

// Charger la bibliothèque Supabase via CDN
var SUPABASE_JS_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

// Charger les scripts nécessaires
var script1 = document.createElement('script');
script1.src = SUPABASE_JS_URL + '/dist/core.js';
script1.async = true;

var script2 = document.createElement('script');
script2.src = SUPABASE_JS_URL + '/dist/edge-runtime.js';
script2.async = true;

document.head.appendChild(script1);
document.head.appendChild(script2);

// Configuration Supabase après chargement du SDK
window.MONTEVIA_SUPABASE = Object.freeze({
  url: "https://bylwvlxxvgumvqgpwgod.supabase.co",
  anonKey: "sb_publishable_T3XYbDWXV5VaC8WQj3CZOQ_LmB7CTwv",
  teamTable: "montevia_team_members",
  loginFunction: "login-by-identifier"
});

// Charger la configuration après que le SDK soit disponible
function loadSupabaseConfig() {
  if (typeof window.supabase !== 'undefined') {
    // Supabase est chargé, on peut créer le client
    var supabase = window.supabase.createClient(
      window.MONTEVIA_SUPABASE.url,
      window.MONTEVIA_SUPABASE.anonKey
    );
    window.supabaseConfig = supabase;
  }
}

// Charger la configuration une fois le SDK disponible
script1.onload = loadSupabaseConfig;
script2.onload = loadSupabaseConfig;
