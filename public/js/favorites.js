/** favorites.js — Favorit & follow per browser (localStorage), tanpa auth.
 * Semua akses storage dibungkus try/catch: mode privat / kuota penuh tidak
 * boleh mematikan app, fitur ini degrade jadi non-persisten. */
const FAVS_KEY = 'ais.favs';
const FOLLOW_KEY = 'ais.follow';

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* non-persisten */ } };
const drop = (k) => { try { localStorage.removeItem(k); } catch { /* non-persisten */ } };

export function createFavorites() {
  let favs = new Set();
  try { favs = new Set(JSON.parse(read(FAVS_KEY) || '[]')); } catch { favs = new Set(); }
  let follow = read(FOLLOW_KEY) || null;
  const save = () => write(FAVS_KEY, JSON.stringify([...favs]));
  return {
    has: (mmsi) => favs.has(mmsi),
    toggle(mmsi) {
      if (favs.has(mmsi)) favs.delete(mmsi); else favs.add(mmsi);
      save();
      return favs.has(mmsi);
    },
    isFollow: (mmsi) => follow === mmsi,
    getFollow: () => follow,
    setFollow(mmsi) {
      follow = follow === mmsi ? null : mmsi;
      if (follow) write(FOLLOW_KEY, follow); else drop(FOLLOW_KEY);
      return follow;
    },
  };
}