import * as api from '../api.js';
import { navigate, toast, errText } from '../ui.js';
import { esc, fmtThousands, numOf, rp, todayStr } from '../utils.js';

const MENU = [
  ['wallets', '👛', 'Dompet & saldo', 'Tunai, bank, e-wallet'],
  ['categories', '🏷️', 'Kategori & plafon', 'Atur batas anggaran bulanan'],
  ['targets', '🎯', 'Target keuangan', 'Tabungan dan investasi'],
  ['places', '📡', 'Lokasi & radar mangkal', 'Daerah, titik jemput, jam ramai'],
  ['vehicle', '🛵', 'Monitor kendaraan', 'KM harian dan ganti oli'],
];

export async function render({ el, user, setHeader }) {
  const name = user?.user_metadata?.full_name || 'Pengguna';
  setHeader({ sub: 'Profil & pengaturan', title: name });

  const target = await api.getDailyTarget();

  el.innerHTML = `
    <div class="card flex items-center gap-3">
      <div class="w-12 h-12 rounded-full bg-brand-700 text-white flex items-center justify-center text-xl font-bold">${esc(name.charAt(0).toUpperCase())}</div>
      <div class="min-w-0">
        <p class="font-semibold truncate">${esc(name)}</p>
        <p class="text-sm text-slate-500 truncate">${esc(user?.email)}</p>
      </div>
    </div>

    <div class="card">
      <p class="font-semibold mb-1">Pencatatan</p>
      ${MENU.map(
        ([k, icon, title, sub]) => `<button data-go="${k}" class="menu-row">
          <span class="text-xl w-8 text-center">${icon}</span>
          <span class="flex-1 min-w-0"><span class="block">${title}</span><span class="block text-xs text-slate-500 font-normal">${sub}</span></span>
          <span class="text-slate-300">›</span>
        </button>`
      ).join('')}
    </div>

    <form id="daily-form" class="card space-y-3">
      <label for="daily-input" class="font-semibold block">Target bersih harian (Rp)</label>
      <input id="daily-input" class="field text-xl font-bold" inputmode="numeric" autocomplete="off" placeholder="0" value="${target ? target.toLocaleString('id-ID') : ''}" />
      <button class="btn-primary w-full" type="submit">Simpan target harian</button>
    </form>

    <div class="card">
      <p class="font-semibold mb-1">Umum</p>
      <button id="export" class="menu-row"><span class="text-xl w-8 text-center">⬇️</span><span class="flex-1">Ekspor data (cadangan JSON)</span></button>
      <button id="logout" class="menu-row text-red-600"><span class="text-xl w-8 text-center">🚪</span><span class="flex-1">Keluar akun</span></button>
    </div>`;

  el.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.go)));

  const input = el.querySelector('#daily-input');
  input.addEventListener('input', () => (input.value = fmtThousands(input.value)));
  el.querySelector('#daily-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.setDailyTarget(numOf(input.value));
      toast('Target harian disimpan');
    } catch (err) {
      toast(errText(err));
    }
  });

  el.querySelector('#export').addEventListener('click', async () => {
    try {
      toast('Menyiapkan cadangan...');
      const data = await api.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `catatan-ojol-${todayStr()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast(`Cadangan berisi ${data.transactions.length} transaksi diunduh`);
    } catch (err) {
      toast(errText(err));
    }
  });

  el.querySelector('#logout').addEventListener('click', async () => {
    try {
      await api.signOut();
    } catch (err) {
      toast(errText(err));
    }
  });
}
