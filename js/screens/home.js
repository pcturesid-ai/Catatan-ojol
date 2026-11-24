import * as api from '../api.js';
import { openTxForm } from '../txform.js';
import { navigate, emptyState, progressBar } from '../ui.js';
import { rp, esc, todayStr, totals, pct } from '../utils.js';
import { WALLET_KINDS } from '../config.js';
import { txRow, walletNameMap, bindTxRows, statCard } from './shared.js';

const greeting = () => {
  const h = new Date().getHours();
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam';
};

// Aset target: tabungan = terkumpul, investasi = nilai pasar terkini (atau terkumpul bila belum diisi)
export const assetValue = (t) => (t.kind === 'investment' && t.market_value != null ? Number(t.market_value) : Number(t.saved_amount));

export async function render({ el, user, setHeader }) {
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Pengguna';
  setHeader({ sub: `${greeting()} 👋`, title: name });

  const h = new Date().getHours();
  const today = todayStr();
  const monthAgo = new Date(Date.now() - 30 * 864e5);
  const from30 = `${monthAgo.getFullYear()}-${String(monthAgo.getMonth() + 1).padStart(2, '0')}-${String(monthAgo.getDate()).padStart(2, '0')}`;

  const [wallets, targets, recent, todayTx, dailyTarget, vehicle, radar] = await Promise.all([
    api.listWallets(),
    api.listTargets(),
    api.recentTx(5),
    api.listTx({ from: today, to: today }),
    api.getDailyTarget(),
    api.getVehicle().catch(() => null),
    api.radar(from30, today, (h + 23) % 24, (h + 1) % 24).catch(() => []),
  ]);

  const cash = wallets.reduce((a, w) => a + Number(w.balance), 0);
  const assets = targets.reduce((a, t) => a + assetValue(t), 0);
  const day = totals(todayTx);
  const dayPct = pct(day.net, dailyTarget);
  const reached = dailyTarget > 0 && day.net >= dailyTarget;
  const wmap = walletNameMap(wallets);

  // Rekomendasi mangkal: daerah dengan order terbanyak di sekitar jam ini
  const byArea = new Map();
  for (const r of radar) byArea.set(r.area, (byArea.get(r.area) || 0) + Number(r.orders));
  const topArea = [...byArea.entries()].sort((a, b) => b[1] - a[1])[0];

  const oilPct = vehicle ? pct(vehicle.kmSinceReset, vehicle.settings.oil_interval_km) : 0;
  const oilDue = vehicle && vehicle.kmSinceReset >= vehicle.settings.oil_interval_km;

  el.innerHTML = `
    <div class="card">
      <p class="text-sm text-slate-500">Total kekayaan bersih</p>
      <p class="text-3xl font-extrabold ${cash + assets < 0 ? 'text-red-600' : 'text-slate-900'}">${rp(cash + assets)}</p>
      <div class="grid grid-cols-2 gap-3 mt-4">
        ${statCard('💵 Uang cair', rp(cash), 'neutral')}
        ${statCard('🎯 Aset & target', rp(assets), 'neutral')}
      </div>
    </div>

    <div class="grid grid-cols-3 gap-3">
      <button data-quick="income" class="card text-center py-3"><span class="block text-xl text-brand-700">↓</span><span class="text-xs font-semibold">Pemasukan</span></button>
      <button data-quick="expense" class="card text-center py-3"><span class="block text-xl text-red-600">↑</span><span class="text-xs font-semibold">Pengeluaran</span></button>
      <button data-quick="transfer" class="card text-center py-3"><span class="block text-xl text-blue-600">⇄</span><span class="text-xs font-semibold">Transfer</span></button>
    </div>

    <div>
      <div class="flex items-center justify-between mb-2 px-1">
        <p class="font-semibold">Dompet aktif</p>
        <button data-go="wallets" class="text-sm text-brand-700 font-medium">Kelola →</button>
      </div>
      <div class="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 snap-x">
        ${wallets
          .map(
            (w) => `<div class="card shrink-0 w-40 snap-start">
              <p class="text-lg">${WALLET_KINDS[w.kind]?.icon || '💼'}</p>
              <p class="text-sm text-slate-500 truncate">${esc(w.name)}</p>
              <p class="font-bold ${w.balance < 0 ? 'text-red-600' : ''}">${rp(w.balance)}</p>
            </div>`
          )
          .join('')}
      </div>
    </div>

    <div class="card">
      <div class="flex justify-between items-baseline">
        <p class="font-semibold">Hari ini</p>
        <p class="text-sm text-slate-500">${dailyTarget > 0 ? 'Target ' + rp(dailyTarget) : 'Target belum diatur'}</p>
      </div>
      <p class="text-2xl font-extrabold mt-1 ${day.net < 0 ? 'text-red-600' : ''}">${rp(day.net)}</p>
      <p class="text-xs text-slate-500 mb-3">Masuk ${rp(day.income)} · Keluar ${rp(day.expense)}</p>
      ${
        dailyTarget > 0
          ? `${progressBar(dayPct, reached ? 'bg-amber-500' : 'bg-brand-600')}
             <p class="text-sm mt-2 ${reached ? 'text-amber-600 font-semibold' : 'text-slate-500'}">${
               reached ? 'Target harian tercapai 🎉' : `${dayPct}% · kurang ${rp(dailyTarget - day.net)}`
             }</p>`
          : `<button data-go="account" class="text-sm text-brand-700 font-medium">Atur target harian →</button>`
      }
    </div>

    <button data-go="vehicle" class="card w-full text-left flex items-center gap-3">
      <div class="w-11 h-11 rounded-full bg-amber-50 flex items-center justify-center text-xl">🛵</div>
      <div class="min-w-0 flex-1">
        <p class="font-semibold">Monitor kendaraan</p>
        ${
          vehicle
            ? `<p class="text-xs ${oilDue ? 'text-red-600 font-semibold' : 'text-slate-500'} mb-1.5">${
                oilDue ? 'Waktunya ganti oli!' : `Oli: ${Math.round(vehicle.kmSinceReset).toLocaleString('id-ID')} / ${vehicle.settings.oil_interval_km.toLocaleString('id-ID')} km`
              }</p>${progressBar(oilPct, oilDue ? 'bg-red-500' : 'bg-amber-500')}`
            : '<p class="text-xs text-slate-500">Pantau KM dan jadwal ganti oli</p>'
        }
      </div>
      <span class="text-slate-300">›</span>
    </button>

    <button data-go="places" class="card w-full text-left flex items-center gap-3">
      <div class="w-11 h-11 rounded-full bg-brand-50 flex items-center justify-center text-xl">📡</div>
      <div class="min-w-0 flex-1">
        <p class="font-semibold">Lokasi & strategi mangkal</p>
        <p class="text-xs text-slate-500">${
          topArea ? `Jam ini biasanya ramai di <b>${esc(topArea[0])}</b> (${topArea[1]} order)` : 'Isi area jemput saat mencatat order untuk mendapat rekomendasi'
        }</p>
      </div>
      <span class="text-slate-300">›</span>
    </button>

    <div class="card">
      <div class="flex items-center justify-between">
        <p class="font-semibold">Transaksi terakhir</p>
        <button data-go="history" class="text-sm text-brand-700 font-medium">Lihat semua →</button>
      </div>
      ${recent.length ? `<ul class="divide-y divide-slate-100">${recent.map((t) => txRow(t, wmap, { showDate: t.trx_date !== today })).join('')}</ul>` : emptyState('Belum ada transaksi. Tekan tombol + untuk mulai.')}
    </div>`;

  el.querySelectorAll('[data-quick]').forEach((b) => b.addEventListener('click', () => openTxForm({ type: b.dataset.quick })));
  el.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.go)));
  bindTxRows(el, recent, (t) => openTxForm({ tx: t }));
}
