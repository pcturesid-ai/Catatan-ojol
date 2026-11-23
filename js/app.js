import * as api from './api.js';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from './config.js';
import {
  rp, todayStr, toDateStr, parseDate, startOfWeek, addDays, fmtDay, fmtShort,
  esc, totals, digitsOnly, fmtThousands,
} from './utils.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  user: null,
  tab: 'home',
  target: 0,
  todayTx: [],
  weekStart: startOfWeek(new Date()),
  weekTx: [],
  authMode: 'login', // 'login' | 'signup'
  txType: 'income',
  txCat: '',
};

// ---------- Util UI ----------
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2400);
}

const errText = (e) => {
  const m = (e && e.message) || String(e);
  if (/Invalid login credentials/i.test(m)) return 'Email atau kata sandi salah.';
  if (/Email not confirmed/i.test(m)) return 'Email belum dikonfirmasi. Cek kotak masuk emailmu.';
  if (/already registered/i.test(m)) return 'Email ini sudah terdaftar. Silakan masuk.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Tidak ada koneksi internet.';
  return m;
};

// ---------- Autentikasi ----------
function showAuth() {
  $('#app').classList.add('hidden');
  $('#fab').classList.add('hidden');
  $('#auth-screen').classList.remove('hidden');
}

function showApp() {
  $('#auth-screen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#fab').classList.remove('hidden');
}

function setAuthMode(mode) {
  state.authMode = mode;
  const signup = mode === 'signup';
  $('#auth-submit').textContent = signup ? 'Daftar' : 'Masuk';
  $('#auth-toggle').textContent = signup ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar';
  $('#auth-pass').autocomplete = signup ? 'new-password' : 'current-password';
  $('#auth-msg').textContent = '';
}

$('#auth-toggle').addEventListener('click', () => setAuthMode(state.authMode === 'login' ? 'signup' : 'login'));

$('#auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#auth-email').value.trim();
  const pass = $('#auth-pass').value;
  const msg = $('#auth-msg');
  const btn = $('#auth-submit');
  msg.className = 'text-sm min-h-[1.25rem] text-slate-500';
  msg.textContent = 'Memproses...';
  btn.disabled = true;
  try {
    if (state.authMode === 'signup') {
      const { session } = await api.signUp(email, pass);
      if (!session) {
        msg.className = 'text-sm min-h-[1.25rem] text-brand-700';
        msg.textContent = 'Pendaftaran berhasil. Cek emailmu untuk konfirmasi, lalu masuk.';
        setAuthMode('login');
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

// ---------- Navigasi ----------
function setTab(tab) {
  state.tab = tab;
  $$('.view').forEach((v) => v.classList.add('hidden'));
  $(`#view-${tab}`).classList.remove('hidden');
  $$('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $('#fab').classList.toggle('hidden', tab === 'settings');
  refresh();
}

$$('.tab-btn').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

async function refresh() {
  try {
    if (state.tab === 'home') await loadHome();
    else if (state.tab === 'recap') await loadRecap();
    else renderSettings();
  } catch (err) {
    toast(errText(err));
  }
}

// ---------- Beranda ----------
async function loadHome() {
  const today = todayStr();
  const [tx, target] = await Promise.all([api.listTx(today, today), api.getTarget()]);
  state.todayTx = tx;
  state.target = target;
  renderHome();
}

function txRow(t, withDate = false) {
  const inc = t.type === 'income';
  return `
    <li class="flex items-center gap-3 py-3">
      <div class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${inc ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-600'}">${inc ? '↓' : '↑'}</div>
      <div class="min-w-0 flex-1">
        <p class="font-semibold truncate">${esc(t.category)}</p>
        <p class="text-xs text-slate-500 truncate">${withDate ? esc(fmtDay(t.trx_date)) + (t.note ? ' · ' : '') : ''}${esc(t.note || (withDate ? '' : 'Tanpa catatan'))}</p>
      </div>
      <p class="font-bold ${inc ? 'text-brand-700' : 'text-red-600'}">${inc ? '+' : '-'}${rp(t.amount).replace('Rp ', '')}</p>
      <button data-del="${esc(t.id)}" class="text-slate-300 hover:text-red-500 text-xl px-1" aria-label="Hapus">🗑</button>
    </li>`;
}

function renderHome() {
  const { income, expense, net } = totals(state.todayTx);
  const target = state.target;
  const pct = target > 0 ? Math.max(0, Math.min(100, Math.round((net / target) * 100))) : 0;
  const reached = target > 0 && net >= target;
  const now = new Date();

  $('#hdr-sub').textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#hdr-title').textContent = 'Hari ini';

  $('#view-home').innerHTML = `
    <div class="card">
      <p class="text-sm text-slate-500">Pendapatan bersih</p>
      <p class="text-3xl font-extrabold ${net < 0 ? 'text-red-600' : 'text-slate-900'}">${rp(net)}</p>
      <div class="grid grid-cols-2 gap-3 mt-4 text-sm">
        <div class="rounded-xl bg-brand-50 p-3"><p class="text-brand-700">Pemasukan</p><p class="font-bold">${rp(income)}</p></div>
        <div class="rounded-xl bg-red-50 p-3"><p class="text-red-600">Pengeluaran</p><p class="font-bold">${rp(expense)}</p></div>
      </div>
    </div>

    <div class="card">
      <div class="flex justify-between items-baseline">
        <p class="font-semibold">Target harian</p>
        <p class="text-sm text-slate-500">${target > 0 ? rp(target) : 'Belum diatur'}</p>
      </div>
      ${
        target > 0
          ? `<div class="h-3 rounded-full bg-slate-100 mt-3 overflow-hidden"><div class="h-full rounded-full ${reached ? 'bg-amber-500' : 'bg-brand-600'}" style="width:${pct}%"></div></div>
             <p class="text-sm mt-2 ${reached ? 'text-amber-600 font-semibold' : 'text-slate-500'}">${
               reached ? 'Target tercapai 🎉' : `${pct}% · kurang ${rp(target - net)}`
             }</p>`
          : `<p class="text-sm text-slate-500 mt-2">Atur target di tab Pengaturan.</p>`
      }
    </div>

    <div class="card">
      <p class="font-semibold mb-1">Catatan hari ini</p>
      ${
        state.todayTx.length
          ? `<ul class="divide-y divide-slate-100">${state.todayTx.map((t) => txRow(t)).join('')}</ul>`
          : `<p class="text-sm text-slate-500 py-6 text-center">Belum ada catatan. Tekan tombol + untuk mulai.</p>`
      }
    </div>`;
}

// ---------- Rekap ----------
async function loadRecap() {
  const from = toDateStr(state.weekStart);
  const to = toDateStr(addDays(state.weekStart, 6));
  state.weekTx = await api.listTx(from, to);
  renderRecap();
}

function renderRecap() {
  const start = state.weekStart;
  const end = addDays(start, 6);
  const isCurrent = toDateStr(start) === toDateStr(startOfWeek(new Date()));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const key = toDateStr(d);
    const list = state.weekTx.filter((t) => t.trx_date === key);
    return { d, key, list, ...totals(list) };
  });
  const week = totals(state.weekTx);
  const maxAbs = Math.max(1, ...days.map((x) => Math.abs(x.net)));
  const dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

  $('#hdr-sub').textContent = 'Rekap';
  $('#hdr-title').textContent = isCurrent ? 'Minggu ini' : `${fmtShort(start)} – ${fmtShort(end)}`;

  const bars = days
    .map((x, i) => {
      const h = Math.round((Math.abs(x.net) / maxAbs) * 100);
      const color = x.net < 0 ? 'bg-red-400' : x.key === todayStr() ? 'bg-amber-500' : 'bg-brand-600';
      return `<div class="flex-1 flex flex-col items-center gap-1 h-full">
        <div class="bar-col w-full flex-1"><div class="bar ${color}" style="height:${x.list.length ? Math.max(h, 4) : 0}%"></div></div>
        <span class="text-[11px] text-slate-500">${dayNames[i]}</span>
      </div>`;
    })
    .join('');

  const dayList = days
    .filter((x) => x.list.length)
    .reverse()
    .map(
      (x) => `
      <details class="py-3">
        <summary class="flex items-center justify-between cursor-pointer list-none">
          <span class="font-semibold">${esc(fmtDay(x.key))}</span>
          <span class="font-bold ${x.net < 0 ? 'text-red-600' : 'text-brand-700'}">${rp(x.net)}</span>
        </summary>
        <ul class="divide-y divide-slate-100 mt-1">${x.list.map((t) => txRow(t)).join('')}</ul>
      </details>`
    )
    .join('');

  $('#view-recap').innerHTML = `
    <div class="flex items-center justify-between">
      <button id="wk-prev" class="btn-ghost" aria-label="Minggu sebelumnya">←</button>
      <p class="text-sm font-medium text-slate-600">${fmtShort(start)} – ${fmtShort(end)}</p>
      <button id="wk-next" class="btn-ghost ${isCurrent ? 'opacity-40' : ''}" ${isCurrent ? 'disabled' : ''} aria-label="Minggu berikutnya">→</button>
    </div>

    <div class="card">
      <p class="text-sm text-slate-500">Bersih minggu ini</p>
      <p class="text-3xl font-extrabold ${week.net < 0 ? 'text-red-600' : 'text-slate-900'}">${rp(week.net)}</p>
      <div class="grid grid-cols-2 gap-3 mt-4 text-sm">
        <div class="rounded-xl bg-brand-50 p-3"><p class="text-brand-700">Pemasukan</p><p class="font-bold">${rp(week.income)}</p></div>
        <div class="rounded-xl bg-red-50 p-3"><p class="text-red-600">Pengeluaran</p><p class="font-bold">${rp(week.expense)}</p></div>
      </div>
    </div>

    <div class="card">
      <p class="font-semibold mb-3">Bersih per hari</p>
      <div class="flex gap-2 h-36 items-end">${bars}</div>
    </div>

    <div class="card">
      <p class="font-semibold">Rincian harian</p>
      ${
        dayList
          ? `<div class="divide-y divide-slate-100">${dayList}</div>`
          : `<p class="text-sm text-slate-500 py-6 text-center">Tidak ada catatan di minggu ini.</p>`
      }
    </div>`;

  $('#wk-prev').addEventListener('click', () => shiftWeek(-7));
  $('#wk-next').addEventListener('click', () => shiftWeek(7));
}

function shiftWeek(n) {
  state.weekStart = addDays(state.weekStart, n);
  loadRecap().catch((e) => toast(errText(e)));
}

// ---------- Pengaturan ----------
async function renderSettings() {
  $('#hdr-sub').textContent = 'Akun';
  $('#hdr-title').textContent = 'Pengaturan';
  try {
    state.target = await api.getTarget();
  } catch (e) {
    toast(errText(e));
  }
  $('#view-settings').innerHTML = `
    <form id="target-form" class="card space-y-3">
      <label for="target-input" class="font-semibold block">Target bersih harian (Rp)</label>
      <input id="target-input" class="field text-xl font-bold" inputmode="numeric" autocomplete="off" placeholder="0" value="${state.target ? state.target.toLocaleString('id-ID') : ''}" />
      <button class="btn-primary w-full" type="submit">Simpan target</button>
    </form>

    <div class="card space-y-3">
      <p class="text-sm text-slate-500">Masuk sebagai</p>
      <p class="font-semibold break-all">${esc(state.user?.email)}</p>
      <button id="logout" class="btn-ghost w-full text-red-600">Keluar</button>
    </div>`;

  const input = $('#target-input');
  input.addEventListener('input', () => (input.value = fmtThousands(input.value)));
  $('#target-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const v = Number(digitsOnly(input.value) || 0);
      await api.setTarget(state.user.id, v);
      state.target = v;
      toast('Target disimpan');
    } catch (err) {
      toast(errText(err));
    }
  });
  $('#logout').addEventListener('click', async () => {
    try {
      await api.signOut();
    } catch (err) {
      toast(errText(err));
    }
  });
}

// ---------- Hapus catatan (delegasi) ----------
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-del]');
  if (!btn) return;
  if (!confirm('Hapus catatan ini?')) return;
  try {
    await api.deleteTx(btn.dataset.del);
    toast('Catatan dihapus');
    refresh();
  } catch (err) {
    toast(errText(err));
  }
});

// ---------- Lembar tambah catatan ----------
function renderCats() {
  const cats = state.txType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  if (!cats.includes(state.txCat)) state.txCat = cats[0];
  $('#tx-cats').innerHTML = cats
    .map((c) => `<button type="button" data-cat="${esc(c)}" class="chip ${c === state.txCat ? 'active' : ''}">${esc(c)}</button>`)
    .join('');
}

function renderType() {
  $$('.type-btn').forEach((b) => {
    b.classList.remove('active-income', 'active-expense');
    if (b.dataset.type === state.txType) b.classList.add(`active-${state.txType}`);
  });
  renderCats();
}

function openSheet() {
  $('#tx-form').reset();
  $('#tx-date').value = todayStr();
  $('#tx-date').max = todayStr();
  $('#tx-msg').textContent = '';
  state.txType = 'income';
  state.txCat = '';
  renderType();
  $('#sheet').classList.remove('hidden');
  setTimeout(() => $('#tx-amount').focus(), 50);
}

function closeSheet() {
  $('#sheet').classList.add('hidden');
}

$('#fab').addEventListener('click', openSheet);
$('#sheet-close').addEventListener('click', closeSheet);
$('#sheet-backdrop').addEventListener('click', closeSheet);
$$('.type-btn').forEach((b) =>
  b.addEventListener('click', () => {
    state.txType = b.dataset.type;
    renderType();
  })
);
$('#tx-cats').addEventListener('click', (e) => {
  const c = e.target.closest('[data-cat]');
  if (!c) return;
  state.txCat = c.dataset.cat;
  renderCats();
});
$('#tx-amount').addEventListener('input', (e) => (e.target.value = fmtThousands(e.target.value)));

$('#tx-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#tx-msg');
  const amount = Number(digitsOnly($('#tx-amount').value) || 0);
  if (amount <= 0) {
    msg.textContent = 'Isi jumlah lebih dari 0.';
    return;
  }
  const btn = $('#tx-submit');
  btn.disabled = true;
  msg.textContent = '';
  try {
    await api.addTx({
      type: state.txType,
      amount,
      category: state.txCat,
      note: $('#tx-note').value.trim() || null,
      trx_date: $('#tx-date').value || todayStr(),
    });
    closeSheet();
    toast('Catatan disimpan');
    refresh();
  } catch (err) {
    msg.textContent = errText(err);
  } finally {
    btn.disabled = false;
  }
});

// ---------- Mulai ----------
async function onSession(session) {
  if (session?.user) {
    // Abaikan event ulang (refresh token, sesi awal) untuk pengguna yang sama
    if (state.user?.id === session.user.id) {
      state.user = session.user;
      return;
    }
    state.user = session.user;
    showApp();
    setTab(state.tab);
  } else {
    state.user = null;
    showAuth();
  }
}

api.onAuthChange((session) => {
  // Hindari memanggil Supabase langsung di dalam callback ini (bisa buntu)
  setTimeout(() => onSession(session), 0);
});

(async () => {
  try {
    onSession(await api.getSession());
  } catch {
    showAuth();
  }
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
