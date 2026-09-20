import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { models, wilson } from '../data.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(ids.length, new Set(ids).size, 'HTML IDs must be unique');
for (const [, url] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
  if (url.startsWith('#')) assert.ok(ids.includes(url.slice(1)), `Missing anchor ${url}`);
  else if (!/^(https?:|data:)/.test(url)) assert.ok(existsSync(resolve(root, url)), `Missing asset ${url}`);
}
assert.deepEqual(models.map(m => m.counts.reduce((a, b) => a + b, 0)), [30, 41, 10, 9]);
const egg = wilson(5, 10).map(v => (v * 100).toFixed(1));
assert.deepEqual(egg, ['23.7', '76.3']);
assert.equal(wilson(0, 10)[0], 0);
assert.equal(models[2].forces[2][0], null, 'No force samples must not become zero force');
const csv = readFileSync(resolve(root, 'assets/results.csv'), 'utf8').trim().split('\n');
assert.equal(csv.length, 13);
const predictions = JSON.parse(readFileSync(resolve(root, 'assets/predictions.json')));
assert.equal(predictions.length, 2);
for (const record of predictions) {
  assert.ok(record.route.includes('offline teacher'), 'Prediction provenance must identify an offline teacher rerun');
  assert.deepEqual(record.shape, [36, 48]);
  for (const kind of ['pred', 'obs']) {
    assert.equal(record[`${kind}_mask`].length, 3);
    for (const step of record[`${kind}_mask`]) {
      assert.equal(step.length, 2);
      for (const finger of step) {
        assert.equal(finger.length, 36);
        assert.ok(finger.every(row => row.length === 48 && row.every(Number.isFinite)));
      }
    }
  }
  for (let i = 0; i <= 3; i++) assert.ok(existsSync(resolve(root, `assets/${record.task}-contact-${i}.webp`)));
}
const episodes = JSON.parse(readFileSync(resolve(root, 'assets/episodes.json')));
assert.equal(episodes.length, 3);
episodes.forEach(e => { assert.ok(existsSync(resolve(root, e.video))); assert.ok(e.duration > 30); });
console.log('Verified local links, manuscript counts, Wilson interval, missing-value handling, media, and contact-array dimensions.');
