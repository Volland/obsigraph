// Records the Zettelkasten clip: the site's live demo page over ontologies/zettelkasten.
// Usage (from the repo root, with `npm run site:build` done and site/ served on :8765): node scripts/record-demos/zettelkasten.mjs <outDir>
import { chromium } from 'playwright-core';
import { readFileSync, readdirSync } from 'node:fs';
const ROOT = 'ontologies/zettelkasten';
const out = process.argv[2] ?? 'demo-out';
let vault = `=== Types/Zettelkasten.md ===\n${readFileSync(`${ROOT}/Types/Zettelkasten.md`, 'utf8')}\n`;
for (const f of readdirSync(`${ROOT}/Examples`)) vault += `\n=== Examples/${f} ===\n${readFileSync(`${ROOT}/Examples/${f}`, 'utf8')}\n`;
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 960 }, colorScheme: 'dark', recordVideo: { dir: out, size: { width: 1280, height: 960 } } });
const page = await ctx.newPage();
await page.goto('http://localhost:8765/demo.html?example=0');
await page.waitForTimeout(800);
await page.addStyleTag({ content: '#examples{visibility:hidden}' });
await page.evaluate((v) => { const t = document.getElementById('vault'); t.value = v; t.scrollTop = t.scrollHeight * (v.indexOf('=== Examples/Notes are') / v.length); }, vault);
const q = async (text, wait) => {
  await page.fill('#query', '');
  await page.click('#query');
  await page.keyboard.type(text, { delay: 35 });
  await page.waitForTimeout(500);
  await page.keyboard.press('Meta+Enter');
  await page.waitForTimeout(wait);
};
await page.evaluate(() => document.getElementById('run').click());
await page.waitForTimeout(1200);
await q('MATCH (z:Zettel)-[r]->(n)\nRETURN z, r, n', 2600);
await q('MATCH (z:Zettel)-[c:cites]->(s:Source)\nRETURN z.title AS note, s.title AS source, c.page AS page\nORDER BY page', 2200);
await ctx.close();
await browser.close();
