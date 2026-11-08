'use strict';

// Single-flight TTL cache for health probes.
// A failed run does not refresh the successful sample timestamp.
function createCachedProbe({ ttlMs, now = Date.now, run }) {
  let cached = null;
  let blockedUntil = 0;
  let flight = null;

  function read() {
    const t = now();
    if (cached && t - cached.at < ttlMs) {
      return Promise.resolve({ ok: true, value: cached.value, checkedAt: cached.at });
    }
    if (t < blockedUntil) {
      return Promise.resolve({
        ok: false,
        value: cached ? cached.value : null,
        checkedAt: cached ? cached.at : 0
      });
    }
    if (flight) return flight;

    let started;
    try {
      started = run();
    } catch (err) {
      started = Promise.reject(err);
    }
    flight = Promise.resolve(started)
      .then((value) => {
        const at = now();
        cached = { at, value };
        blockedUntil = 0;
        return { ok: true, value, checkedAt: at };
      }, () => {
        blockedUntil = now() + ttlMs;
        return {
          ok: false,
          value: cached ? cached.value : null,
          checkedAt: cached ? cached.at : 0
        };
      })
      .finally(() => {
        flight = null;
      });
    return flight;
  }

  return { read };
}

module.exports = { createCachedProbe };
