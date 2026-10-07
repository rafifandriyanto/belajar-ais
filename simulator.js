/**
 * simulator.js - Simulator Pergerakan Kapal AIS Virtual
 * Area: Selat Madura / Pelabuhan Tanjung Perak, Surabaya
 */

// Menghitung bearing (sudut arah kapal dalam derajat 0-359)
function calculateBearing(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const dLon = toRad(lon2 - lon1);
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);

  const y = Math.sin(dLon) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);

  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return Math.round(bearing);
}

// 10 Kapal Virtual di Alur Pelayaran Selat Madura & Tanjung Perak
const ships = [
  {
    mmsi: '525001001',
    name: 'KM Dharma Kencana VII',
    type: 'ferry',
    speed: 13.5,
    heading: 0,
    route: [
      [-7.1955, 112.7395],
      [-7.1850, 112.7340],
      [-7.1750, 112.7270],
      [-7.1685, 112.7225]
    ],
    targetIndex: 1,
    direction: 1,
    lat: -7.1955,
    lon: 112.7395
  },
  {
    mmsi: '525001002',
    name: 'KMP Gili Iyang',
    type: 'ferry',
    speed: 11.2,
    heading: 0,
    route: [
      [-7.1688, 112.7230],
      [-7.1765, 112.7285],
      [-7.1860, 112.7350],
      [-7.1948, 112.7402]
    ],
    targetIndex: 1,
    direction: 1,
    lat: -7.1688,
    lon: 112.7230
  },
  {
    mmsi: '525002001',
    name: 'Meratus Surabaya',
    type: 'cargo',
    speed: 14.8,
    heading: 0,
    route: [
      [-7.2075, 112.6860],
      [-7.1880, 112.7050],
      [-7.1650, 112.7180],
      [-7.1350, 112.7160]
    ],
    targetIndex: 1,
    direction: 1,
    lat: -7.2075,
    lon: 112.6860
  },
  {
    mmsi: '525002002',
    name: 'Tanto Sejahtera',
    type: 'cargo',
    speed: 12.4,
    heading: 0,
    route: [
      [-7.2025, 112.7340],
      [-7.1920, 112.7480],
      [-7.1860, 112.7660],
      [-7.1820, 112.7950]
    ],
    targetIndex: 1,
    direction: 1,
    lat: -7.2025,
    lon: 112.7340
  },
  {
    mmsi: '525002003',
    name: 'SPIL Nirmala',
    type: 'cargo',
    speed: 15.0,
    heading: 0,
    route: [
      [-7.1320, 112.7145],
      [-7.1580, 112.7175],
      [-7.1820, 112.7260],
      [-7.2010, 112.7325]
    ],
    targetIndex: 1,
    direction: 1,
    lat: -7.1320,
    lon: 112.7145
  },
  {
    mmsi: '525003001',
    name: 'Pertamina Pride',
    type: 'tanker',
    speed: 10.5,
    heading: 0,
    route: [
      [-7.2005, 112.7290],
      [-7.1780, 112.7210],
      [-7.1540, 112.7150],
      [-7.1280, 112.7120]
    ],
    targetIndex: 1,
    direction: 1,
    lat: -7.2005,
    lon: 112.7290
  },
  {
    mmsi: '525003002',
    name: 'Gas Arjuna',
    type: 'tanker',
    speed: 9.8,
    heading: 0,
    route: [
      [-7.1970, 112.7420],
      [-7.1880, 112.7560],
      [-7.1840, 112.7750],
      [-7.1790, 112.8050]
    ],
    targetIndex: 1,
    direction: 1,
    lat: -7.1970,
    lon: 112.7420
  },
  {
    mmsi: '525004001',
    name: 'TB Bima Perkasa',
    type: 'tug',
    speed: 7.5,
    heading: 0,
    route: [
      [-7.2040, 112.7310],
      [-7.2010, 112.7350],
      [-7.1970, 112.7330],
      [-7.1990, 112.7280]
    ],
    targetIndex: 1,
    direction: 1,
    lat: -7.2040,
    lon: 112.7310
  },
  {
    mmsi: '525004002',
    name: 'TB Tanjung Perak Satu',
    type: 'tug',
    speed: 8.0,
    heading: 0,
    route: [
      [-7.1920, 112.7370],
      [-7.1870, 112.7330],
      [-7.1820, 112.7300],
      [-7.1880, 112.7350]
    ],
    targetIndex: 1,
    direction: 1,
    lat: -7.1920,
    lon: 112.7370
  },
  {
    mmsi: '525001003',
    name: 'KM Kirana IX',
    type: 'ferry',
    speed: 12.0,
    heading: 0,
    route: [
      [-7.1985, 112.7360],
      [-7.1910, 112.7490],
      [-7.1875, 112.7720],
      [-7.1860, 112.7910]
    ],
    targetIndex: 1,
    direction: 1,
    lat: -7.1985,
    lon: 112.7360
  }
];

// Inisialisasi heading awal untuk tiap kapal
ships.forEach((ship) => {
  const target = ship.route[ship.targetIndex];
  ship.heading = calculateBearing(ship.lat, ship.lon, target[0], target[1]);
});

/**
 * Memperbarui posisi seluruh kapal 1 langkah menuju waypoint target
 */
function updateShips() {
  ships.forEach((ship) => {
    const target = ship.route[ship.targetIndex];
    const targetLat = target[0];
    const targetLon = target[1];

    const dLat = targetLat - ship.lat;
    const dLon = targetLon - ship.lon;
    const distance = Math.hypot(dLat, dLon);

    // Faktor step per pembaruan (disesuaikan dengan kecepatan dalam knot)
    // 1 knot setara pergerakan kecil realistis di peta tiap 2 detik
    const step = ship.speed * 0.000035;

    if (distance <= step || distance === 0) {
      // Tiba di waypoint target
      ship.lat = targetLat;
      ship.lon = targetLon;

      // Geser ke waypoint berikutnya atau balik arah jika sudah di ujung rute
      const nextIndex = ship.targetIndex + ship.direction;
      if (nextIndex >= ship.route.length) {
        ship.direction = -1;
        ship.targetIndex = ship.route.length - 2;
      } else if (nextIndex < 0) {
        ship.direction = 1;
        ship.targetIndex = 1;
      } else {
        ship.targetIndex = nextIndex;
      }

      // Hitung heading menuju target baru
      const newTarget = ship.route[ship.targetIndex];
      ship.heading = calculateBearing(ship.lat, ship.lon, newTarget[0], newTarget[1]);
    } else {
      // Maju mendekati target
      const ratio = step / distance;
      ship.lat += dLat * ratio;
      ship.lon += dLon * ratio;

      // Update heading
      ship.heading = calculateBearing(ship.lat, ship.lon, targetLat, targetLon);
    }

    // Pembulatan presisi koordinat
    ship.lat = Number(ship.lat.toFixed(6));
    ship.lon = Number(ship.lon.toFixed(6));
  });
}

/**
 * Mengambil data kapal publik (sesuai spesifikasi PRD)
 */
function getShips() {
  return ships.map((ship) => ({
    mmsi: ship.mmsi,
    name: ship.name,
    type: ship.type,
    lat: ship.lat,
    lon: ship.lon,
    speed: ship.speed,
    heading: ship.heading,
    route: ship.route
  }));
}

module.exports = {
  ships,
  updateShips,
  getShips
};
