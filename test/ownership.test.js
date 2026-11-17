const test = require('node:test');
const assert = require('node:assert');
const { canEditShip } = require('../services/auth');

test('admin boleh edit semua kapal termasuk seed', () => {
  const admin = { id: 1, role: 'admin' };
  assert.ok(canEditShip(admin, { owner_id: null }));
  assert.ok(canEditShip(admin, { owner_id: 9 }));
});

test('operator hanya boleh edit kapal miliknya', () => {
  const op = { id: 2, role: 'operator' };
  assert.ok(canEditShip(op, { owner_id: 2 }));
  assert.ok(!canEditShip(op, { owner_id: 3 }));
  assert.ok(!canEditShip(op, { owner_id: null }));
});

test('tanpa login tidak boleh edit', () => {
  assert.ok(!canEditShip(null, { owner_id: 2 }));
});