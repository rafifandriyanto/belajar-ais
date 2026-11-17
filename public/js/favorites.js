/** favorites.js — Favorit & follow per browser (localStorage), tanpa auth. */
const FAVS_KEY = 'ais.favs';
const FOLLOW_KEY = 'ais.follow';

export function createFavorites() {
  let favs = new Set();
  try { favs = new Set(JSON.parse(localStorage.getItem(FAVS_KEY) || '[]')); } catch { favs = new Set(); }
  let follow = localStorage.getItem(FOLLOW_KEY) || null;
  const save = () => localStorage.setItem(FAVS_KEY, JSON.stringify([...favs]));
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
      if (follow) localStorage.setItem(FOLLOW_KEY, follow); else localStorage.removeItem(FOLLOW_KEY);
      return follow;
    },
  };
}