import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
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
const provenance = JSON.parse(readFileSync(resolve(root, 'assets/provenance.json')));
for (const file of ['framework-overview.png', 'framework-internals.png']) {
  const hash = createHash('sha256').update(readFileSync(resolve(root, 'assets', file))).digest('hex');
  assert.equal(hash, provenance.paperFigures[file].sha256, `${file} must preserve the manuscript figure`);
}
const rollouts = JSON.parse(readFileSync(resolve(root, 'assets/rollouts.json')));
assert.equal(rollouts.episodes.length, 6);
assert.equal(new Set(rollouts.episodes.map(e => `${e.task}/${e.model}`)).size, 6);
for (const e of rollouts.episodes) {
  assert.equal(e.seed, 101);
  assert.equal(e.forceUnit, 'N');
  assert.equal(e.label, e.model === 'student' ? 'label:stu_simft_001000' : 'label:v6_simft2k');
  assert.ok(e.duration > 5);
  assert.ok(existsSync(resolve(root, e.video)) && existsSync(resolve(root, e.poster)));
  assert.ok(Object.values(e.maxImageOffsetMs).every(v => v < 150));
  for (const samples of Object.values(e.force)) {
    assert.ok(samples.length > 20);
    samples.forEach(([t, value], i) => {
      assert.ok(Number.isFinite(t) && Number.isFinite(value));
      assert.ok(t >= 0 && t <= e.duration + 1 / e.fps);
      if (i) assert.ok(t > samples[i - 1][0]);
    });
  }
}
console.log('Verified links, manuscript data, original figures, six seed-matched rollouts, timestamps, force traces, synchronization bounds, and archived contact arrays.');
