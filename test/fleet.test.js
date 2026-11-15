const { test } = require('node:test');
const assert = require('node:assert');
const { FLEET, PORTS, isValidMmsi, getFleetShip } = require('../data/fleet');

test('FLEET berisi 10 kapal unik, MMSI 9 digit', () => {
  assert.equal(FLEET.length, 10);
  const seen = new Set(FLEET.map((s) => s.mmsi));
  assert.equal(seen.size, 10);
  for (const s of FLEET) {
    assert.ok(isValidMmsi(s.mmsi));
    assert.ok(s.route.length >= 2);
    assert.ok(s.speedKn > 0);
    assert.ok(['ferry', 'cargo', 'tanker', 'tug'].includes(s.type));
  }
});

test('isValidMmsi menolak non-9-digit', () => {
  assert.equal(isValidMmsi('525001001'), true);
  assert.equal(isValidMmsi('12345'), false);
  assert.equal(isValidMmsi('52500100a'), false);
  assert.equal(isValidMmsi(undefined), false);
});

test('getFleetShip menemukan kapal & PORTS berisi 3 pelabuhan', () => {
  assert.equal(getFleetShip('525001001').name, 'KM Dharma Kencana VII');
  assert.equal(getFleetShip('000000000'), undefined);
  assert.equal(PORTS.length, 3);
});