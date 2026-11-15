/** socket.js — koneksi Socket.io + status koneksi untuk UI. */

export function connectSocket({ onUpdate, onStatus }) {
  const socket = io();
  let firstConnect = true;

  socket.on('ships:update', (ships) => onUpdate(ships));

  socket.on('connect', () => {
    onStatus(true, firstConnect);
    firstConnect = false;
  });

  socket.on('disconnect', () => onStatus(false, false));

  return socket;
}