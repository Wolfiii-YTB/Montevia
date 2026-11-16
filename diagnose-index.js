const fs = require('fs');
const file = 'index.html';
const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
const decoder = new TextDecoder('windows-1252');
const map = new Map();
for (let b = 0x80; b <= 0xff; b++) {
  const ch = decoder.decode(Uint8Array.from([b]));
  if (ch && ch !== '\uFFFD') map.set(ch, b);
}
const counts = new Map();
for (const ch of text) {
  if (ch.codePointAt(0) > 127) counts.set(ch, (counts.get(ch) || 0) + 1);
}
for (const [ch, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(JSON.stringify(ch), 'U+' + ch.codePointAt(0).toString(16).toUpperCase(), count);
}

const bytes = [];
const owner = [];
let index = 0;
for (const ch of text) {
  const cp = ch.codePointAt(0);
  let bs;
  if (cp <= 0xff) bs = [cp];
  else if (map.has(ch)) bs = [map.get(ch)];
  else bs = [...Buffer.from(ch, 'utf8')];
  for (const b of bs) { bytes.push(b); owner.push(index); }
  index += ch.length;
}
const buf = Buffer.from(bytes);
try {
  new TextDecoder('utf-8', { fatal: true }).decode(buf);
  console.log('valid');
} catch (e) {
  console.log('invalid:', e.message);
  let start = 0;
  for (let i = 0; i < buf.length; i++) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buf.subarray(start, i + 1));
    } catch (err) {
      console.log('first invalid byte index', i, 'byte', buf[i].toString(16), 'sourceIndex', owner[i], 'context', JSON.stringify(text.slice(Math.max(0, owner[i] - 40), owner[i] + 40)));
      break;
    }
  }
}
