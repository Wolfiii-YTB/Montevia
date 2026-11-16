const fs = require('fs');
const path = require('path');

const version = '10';
const files = fs.readdirSync(process.cwd()).filter(f => f.endsWith('.html'));

for (const file of files) {
  const full = path.join(process.cwd(), file);
  let html = fs.readFileSync(full, 'utf8');

  html = html.replace(/css\/style\.css(?:\?v=\d+)?/g, 'css/style.css?v=' + version);
  html = html.replace(/js\/([A-Za-z0-9_-]+)\.js(?:\?v=\d+)?/g, (match, name) => 'js/' + name + '.js?v=' + version);
  html = html.replace(/js\/vendor\/supabase\.js(?:\?v=\d+)?/g, 'js/vendor/supabase.js?v=' + version);

  fs.writeFileSync(full, html, 'utf8');
  console.log(file);
}

