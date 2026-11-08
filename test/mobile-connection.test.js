'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadConnectionState() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'mobile-dashboard.html'), 'utf8');
  const match = html.match(/function connectionStateFromPoll\(metricsOk, apiOk\) \{[\s\S]*?\n        \}/);
  assert.ok(match, 'connectionStateFromPoll missing');
  return vm.runInNewContext(`${match[0]}\nconnectionStateFromPoll`);
}

test('a successful metrics poll is online even when the API fallback did not run', () => {
  const connectionStateFromPoll = loadConnectionState();
  assert.equal(connectionStateFromPoll(true, false), 'ONLINE');
});

test('the API fallback can still report online', () => {
  const connectionStateFromPoll = loadConnectionState();
  assert.equal(connectionStateFromPoll(false, true), 'ONLINE');
});

test('both failed sources stay offline', () => {
  const connectionStateFromPoll = loadConnectionState();
  assert.equal(connectionStateFromPoll(false, false), 'OFFLINE');
  assert.equal(connectionStateFromPoll(undefined, undefined), 'OFFLINE');
});

test('the metrics success path records metricsOk before rendering the label', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'mobile-dashboard.html'), 'utf8');
  const start = html.indexOf('async function updateMobile');
  const end = html.indexOf('function updateElement', start);
  assert.ok(start !== -1 && end !== -1);
  const fn = html.slice(start, end);
  assert.match(fn, /metricsOk = true/);
  assert.match(fn, /connectionStateFromPoll\(metricsOk, apiOk\)/);
  assert.equal(fn.includes("isConnected ? 'ONLINE'"), false);
});
