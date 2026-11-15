const { test } = require('node:test');
const assert = require('node:assert');
const { mergeShips } = require('../services/fleet');

const dyn = [{ mmsi: '525001001', lat: -7.1, lon: 112.7, heading: 90, speed: 12, status: 'underway' }];
const staticMap = new Map([
  ['525001001', { mmsi: '525001001', name: 'Nama PG', type: 'ferry', route: [[0, 0], [1, 1]] }],
]);

test('merge: nama/tipe dari statis, posisi dari dinamis', () => {
  const [s] = mergeShips(dyn, staticMap);
  assert.equal(s.name, 'Nama PG');
  assert.equal(s.type, 'ferry');
  assert.equal(s.lat, -7.1);
  assert.equal(s.heading, 90);
  assert.deepEqual(s.route, [[0, 0], [1, 1]]);
});

test('merge: mmsi tak dikenal tetap lolos tanpa nama PG', () => {
  const [s] = mergeShips([{ mmsi: '999999999', lat: 0, lon: 0 }], staticMap);
  assert.equal(s.mmsi, '999999999');
  assert.equal(s.lat, 0);
});