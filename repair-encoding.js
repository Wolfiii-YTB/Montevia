const fs = require('fs');
const path = require('path');

const files = ['admin.html', 'compte.html', 'equipe.html', 'index.html', 'support.html', 'ticket.html', 'supabase/montevia_admin.sql'];
const decoder = new TextDecoder('windows-1252');
const map = new Map();
for (let b = 0x80; b <= 0xff; b++) {
  const ch = decoder.decode(Uint8Array.from([b]));
  if (ch && ch !== '\uFFFD') map.set(ch, b);
}

const utf8Strict = new TextDecoder('utf-8', { fatal: true });

for (const file of files) {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) continue;

  const originalBytes = fs.readFileSync(full);
  const text = originalBytes.toString('utf8').replace(/^\uFEFF/, '');

  const bytes = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp <= 0xff) {
      bytes.push(cp);
    } else if (map.has(ch)) {
      bytes.push(map.get(ch));
    } else {
      for (const b of Buffer.from(ch, 'utf8')) bytes.push(b);
    }
  }

  let repaired;
  try {
    repaired = utf8Strict.decode(Buffer.from(bytes));
  } catch (error) {
    console.log('SKIP (not reversible):', file, error.message);
    continue;
  }

  const mojibake = /Ã|â€|Â/.test(repaired);
  console.log(file, 'mojibakeAfter=' + mojibake, 'len=' + repaired.length);
  fs.writeFileSync(full, repaired, 'utf8');
}
