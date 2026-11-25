/** socket.js — koneksi Socket.io + status koneksi untuk UI. */

export function connectSocket({ onUpdate, onStatus, onError }) {
  const socket = io();
  let firstConnect = true;

  socket.on('ships:update', (ships) => onUpdate(ships));
  socket.on('fleet:update', (ships) => onUpdate(ships));

  socket.on('connect', () => {
    onStatus(true, firstConnect);
    firstConnect = false;
  });

  socket.on('disconnect', () => onStatus(false, false));
  // Koneksi awal yang gagal tidak memicu `disconnect`. Tanpa ini badge
  // tetap hijau LIVE padahal tidak ada frame sama sekali.
  socket.on('connect_error', () => {
    onError?.();
    onStatus(false, false, 'error');
  });

  return { socket, retry: () => socket.connect() };
}