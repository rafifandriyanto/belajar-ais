/**
 * db/postgres.js - Koneksi dan Inisialisasi Tabel PostgreSQL
 *
 * Menggunakan library 'pg' (node-postgres).
 * Connection string diambil dari variabel lingkungan DATABASE_URL di .env
 * agar password tidak pernah hardcode di kode.
 */

const { Pool } = require('pg');

// Pool koneksi PostgreSQL - otomatis mengelola multiple koneksi
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Koneksi idle yang putus (mis. server DB restart) tidak boleh crash proses
pool.on('error', (err) => {
  console.warn('Koneksi PostgreSQL idle bermasalah:', err.message);
});

/**
 * Membuat tabel ships dan ports jika belum ada (CREATE TABLE IF NOT EXISTS).
 * Dipanggil HANYA oleh db/seed.js — server tidak mengubah schema saat start.
 */
async function initTables() {
  // Tabel ships: menyimpan data statis kapal (MMSI, nama, tipe armada)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ships (
      mmsi    VARCHAR(20) PRIMARY KEY,
      name    VARCHAR(100) NOT NULL,
      type    VARCHAR(20)  NOT NULL
    )
  `);

  // Tabel ports: menyimpan data pelabuhan (nama unik, koordinat lat/lon)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ports (
      id    SERIAL PRIMARY KEY,
      name  VARCHAR(100) NOT NULL UNIQUE,
      lat   DOUBLE PRECISION NOT NULL,
      lon   DOUBLE PRECISION NOT NULL
    )
  `);

  // Tabel users: akun operator/admin untuk auth sesi cookie
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      VARCHAR(24) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          VARCHAR(10) NOT NULL DEFAULT 'operator'
                    CHECK (role IN ('admin','operator')),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Tabel sessions: id = sha256 token cookie (token mentah tidak disimpan)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);

  // Particulars + kepemilikan kapal (kolom tambahan, idempotent)
  await pool.query(`ALTER TABLE ships ADD COLUMN IF NOT EXISTS imo VARCHAR(12)`);
  await pool.query(`ALTER TABLE ships ADD COLUMN IF NOT EXISTS call_sign VARCHAR(12)`);
  await pool.query(`ALTER TABLE ships ADD COLUMN IF NOT EXISTS flag VARCHAR(40)`);
  await pool.query(`ALTER TABLE ships ADD COLUMN IF NOT EXISTS length_m NUMERIC(6,1)`);
  await pool.query(`ALTER TABLE ships ADD COLUMN IF NOT EXISTS beam_m NUMERIC(5,1)`);
  await pool.query(`ALTER TABLE ships ADD COLUMN IF NOT EXISTS destination VARCHAR(60)`);
  await pool.query(`ALTER TABLE ships ADD COLUMN IF NOT EXISTS owner_id INT REFERENCES users(id)`);

  // Tabel routes: waypoint rute per kapal (sumber dinamis simulator)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS routes (
      mmsi      VARCHAR(20) PRIMARY KEY REFERENCES ships(mmsi) ON DELETE CASCADE,
      waypoints JSONB NOT NULL,
      speed_kn  NUMERIC(4,1) NOT NULL DEFAULT 12,
      dwell_s   INT NOT NULL DEFAULT 60
    )
  `);

  console.log('Tabel PostgreSQL (ships, ports, users, sessions, routes) siap digunakan');
}

module.exports = { pool, initTables };
