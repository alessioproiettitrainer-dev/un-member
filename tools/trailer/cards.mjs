import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const D = process.argv[2];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
for (const mode of ['', 'bg', 'txt']) {
  await p.goto('file://' + D + '/cards.html' + (mode ? '?mode=' + mode : '')); await p.waitForSelector('body[data-ok]'); await p.waitForTimeout(800);
  const ids = await p.evaluate(() => [...document.querySelectorAll('.f')].map((e) => e.id));
  for (const id of ids) await p.locator('#' + id).screenshot({ path: `${D}/card-${id}${mode ? '-' + mode : ''}.png`, omitBackground: true });
}
const ids = [];
console.log(ids.join(' ')); await b.close();
