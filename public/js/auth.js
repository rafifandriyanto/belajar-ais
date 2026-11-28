/** auth.js — Modal masuk/daftar + state sesi topbar. */
import { escapeHtml } from './util.js';
export function createAuth({ onChange }) {
  let user = null;
  let tab = 'login';
  const dlg = document.getElementById('authDialog');
  const form = document.getElementById('authForm');
  const err = document.getElementById('authErr');
  const title = document.getElementById('authTitle');
  const submit = document.getElementById('authSubmit');
  const uEl = document.getElementById('authUsername');
  const pEl = document.getElementById('authPassword');

  function setTab(t) {
    tab = t;
    title.textContent = t === 'login' ? 'MASUK OPERATOR' : 'DAFTAR OPERATOR';
    submit.textContent = t === 'login' ? 'MASUK' : 'DAFTAR';
    document.getElementById('tabLogin').setAttribute('aria-pressed', String(t === 'login'));
    document.getElementById('tabLogin').classList.toggle('active', t === 'login');
    document.getElementById('tabRegister').setAttribute('aria-pressed', String(t === 'register'));
    document.getElementById('tabRegister').classList.toggle('active', t === 'register');
    pEl.autocomplete = t === 'login' ? 'current-password' : 'new-password';
    err.hidden = true;
  }
  document.getElementById('tabLogin').addEventListener('click', () => setTab('login'));
  document.getElementById('tabRegister').addEventListener('click', () => setTab('register'));
  document.getElementById('authClose').addEventListener('click', () => dlg.close());

  async function submitAuth(endpoint, username, password) {
    err.hidden = true;
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) { err.textContent = j?.message || 'Gagal menghubungi server'; err.hidden = false; return; }
    user = j.data;
    pEl.value = '';
    syncUsersBtn();
    dlg.close();
    onChange(user);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const endpoint = tab === 'register' ? '/api/auth/register' : '/api/auth/login';
    await submitAuth(endpoint, uEl.value, pEl.value);
  });

  const demoCreds = { demoAdmin: ['demo_admin', 'DemoPass123!'], demoOperator: ['demo_operator', 'DemoPass123!'] };
  for (const [id, [u, p]] of Object.entries(demoCreds)) {
    document.getElementById(id)?.addEventListener('click', () => submitAuth('/api/auth/login', u, p));
  }

  const usersBtn = document.getElementById('usersBtn');
  const usersDlg = document.getElementById('usersDialog');
  const usersList = document.getElementById('usersList');
  const usersErr = document.getElementById('usersErr');
  document.getElementById('usersClose')?.addEventListener('click', () => usersDlg.close());

  async function loadUsers() {
    usersErr.hidden = true;
    const r = await fetch('/api/auth/users');
    const j = await r.json().catch(() => null);
    if (!r.ok) { usersErr.textContent = j?.message || 'Gagal memuat user'; usersErr.hidden = false; return; }
    usersList.innerHTML = (j.data || []).map((u) => `
      <div class="flex items-center justify-between rounded border border-slate-700 px-3 py-2">
        <span class="text-sm">${escapeHtml(u.username)} <span class="text-xs text-slate-400">(${escapeHtml(u.role)})</span></span>
        <button class="btn danger" data-del="${u.id}" ${u.id === user?.id ? 'disabled' : ''}>HAPUS</button>
      </div>`).join('');
    usersList.querySelectorAll('[data-del]').forEach((b) => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-del');
        const r = await fetch(`/api/auth/users/${id}`, { method: 'DELETE' });
        const j = await r.json().catch(() => null);
        if (!r.ok) { usersErr.textContent = j?.message || 'Gagal hapus'; usersErr.hidden = false; return; }
        loadUsers();
      });
    });
  }

  function syncUsersBtn() {
    if (usersBtn) usersBtn.hidden = !(user && user.role === 'admin');
  }

  usersBtn?.addEventListener('click', () => { loadUsers(); usersDlg.showModal(); });

  async function refresh() {
    const r = await fetch('/api/auth/me');
    user = r.ok ? (await r.json()).data : null;
    syncUsersBtn();
    onChange(user);
  }
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    user = null;
    syncUsersBtn();
    onChange(user);
  }
  return {
    refresh, logout,
    open: (t = 'login') => { setTab(t); dlg.showModal(); uEl.focus(); },
    getUser: () => user,
    canEdit: (ship) => !!user && (user.role === 'admin' || (ship.owner_id != null && ship.owner_id === user.id)),
  };
}