(function () {
  var out = document.createElement('div');
  out.id = '__probe_main';
  out.style.display = 'none';
  out.textContent = JSON.stringify({
    supabase: typeof window.supabase,
    createClient: window.supabase && typeof window.supabase.createClient,
    config: !!window.MONTEVIA_SUPABASE,
    configUrl: window.MONTEVIA_SUPABASE && window.MONTEVIA_SUPABASE.url,
    year: document.getElementById('year') && document.getElementById('year').textContent
  });
  document.body.appendChild(out);
})();
