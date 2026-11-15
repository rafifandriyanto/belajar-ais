/**
 * db/seed.js — Isi data awal PostgreSQL dari data/fleet.js (satu sumber data).
 * Jalankan: npm run seed   (aman diulang — ON CONFLICT DO NOTHING)
 */

require('dotenv').config();

const { pool, initTables } = require('./postgres');
const { FLEET, PORTS } = require('../data/fleet');

async function seed() {
  try {
    await initTables();

    console.log('Mengisi data kapal...');
    for (const ship of FLEET) {
      await pool.query(
        `INSERT INTO ships (mmsi, name, type)
         VALUES ($1, $2, $3)
         ON CONFLICT (mmsi) DO NOTHING`,
        [ship.mmsi, ship.name, ship.type],
      );
    }
    console.log(`  ${FLEET.length} kapal siap`);

    console.log('Mengisi data pelabuhan...');
    for (const port of PORTS) {
      await pool.query(
        `INSERT INTO ports (name, lat, lon)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO NOTHING`,
        [port.name, port.lat, port.lon],
      );
    }
    console.log(`  ${PORTS.length} pelabuhan siap`);

    console.log('Seed selesai.');
  } catch (err) {
    console.error('Seed gagal:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seed();