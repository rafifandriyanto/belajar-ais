/**
 * db/seed.js - Script Pengisian Data Awal (Seed) ke PostgreSQL
 *
 * Jalankan sekali dengan perintah: node db/seed.js
 * Akan mengisi tabel ships (10 kapal) dan tabel ports (Tanjung Perak).
 * Aman dijalankan berkali-kali karena menggunakan INSERT ... ON CONFLICT DO NOTHING.
 */

require('dotenv').config(); // Muat variabel dari .env (DATABASE_URL, dll)

const { pool, initTables } = require('./postgres');

// Data 10 kapal yang sama dengan simulator.js (MMSI harus cocok!)
const shipsSeed = [
  { mmsi: '525001001', name: 'KM Dharma Kencana VII',  type: 'ferry'  },
  { mmsi: '525001002', name: 'KMP Gili Iyang',         type: 'ferry'  },
  { mmsi: '525001003', name: 'KM Kirana IX',            type: 'ferry'  },
  { mmsi: '525002001', name: 'Meratus Surabaya',        type: 'cargo'  },
  { mmsi: '525002002', name: 'Tanto Sejahtera',         type: 'cargo'  },
  { mmsi: '525002003', name: 'SPIL Nirmala',            type: 'cargo'  },
  { mmsi: '525003001', name: 'Pertamina Pride',         type: 'tanker' },
  { mmsi: '525003002', name: 'Gas Arjuna',              type: 'tanker' },
  { mmsi: '525004001', name: 'TB Bima Perkasa',         type: 'tug'   },
  { mmsi: '525004002', name: 'TB Tanjung Perak Satu',   type: 'tug'   }
];

// Data pelabuhan referensi
const portsSeed = [
  { name: 'Pelabuhan Tanjung Perak',  lat: -7.2052, lon: 112.7321 },
  { name: 'Terminal Gapura Surya',    lat: -7.1993, lon: 112.7388 },
  { name: 'Terminal Nilam',           lat: -7.2015, lon: 112.7415 }
];

async function seed() {
  try {
    // Pastikan tabel sudah ada sebelum insert
    await initTables();

    // --- Seed kapal ---
    console.log('📦 Mengisi data kapal...');
    for (const ship of shipsSeed) {
      // ON CONFLICT DO NOTHING: jika MMSI sudah ada, skip (tidak error)
      await pool.query(
        `INSERT INTO ships (mmsi, name, type)
         VALUES ($1, $2, $3)
         ON CONFLICT (mmsi) DO NOTHING`,
        [ship.mmsi, ship.name, ship.type]
      );
    }
    console.log(`   ✅ ${shipsSeed.length} kapal berhasil di-seed`);

    // --- Seed pelabuhan ---
    console.log('🏭 Mengisi data pelabuhan...');
    for (const port of portsSeed) {
        // ON CONFLICT pada kolom name: skip jika nama pelabuhan sudah ada
      await pool.query(
        `INSERT INTO ports (name, lat, lon)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO NOTHING`,
        [port.name, port.lat, port.lon]
      );
    }
    console.log(`   ✅ ${portsSeed.length} pelabuhan berhasil di-seed`);

    console.log('\n✨ Seed selesai! Database siap digunakan.');
  } catch (err) {
    console.error('❌ Seed gagal:', err.message);
    process.exit(1);
  } finally {
    // Tutup koneksi pool setelah selesai agar script bisa exit
    await pool.end();
  }
}

seed();
