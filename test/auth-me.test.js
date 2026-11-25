const test = require('node:test');
const assert = require('node:assert');
const { me } = require('../routes/auth');

function fakeRes() {
  return {
    code: 200,
    body: null,
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

test('GET /api/auth/me tanpa sesi mengembalikan 200 dengan data null', async () => {
  const res = fakeRes();
  await me({ headers: {} }, res);
  assert.strictEqual(res.code, 200);
  assert.deepStrictEqual(res.body, { status: 'success', data: null });
});
