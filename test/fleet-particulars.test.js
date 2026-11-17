const test = require('node:test');
const assert = require('node:assert');
const { FLEET } = require('../data/fleet');
const BBOX = { latMin: -7.35, latMax: -7.05, lonMin: 112.55, lonMax: 112.85 };

test('semua kapal punya particulars dan destination', () => {
  for (const s of FLEET) {
    assert.ok(/^\d{7}$/.test(s.imo), `${s.mmsi} imo`);
    assert.ok(s.callSign && s.flag, `${s.mmsi} callSign/flag`);
    assert.ok(s.lengthM > 0 && s.beamM > 0, `${s.mmsi} dimensi`);
    assert.ok(s.destination, `${s.mmsi} destination`);
  }
});

test('route minimal 2 titik dan dalam bbox area operasi', () => {
  for (const s of FLEET) {
    assert.ok(s.route.length >= 2, s.mmsi);
    for (const [lat, lon] of s.route) {
      assert.ok(lat >= BBOX.latMin && lat <= BBOX.latMax, `${s.mmsi} lat`);
      assert.ok(lon >= BBOX.lonMin && lon <= BBOX.lonMax, `${s.mmsi} lon`);
    }
  }
});