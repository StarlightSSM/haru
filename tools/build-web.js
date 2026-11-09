/* Assembles www/ (the Capacitor web bundle for Android / iOS) from src/. `node tools/build-web.js` */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'src');
const www = path.join(root, 'www');

require('./build-3d.js');
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(path.join(www, 'lib'), { recursive: true });

const SKIP = new Set(['mini.html', path.join('js', 'mini.js')]);
(function copyDir(from, rel = '') {
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const r = path.join(rel, e.name);
    if (SKIP.has(r)) continue;
    const s = path.join(from, e.name), d = path.join(www, r);
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyDir(s, r); }
    else fs.copyFileSync(s, d);
  }
})(src);

fs.copyFileSync(path.join(root, 'node_modules/lamejs/lame.min.js'), path.join(www, 'lib/lame.min.js'));
fs.copyFileSync(path.join(root, 'node_modules/mp4-muxer/build/mp4-muxer.js'), path.join(www, 'lib/mp4-muxer.js'));

let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
html = html
  .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/, '') /* Capacitor injects its bridge inline */
  .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">\n  <meta name="theme-color" content="#f6f7f5">')
  .replace('../node_modules/lamejs/lame.min.js', 'lib/lame.min.js')
  .replace('../node_modules/mp4-muxer/build/mp4-muxer.js', 'lib/mp4-muxer.js')
  .replace('<script src="js/util.js"></script>', '<script src="js/platform-mobile.js"></script>\n  <script src="js/util.js"></script>');
if (!html.includes('platform-mobile.js')) throw new Error('script injection failed');
fs.writeFileSync(path.join(www, 'index.html'), html);
console.log('www/ ready');
