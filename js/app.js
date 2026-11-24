import * as api from './api.js';
import { $, $$, toast, errText, initSheet, closeSheet } from './ui.js';
import { openTxForm } from './txform.js';

import * as home from './screens/home.js';
import * as history from './screens/history.js';
import * as analytics from './screens/analytics.js';
import * as account from './screens/account.js';
import * as wallets from './screens/wallets.js';
import * as categories from './screens/categories.js';
import * as targets from './screens/targets.js';
import * as places from './screens/places.js';
import * as vehicle from './screens/vehicle.js';

const routes = { home, history, analytics, account, wallets, categories, targets, places, vehicle };
const TABS = ['home', 'history', 'analytics', 'account'];
// Layar kelola kembali ke Akun
const PARENT = { wallets: 'account', categories: 'account', targets: 'account', places: 'account', vehicle: 'account' };

const state = { user: null, route: 'home', authMode: 'login' };

// ---------- Masuk / daftar ----------
function showAuth() {
  $('#app').classList.add('hidden');
  $('#auth-screen').classList.remove('hidden');
}

function showApp() {
  $('#auth-screen').classList.add('hidden');
  $('#app').classList.remove('hidden');
}

function setAuthMode(mode) {
  state.authMode = mode;
  const signup = mode === 'signup';
  $('#auth-submit').textContent = signup ? 'Daftar' : 'Masuk';
  $('#auth-toggle').textContent = signup ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar';
  $('#auth-pass').autocomplete = signup ? 'new-password' : 'current-password';
  $('#auth-name-wrap').classList.toggle('hidden', !signup);
  $('#auth-msg').textContent = '';
}

$('#auth-toggle').addEventListener('click', () => setAuthMode(state.authMode === 'login' ? 'signup' : 'login'));

$('#auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#auth-email').value.trim();
  const pass = $('#auth-pass').value;
  const name = $('#auth-name').value.trim();
  const msg = $('#auth-msg');
  const btn = $('#auth-submit');
  msg.className = 'text-sm min-h-[1.25rem] text-slate-500';
  msg.textContent = 'Memproses...';
  btn.disabled = true;
  try {
    if (state.authMode === 'signup') {
      const { session } = await api.signUp(email, pass, name);
      if (!session) {
        setAuthMode('login');
        msg.className = 'text-sm min-h-[1.25rem] text-brand-700';
        msg.textContent = 'Pendaftaran berhasil. Cek emailmu untuk konfirmasi, lalu masuk.';
      }
    } else {
      await api.signIn(email, pass);
    }
  } catch (err) {
    msg.className = 'text-sm min-h-[1.25rem] text-red-600';
    msg.textContent = errText(err);
  } finally {
    btn.disabled = false;
  }
});

// ---------- Router ----------
export function setHeader({ sub = '', title = '', back = false }) {
  $('#hdr-sub').textContent = sub;
  $('#hdr-title').textContent = title;
  $('#hdr-back').classList.toggle('hidden', !back);
}

const ctx = () => ({ el: $('#view'), user: state.user, go, setHeader });

let renderToken = 0;
async function renderRoute() {
  const token = ++renderToken;
  const mod = routes[state.route];
  const activeTab = TABS.includes(state.route) ? state.route : PARENT[state.route];
  $$('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === activeTab));
  $('#fab').classList.toggle('hidden', !['home', 'history'].includes(state.route));
  try {
    await mod.render(ctx());
  } catch (err) {
    if (token === renderToken) {
      $('#view').innerHTML = `<div class="card text-center text-sm text-red-600">${errText(err)}</div>`;
    }
  }
}

export function go(name) {
  if (!routes[name]) return;
  state.route = name;
  closeSheet();
  window.scrollTo(0, 0);
  renderRoute();
}

$$('.tab-btn').forEach((b) => b.addEventListener('click', () => go(b.dataset.tab)));
$('#hdr-back').addEventListener('click', () => go(PARENT[state.route] || 'home'));
$('#fab').addEventListener('click', () => openTxForm({ type: 'income' }));

document.addEventListener('navigate', (e) => go(e.detail));
document.addEventListener('data-changed', () => renderRoute());

// ---------- Sesi ----------
initSheet();

function onSession(session) {
  if (session?.user) {
    // Abaikan event ulang (refresh token, sesi awal) untuk pengguna yang sama
    if (state.user?.id === session.user.id) {
      state.user = session.user;
      return;
    }
    state.user = session.user;
    showApp();
    go('home');
  } else {
    state.user = null;
    showAuth();
  }
}

api.onAuthChange((session) => {
  // Jangan panggil Supabase langsung di dalam callback ini (bisa buntu)
  setTimeout(() => onSession(session), 0);
});

(async () => {
  try {
    onSession(await api.getSession());
  } catch (err) {
    showAuth();
    toast(errText(err));
  }
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
