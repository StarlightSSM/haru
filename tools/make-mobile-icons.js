/* Renders Android/iOS launcher icons + splash screens from the character renderer.
   `electron tools/make-mobile-icons.js` (run after `npx cap add android|ios`) */
const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  const js = (f) => fs.readFileSync(path.join(root, 'src', 'js', f), 'utf8');
  const html = `<!doctype html><html><body><script>${js('util.js')}</script><script>${js('character.js')}</script><script>
    function char(x, cx, cy, s) { x.save(); x.translate(cx, cy); x.scale(s, s); H.drawCharacter(x, H.DEFAULT_CHARACTER, { t: 0.4, act: 'happy', emo: 'happy', blink: 1, look: {x:0,y:0} }); x.restore(); }
    window.render = (kind, w, h) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
      if (kind === 'legacy' || kind === 'round' || kind === 'ios') {
        x.fillStyle = '#eef0ff';
        if (kind === 'round') { x.beginPath(); x.arc(w/2, h/2, w/2, 0, 7); x.fill(); x.save(); x.beginPath(); x.arc(w/2, h/2, w/2, 0, 7); x.clip(); }
        else if (kind === 'legacy') { H.roundRect(x, 0, 0, w, h, w * 0.2); x.fill(); x.save(); H.roundRect(x, 0, 0, w, h, w * 0.2); x.clip(); }
        else { x.fillRect(0, 0, w, h); x.save(); }
        char(x, w / 2, h * 1.08, w / 150);
        x.restore();
      } else if (kind === 'fg') {
        /* adaptive icon: content must sit in the inner 66/108 */
        char(x, w / 2, h * 0.86, w / 230);
      } else if (kind === 'splash') {
        x.fillStyle = '#eceeec'; x.fillRect(0, 0, w, h);
        const s = Math.min(w, h) / 420;
        char(x, w / 2, h / 2 + 70 * s, s);
        x.fillStyle = '#1b1d22'; x.font = '600 ' + Math.round(16 * s) + 'px Consolas, monospace'; x.textAlign = 'center';
        x.fillText('H A R U', w / 2, h / 2 + 110 * s);
      }
      return c.toDataURL('image/png');
    };
  </script></body></html>`;
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  const render = async (kind, w, h) => Buffer.from((await win.webContents.executeJavaScript(`render(${JSON.stringify(kind)}, ${w}, ${h})`)).split(',')[1], 'base64');

  /* ---- Android ---- */
  const res = path.join(root, 'android/app/src/main/res');
  if (fs.existsSync(res)) {
    const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
    for (const [d, k] of Object.entries(dens)) {
      const dir = path.join(res, 'mipmap-' + d);
      fs.writeFileSync(path.join(dir, 'ic_launcher.png'), await render('legacy', 48 * k, 48 * k));
      fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), await render('round', 48 * k, 48 * k));
      fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), await render('fg', 108 * k, 108 * k));
    }
    fs.writeFileSync(path.join(res, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#EEF0FF</color>\n</resources>\n');
    for (const dir of fs.readdirSync(res).filter((n) => n.startsWith('drawable'))) {
      const f = path.join(res, dir, 'splash.png');
      if (!fs.existsSync(f)) continue;
      const { width, height } = nativeImage.createFromPath(f).getSize();
      fs.writeFileSync(f, await render('splash', width, height));
    }
    console.log('android icons + splash written');
  }

  /* ---- iOS ---- */
  const assets = path.join(root, 'ios/App/App/Assets.xcassets');
  if (fs.existsSync(assets)) {
    const iconDir = path.join(assets, 'AppIcon.appiconset');
    for (const f of fs.readdirSync(iconDir).filter((n) => n.endsWith('.png'))) {
      const { width, height } = nativeImage.createFromPath(path.join(iconDir, f)).getSize();
      fs.writeFileSync(path.join(iconDir, f), await render('ios', width, height));
    }
    const splashDir = path.join(assets, 'Splash.imageset');
    if (fs.existsSync(splashDir)) for (const f of fs.readdirSync(splashDir).filter((n) => n.endsWith('.png'))) {
      const { width, height } = nativeImage.createFromPath(path.join(splashDir, f)).getSize();
      fs.writeFileSync(path.join(splashDir, f), await render('splash', width, height));
    }
    console.log('ios icons + splash written');
  }
  app.quit();
});
