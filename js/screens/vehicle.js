import * as api from '../api.js';
import { $, toast, errText, dataChanged, emptyState, progressBar } from '../ui.js';
import { esc, todayStr, pct, fmtDayShort } from '../utils.js';

const fmtKm = (n) => (Math.round(Number(n) * 10) / 10).toLocaleString('id-ID', { maximumFractionDigits: 1 });

export async function render({ el, setHeader }) {
  setHeader({ sub: 'Akun', title: 'Monitor kendaraan', back: true });
  const { settings, logs, kmSinceReset } = await api.getVehicle();

  const limit = settings.oil_interval_km;
  const p = pct(kmSinceReset, limit);
  const due = kmSinceReset >= limit;
  const left = Math.max(0, limit - kmSinceReset);
  const total = logs.reduce((a, l) => a + Number(l.km), 0);

  el.innerHTML = `
    <div class="card">
      <p class="text-sm text-slate-500">💧 Status oli motor</p>
      <p class="text-3xl font-extrabold ${due ? 'text-red-600' : ''}">${fmtKm(kmSinceReset)} <span class="text-lg font-semibold text-slate-500">km</span></p>
      <p class="text-xs text-slate-500 mb-3">sejak ganti oli terakhir · total tercatat ${fmtKm(total)} km</p>
      ${progressBar(p, due ? 'bg-red-500' : p > 80 ? 'bg-amber-500' : 'bg-brand-600')}
      <p class="text-sm mt-2 ${due ? 'text-red-600 font-semibold' : 'text-slate-500'}">${
        due ? `⚠️ Waktunya ganti oli! Motor sudah menempuh ≥ ${fmtKm(limit)} km.` : `Sisa ${fmtKm(left)} km lagi sebelum ganti oli`
      }</p>
      <button id="oil-reset" class="btn-ghost w-full mt-4">↻ Reset setelah ganti oli</button>
    </div>

    <form id="km-form" class="card space-y-3">
      <p class="font-semibold">Catat jarak tempuh harian</p>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="km-val" class="block text-sm font-medium mb-1">Jarak (km)</label>
          <input id="km-val" class="field text-xl font-bold" inputmode="decimal" autocomplete="off" placeholder="0" />
        </div>
        <div>
          <label for="km-date" class="block text-sm font-medium mb-1">Tanggal</label>
          <input id="km-date" type="date" class="field" max="${todayStr()}" value="${todayStr()}" />
        </div>
      </div>
      <p id="km-msg" class="text-sm text-red-600 min-h-[1.25rem]" role="alert"></p>
      <button class="btn-primary w-full" type="submit">Simpan jarak</button>
    </form>

    <form id="limit-form" class="card space-y-3">
      <label for="limit-val" class="font-semibold block">Batas aman ganti oli (km)</label>
      <div class="flex gap-3">
        <input id="limit-val" class="field" inputmode="numeric" autocomplete="off" value="${limit}" />
        <button class="btn-ghost" type="submit">Simpan</button>
      </div>
    </form>

    <div class="card">
      <p class="font-semibold mb-1">Riwayat jarak</p>
      ${
        logs.length
          ? `<ul class="divide-y divide-slate-100">${logs
              .slice(0, 30)
              .map(
                (l) => `<li class="flex items-center justify-between py-2.5 text-sm">
                  <span>${esc(fmtDayShort(l.log_date))}</span>
                  <span class="flex items-center gap-3"><b>${fmtKm(l.km)} km</b><button data-del="${esc(l.id)}" class="text-slate-300 text-lg px-1" aria-label="Hapus">🗑</button></span>
                </li>`
              )
              .join('')}</ul>${logs.length > 30 ? '<p class="text-xs text-slate-400 mt-2">Menampilkan 30 catatan terbaru.</p>' : ''}`
          : emptyState('Belum ada catatan jarak.')
      }
    </div>`;

  $('#oil-reset', el).addEventListener('click', async () => {
    if (!confirm('Sudah ganti oli? Hitungan jarak akan dimulai lagi dari 0.')) return;
    try {
      await api.resetOil();
      toast('Hitungan oli di-reset');
      dataChanged();
    } catch (err) {
      toast(errText(err));
    }
  });

  $('#km-form', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#km-msg', el);
    const km = parseFloat(String($('#km-val', el).value).replace(',', '.'));
    if (!(km > 0) || km > 2000) return void (msg.textContent = 'Isi jarak antara 0 dan 2.000 km.');
    try {
      await api.addKm(km, $('#km-date', el).value || todayStr());
      toast('Jarak dicatat');
      dataChanged();
    } catch (err) {
      msg.textContent = errText(err);
    }
  });

  $('#limit-form', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = parseInt($('#limit-val', el).value, 10);
    if (!(v > 0)) return void toast('Isi batas lebih dari 0 km');
    try {
      await api.setOilInterval(v);
      toast('Batas disimpan');
      dataChanged();
    } catch (err) {
      toast(errText(err));
    }
  });

  el.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('Hapus catatan jarak ini?')) return;
      try {
        await api.deleteKm(b.dataset.del);
        dataChanged();
      } catch (err) {
        toast(errText(err));
      }
    })
  );
}
