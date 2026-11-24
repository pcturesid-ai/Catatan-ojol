import * as api from '../api.js';
import { toast, errText, chip, emptyState } from '../ui.js';
import {
  rp, rpShort, esc, periodRange, totals, groupBy, parseDate, toDateStr, addDays, startOfWeek, monthStart, monthEnd,
} from '../utils.js';
import { statCard } from './shared.js';

const PERIODS = [
  ['today', 'Hari ini'],
  ['week', 'Minggu ini'],
  ['month', 'Bulan ini'],
  ['all', 'Semua waktu'],
];
const COLORS = ['#0f766e', '#f59e0b', '#2563eb', '#dc2626', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#94a3b8'];

let period = 'week';

// Daftar tanggal yang ditampilkan pada grafik harian
function dayKeys(rows) {
  const now = new Date();
  if (period === 'today') return [toDateStr(now)];
  if (period === 'week') return Array.from({ length: 7 }, (_, i) => toDateStr(addDays(startOfWeek(now), i)));
  if (period === 'month') {
    const s = monthStart(now);
    return Array.from({ length: monthEnd(now).getDate() }, (_, i) => toDateStr(addDays(s, i)));
  }
  // Semua waktu: 14 hari terakhir yang ada catatan
  return [...new Set(rows.map((t) => t.trx_date))].sort().slice(-14);
}

function donut(items, total) {
  let acc = 0;
  const stops = items.map((it, i) => {
    const start = (acc / total) * 100;
    acc += it.value;
    return `${COLORS[i % COLORS.length]} ${start}% ${(acc / total) * 100}%`;
  });
  return `<div class="donut w-32 h-32 shrink-0" style="background:conic-gradient(${stops.join(',')})"></div>`;
}

function draw(el, rows) {
  const sum = totals(rows);
  const incomeRows = rows.filter((t) => t.type === 'income');
  const expenseRows = rows.filter((t) => t.type === 'expense');
  const activeDays = new Set(rows.map((t) => t.trx_date)).size;

  // Pengeluaran per kategori (maksimal 8 teratas, sisanya digabung)
  const byCat = [...groupBy(expenseRows, (t) => t.category).entries()]
    .map(([name, list]) => ({ name, value: list.reduce((a, t) => a + Number(t.amount), 0) }))
    .sort((a, b) => b.value - a.value);
  const topCats = byCat.slice(0, 8);
  const restValue = byCat.slice(8).reduce((a, c) => a + c.value, 0);
  if (restValue) topCats.push({ name: 'Lainnya', value: restValue });

  // Pemasukan per layanan
  const bySvc = [...groupBy(incomeRows, (t) => t.service || 'Tanpa layanan').entries()]
    .map(([name, list]) => ({
      name,
      orders: list.length,
      value: list.reduce((a, t) => a + Number(t.amount), 0),
    }))
    .sort((a, b) => b.value - a.value);
  const maxSvc = Math.max(1, ...bySvc.map((s) => s.value));

  // Grafik harian
  const keys = dayKeys(rows);
  const days = keys.map((k) => {
    const list = rows.filter((t) => t.trx_date === k);
    return { key: k, ...totals(list), has: list.length > 0 };
  });
  const maxAbs = Math.max(1, ...days.map((d) => Math.abs(d.net)));
  const dense = days.length > 10;

  el.querySelector('#an-body').innerHTML = `
    <div class="card">
      <p class="text-sm text-slate-500">Pendapatan bersih</p>
      <p class="text-3xl font-extrabold ${sum.net < 0 ? 'text-red-600' : 'text-slate-900'}">${rp(sum.net)}</p>
      <div class="grid grid-cols-2 gap-3 mt-4">
        ${statCard('Pemasukan', rp(sum.income), 'in')}
        ${statCard('Pengeluaran', rp(sum.expense), 'out')}
        ${statCard('Jumlah order', incomeRows.length.toLocaleString('id-ID'), 'neutral')}
        ${statCard('Rata-rata / hari aktif', rp(activeDays ? sum.net / activeDays : 0), 'neutral')}
      </div>
    </div>

    <div class="card">
      <p class="font-semibold mb-3">Bersih per hari</p>
      ${
        days.some((d) => d.has)
          ? `<div class="flex gap-1 h-36 items-end overflow-x-auto">${days
              .map((d) => {
                const h = Math.round((Math.abs(d.net) / maxAbs) * 100);
                const color = d.net < 0 ? 'bg-red-400' : 'bg-brand-600';
                const label = parseDate(d.key).getDate();
                return `<div class="flex-1 ${dense ? 'min-w-[14px]' : ''} flex flex-col items-center gap-1 h-full" title="${esc(d.key)}: ${esc(rp(d.net))}">
                  <div class="bar-col w-full flex-1"><div class="bar ${color}" style="height:${d.has ? Math.max(h, 4) : 0}%"></div></div>
                  <span class="text-[10px] text-slate-500">${label}</span>
                </div>`;
              })
              .join('')}</div>
             <p class="text-xs text-slate-400 mt-2">Angka di bawah batang = tanggal. Merah berarti rugi di hari itu.</p>`
          : emptyState('Belum ada data di periode ini.')
      }
    </div>

    <div class="card">
      <p class="font-semibold mb-3">Pengeluaran per kategori</p>
      ${
        topCats.length
          ? `<div class="flex items-center gap-4">
              ${donut(topCats, sum.expense)}
              <ul class="flex-1 min-w-0 space-y-1.5 text-sm">${topCats
                .map(
                  (c, i) => `<li class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${COLORS[i % COLORS.length]}"></span>
                    <span class="truncate flex-1">${esc(c.name)}</span>
                    <span class="text-slate-500 text-xs">${Math.round((c.value / sum.expense) * 100)}%</span>
                  </li>`
                )
                .join('')}</ul>
            </div>
            <ul class="divide-y divide-slate-100 mt-3 text-sm">${topCats
              .map((c) => `<li class="flex justify-between py-2"><span>${esc(c.name)}</span><span class="font-semibold">${rp(c.value)}</span></li>`)
              .join('')}</ul>`
          : emptyState('Belum ada pengeluaran di periode ini.')
      }
    </div>

    <div class="card">
      <p class="font-semibold mb-3">Pemasukan per layanan</p>
      ${
        bySvc.length
          ? `<ul class="space-y-3">${bySvc
              .map(
                (s) => `<li>
                  <div class="flex justify-between text-sm mb-1"><span class="font-medium">${esc(s.name)} <span class="text-slate-400 font-normal">· ${s.orders} order</span></span><span class="font-semibold">${rp(s.value)}</span></div>
                  <div class="h-2 rounded-full bg-slate-100 overflow-hidden"><div class="h-full bg-brand-600 rounded-full" style="width:${Math.round((s.value / maxSvc) * 100)}%"></div></div>
                </li>`
              )
              .join('')}</ul>`
          : emptyState('Belum ada pemasukan di periode ini.')
      }
    </div>`;
}

export async function render({ el, setHeader }) {
  setHeader({ sub: 'Statistik', title: 'Analitik' });
  el.innerHTML = `
    <div class="card"><div id="an-periods" class="flex flex-wrap gap-2"></div></div>
    <div id="an-body" class="space-y-4"><div class="card text-sm text-slate-500">Memuat...</div></div>`;

  const drawChips = () => {
    el.querySelector('#an-periods').innerHTML = PERIODS.map(([k, l]) => chip(l, period === k, `data-period="${k}"`)).join('');
  };

  const load = async () => {
    try {
      const range = periodRange(period);
      const rows = await api.listTx({ from: range?.from, to: range?.to, types: ['income', 'expense'] });
      draw(el, rows);
    } catch (e) {
      toast(errText(e));
    }
  };

  drawChips();
  el.querySelector('#an-periods').addEventListener('click', (e) => {
    const b = e.target.closest('[data-period]');
    if (!b) return;
    period = b.dataset.period;
    drawChips();
    load();
  });
  await load();
}
