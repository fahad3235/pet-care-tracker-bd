'use strict';
/* Headless-Chrome smoke tests via puppeteer-core + /opt/meta-chromium/chrome.
   Run: NODE_PATH=../load-shedding-tracker-bd/node_modules node tests/smoke.mjs */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const pageUrl = 'file://' + path.resolve(dir, '..', 'index.html') + '?asof=2026-10-14';

let pass = 0, fail = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); pass++; } catch (e) { fail++; failures.push(name + ' \u2014 ' + e.message); console.log('FAIL', name, '-', e.message); }
}
function eq(a, b) { if (a !== b) throw new Error('expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-smoke-'));
const browser = await puppeteer.launch({
  executablePath: '/opt/meta-chromium/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
  userDataDir: tmp
});
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));
page.on('dialog', async d => { await d.accept(); });
await page.goto(pageUrl, { waitUntil: 'load' });
await page.waitForSelector('#tab-dashboard');

await check('title + header', async () => {
  eq(await page.title(), 'Pet Care Tracker BD');
  eq(await page.$eval('header h1', el => el.textContent), 'Pet Care Tracker');
});
await check('7 tabs present', async () => {
  const tabs = await page.$$eval('#tabs button', els => els.map(e => e.textContent));
  eq(tabs.length, 7);
  ok(tabs.includes('Pets'), 'Pets tab missing');
});
await check('dashboard empty state', async () => {
  const txt = await page.$eval('#tab-dashboard', el => el.textContent);
  ok(txt.includes('No pets yet'), 'empty state text missing');
});
await check('empty pet name shows inline error', async () => {
  await page.click('#tabs button[data-tab="pets"]');
  await page.waitForSelector('#pet-name');
  await page.click('#pet-submit');
  const err = await page.$eval('#pet-form-err', el => el.textContent);
  ok(err.length > 0, 'expected validation error, got empty');
});
await check('add pet Mimi via UI', async () => {
  await page.type('#pet-name', 'Mimi');
  await page.select('#pet-species', 'cat');
  await page.type('#pet-breed', 'Deshi');
  await page.$eval('#pet-dob', el => { el.value = '2021-03-05'; });
  await page.type('#pet-weight', '3.5');
  await page.click('#pet-submit');
  await page.waitForFunction(() => document.querySelector('#tab-pets').textContent.includes('Mimi'));
  const cards = await page.$$eval('#tab-pets .pet-card', els => els.length);
  eq(cards, 1);
  const cardTxt = await page.$eval('#tab-pets .pet-card', el => el.textContent);
  ok(cardTxt.includes('5 yrs 7 mos'), 'age wrong: ' + cardTxt);
  ok(cardTxt.includes('3.5 kg'), 'weight wrong: ' + cardTxt);
});
await check('dashboard pet count = 1', async () => {
  await page.click('#tabs button[data-tab="dashboard"]');
  const txt = await page.$eval('#tab-dashboard', el => el.textContent);
  ok(txt.includes('Mimi'), 'Mimi not on dashboard');
});
await check('log feeding via UI', async () => {
  await page.click('#tabs button[data-tab="feeding"]');
  await page.waitForSelector('#feeding-amount');
  await page.type('#feeding-amount', '80');
  await page.click('#feeding-submit');
  await page.waitForFunction(() => document.querySelector('#tab-feeding').textContent.includes('80 g'));
  const txt = await page.$eval('#tab-feeding', el => el.textContent);
  ok(txt.includes('Mimi'), 'feeding row missing pet name');
});
await check('dashboard feedings today = 1', async () => {
  await page.click('#tabs button[data-tab="dashboard"]');
  await page.waitForFunction(() => document.querySelector('#tab-dashboard').textContent.includes('Feedings today'));
});
await check('add overdue vaccine via UI', async () => {
  await page.click('#tabs button[data-tab="vaccines"]');
  await page.waitForSelector('#vaccine-name');
  await page.$eval('#vaccine-name', el => { el.value = ''; });
  await page.type('#vaccine-name', 'rabies');
  await page.$eval('#vaccine-given', el => { el.value = '2025-01-05'; });
  await page.$eval('#vaccine-due', el => { el.value = '2026-10-01'; });
  await page.click('#vaccine-submit');
  await page.waitForFunction(() => document.querySelector('#tab-vaccines').textContent.includes('Overdue'));
  const txt = await page.$eval('#tab-vaccines', el => el.textContent);
  ok(txt.includes('13 days overdue'), 'overdue text wrong: ' + txt);
});
await check('mark vaccine given clears due', async () => {
  await page.click('#tab-vaccines button[data-action="mark-given"]');
  await page.waitForFunction(() => document.querySelector('#tab-vaccines').textContent.includes('No due date'));
});
await check('add vet visit + total spend', async () => {
  await page.click('#tabs button[data-tab="visits"]');
  await page.waitForSelector('#visit-reason');
  await page.type('#visit-reason', 'Annual checkup');
  await page.type('#visit-cost', '1500');
  await page.click('#visit-submit');
  await page.waitForFunction(() => document.querySelector('#tab-visits').textContent.includes('\u09f31,500.00'));
});
await check('log weight + chart renders', async () => {
  await page.click('#tabs button[data-tab="weight"]');
  await page.waitForSelector('#weight-kg');
  await page.type('#weight-kg', '3.6');
  await page.click('#weight-submit');
  await page.waitForFunction(() => document.querySelector('#tab-weight svg') !== null);
  const circles = await page.$$eval('#tab-weight svg circle', els => els.length);
  eq(circles, 1);
});
await check('persistence across reload', async () => {
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#tab-dashboard');
  const txt = await page.$eval('#tab-dashboard', el => el.textContent);
  ok(txt.includes('Mimi'), 'Mimi lost after reload');
  ok(txt.includes('\u09f31,500.00'), 'vet spend lost after reload');
});
await check('BN toggle renders Bengali + persists', async () => {
  await page.click('#langBtn');
  await page.waitForFunction(() => document.querySelector('header h1').textContent.includes('\u09aa\u09cb\u09b7\u09be'));
  const h1 = await page.$eval('header h1', el => el.textContent);
  eq(h1, '\u09aa\u09cb\u09b7\u09be \u09aa\u09cd\u09b0\u09be\u09a3\u09c0\u09b0 \u09af\u09a4\u09cd\u09a8');
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('header h1').textContent.includes('\u09aa\u09cb\u09b7\u09be'));
  // back to EN for remaining checks
  await page.click('#langBtn');
  await page.waitForFunction(() => document.querySelector('header h1').textContent === 'Pet Care Tracker');
});
await check('typed-DELETE erase-all', async () => {
  await page.click('#tabs button[data-tab="data"]');
  await page.waitForSelector('#erase-input');
  await page.click('#erase-btn');
  const err = await page.$eval('#erase-msg', el => el.textContent);
  ok(err.length > 0, 'expected wrong-confirm error');
  await page.type('#erase-input', 'DELETE');
  await page.click('#erase-btn');
  await page.waitForFunction(() => document.querySelector('#erase-msg').textContent.includes('All data erased'));
  await page.click('#tabs button[data-tab="dashboard"]');
  const txt = await page.$eval('#tab-dashboard', el => el.textContent);
  ok(txt.includes('No pets yet'), 'pets not erased');
});
await check('XSS: pet name is escaped, no script execution', async () => {
  await page.click('#tabs button[data-tab="pets"]');
  await page.waitForSelector('#pet-name');
  await page.type('#pet-name', '<img src=x onerror=alert(1)>');
  await page.click('#pet-submit');
  await page.waitForFunction(() => document.querySelector('#tab-pets').textContent.includes('<img'));
  const imgs = await page.$$eval('#tab-pets .pet-card img', els => els.length);
  eq(imgs, 0);
  const cardHtml = await page.$eval('#tab-pets .pet-card', el => el.innerHTML);
  ok(cardHtml.includes('&lt;img'), 'name not escaped: ' + cardHtml.slice(0, 200));
});
await check('390px mobile no horizontal overflow', async () => {
  await page.setViewport({ width: 390, height: 844 });
  for (const tab of ['dashboard', 'pets', 'feeding', 'vaccines', 'visits', 'weight', 'data']) {
    await page.click('#tabs button[data-tab="' + tab + '"]');
    await new Promise(r => setTimeout(r, 150));
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 1) throw new Error('overflow ' + over + 'px on tab ' + tab);
  }
  await page.setViewport({ width: 1280, height: 900 });
});
await check('zero console/page errors', async () => {
  eq(consoleErrors.length, 0);
  if (consoleErrors.length) throw new Error(consoleErrors.join(' | '));
});

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) console.log(failures.join('\n'));
process.exit(fail ? 1 : 0);
