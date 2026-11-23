import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const debugPort = process.env.CHROME_DEBUG_PORT || '9222';
const siteUrl = process.env.SITE_URL || 'http://127.0.0.1:4174/';
const outputDirectory = path.resolve('screenshots');
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function findPage() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(response => response.json());
      const page = pages.find(item => item.type === 'page');
      if (page) return page;
    } catch {}
    await pause(250);
  }
  throw new Error('Chrome debugging page did not become available.');
}

const page = await findPage();
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let commandId = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

function command(method, params = {}) {
  commandId += 1;
  return new Promise((resolve, reject) => {
    pending.set(commandId, { resolve, reject });
    socket.send(JSON.stringify({ id: commandId, method, params }));
  });
}

async function evaluate(expression) {
  return command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
}

async function waitForSelector(selector) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const result = await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
    if (result.result.value) return;
    await pause(100);
  }
  throw new Error(`Timed out waiting for ${selector}`);
}

async function capture(filename) {
  const { data } = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(path.join(outputDirectory, filename), Buffer.from(data, 'base64'));
}

await mkdir(outputDirectory, { recursive: true });
await command('Page.enable');
await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
await command('Page.navigate', { url: siteUrl });
await waitForSelector('[data-start]');
await evaluate('document.fonts.ready');
await capture('01-start.png');

await evaluate("document.querySelector('[data-start]')?.click()");
await pause(400);
await capture('02-object-and-choices.png');

for (let stop = 1; stop < 5; stop += 1) {
  await evaluate("document.querySelector('[data-choice]')?.click()");
  await pause(250);
}
await evaluate("document.querySelector('#see-journey')?.click()");
await pause(500);
await capture('03-treasure-map.png');

socket.close();
console.log('Captured three README screenshots.');
