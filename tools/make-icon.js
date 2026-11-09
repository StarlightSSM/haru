/* renders build/icon.png from the character renderer: `npx electron tools/make-icon.js` */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 600, height: 600, webPreferences: { offscreen: true } });
  const root = path.join(__dirname, '..', 'src', 'js');
  const html = `<!doctype html><html><body style="margin:0"><canvas id="c" width="512" height="512"></canvas>
  <script>${fs.readFileSync(path.join(root, 'util.js'), 'utf8')}</script>
  <script>${fs.readFileSync(path.join(root, 'character.js'), 'utf8')}</script>
  <script>
    const c = document.getElementById('c'), x = c.getContext('2d');
    x.fillStyle = '#eef0ff'; H.roundRect(x, 16, 16, 480, 480, 110); x.fill();
    x.strokeStyle = '#2f45ff'; x.lineWidth = 10; H.roundRect(x, 16, 16, 480, 480, 110); x.stroke();
    x.save(); x.beginPath(); H.roundRect(x, 21, 21, 470, 470, 106); x.clip();
    x.translate(256, 560); x.scale(3.4, 3.4);
    H.drawCharacter(x, H.DEFAULT_CHARACTER, { t: 0.4, act: 'happy', emo: 'happy', blink: 1, look: {x:0,y:0} });
    x.restore();
    window.done = c.toDataURL('image/png');
  </script></body></html>`;
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  const data = await win.webContents.executeJavaScript('window.done');
  fs.mkdirSync(path.join(__dirname, '..', 'build'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'build', 'icon.png'), Buffer.from(data.split(',')[1], 'base64'));
  console.log('icon written');
  app.quit();
});
