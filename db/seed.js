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
        `INSERT INTO ships (mmsi, name, type, imo, call_sign, flag, length_m, beam_m, destination)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (mmsi) DO UPDATE SET
           imo = COALESCE(ships.imo, EXCLUDED.imo),
           call_sign = COALESCE(ships.call_sign, EXCLUDED.call_sign),
           flag = COALESCE(ships.flag, EXCLUDED.flag),
           length_m = COALESCE(ships.length_m, EXCLUDED.length_m),
           beam_m = COALESCE(ships.beam_m, EXCLUDED.beam_m),
           destination = COALESCE(ships.destination, EXCLUDED.destination)`,
        [ship.mmsi, ship.name, ship.type, ship.imo, ship.callSign, ship.flag, ship.lengthM, ship.beamM, ship.destination],
      );
      await pool.query(
        `INSERT INTO routes (mmsi, waypoints, speed_kn, dwell_s)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (mmsi) DO NOTHING`,
        [ship.mmsi, JSON.stringify(ship.route), ship.speedKn, ship.dwellSeconds || 0],
      );
    }
    console.log(`  ${FLEET.length} kapal + rute siap`);

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

    // Admin opsional dari .env (nilai tidak pernah dicetak).
    // Bila tidak disetel, pendaftar pertama di web menjadi admin.
    if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
      const { hashPassword } = require('../services/auth');
      await pool.query(
        `INSERT INTO users (username, password_hash, role)
         VALUES ($1,$2,'admin') ON CONFLICT (username) DO NOTHING`,
        [process.env.ADMIN_USERNAME, hashPassword(process.env.ADMIN_PASSWORD)],
      );
      console.log('Admin seed siap (kredensial dari .env)');
    } else {
      console.log('ADMIN_USERNAME/PASSWORD tidak disetel — pendaftar pertama akan menjadi admin');
    }

    console.log('Seed selesai.');
  } catch (err) {
    console.error('Seed gagal:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seed();