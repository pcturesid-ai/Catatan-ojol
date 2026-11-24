import * as api from './api.js';
import { SERVICES } from './config.js';
import { $, $$, openSheet, closeSheet, toast, errText, dataChanged, navigate, chip, esc } from './ui.js';
import { todayStr, nowTime, fmtThousands, numOf, safeStore, rp } from './utils.js';

const TYPE_LABEL = { income: 'Pemasukan', expense: 'Pengeluaran', transfer: 'Transfer' };

// Buka form catat (tx = null) atau ubah (tx = baris transaksi)
export async function openTxForm({ type = 'income', tx = null } = {}) {
  let wallets, categories, areas;
  try {
    [wallets, categories, areas] = await Promise.all([api.listWallets(), api.listCategories(), api.listAreas()]);
  } catch (e) {
    toast(errText(e));
    return;
  }

  // Transaksi dari layar Target tidak diubah di sini, hanya boleh dihapus
  if (tx && (tx.type === 'target_deposit' || tx.type === 'target_withdraw')) {
    openSheet(
      `<h2 class="text-lg font-bold mb-2">${tx.type === 'target_deposit' ? 'Setoran target' : 'Pencairan target'}</h2>
       <p class="text-2xl font-extrabold">${rp(tx.amount)}</p>
       <p class="text-sm text-slate-500 mt-2">Untuk mengubah setoran atau pencairan target, hapus catatan ini lalu buat ulang dari layar Target.</p>
       <div class="grid grid-cols-2 gap-3 mt-5">
         <button id="tx-cancel" class="btn-ghost">Tutup</button>
         <button id="tx-del" class="btn-ghost text-red-600">Hapus</button>
       </div>`,
      (root) => {
        $('#tx-cancel', root).onclick = closeSheet;
        $('#tx-del', root).onclick = () => removeTx(tx);
      }
    );
    return;
  }

  const lastWallet = safeStore.get('lastWallet');
  const st = {
    type: tx ? tx.type : type,
    service: tx?.service || '',
    categoryId: tx?.category_id || '',
    walletId: tx?.wallet_id || (wallets.find((w) => w.id === lastWallet) || wallets[0])?.id || '',
    toWalletId: tx?.to_wallet_id || '',
  };

  const walletOptions = (selected, exclude) =>
    wallets
      .filter((w) => w.id !== exclude)
      .map((w) => `<option value="${w.id}" ${w.id === selected ? 'selected' : ''}>${esc(w.name)} · ${rp(w.balance)}</option>`)
      .join('');

  const html = `
  <form id="tx-form" class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold">${tx ? 'Ubah transaksi' : 'Catat transaksi'}</h2>
      <button type="button" id="tx-close" class="text-slate-400 text-2xl leading-none px-2" aria-label="Tutup">×</button>
    </div>

    <div class="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl" id="tx-types">
      ${Object.entries(TYPE_LABEL)
        .map(([k, v]) => `<button type="button" data-type="${k}" class="type-btn text-sm">${v}</button>`)
        .join('')}
    </div>

    <div>
      <label for="tx-amount" class="block text-sm font-medium mb-1">Nominal (Rp)</label>
      <input id="tx-amount" type="text" inputmode="numeric" autocomplete="off" class="field text-2xl font-bold" placeholder="0"
        value="${tx ? Number(tx.amount).toLocaleString('id-ID') : ''}" />
    </div>

    <div id="grp-service">
      <p class="text-sm font-medium mb-2">Layanan Grab <span class="text-slate-400 font-normal">(ketuk untuk isi otomatis)</span></p>
      <div id="tx-services" class="flex flex-wrap gap-2"></div>
    </div>

    <div id="grp-pickup">
      <label for="tx-pickup" class="block text-sm font-medium mb-1">Area / lokasi jemput <span class="text-slate-400 font-normal">(opsional)</span></label>
      <input id="tx-pickup" list="tx-pickup-list" class="field" maxlength="80" placeholder="Contoh: Stasiun, Mall, Kampus" value="${esc(tx?.pickup_area || '')}" />
      <datalist id="tx-pickup-list">
        ${areas.flatMap((a) => [a.name, ...a.spots.map((s) => s.name)]).map((n) => `<option value="${esc(n)}"></option>`).join('')}
      </datalist>
      <button type="button" id="tx-manage-places" class="text-sm text-brand-700 font-medium mt-1">+ Kelola lokasi</button>
    </div>

    <div>
      <label for="tx-note" class="block text-sm font-medium mb-1">Keterangan</label>
      <input id="tx-note" class="field" maxlength="200" placeholder="Opsional" value="${esc(tx?.note || '')}" />
    </div>

    <div>
      <label for="tx-wallet" id="lbl-wallet" class="block text-sm font-medium mb-1">Dompet</label>
      <select id="tx-wallet" class="field">${walletOptions(st.walletId)}</select>
    </div>

    <div id="grp-category">
      <label for="tx-category" class="block text-sm font-medium mb-1">Kategori</label>
      <select id="tx-category" class="field"></select>
    </div>

    <div id="grp-towallet">
      <label for="tx-towallet" class="block text-sm font-medium mb-1">Dompet tujuan</label>
      <select id="tx-towallet" class="field"></select>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <label for="tx-date" class="block text-sm font-medium mb-1">Tanggal</label>
        <input id="tx-date" type="date" class="field" max="${todayStr()}" value="${tx?.trx_date || todayStr()}" />
      </div>
      <div>
        <label for="tx-time" class="block text-sm font-medium mb-1">Waktu</label>
        <input id="tx-time" type="time" class="field" value="${tx ? String(tx.trx_time).slice(0, 5) : nowTime()}" />
      </div>
    </div>

    <p id="tx-msg" class="text-sm text-red-600 min-h-[1.25rem]" role="alert"></p>
    <div class="${tx ? 'grid grid-cols-3 gap-3' : ''}">
      ${tx ? '<button type="button" id="tx-del" class="btn-ghost text-red-600">Hapus</button>' : ''}
      <button id="tx-submit" type="submit" class="btn-primary ${tx ? 'col-span-2' : 'w-full'}">${tx ? 'Simpan perubahan' : 'Simpan transaksi'}</button>
    </div>
  </form>`;

  openSheet(html, (root) => {
    const amount = $('#tx-amount', root);
    amount.addEventListener('input', () => (amount.value = fmtThousands(amount.value)));

    const renderServices = () => {
      $('#tx-services', root).innerHTML = SERVICES.map((s) =>
        chip(`${s.icon} ${s.name}`, st.service === s.name, `data-service="${esc(s.name)}"`)
      ).join('');
    };

    const renderCategories = () => {
      const list = categories.filter((c) => c.type === st.type);
      if (!list.some((c) => c.id === st.categoryId)) st.categoryId = list[0]?.id || '';
      $('#tx-category', root).innerHTML = list.length
        ? list.map((c) => `<option value="${c.id}" ${c.id === st.categoryId ? 'selected' : ''}>${esc(c.icon)} ${esc(c.name)}</option>`).join('')
        : '<option value="">Belum ada kategori</option>';
    };

    const renderToWallet = () => {
      const from = $('#tx-wallet', root).value;
      const options = wallets.filter((w) => w.id !== from);
      if (!options.some((w) => w.id === st.toWalletId)) st.toWalletId = options[0]?.id || '';
      $('#tx-towallet', root).innerHTML = walletOptions(st.toWalletId, from);
    };

    const renderType = () => {
      $$('.type-btn', root).forEach((b) => {
        b.classList.remove('active-income', 'active-expense', 'active-transfer');
        if (b.dataset.type === st.type) b.classList.add(`active-${st.type}`);
      });
      const isIncome = st.type === 'income';
      const isTransfer = st.type === 'transfer';
      $('#grp-service', root).classList.toggle('hidden', !isIncome);
      $('#grp-pickup', root).classList.toggle('hidden', !isIncome);
      $('#grp-category', root).classList.toggle('hidden', isTransfer);
      $('#grp-towallet', root).classList.toggle('hidden', !isTransfer);
      $('#lbl-wallet', root).textContent = isTransfer ? 'Dari dompet' : isIncome ? 'Masuk ke dompet' : 'Bayar dari dompet';
      renderCategories();
      renderToWallet();
    };

    $('#tx-types', root).addEventListener('click', (e) => {
      const b = e.target.closest('[data-type]');
      if (!b) return;
      st.type = b.dataset.type;
      renderType();
    });

    $('#tx-services', root).addEventListener('click', (e) => {
      const b = e.target.closest('[data-service]');
      if (!b) return;
      st.service = st.service === b.dataset.service ? '' : b.dataset.service;
      renderServices();
      if (st.service) {
        const order = categories.find((c) => c.type === 'income' && c.name.toLowerCase() === 'order');
        if (order) {
          st.categoryId = order.id;
          renderCategories();
        }
        const note = $('#tx-note', root);
        if (!note.value.trim()) note.value = st.service;
      }
    });

    $('#tx-category', root).addEventListener('change', (e) => (st.categoryId = e.target.value));
    $('#tx-towallet', root).addEventListener('change', (e) => (st.toWalletId = e.target.value));
    $('#tx-wallet', root).addEventListener('change', () => renderToWallet());
    $('#tx-close', root).onclick = closeSheet;
    $('#tx-manage-places', root).onclick = () => {
      closeSheet();
      navigate('places');
    };
    if (tx) $('#tx-del', root).onclick = () => removeTx(tx);

    $('#tx-form', root).addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = $('#tx-msg', root);
      const amountVal = numOf(amount.value);
      const walletId = $('#tx-wallet', root).value;
      if (amountVal <= 0) return void (msg.textContent = 'Isi nominal lebih dari 0.');
      if (!walletId) return void (msg.textContent = 'Pilih dompet dulu.');

      const isTransfer = st.type === 'transfer';
      const isIncome = st.type === 'income';
      const cat = categories.find((c) => c.id === st.categoryId);
      if (!isTransfer && !cat) return void (msg.textContent = 'Pilih kategori. Tambah di menu Akun > Kategori bila kosong.');
      if (isTransfer && !st.toWalletId) return void (msg.textContent = 'Pilih dompet tujuan.');

      const row = {
        type: st.type,
        amount: amountVal,
        wallet_id: walletId,
        to_wallet_id: isTransfer ? st.toWalletId : null,
        category_id: isTransfer ? null : cat.id,
        category: isTransfer ? 'Transfer' : cat.name,
        note: $('#tx-note', root).value.trim() || null,
        service: isIncome && st.service ? st.service : null,
        pickup_area: isIncome ? $('#tx-pickup', root).value.trim() || null : null,
        trx_date: $('#tx-date', root).value || todayStr(),
        trx_time: $('#tx-time', root).value || nowTime(),
      };

      const btn = $('#tx-submit', root);
      btn.disabled = true;
      msg.textContent = '';
      try {
        if (tx) await api.updateTx(tx.id, row);
        else await api.addTx(row);
        safeStore.set('lastWallet', walletId);
        closeSheet();
        toast(tx ? 'Perubahan disimpan' : 'Transaksi disimpan');
        dataChanged();
      } catch (err) {
        msg.textContent = errText(err);
        btn.disabled = false;
      }
    });

    renderServices();
    renderType();
    setTimeout(() => !tx && amount.focus(), 60);
  });
}

async function removeTx(tx) {
  if (!confirm('Hapus transaksi ini? Saldo dompet akan dihitung ulang.')) return;
  try {
    await api.deleteTx(tx.id);
    closeSheet();
    toast('Transaksi dihapus');
    dataChanged();
  } catch (err) {
    toast(errText(err));
  }
}
