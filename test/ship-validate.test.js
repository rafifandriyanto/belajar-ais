const test = require('node:test');
const assert = require('node:assert');
const { validateShipPayload } = require('../services/ship-validate');
const good = { mmsi: '525009001', name: 'Test Ship', type: 'cargo', speedKn: 12, route: [[-7.2, 112.7], [-7.19, 112.71]] };

test('payload valid lolos', () => assert.deepStrictEqual(validateShipPayload(good), []));
test('mmsi bukan 9 digit ditolak', () => assert.ok(validateShipPayload({ ...good, mmsi: '123' }).length));
test('route satu titik ditolak', () => assert.ok(validateShipPayload({ ...good, route: [[-7.2, 112.7]] }).length));
test('titik di luar bbox ditolak', () => assert.ok(validateShipPayload({ ...good, route: [[-8.0, 112.7], [-7.19, 112.71]] }).length));
test('speed di luar 1-30 ditolak', () => assert.ok(validateShipPayload({ ...good, speedKn: 40 }).length));
test('partial update tanpa mmsi lolos', () => assert.deepStrictEqual(validateShipPayload({ name: 'Baru' }, { partial: true }), []));
test('tipe asing ditolak', () => assert.ok(validateShipPayload({ ...good, type: 'pesawat' }).length));
test('name non-string ditolak (bukan coerce)', () => assert.ok(validateShipPayload({ ...good, name: 42 }).length));
test('lengthM di luar 1-400 ditolak', () => assert.ok(validateShipPayload({ ...good, lengthM: 900 }).length));
test('beamM non-numerik ditolak', () => assert.ok(validateShipPayload({ ...good, beamM: 'abc' }).length));
test('imo lebih dari 12 karakter ditolak', () => assert.ok(validateShipPayload({ ...good, imo: '1234567890123' }).length));
test('particulars opsional kosong tetap lolos', () => assert.deepStrictEqual(validateShipPayload({ ...good, imo: undefined, lengthM: undefined }), []));