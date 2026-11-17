const test = require('node:test');
const assert = require('node:assert');
const sim = require('../simulator');
const R1 = [[-7.20, 112.70], [-7.19, 112.71]];
const R2 = [[-7.21, 112.72], [-7.20, 112.73], [-7.19, 112.74]];

test('upsert kapal baru menambah state', () => {
  sim.initSimulator([{ mmsi: '111111111', route: R1, speedKn: 10, dwellSeconds: 0 }]);
  sim.upsertShip({ mmsi: '222222222', route: R2, speedKn: 12, dwellSeconds: 0 });
  assert.strictEqual(sim.getShips().length, 2);
});

test('upsert route berubah mereset posisi ke waypoint pertama', () => {
  sim.initSimulator([{ mmsi: '111111111', route: R1, speedKn: 10, dwellSeconds: 0 }]);
  sim.updateShips(5, 1000);
  sim.upsertShip({ mmsi: '111111111', route: R2, speedKn: 10, dwellSeconds: 0 });
  const s = sim.getShips().find((x) => x.mmsi === '111111111');
  assert.strictEqual(s.lat, R2[0][0]);
  assert.strictEqual(s.lon, R2[0][1]);
});

test('upsert kecepatan saja tidak mereset posisi', () => {
  sim.initSimulator([{ mmsi: '111111111', route: R1, speedKn: 10, dwellSeconds: 0 }]);
  sim.updateShips(5, 1000);
  const before = sim.getShips()[0];
  sim.upsertShip({ mmsi: '111111111', route: R1, speedKn: 14, dwellSeconds: 0 });
  const after = sim.getShips()[0];
  assert.strictEqual(after.lat, before.lat);
  // getShips menerapkan jitter tampilan; nilai tersimpan dicek via state internal
  assert.strictEqual(sim._state()[0].speedKn, 14);
});

test('remove menghapus kapal dari state', () => {
  sim.initSimulator([{ mmsi: '111111111', route: R1, speedKn: 10, dwellSeconds: 0 }]);
  assert.ok(sim.removeShip('111111111'));
  assert.strictEqual(sim.getShips().length, 0);
  assert.ok(!sim.removeShip('999999999'));
});

test('getDynamics memberi input voyage atau null', () => {
  sim.initSimulator([{ mmsi: '111111111', route: R1, speedKn: 10, dwellSeconds: 0 }]);
  const d = sim.getDynamics('111111111');
  assert.strictEqual(d.targetIndex, 1);
  assert.strictEqual(d.direction, 1);
  assert.strictEqual(sim.getDynamics('999999999'), null);
});