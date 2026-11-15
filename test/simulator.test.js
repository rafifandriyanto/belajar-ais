const { test } = require('node:test');
const assert = require('node:assert');
const sim = require('../simulator');
const { FLEET } = require('../data/fleet');

test('bearing: utara=0, timur=90', () => {
  assert.equal(sim.calculateBearing(-7.0, 112.0, -6.0, 112.0), 0);
  assert.equal(sim.calculateBearing(-7.0, 112.0, -7.0, 113.0), 90);
});

test('distanceMeters: 1 derajat lintang ≈ 111.19 km', () => {
  const d = sim.distanceMeters(-7.0, 112.0, -6.0, 112.0);
  assert.ok(Math.abs(d - 111195) < 200, `d=${d}`);
});

test('destinationPoint: maju 1000 m ke utara menambah lat', () => {
  const [lat, lon] = sim.destinationPoint(-7.0, 112.0, 0, 1000);
  assert.ok(lat > -7.0 && Math.abs(lon - 112.0) < 1e-9);
  assert.ok(Math.abs(sim.distanceMeters(-7.0, 112.0, lat, lon) - 1000) < 1);
});

test('updateShips: kapal bergerak ≈ speed×0.514444×dt meter', () => {
  sim.initSimulator(FLEET);
  const before = sim.getShips().find((s) => s.mmsi === '525002001'); // cargo, dwell 0
  sim.updateShips(2, Date.now());
  const after = sim.getShips().find((s) => s.mmsi === '525002001');
  const d = sim.distanceMeters(before.lat, before.lon, after.lat, after.lon);
  const expect = 14.8 * 0.514444 * 2;
  assert.ok(Math.abs(d - expect) < expect * 0.1, `d=${d} expect≈${expect}`);
});

test('ferry moored di ujung rute lalu balik arah', () => {
  const ferry = FLEET.find((s) => s.type === 'ferry');
  sim.initSimulator([ferry]);
  const st = sim._state()[0];
  const end = ferry.route[ferry.route.length - 1];
  st.lat = end[0];
  st.lon = end[1];
  st.targetIndex = ferry.route.length - 1;
  st.direction = 1;
  sim.updateShips(2, 1000);
  assert.equal(sim.getShips()[0].status, 'moored');
  sim.updateShips(2, 1000 + (ferry.dwellSeconds + 1) * 1000);
  assert.equal(sim.getShips()[0].status, 'underway');
  assert.equal(st.direction, -1);
});