const test = require('node:test');
const assert = require('node:assert');
const { computeVoyage } = require('../services/voyage');
const route = [[-7.20, 112.70], [-7.19, 112.71], [-7.18, 112.72]];

test('sisa jarak menurun sepanjang rute', () => {
  const a = computeVoyage({ lat: -7.20, lon: 112.70, targetIndex: 1, direction: 1, speedKn: 10, dwellUntil: 0 }, route, 0);
  const b = computeVoyage({ lat: -7.19, lon: 112.71, targetIndex: 2, direction: 1, speedKn: 10, dwellUntil: 0 }, route, 0);
  assert.ok(a.remainingM > b.remainingM && b.remainingM > 0);
});

test('ETA konsisten dengan kecepatan knot', () => {
  const v = computeVoyage({ lat: -7.20, lon: 112.70, targetIndex: 1, direction: 1, speedKn: 10, dwellUntil: 0 }, route, 0);
  const expectMs = (v.remainingM / (10 * 0.514444)) * 1000;
  assert.ok(Math.abs(Date.parse(v.etaIso) - expectMs) < 1500);
});

test('moored menambah sisa waktu sandar ke ETA', () => {
  const base = computeVoyage({ lat: -7.20, lon: 112.70, targetIndex: 1, direction: 1, speedKn: 10, dwellUntil: 0 }, route, 0);
  const moored = computeVoyage({ lat: -7.20, lon: 112.70, targetIndex: 1, direction: 1, speedKn: 10, dwellUntil: 60000 }, route, 0);
  assert.ok(Date.parse(moored.etaIso) - Date.parse(base.etaIso) >= 59000);
});

test('arah balik menghitung ke ujung awal rute', () => {
  const v = computeVoyage({ lat: -7.18, lon: 112.72, targetIndex: 1, direction: -1, speedKn: 10, dwellUntil: 0 }, route, 0);
  assert.ok(v.remainingM > 0);
});