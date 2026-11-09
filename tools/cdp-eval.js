/* dev: evaluate JS inside the Android WebView of a debug build.
   adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>; node tools/cdp-eval.js "expr" */
(async () => {
  const list = await (await fetch('http://127.0.0.1:9222/json')).json();
  const page = list.find((p) => p.type === 'page') || list[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: process.argv[2], awaitPromise: true, returnByValue: true } }));
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (d.id === 1) { console.log(JSON.stringify(d.result.result ? d.result.result.value : d.result)); process.exit(0); }
  });
  setTimeout(() => { console.log('timeout'); process.exit(1); }, +(process.argv[3] || 20000));
})();
