const fs = require('fs');
const path = require('path');

const files = ['admin.html', 'compte.html', 'equipe.html', 'index.html', 'support.html', 'ticket.html', 'supabase/montevia_admin.sql'];
const decoder = new TextDecoder('windows-1252');
const map = new Map();
for (let b = 0x80; b <= 0xff; b++) {
  const ch = decoder.decode(Uint8Array.from([b]));
  if (ch && ch !== '\uFFFD') map.set(ch, b);
}

for (const file of files) {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, 'utf8');
  const unique = [...new Set(text.split('').filter(ch => ch.codePointAt(0) > 127))];
  const missing = unique.filter(ch => ch.codePointAt(0) > 255 && !map.has(ch));
  console.log(file, 'chars=' + unique.length, 'missing=' + missing.length, missing.slice(0, 20).join(' '));
}
