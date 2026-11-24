import * as api from '../api.js';
import { $, openSheet, closeSheet, toast, errText, dataChanged, emptyState, progressBar, chip } from '../ui.js';
import { rp, esc, fmtThousands, numOf, pct, todayStr, nowTime, parseDate, fmtDayShort } from '../utils.js';
import { assetValue } from './home.js';

let filter = 'all';

const KIND_LABEL = { savings: '🐷 Tabungan', investment: '📈 Investasi' };

function openTargetForm(target) {
  const edit = !!target;
  let kind = target?.kind || 'savings';

  openSheet(
    `<form id="t-form" class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold">${edit ? 'Ubah target' : 'Buat target baru'}</h2>
        <button type="button" id="t-close" class="text-slate-400 text-2xl leading-none px-2" aria-label="Tutup">×</button>
      </div>
      ${
        edit
          ? ''
          : `<div class="grid grid-cols-2 gap-2" id="t-kinds">
              <button type="button" data-kind="savings" class="chip !rounded-xl !py-3">🐷<br>Tabungan biasa</button>
              <button type="button" data-kind="investment" class="chip !rounded-xl !py-3">📈<br>Aset investasi</button>
            </div>`
      }
      <div>
        <label for="t-name" class="block text-sm font-medium mb-1">Nama target / impian</label>
        <input id="t-name" class="field" maxlength="60" required placeholder="Contoh: Ganti motor, Dana darurat" value="${esc(target?.name || '')}" />
      </div>
      <div>
        <label for="t-goal" class="block text-sm font-medium mb-1">Nominal yang ingin dicapai (Rp)</label>
        <input id="t-goal" class="field" inputmode="numeric" autocomplete="off" placeholder="0" value="${target?.goal_amount ? Number(target.goal_amount).toLocaleString('id-ID') : ''}" />
      </div>
      <div>
        <label for="t-initial" class="block text-sm font-medium mb-1">Sudah terkumpul saat ini (Rp)</label>
        <input id="t-initial" class="field" inputmode="numeric" autocomplete="off" placeholder="0" value="${target?.initial_amount ? Number(target.initial_amount).toLocaleString('id-ID') : ''}" />
        <p class="text-xs text-slate-500 mt-1">Dana yang sudah ada sebelum kamu mulai mencatat setoran di aplikasi ini.</p>
      </div>
      <div id="t-market-wrap">
        <label for="t-market" class="block text-sm font-medium mb-1">Nilai portofolio terkini (Rp)</label>
        <input id="t-market" class="field" inputmode="numeric" autocomplete="off" placeholder="Kosongkan bila sama dengan modal" value="${target?.market_value != null ? Number(target.market_value).toLocaleString('id-ID') : ''}" />
      </div>
      <div>
        <label for="t-deadline" class="block text-sm font-medium mb-1">Tenggat waktu <span class="text-slate-400 font-normal">(opsional)</span></label>
        <input id="t-deadline" type="date" class="field" value="${target?.deadline || ''}" />
      </div>
      <p id="t-msg" class="text-sm text-red-600 min-h-[1.25rem]" role="alert"></p>
      <div class="${edit ? 'grid grid-cols-3 gap-3' : ''}">
        ${edit ? '<button type="button" id="t-del" class="btn-ghost text-red-600">Hapus</button>' : ''}
        <button class="btn-primary ${edit ? 'col-span-2' : 'w-full'}" type="submit">Simpan target</button>
      </div>
    </form>`,
    (root) => {
      ['#t-goal', '#t-initial', '#t-market'].forEach((s) => {
        const i = $(s, root);
        i.addEventListener('input', () => (i.value = fmtThousands(i.value)));
      });
      const drawKind = () => {
        root.querySelectorAll('#t-kinds [data-kind]').forEach((b) => b.classList.toggle('active', b.dataset.kind === kind));
        $('#t-market-wrap', root).classList.toggle('hidden', kind !== 'investment');
      };
      drawKind();
      root.querySelector('#t-kinds')?.addEventListener('click', (e) => {
        const b = e.target.closest('[data-kind]');
        if (!b) return;
        kind = b.dataset.kind;
        drawKind();
      });
      $('#t-close', root).onclick = closeSheet;

      if (edit)
        $('#t-del', root).onclick = async () => {
          if (!confirm(`Hapus target "${target.name}"?`)) return;
          try {
            await api.deleteTarget(target.id);
            closeSheet();
            toast('Target dihapus');
            dataChanged();
          } catch (err) {
            $('#t-msg', root).textContent = /foreign key/i.test(err.message || '')
              ? 'Target ini punya riwayat setoran. Cairkan semua dananya dan hapus catatan setorannya dulu.'
              : errText(err);
          }
        };

      $('#t-form', root).addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = $('#t-name', root).value.trim();
        if (!name) return;
        const market = numOf($('#t-market', root).value);
        const row = {
          name,
          goal_amount: numOf($('#t-goal', root).value),
          initial_amount: numOf($('#t-initial', root).value),
          deadline: $('#t-deadline', root).value || null,
          market_value: kind === 'investment' && $('#t-market', root).value.trim() ? market : null,
        };
        try {
          if (edit) await api.updateTarget(target.id, row);
          else await api.addTarget({ ...row, kind });
          closeSheet();
          toast('Target disimpan');
          dataChanged();
        } catch (err) {
          $('#t-msg', root).textContent = errText(err);
        }
      });
    }
  );
}

// Setor ke target (deposit) atau cairkan (withdraw)
async function openMoveForm(target, mode, wallets) {
  const deposit = mode === 'deposit';
  const options = wallets.map((w) => `<option value="${w.id}">${esc(w.name)} · ${rp(w.balance)}</option>`).join('');

  openSheet(
    `<form id="m-form" class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold">${deposit ? 'Setor ke target 🎯' : 'Cairkan dari target 💸'}</h2>
        <button type="button" id="m-close" class="text-slate-400 text-2xl leading-none px-2" aria-label="Tutup">×</button>
      </div>
      <p class="text-sm text-slate-500">${esc(target.name)} · terkumpul ${rp(target.saved_amount)}</p>
      <div>
        <label for="m-amount" class="block text-sm font-medium mb-1">Nominal (Rp)</label>
        <input id="m-amount" class="field text-2xl font-bold" inputmode="numeric" autocomplete="off" placeholder="0" />
      </div>
      <div>
        <label for="m-wallet" class="block text-sm font-medium mb-1">${deposit ? 'Ambil dana dari dompet' : 'Masukkan ke dompet'}</label>
        <select id="m-wallet" class="field">${options}</select>
      </div>
      <p id="m-msg" class="text-sm text-red-600 min-h-[1.25rem]" role="alert"></p>
      <button class="btn-primary w-full" type="submit">${deposit ? 'Konfirmasi setoran' : 'Cairkan ke dompet'}</button>
    </form>`,
    (root) => {
      const amount = $('#m-amount', root);
      amount.addEventListener('input', () => (amount.value = fmtThousands(amount.value)));
      $('#m-close', root).onclick = closeSheet;
      setTimeout(() => amount.focus(), 60);

      $('#m-form', root).addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = $('#m-msg', root);
        const value = numOf(amount.value);
        const wallet = wallets.find((w) => w.id === $('#m-wallet', root).value);
        if (value <= 0) return void (msg.textContent = 'Isi nominal lebih dari 0.');
        if (!wallet) return void (msg.textContent = 'Pilih dompet dulu.');
        if (deposit && value > Number(wallet.balance)) return void (msg.textContent = `Saldo ${wallet.name} tidak cukup.`);
        if (!deposit && value > Number(target.saved_amount)) return void (msg.textContent = 'Nominal melebihi dana yang terkumpul.');
        try {
          await api.addTx({
            type: deposit ? 'target_deposit' : 'target_withdraw',
            amount: value,
            wallet_id: wallet.id,
            target_id: target.id,
            category: deposit ? 'Setoran target' : 'Pencairan target',
            note: target.name,
            trx_date: todayStr(),
            trx_time: nowTime(),
          });
          closeSheet();
          toast(deposit ? 'Setoran dicatat' : 'Dana dicairkan');
          dataChanged();
        } catch (err) {
          msg.textContent = errText(err);
        }
      });
    }
  );
}

function openValueForm(target) {
  openSheet(
    `<form id="v-form" class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold">Update nilai pasar 📈</h2>
        <button type="button" id="v-close" class="text-slate-400 text-2xl leading-none px-2" aria-label="Tutup">×</button>
      </div>
      <p class="text-sm text-slate-500">${esc(target.name)} · modal ${rp(target.saved_amount)}</p>
      <div>
        <label for="v-amount" class="block text-sm font-medium mb-1">Nilai portofolio terkini (Rp)</label>
        <input id="v-amount" class="field text-2xl font-bold" inputmode="numeric" autocomplete="off" placeholder="0"
          value="${target.market_value != null ? Number(target.market_value).toLocaleString('id-ID') : ''}" />
      </div>
      <button class="btn-primary w-full" type="submit">Simpan nilai terkini</button>
    </form>`,
    (root) => {
      const amount = $('#v-amount', root);
      amount.addEventListener('input', () => (amount.value = fmtThousands(amount.value)));
      $('#v-close', root).onclick = closeSheet;
      $('#v-form', root).addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await api.updateTarget(target.id, { market_value: numOf(amount.value) });
          closeSheet();
          toast('Nilai diperbarui');
          dataChanged();
        } catch (err) {
          toast(errText(err));
        }
      });
    }
  );
}

export async function render({ el, setHeader }) {
  setHeader({ sub: 'Akun', title: 'Target keuangan', back: true });
  const [targets, wallets] = await Promise.all([api.listTargets(), api.listWallets()]);

  const total = targets.reduce((a, t) => a + assetValue(t), 0);
  const savings = targets.filter((t) => t.kind === 'savings').reduce((a, t) => a + assetValue(t), 0);
  const invest = targets.filter((t) => t.kind === 'investment').reduce((a, t) => a + assetValue(t), 0);
  const goalSum = targets.reduce((a, t) => a + Number(t.goal_amount), 0);

  // Alokasi harian: sisa target dibagi hari menuju tenggat (hanya target yang punya tenggat di masa depan)
  const today = parseDate(todayStr());
  const daily = targets.reduce((a, t) => {
    if (!t.deadline || !Number(t.goal_amount)) return a;
    const days = Math.ceil((parseDate(t.deadline) - today) / 864e5);
    const remain = Number(t.goal_amount) - assetValue(t);
    return days > 0 && remain > 0 ? a + remain / days : a;
  }, 0);

  const shown = targets.filter((t) => filter === 'all' || t.kind === filter);

  const card = (t) => {
    const value = assetValue(t);
    const goal = Number(t.goal_amount);
    const p = pct(value, goal);
    const inv = t.kind === 'investment';
    const gain = inv && t.market_value != null ? Number(t.market_value) - Number(t.saved_amount) : null;
    return `<div class="card space-y-3">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="text-xs text-slate-500">${KIND_LABEL[t.kind]}</p>
          <p class="font-semibold truncate">${esc(t.name)}</p>
        </div>
        <button data-edit="${esc(t.id)}" class="text-slate-400 text-sm px-2 py-1">Ubah</button>
      </div>
      <div>
        <p class="text-2xl font-extrabold">${rp(value)}</p>
        <p class="text-xs text-slate-500">${goal ? `dari ${rp(goal)}` : 'Tanpa nominal target'}${t.deadline ? ` · tenggat ${esc(fmtDayShort(t.deadline))}` : ''}</p>
      </div>
      ${
        goal
          ? `<div>${progressBar(p, p >= 100 ? 'bg-amber-500' : 'bg-brand-600')}<p class="text-xs text-slate-500 mt-1">${p >= 100 ? 'Target tercapai 🎉' : `${p}% tercapai`}</p></div>`
          : ''
      }
      ${
        inv
          ? `<div class="grid grid-cols-2 gap-3 text-sm">
              <div class="rounded-xl bg-slate-50 p-3"><p class="text-xs text-slate-500">Modal</p><p class="font-bold">${rp(t.saved_amount)}</p></div>
              <div class="rounded-xl ${gain == null ? 'bg-slate-50' : gain >= 0 ? 'bg-brand-50' : 'bg-red-50'} p-3"><p class="text-xs text-slate-500">Untung/rugi</p><p class="font-bold ${gain != null && gain < 0 ? 'text-red-600' : ''}">${gain == null ? '-' : rp(gain)}</p></div>
            </div>`
          : ''
      }
      <div class="grid ${inv ? 'grid-cols-3' : 'grid-cols-2'} gap-2">
        <button data-deposit="${esc(t.id)}" class="btn-primary !py-2 text-sm">Setor</button>
        <button data-withdraw="${esc(t.id)}" class="btn-ghost !py-2 text-sm">Cairkan</button>
        ${inv ? `<button data-value="${esc(t.id)}" class="btn-ghost !py-2 text-sm">Nilai</button>` : ''}
      </div>
    </div>`;
  };

  el.innerHTML = `
    <div class="card">
      <p class="text-sm text-slate-500">Total aset & tabungan</p>
      <p class="text-3xl font-extrabold">${rp(total)}</p>
      <p class="text-xs text-slate-500">${targets.length} target${daily ? ` · alokasi ${rp(daily)}/hari menuju tenggat` : ''}</p>
      <div class="grid grid-cols-2 gap-3 mt-4 text-sm">
        <div class="rounded-xl bg-slate-50 p-3"><p class="text-xs text-slate-500">🐷 Tabungan</p><p class="font-bold">${rp(savings)}</p></div>
        <div class="rounded-xl bg-slate-50 p-3"><p class="text-xs text-slate-500">📈 Nilai investasi</p><p class="font-bold">${rp(invest)}</p></div>
      </div>
      ${goalSum ? `<div class="mt-4">${progressBar(pct(total, goalSum))}<p class="text-xs text-slate-500 mt-1">${pct(total, goalSum)}% dari seluruh target</p></div>` : ''}
    </div>

    <div class="flex gap-2" id="t-filters">
      ${[['all', '📚 Semua'], ['savings', '🐷 Tabungan'], ['investment', '📈 Investasi']].map(([k, l]) => chip(l, filter === k, `data-filter="${k}"`)).join('')}
    </div>

    ${shown.length ? shown.map(card).join('') : `<div class="card">${emptyState('Belum ada target. Buat target pertamamu.')}</div>`}

    <button id="t-add" class="btn-primary w-full">+ Buat target baru</button>`;

  const byId = new Map(targets.map((t) => [t.id, t]));
  const hook = (attr, fn) => el.querySelectorAll(`[${attr}]`).forEach((b) => b.addEventListener('click', () => fn(byId.get(b.getAttribute(attr)))));
  hook('data-edit', openTargetForm);
  hook('data-deposit', (t) => openMoveForm(t, 'deposit', wallets));
  hook('data-withdraw', (t) => openMoveForm(t, 'withdraw', wallets));
  hook('data-value', openValueForm);
  el.querySelector('#t-add').addEventListener('click', () => openTargetForm(null));
  el.querySelector('#t-filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    filter = b.dataset.filter;
    dataChanged();
  });
}
