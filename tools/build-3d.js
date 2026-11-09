/* Bundles three.js + GLTF/VRM loaders into one classic script: `node tools/build-3d.js` */
const path = require('path');
const fs = require('fs');
const out = path.join(__dirname, '..', 'src', 'js', 'vendor', 'three-bundle.js');
fs.mkdirSync(path.dirname(out), { recursive: true });
require('esbuild').buildSync({
  entryPoints: [path.join(__dirname, 'three-entry.js')],
  bundle: true, minify: true, format: 'iife', target: ['chrome110', 'safari16'],
  outfile: out, legalComments: 'eof', logLevel: 'warning',
});
console.log('three-bundle.js', Math.round(fs.statSync(out).size / 1024) + ' KB');
