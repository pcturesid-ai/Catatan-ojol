import * as api from '../api.js';
import { WALLET_KINDS } from '../config.js';
import { $, openSheet, closeSheet, toast, errText, dataChanged, emptyState } from '../ui.js';
import { rp, esc, fmtThousands, numOf } from '../utils.js';

function openWalletForm(wallet) {
  const edit = !!wallet;
  let kind = wallet?.kind || 'cash';

  openSheet(
    `<form id="w-form" class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold">${edit ? 'Ubah dompet' : 'Tambah dompet'}</h2>
        <button type="button" id="w-close" class="text-slate-400 text-2xl leading-none px-2" aria-label="Tutup">×</button>
      </div>
      <div>
        <label for="w-name" class="block text-sm font-medium mb-1">Nama dompet</label>
        <input id="w-name" class="field" maxlength="40" required placeholder="Contoh: BCA, DANA, Dompet motor" value="${esc(wallet?.name || '')}" />
      </div>
      <div>
        <p class="text-sm font-medium mb-2">Jenis dompet</p>
        <div id="w-kinds" class="grid grid-cols-3 gap-2"></div>
      </div>
      <div>
        <label for="w-balance" class="block text-sm font-medium mb-1">Saldo aktual saat ini (Rp)</label>
        <input id="w-balance" class="field text-xl font-bold" inputmode="numeric" autocomplete="off" placeholder="0"
          value="${edit ? Number(wallet.balance).toLocaleString('id-ID') : ''}" />
        ${edit ? '<p class="text-xs text-slate-500 mt-1">Ubah angka ini bila saldo di aplikasi tidak sama dengan saldo sebenarnya. Riwayat transaksi tidak berubah.</p>' : ''}
      </div>
      <p id="w-msg" class="text-sm text-red-600 min-h-[1.25rem]" role="alert"></p>
      <div class="${edit ? 'grid grid-cols-3 gap-3' : ''}">
        ${edit ? '<button type="button" id="w-del" class="btn-ghost text-red-600">Hapus</button>' : ''}
        <button class="btn-primary ${edit ? 'col-span-2' : 'w-full'}" type="submit">Simpan dompet</button>
      </div>
    </form>`,
    (root) => {
      const drawKinds = () => {
        $('#w-kinds', root).innerHTML = Object.entries(WALLET_KINDS)
          .map(
            ([k, v]) =>
              `<button type="button" data-kind="${k}" class="chip !rounded-xl !py-3 ${k === kind ? 'active' : ''}">${v.icon}<br>${v.label}</button>`
          )
          .join('');
      };
      drawKinds();
      $('#w-kinds', root).addEventListener('click', (e) => {
        const b = e.target.closest('[data-kind]');
        if (!b) return;
        kind = b.dataset.kind;
        drawKinds();
      });
      const bal = $('#w-balance', root);
      bal.addEventListener('input', () => (bal.value = fmtThousands(bal.value)));
      $('#w-close', root).onclick = closeSheet;

      if (edit)
        $('#w-del', root).onclick = async () => {
          if (!confirm(`Hapus dompet "${wallet.name}"?`)) return;
          try {
            await api.deleteWallet(wallet.id);
            closeSheet();
            toast('Dompet dihapus');
            dataChanged();
          } catch (err) {
            $('#w-msg', root).textContent = /foreign key/i.test(err.message || '')
              ? 'Dompet ini masih punya transaksi, jadi tidak bisa dihapus.'
              : errText(err);
          }
        };

      $('#w-form', root).addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = $('#w-name', root).value.trim();
        if (!name) return;
        const entered = numOf(bal.value);
        try {
          if (edit) {
            // Saldo = saldo awal + mutasi. Sesuaikan saldo awal agar hasilnya sama dengan angka yang diisi.
            const mutations = Number(wallet.balance) - Number(wallet.initial_balance);
            await api.updateWallet(wallet.id, { name, kind, initial_balance: entered - mutations });
          } else {
            await api.addWallet({ name, kind, initial_balance: entered });
          }
          closeSheet();
          toast('Dompet disimpan');
          dataChanged();
        } catch (err) {
          $('#w-msg', root).textContent = errText(err);
        }
      });
    }
  );
}

export async function render({ el, setHeader }) {
  setHeader({ sub: 'Akun', title: 'Dompet & saldo', back: true });
  const wallets = await api.listWallets();
  const total = wallets.reduce((a, w) => a + Number(w.balance), 0);

  el.innerHTML = `
    <div class="card">
      <p class="text-sm text-slate-500">Total uang cair</p>
      <p class="text-3xl font-extrabold ${total < 0 ? 'text-red-600' : ''}">${rp(total)}</p>
    </div>
    <div class="card">
      ${
        wallets.length
          ? wallets
              .map(
                (w) => `<button data-w="${esc(w.id)}" class="menu-row">
                  <span class="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-xl">${WALLET_KINDS[w.kind]?.icon || '💼'}</span>
                  <span class="flex-1 min-w-0"><span class="block truncate">${esc(w.name)}</span><span class="block text-xs text-slate-500 font-normal">${WALLET_KINDS[w.kind]?.label || ''}</span></span>
                  <span class="font-bold ${w.balance < 0 ? 'text-red-600' : ''}">${rp(w.balance)}</span>
                </button>`
              )
              .join('')
          : emptyState('Belum ada dompet.')
      }
    </div>
    <button id="w-add" class="btn-primary w-full">+ Tambah dompet</button>`;

  const byId = new Map(wallets.map((w) => [w.id, w]));
  el.querySelectorAll('[data-w]').forEach((b) => b.addEventListener('click', () => openWalletForm(byId.get(b.dataset.w))));
  el.querySelector('#w-add').addEventListener('click', () => openWalletForm(null));
}
