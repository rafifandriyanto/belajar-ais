/**
 * routes/auth.js — Register/login/logout/me dengan sesi cookie PG.
 * Rate limit 5/menit/IP; Origin check untuk mutasi; tanpa dependensi baru.
 */
const express = require('express');
const { pool } = require('../db/postgres');
const A = require('../services/auth');

const router = express.Router();
const limiter = A.createRateLimiter(5, 60000);
const MAX_AGE = Math.floor(A.SESSION_TTL_MS / 1000);

const pgDown = (res) => res.status(503).json({ status: 'error', message: 'Database akun belum tersedia' });
const bad = (res, msg) => res.status(400).json({ status: 'error', message: msg });

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) {
      try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* cookie rusak: abaikan */ }
    }
  }
  return out;
}

async function sessionUser(req) {
  const tok = parseCookies(req)[A.COOKIE_NAME];
  if (!tok) return null;
  const id = A.hashToken(tok);
  const { rows } = await pool.query(
    'SELECT u.id, u.username, u.role, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1',
    [id],
  );
  if (!rows.length) return null;
  if (A.isExpired(rows[0].expires_at)) {
    await pool.query('DELETE FROM sessions WHERE id = $1', [id]);
    return null;
  }
  return { id: rows[0].id, username: rows[0].username, role: rows[0].role };
}

async function requireAuth(req, res, next) {
  try {
    const u = await sessionUser(req);
    if (!u) return res.status(401).json({ status: 'error', message: 'Silakan masuk dulu' });
    req.user = u;
    next();
  } catch {
    pgDown(res);
  }
}

function sameOrigin(req, res, next) {
  const o = req.headers.origin;
  if (o) {
    try {
      if (new URL(o).host !== req.headers.host) {
        return res.status(403).json({ status: 'error', message: 'Origin tidak diizinkan' });
      }
    } catch {
      return res.status(403).json({ status: 'error', message: 'Origin tidak valid' });
    }
  }
  next();
}

function setSessionCookie(res, token, secure = false) {
  res.setHeader('Set-Cookie', `${A.COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}${secure ? '; Secure' : ''}`);
}

async function startSession(res, userId, q = pool, secure = false) {
  const token = A.newToken();
  await q.query('INSERT INTO sessions (id, user_id, expires_at) VALUES ($1,$2,$3)', [A.hashToken(token), userId, A.sessionExpiry()]);
  setSessionCookie(res, token, secure);
}

// Sapuan sesi kedaluwarsa berkala (unref: tidak menahan proses/test)
const sweep = setInterval(() => {
  pool.query('DELETE FROM sessions WHERE expires_at <= now()').catch((err) => {
    console.warn('Gagal membersihkan sesi kedaluwarsa:', err.message);
  });
}, 60000);
sweep.unref();

router.post('/register', sameOrigin, async (req, res) => {
  if (!limiter.try(req.ip)) return res.status(429).json({ status: 'error', message: 'Terlalu banyak percobaan, coba lagi semenit' });
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!/^[a-z0-9._-]{3,24}$/.test(username)) return bad(res, 'username: 3-24 karakter a-z 0-9 . _ -');
  if (password.length < 8) return bad(res, 'password: minimal 8 karakter');
  try {
    // Registrasi hanya terbuka saat belum ada user (bootstrap admin) atau oleh admin.
    const cnt = await pool.query('SELECT count(*)::int AS n FROM users');
    if (cnt.rows[0].n > 0) {
      const u = await sessionUser(req);
      if (!u || u.role !== 'admin') {
        return res.status(403).json({ status: 'error', message: 'Hanya admin yang boleh mendaftarkan user baru' });
      }
    }
    // Transaksi + advisory lock: cek duplikat atomik terhadap register bersamaan.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(727272)');
      const dup = await client.query('SELECT 1 FROM users WHERE username = $1', [username]);
      if (dup.rows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ status: 'error', message: 'Username sudah dipakai' });
      }
      // Admin hanya jika username cocok dengan ADMIN_USERNAME di .env.
      // Tidak ada lagi "pendaftar pertama otomatis admin".
      const adminUser = String(process.env.ADMIN_USERNAME || '').trim().toLowerCase();
      const role = adminUser && username === adminUser ? 'admin' : 'operator';
      const ins = await client.query(
        'INSERT INTO users (username, password_hash, role) VALUES ($1,$2,$3) RETURNING id, username, role',
        [username, A.hashPassword(password), role],
      );
      await startSession(res, ins.rows[0].id, client, req.secure);
      await client.query('COMMIT');
      res.status(201).json({ status: 'success', data: ins.rows[0] });
    } catch {
      await client.query('ROLLBACK').catch(() => {});
      pgDown(res);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Gagal mendaftarkan user:', err.message);
    pgDown(res);
  }
});

router.post('/login', sameOrigin, async (req, res) => {
  if (!limiter.try(req.ip)) return res.status(429).json({ status: 'error', message: 'Terlalu banyak percobaan, coba lagi semenit' });
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  try {
    const { rows } = await pool.query('SELECT id, username, role, password_hash FROM users WHERE username = $1', [username]);
    if (!rows.length || !A.verifyPassword(password, rows[0].password_hash)) {
      return res.status(401).json({ status: 'error', message: 'Username atau password salah' });
    }
    await pool.query('DELETE FROM sessions WHERE user_id = $1 AND expires_at <= now()', [rows[0].id]);
    await startSession(res, rows[0].id, pool, req.secure);
    res.json({ status: 'success', data: { id: rows[0].id, username: rows[0].username, role: rows[0].role } });
  } catch (err) {
    console.error('Gagal login:', err.message);
    pgDown(res);
  }
});

router.post('/logout', sameOrigin, async (req, res) => {
  const tok = parseCookies(req)[A.COOKIE_NAME];
  try {
    if (tok) await pool.query('DELETE FROM sessions WHERE id = $1', [A.hashToken(tok)]);
  } catch { /* sesi tetap dibersihkan di client */ }
  res.setHeader('Set-Cookie', `${A.COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${req.secure ? '; Secure' : ''}`);
  res.json({ status: 'success' });
});

async function me(req, res) {
  try {
    // Tanpa sesi adalah keadaan normal, bukan error. Mengembalikan 401 membuat
    // browser mencatat console error setiap kali halaman dimuat.
    res.json({ status: 'success', data: await sessionUser(req) });
  } catch (err) {
    console.error('Gagal mengambil sesi user (/me):', err.message);
    pgDown(res);
  }
}

router.get('/me', me);

module.exports = { router, requireAuth, sameOrigin, sessionUser, me };