import * as api from '../api.js';
import { CATEGORY_ICONS } from '../config.js';
import { $, openSheet, closeSheet, toast, errText, dataChanged, emptyState, progressBar, chip } from '../ui.js';
import { rp, esc, fmtThousands, numOf, pct, periodRange, daysLeftInMonth, fmtMonthYear } from '../utils.js';

const BUDGET_PRESETS = [0, 150000, 300000, 450000, 600000, 900000];

function openCategoryForm(cat, defaultType) {
  const edit = !!cat;
  const st = { type: cat?.type || defaultType, icon: cat?.icon || '🏷️' };

  openSheet(
    `<form id="c-form" class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold">${edit ? 'Ubah kategori' : 'Tambah kategori'}</h2>
        <button type="button" id="c-close" class="text-slate-400 text-2xl leading-none px-2" aria-label="Tutup">×</button>
      </div>
      ${
        edit
          ? ''
          : `<div class="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl" id="c-types">
              <button type="button" data-type="expense" class="type-btn">Pengeluaran</button>
              <button type="button" data-type="income" class="type-btn">Pemasukan</button>
            </div>`
      }
      <div>
        <label for="c-name" class="block text-sm font-medium mb-1">Nama kategori</label>
        <input id="c-name" class="field" maxlength="40" required placeholder="Contoh: Servis motor" value="${esc(cat?.name || '')}" />
      </div>
      <div>
        <p class="text-sm font-medium mb-2">Ikon</p>
        <div id="c-icons" class="flex flex-wrap gap-2"></div>
      </div>
      <div id="c-budget-wrap">
        <label for="c-budget" class="block text-sm font-medium mb-1">Batas anggaran sebulan (Rp) <span class="text-slate-400 font-normal">kosongkan bila tanpa batas</span></label>
        <input id="c-budget" class="field" inputmode="numeric" autocomplete="off" placeholder="Tanpa batas" value="${cat?.monthly_budget ? Number(cat.monthly_budget).toLocaleString('id-ID') : ''}" />
        <div id="c-presets" class="flex flex-wrap gap-2 mt-2"></div>
      </div>
      <p id="c-msg" class="text-sm text-red-600 min-h-[1.25rem]" role="alert"></p>
      <div class="${edit ? 'grid grid-cols-3 gap-3' : ''}">
        ${edit ? '<button type="button" id="c-del" class="btn-ghost text-red-600">Hapus</button>' : ''}
        <button class="btn-primary ${edit ? 'col-span-2' : 'w-full'}" type="submit">Simpan kategori</button>
      </div>
    </form>`,
    (root) => {
      const budget = $('#c-budget', root);
      budget.addEventListener('input', () => (budget.value = fmtThousands(budget.value)));

      const drawType = () => {
        root.querySelectorAll('#c-types .type-btn').forEach((b) => {
          b.classList.remove('active-income', 'active-expense');
          if (b.dataset.type === st.type) b.classList.add(`active-${st.type}`);
        });
        $('#c-budget-wrap', root).classList.toggle('hidden', st.type === 'income');
      };
      const drawIcons = () => {
        const list = CATEGORY_ICONS.includes(st.icon) ? CATEGORY_ICONS : [st.icon, ...CATEGORY_ICONS];
        $('#c-icons', root).innerHTML = list
          .map((i) => `<button type="button" data-icon="${esc(i)}" class="chip !px-3 !text-lg ${i === st.icon ? 'active' : ''}">${i}</button>`)
          .join('');
      };
      const drawPresets = () => {
        $('#c-presets', root).innerHTML = BUDGET_PRESETS.map((v) =>
          chip(v ? `Rp ${v / 1000}rb` : 'Tanpa batas', numOf(budget.value) === v, `data-preset="${v}"`)
        ).join('');
      };

      drawType();
      drawIcons();
      drawPresets();
      budget.addEventListener('input', drawPresets);

      root.querySelector('#c-types')?.addEventListener('click', (e) => {
        const b = e.target.closest('[data-type]');
        if (!b) return;
        st.type = b.dataset.type;
        drawType();
      });
      $('#c-icons', root).addEventListener('click', (e) => {
        const b = e.target.closest('[data-icon]');
        if (!b) return;
        st.icon = b.dataset.icon;
        drawIcons();
      });
      $('#c-presets', root).addEventListener('click', (e) => {
        const b = e.target.closest('[data-preset]');
        if (!b) return;
        const v = Number(b.dataset.preset);
        budget.value = v ? v.toLocaleString('id-ID') : '';
        drawPresets();
      });
      $('#c-close', root).onclick = closeSheet;

      if (edit)
        $('#c-del', root).onclick = async () => {
          if (!confirm(`Hapus kategori "${cat.name}"? Transaksi lama tetap tersimpan.`)) return;
          try {
            await api.deleteCategory(cat.id);
            closeSheet();
            toast('Kategori dihapus');
            dataChanged();
          } catch (err) {
            $('#c-msg', root).textContent = errText(err);
          }
        };

      $('#c-form', root).addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = $('#c-name', root).value.trim();
        if (!name) return;
        const monthly = st.type === 'expense' ? numOf(budget.value) || null : null;
        try {
          if (edit) await api.updateCategory(cat.id, { name, icon: st.icon, monthly_budget: monthly });
          else await api.addCategory({ type: st.type, name, icon: st.icon, monthly_budget: monthly });
          closeSheet();
          toast('Kategori disimpan');
          dataChanged();
        } catch (err) {
          $('#c-msg', root).textContent = errText(err);
        }
      });
    }
  );
}

export async function render({ el, setHeader }) {
  setHeader({ sub: 'Akun', title: 'Kategori & plafon', back: true });

  const range = periodRange('month');
  const [cats, tx] = await Promise.all([api.listCategories(), api.listTx({ from: range.from, to: range.to, types: ['expense'] })]);

  const spentBy = new Map();
  for (const t of tx) spentBy.set(t.category_id, (spentBy.get(t.category_id) || 0) + Number(t.amount));

  const expense = cats.filter((c) => c.type === 'expense');
  const income = cats.filter((c) => c.type === 'income');
  const budgeted = expense.filter((c) => c.monthly_budget);
  const plafon = budgeted.reduce((a, c) => a + Number(c.monthly_budget), 0);
  const used = budgeted.reduce((a, c) => a + (spentBy.get(c.id) || 0), 0);
  const left = plafon - used;
  const safeDaily = Math.max(0, left) / daysLeftInMonth();
  const usedPct = pct(used, plafon);

  const expRow = (c) => {
    const spent = spentBy.get(c.id) || 0;
    const over = c.monthly_budget && spent > c.monthly_budget;
    return `<button data-c="${esc(c.id)}" class="menu-row !items-start">
      <span class="text-xl w-8 text-center">${esc(c.icon)}</span>
      <span class="flex-1 min-w-0">
        <span class="flex justify-between gap-2"><span class="truncate">${esc(c.name)}</span><span class="text-sm font-semibold ${over ? 'text-red-600' : ''}">${rp(spent)}</span></span>
        ${
          c.monthly_budget
            ? `<span class="block mt-1.5">${progressBar(pct(spent, c.monthly_budget), over ? 'bg-red-500' : pct(spent, c.monthly_budget) > 80 ? 'bg-amber-500' : 'bg-brand-600')}</span>
               <span class="block text-xs text-slate-500 font-normal mt-1">${over ? 'Melebihi batas ' : 'Batas '}${rp(c.monthly_budget)}</span>`
            : '<span class="block text-xs text-slate-400 font-normal">Tanpa batas</span>'
        }
      </span>
    </button>`;
  };

  el.innerHTML = `
    <div class="card">
      <p class="text-sm text-slate-500">Plafon anggaran · ${esc(fmtMonthYear())}</p>
      <p class="text-3xl font-extrabold">${plafon ? rp(plafon) : 'Belum diatur'}</p>
      <p class="text-xs text-slate-500">${budgeted.length} kategori punya batas${plafon ? ` · aman ${rp(safeDaily)}/hari` : ''}</p>
      ${
        plafon
          ? `<div class="grid grid-cols-2 gap-3 mt-4 text-sm">
              <div class="rounded-xl bg-red-50 p-3"><p class="text-xs text-red-600">Terpakai</p><p class="font-bold">${rp(used)}</p></div>
              <div class="rounded-xl bg-brand-50 p-3"><p class="text-xs text-brand-700">Sisa plafon</p><p class="font-bold ${left < 0 ? 'text-red-600' : ''}">${rp(left)}</p></div>
            </div>
            <div class="mt-4">${progressBar(usedPct, usedPct >= 100 ? 'bg-red-500' : usedPct > 80 ? 'bg-amber-500' : 'bg-brand-600')}
            <p class="text-xs text-slate-500 mt-1">${usedPct}% plafon terpakai</p></div>`
          : '<p class="text-sm text-slate-500 mt-3">Ketuk kategori pengeluaran di bawah untuk memberi batas bulanan.</p>'
      }
    </div>

    <div class="card">
      <p class="font-semibold mb-1">🛑 Pos pengeluaran</p>
      ${expense.length ? expense.map(expRow).join('') : emptyState('Belum ada kategori pengeluaran.')}
    </div>

    <div class="card">
      <p class="font-semibold mb-1">📈 Pos pemasukan</p>
      ${
        income.length
          ? income
              .map(
                (c) => `<button data-c="${esc(c.id)}" class="menu-row"><span class="text-xl w-8 text-center">${esc(c.icon)}</span><span class="flex-1">${esc(c.name)}</span><span class="text-slate-300">›</span></button>`
              )
              .join('')
          : emptyState('Belum ada kategori pemasukan.')
      }
    </div>

    <button id="c-add" class="btn-primary w-full">+ Tambah kategori</button>`;

  const byId = new Map(cats.map((c) => [c.id, c]));
  el.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => openCategoryForm(byId.get(b.dataset.c))));
  el.querySelector('#c-add').addEventListener('click', () => openCategoryForm(null, 'expense'));
}
