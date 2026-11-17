/** auth.js — Modal masuk/daftar + state sesi topbar. */
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const r = await fetch(`/api/auth/${tab}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: uEl.value, password: pEl.value }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) { err.textContent = j?.message || 'Gagal menghubungi server'; err.hidden = false; return; }
    user = j.data;
    pEl.value = '';
    dlg.close();
    onChange(user);
  });

  async function refresh() {
    const r = await fetch('/api/auth/me');
    user = r.ok ? (await r.json()).data : null;
    onChange(user);
  }
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    user = null;
    onChange(user);
  }
  return {
    refresh, logout,
    open: (t = 'login') => { setTab(t); dlg.showModal(); uEl.focus(); },
    getUser: () => user,
    canEdit: (ship) => !!user && (user.role === 'admin' || (ship.owner_id != null && ship.owner_id === user.id)),
  };
}