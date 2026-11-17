const test = require('node:test');
const assert = require('node:assert');

test('matchShip nama substring case-insensitive dan mmsi substring', async () => {
  const { matchShip } = await import('../public/js/util.js');
  const ship = { name: 'KM Dharma Kencana VII', mmsi: '525001001' };
  assert.ok(matchShip(ship, 'dharma'));
  assert.ok(matchShip(ship, '  DHARMA  '));
  assert.ok(matchShip(ship, '525001'));
  assert.ok(matchShip(ship, ''));
  assert.ok(matchShip(ship, null));
  assert.ok(!matchShip(ship, 'tanker'));
});

test('fmtNm meter ke mil laut 1 desimal', async () => {
  const { fmtNm } = await import('../public/js/util.js');
  assert.strictEqual(fmtNm(1852), '1.0');
  assert.strictEqual(fmtNm(3704), '2.0');
});