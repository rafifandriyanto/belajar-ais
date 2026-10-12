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

/**
 * Membuat tabel ships dan ports jika belum ada (CREATE TABLE IF NOT EXISTS).
 * Dipanggil sekali saat server pertama kali menyala.
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

  console.log('🐘 Tabel PostgreSQL (ships, ports) siap digunakan');
}

module.exports = { pool, initTables };
