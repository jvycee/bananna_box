'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { rotateApiKey } = require('../key-rotation');

function scratchFile(name) {
  const dir = process.env.TMPDIR;
  if (!dir || !path.isAbsolute(dir) || dir === '/' || dir.includes('..')) {
    throw new Error('TMPDIR scratch is required');
  }
  return path.join(dir, name);
}

function tokenFrom(file) {
  const line = fs.readFileSync(file, 'utf8').split('\n').find((entry) => entry.startsWith('INTERNAL_AUTH_TOKEN='));
  assert.ok(line);
  return line.slice('INTERNAL_AUTH_TOKEN='.length);
}

test('a due rotation reloads the caller verifier and replaces the file token', () => {
  const file = scratchFile('rotation-due.env');
  const previous = 'previous-dummy-token';
  fs.writeFileSync(file, `INTERNAL_AUTH_TOKEN=${previous}\n`);
  const verifier = { authToken: previous };
  const result = rotateApiKey({
    envFile: file,
    onRotated: (token) => {
      verifier.authToken = token;
    }
  });
  const written = tokenFrom(file);
  assert.equal(result.rotated, true);
  assert.equal(verifier.authToken === written, true);
  assert.equal(verifier.authToken === previous, false);
  const accepts = (header) => header.split(' ')[1] === verifier.authToken;
  assert.equal(accepts(`Bearer ${previous}`), false);
  assert.equal(accepts(`Bearer ${written}`), true);
});

test('a rotation that is not due leaves the verifier unchanged', () => {
  const file = scratchFile('rotation-fresh.env');
  const current = 'current-dummy-token';
  fs.writeFileSync(file, `INTERNAL_AUTH_TOKEN=${current}\nLAST_KEY_ROTATION=${Date.now()}\n`);
  const verifier = { authToken: current };
  let called = false;
  const result = rotateApiKey({
    envFile: file,
    onRotated: () => {
      called = true;
    }
  });
  assert.equal(result.rotated, false);
  assert.equal(called, false);
  assert.equal(verifier.authToken, current);
  assert.equal(tokenFrom(file), current);
});

test('a missing env file does not report success or call the verifier', () => {
  const missing = scratchFile(path.join('missing-dir', 'rotation.env'));
  let called = false;
  const result = rotateApiKey({
    envFile: missing,
    onRotated: () => {
      called = true;
    }
  });
  assert.equal(result.rotated, false);
  assert.equal(called, false);
});

test('the secure server assigns the rotated token onto CFG.authToken', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'secure-ultra-minimal.js'), 'utf8');
  assert.match(src, /onRotated:\s*\(token\)\s*=>\s*\{\s*CFG\.authToken = token;\s*\}/);
  assert.match(src, /token === CFG\.authToken/);
});
