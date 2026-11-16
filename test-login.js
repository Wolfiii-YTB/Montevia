(async function () {
  var creds = JSON.parse(decodeURIComponent(window.location.hash.slice(1)) || '{}');
  var email = creds.email;
  var password = creds.password;
  var out = document.createElement('div');
  out.id = '__test_login';
  out.style.display = 'none';
  document.body.appendChild(out);

  if (!window.supabase || !window.MONTEVIA_SUPABASE) {
    out.textContent = JSON.stringify({ ok: false, error: 'supabase missing' });
    return;
  }

  try {
    var client = window.supabase.createClient(window.MONTEVIA_SUPABASE.url, window.MONTEVIA_SUPABASE.anonKey);
    var result = await client.auth.signInWithPassword({ email: email, password: password });
    out.textContent = JSON.stringify({
      ok: !result.error,
      error: result.error ? result.error.message : null,
      id: result.data && result.data.user ? result.data.user.id : null,
      hasSession: !!(result.data && result.data.session)
    });
  } catch (error) {
    out.textContent = JSON.stringify({ ok: false, error: String(error) });
  }
})();
