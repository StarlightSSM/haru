/* Renders docs/brochure/brochure.html → docs/HARU-service-overview.pdf (A4).  `electron tools/make-brochure.js` */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 794, height: 1123 });
  await win.loadFile(path.join(__dirname, '..', 'docs', 'brochure', 'brochure.html'));
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => Promise.all([...document.images].map((i) => i.complete ? 1 : new Promise((r) => { i.onload = i.onerror = r; }))))');
  const pdf = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { marginType: 'none' }, preferCSSPageSize: true });
  const out = path.join(__dirname, '..', 'docs', 'HARU-service-overview.pdf');
  fs.writeFileSync(out, pdf);
  console.log('wrote', out, Math.round(pdf.length / 1024) + ' KB');
  app.quit();
});
