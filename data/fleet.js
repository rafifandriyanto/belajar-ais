/**
 * data/fleet.js — Satu-satunya sumber data statis armada & pelabuhan.
 * Dipakai oleh: db/seed.js (isi PostgreSQL) dan simulator (fallback bila PG mati).
 * Jangan menduplikasi data ini di file lain.
 */

const FLEET = [
  {
    mmsi: '525001001', name: 'KM Dharma Kencana VII', type: 'ferry',
    speedKn: 13.5, dwellSeconds: 20,
    route: [[-7.1955, 112.7395], [-7.1850, 112.7340], [-7.1750, 112.7270], [-7.1685, 112.7225]],
  },
  {
    mmsi: '525001002', name: 'KMP Gili Iyang', type: 'ferry',
    speedKn: 11.2, dwellSeconds: 20,
    route: [[-7.1688, 112.7230], [-7.1765, 112.7285], [-7.1860, 112.7350], [-7.1948, 112.7402]],
  },
  {
    mmsi: '525001003', name: 'KM Kirana IX', type: 'ferry',
    speedKn: 12.0, dwellSeconds: 20,
    route: [[-7.1985, 112.7360], [-7.1910, 112.7490], [-7.1875, 112.7720], [-7.1860, 112.7910]],
  },
  {
    mmsi: '525002001', name: 'Meratus Surabaya', type: 'cargo',
    speedKn: 14.8, dwellSeconds: 0,
    route: [[-7.2075, 112.6860], [-7.1880, 112.7050], [-7.1650, 112.7180], [-7.1700, 112.7000]],
  },
  {
    mmsi: '525002002', name: 'Tanto Sejahtera', type: 'cargo',
    speedKn: 12.4, dwellSeconds: 0,
    route: [[-7.2025, 112.7340], [-7.1920, 112.7480], [-7.1860, 112.7660], [-7.1820, 112.7950]],
  },
  {
    mmsi: '525002003', name: 'SPIL Nirmala', type: 'cargo',
    speedKn: 15.0, dwellSeconds: 0,
    route: [[-7.1700, 112.7000], [-7.1680, 112.7160], [-7.1820, 112.7260], [-7.2010, 112.7325]],
  },
  {
    mmsi: '525003001', name: 'Pertamina Pride', type: 'tanker',
    speedKn: 10.5, dwellSeconds: 0,
    route: [[-7.2005, 112.7290], [-7.1780, 112.7210], [-7.1600, 112.7050], [-7.1700, 112.7000]],
  },
  {
    mmsi: '525003002', name: 'Gas Arjuna', type: 'tanker',
    speedKn: 9.8, dwellSeconds: 0,
    route: [[-7.1970, 112.7420], [-7.1880, 112.7560], [-7.1840, 112.7750], [-7.1790, 112.8050]],
  },
  {
    mmsi: '525004001', name: 'TB Bima Perkasa', type: 'tug',
    speedKn: 7.5, dwellSeconds: 20,
    route: [[-7.2040, 112.7310], [-7.2010, 112.7350], [-7.1970, 112.7330], [-7.1990, 112.7280]],
  },
  {
    mmsi: '525004002', name: 'TB Tanjung Perak Satu', type: 'tug',
    speedKn: 8.0, dwellSeconds: 20,
    route: [[-7.1920, 112.7370], [-7.1870, 112.7330], [-7.1820, 112.7300], [-7.1880, 112.7350]],
  },
];

const PORTS = [
  { name: 'Pelabuhan Tanjung Perak', lat: -7.2052, lon: 112.7321 },
  { name: 'Terminal Gapura Surya', lat: -7.1993, lon: 112.7388 },
  { name: 'Terminal Nilam', lat: -7.2015, lon: 112.7415 },
];

const isValidMmsi = (s) => typeof s === 'string' && /^\d{9}$/.test(s);
const getFleetShip = (mmsi) => FLEET.find((s) => s.mmsi === mmsi);

module.exports = { FLEET, PORTS, isValidMmsi, getFleetShip };