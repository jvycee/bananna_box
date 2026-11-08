'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createCachedProbe } = require('../health-cache');

test('concurrent reads share one in-flight probe', async () => {
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const probe = createCachedProbe({
    ttlMs: 30000,
    now: () => 1000,
    run: () => {
      calls += 1;
      return gate.then(() => 'sample');
    }
  });

  const first = probe.read();
  const second = probe.read();
  assert.equal(calls, 1);
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.value, 'sample');
  assert.equal(b.value, 'sample');
  assert.equal(a.checkedAt, b.checkedAt);
});

test('a resolved false result stays cached for the ttl', async () => {
  let clock = 5000;
  let calls = 0;
  const probe = createCachedProbe({
    ttlMs: 30000,
    now: () => clock,
    run: async () => {
      calls += 1;
      return false;
    }
  });

  const first = await probe.read();
  clock = 10000;
  const second = await probe.read();
  assert.equal(first.ok, true);
  assert.equal(first.value, false);
  assert.equal(second.value, false);
  assert.equal(second.checkedAt, first.checkedAt);
  assert.equal(calls, 1);
});

test('a failed probe does not publish a fresh timestamp for the previous sample', async () => {
  let clock = 10000;
  let calls = 0;
  let mode = 'ok';
  const probe = createCachedProbe({
    ttlMs: 1000,
    now: () => clock,
    run: async () => {
      calls += 1;
      if (mode === 'fail') throw new Error('probe failed');
      return { temp: 42 };
    }
  });

  const ok = await probe.read();
  assert.equal(ok.ok, true);
  assert.equal(ok.checkedAt, 10000);
  assert.equal(ok.value.temp, 42);

  clock = 10900;
  const cached = await probe.read();
  assert.equal(cached.checkedAt, 10000);
  assert.equal(calls, 1);

  clock = 12000;
  mode = 'fail';
  const failed = await probe.read();
  assert.equal(failed.ok, false);
  assert.equal(failed.checkedAt, 10000);
  assert.equal(failed.value.temp, 42);
  assert.equal(calls, 2);

  clock = 12500;
  const blocked = await probe.read();
  assert.equal(blocked.ok, false);
  assert.equal(blocked.checkedAt, 10000);
  assert.equal(calls, 2);
});

test('the first failed probe leaves checkedAt at 0', async () => {
  let calls = 0;
  const probe = createCachedProbe({
    ttlMs: 30000,
    now: () => 50,
    run: async () => {
      calls += 1;
      throw new Error('missing');
    }
  });
  const failed = await probe.read();
  assert.equal(failed.ok, false);
  assert.equal(failed.checkedAt, 0);
  assert.equal(failed.value, null);
  const again = await probe.read();
  assert.equal(again.checkedAt, 0);
  assert.equal(calls, 1);
});

test('Pi check publishes lastPiCheck only after a successful sample', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'ultra-minimal.js'), 'utf8');
  const start = src.indexOf('async function checkPi');
  const end = src.indexOf('const log', start);
  assert.ok(start !== -1 && end !== -1);
  const fn = src.slice(start, end);
  assert.match(fn, /if \(result\.ok && result\.value\)/);
  assert.match(fn, /piHealth\.lastPiCheck = result\.checkedAt/);
  assert.equal(fn.includes('piHealth.lastPiCheck = Date.now()'), false);
  const successArm = fn.slice(fn.indexOf('if (result.ok && result.value)'), fn.indexOf('} else'));
  assert.match(successArm, /piHealth\.lastPiCheck = result\.checkedAt/);
  const failureArm = fn.slice(fn.indexOf('} else'));
  assert.equal(failureArm.includes('lastPiCheck'), false);
});

test('both Ollama entrypoints delegate the probe to the single-flight cache', () => {
  for (const file of ['ultra-minimal.js', 'secure-ultra-minimal.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const start = src.indexOf('async function checkOllama');
    const end = src.indexOf('async function routeAI', start);
    assert.ok(start !== -1 && end !== -1, file);
    const fn = src.slice(start, end);
    assert.match(fn, /ollamaCache\.read\(\)/);
    assert.equal(fn.includes('Date.now() - lastCheck'), false);
    assert.equal(fn.includes('axios.get'), false);
  }
});
