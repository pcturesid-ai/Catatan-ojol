import { esc, rp, fmtDay, parseDate } from '../utils.js';

const META = {
  income: { icon: '↓', box: 'bg-brand-50 text-brand-700', amount: 'text-brand-700', sign: '+' },
  expense: { icon: '↑', box: 'bg-red-50 text-red-600', amount: 'text-red-600', sign: '-' },
  transfer: { icon: '⇄', box: 'bg-blue-50 text-blue-600', amount: 'text-blue-600', sign: '' },
  target_deposit: { icon: '🎯', box: 'bg-amber-50 text-amber-600', amount: 'text-amber-600', sign: '-' },
  target_withdraw: { icon: '🎯', box: 'bg-amber-50 text-amber-600', amount: 'text-amber-600', sign: '+' },
};

const TITLE = { transfer: 'Transfer', target_deposit: 'Setoran target', target_withdraw: 'Pencairan target' };

// Satu baris transaksi. data-tx dipakai layar untuk membuka form ubah.
export function txRow(t, walletMap = new Map(), { showDate = false } = {}) {
  const m = META[t.type] || META.expense;
  const title = TITLE[t.type] || t.category;
  const from = walletMap.get(t.wallet_id);
  const to = walletMap.get(t.to_wallet_id);
  const where = t.type === 'transfer' && from && to ? `${from} → ${to}` : from || '';
  const parts = [];
  if (showDate) parts.push(fmtDay(t.trx_date));
  parts.push(String(t.trx_time).slice(0, 5));
  if (where) parts.push(esc(where));
  const extra = [t.service, t.pickup_area, t.note].filter(Boolean).map(esc).join(' · ');
  return `
    <li>
      <button type="button" data-tx="${esc(t.id)}" class="w-full flex items-center gap-3 py-3 text-left">
        <div class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold ${m.box}">${m.icon}</div>
        <div class="min-w-0 flex-1">
          <p class="font-semibold truncate">${esc(title)}</p>
          <p class="text-xs text-slate-500 truncate">${parts.join(' · ')}</p>
          ${extra ? `<p class="text-xs text-slate-400 truncate">${extra}</p>` : ''}
        </div>
        <p class="font-bold whitespace-nowrap ${m.amount}">${m.sign}${rp(t.amount).replace('Rp ', '')}</p>
      </button>
    </li>`;
}

export const walletNameMap = (wallets) => new Map(wallets.map((w) => [w.id, w.name]));

// Pasang pendengar klik pada baris transaksi untuk membuka form ubah
export function bindTxRows(root, list, open) {
  const byId = new Map(list.map((t) => [t.id, t]));
  root.querySelectorAll('[data-tx]').forEach((b) =>
    b.addEventListener('click', () => {
      const t = byId.get(b.dataset.tx);
      if (t) open(t);
    })
  );
}

export const statCard = (label, value, tone) => {
  const tones = {
    in: 'bg-brand-50 text-brand-700',
    out: 'bg-red-50 text-red-600',
    neutral: 'bg-slate-50 text-slate-600',
  };
  return `<div class="rounded-xl p-3 ${tones[tone] || tones.neutral}"><p class="text-xs">${label}</p><p class="font-bold text-slate-900 text-sm sm:text-base">${value}</p></div>`;
};

export const dateKey = (t) => t.trx_date;
export const dayOf = (s) => parseDate(s).getDay();
