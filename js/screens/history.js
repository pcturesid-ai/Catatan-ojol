import * as api from '../api.js';
import { openTxForm } from '../txform.js';
import { toast, errText, chip, emptyState } from '../ui.js';
import { rp, esc, periodRange, totals, groupBy, fmtDay } from '../utils.js';
import { txRow, walletNameMap, bindTxRows, statCard } from './shared.js';

const PERIODS = [
  ['all', 'Semua'],
  ['today', 'Hari ini'],
  ['week', 'Minggu ini'],
  ['month', 'Bulan ini'],
];
const TYPES = [
  ['all', 'Semua jenis'],
  ['income', 'Pemasukan'],
  ['expense', 'Pengeluaran'],
  ['transfer', 'Transfer'],
  ['target', 'Target'],
];

// Filter diingat selama aplikasi terbuka
const f = { period: 'month', type: 'all', q: '', limit: 50 };
let data = [];
let wmap = new Map();

const typesFor = (t) =>
  t === 'all' ? undefined : t === 'target' ? ['target_deposit', 'target_withdraw'] : [t];

async function load() {
  const range = periodRange(f.period);
  const [rows, wallets] = await Promise.all([
    api.listTx({ from: range?.from, to: range?.to, types: typesFor(f.type) }),
    api.listWallets(),
  ]);
  data = rows;
  wmap = walletNameMap(wallets);
}

const visible = () => {
  const q = f.q.trim().toLowerCase();
  if (!q) return data;
  return data.filter((t) =>
    [t.category, t.note, t.service, t.pickup_area, wmap.get(t.wallet_id), wmap.get(t.to_wallet_id)]
      .filter(Boolean)
      .some((s) => String(s).toLowerCase().includes(q))
  );
};

function drawList(root) {
  const list = visible();
  const sum = totals(list);
  const shown = list.slice(0, f.limit);
  const groups = groupBy(shown, (t) => t.trx_date);

  root.querySelector('#hist-summary').innerHTML = `
    <div class="grid grid-cols-2 gap-3">
      ${statCard('Total masuk', rp(sum.income), 'in')}
      ${statCard('Total keluar', rp(sum.expense), 'out')}
    </div>
    <p class="text-xs text-slate-500 mt-2">${list.length} transaksi</p>`;

  root.querySelector('#hist-list').innerHTML = shown.length
    ? [...groups.entries()]
        .map(([date, rows]) => {
          const d = totals(rows);
          return `<div>
            <div class="flex justify-between text-xs font-semibold text-slate-500 px-1 pt-3 pb-1">
              <span>${esc(fmtDay(date))}</span><span>${rp(d.net)}</span>
            </div>
            <ul class="card !py-0 divide-y divide-slate-100">${rows.map((t) => txRow(t, wmap)).join('')}</ul>
          </div>`;
        })
        .join('') +
      (list.length > shown.length
        ? `<button id="hist-more" class="btn-ghost w-full mt-3">Muat lebih banyak (${list.length - shown.length} lagi)</button>`
        : '')
    : `<div class="card">${emptyState('Tidak ada transaksi untuk filter ini.')}</div>`;

  bindTxRows(root, shown, (t) => openTxForm({ tx: t }));
  const more = root.querySelector('#hist-more');
  if (more)
    more.onclick = () => {
      f.limit += 50;
      drawList(root);
    };
}

function drawControls(root) {
  root.querySelector('#hist-periods').innerHTML = PERIODS.map(([k, l]) =>
    chip(l, f.period === k, `data-period="${k}"`)
  ).join('');
  root.querySelector('#hist-type').value = f.type;
}

export async function render({ el, setHeader }) {
  setHeader({ sub: 'Semua catatan', title: 'Riwayat transaksi' });

  el.innerHTML = `
    <div id="hist-summary" class="card"></div>
    <div class="card space-y-3">
      <div id="hist-periods" class="flex flex-wrap gap-2"></div>
      <div class="grid grid-cols-2 gap-3">
        <select id="hist-type" class="field">${TYPES.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
        <input id="hist-q" type="search" class="field" placeholder="Cari..." value="${esc(f.q)}" />
      </div>
    </div>
    <div id="hist-list"></div>`;

  drawControls(el);
  el.querySelector('#hist-summary').innerHTML = '<p class="text-sm text-slate-500">Memuat...</p>';

  const reload = async () => {
    try {
      f.limit = 50;
      await load();
      drawList(el);
    } catch (e) {
      toast(errText(e));
    }
  };

  el.querySelector('#hist-periods').addEventListener('click', (e) => {
    const b = e.target.closest('[data-period]');
    if (!b) return;
    f.period = b.dataset.period;
    drawControls(el);
    reload();
  });
  el.querySelector('#hist-type').addEventListener('change', (e) => {
    f.type = e.target.value;
    reload();
  });
  el.querySelector('#hist-q').addEventListener('input', (e) => {
    f.q = e.target.value;
    f.limit = 50;
    drawList(el);
  });

  await load();
  drawList(el);
}
