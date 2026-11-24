import * as api from '../api.js';
import { DAYPARTS } from '../config.js';
import { $, openSheet, closeSheet, toast, errText, dataChanged, emptyState, chip } from '../ui.js';
import { rp, esc, periodRange, todayStr } from '../utils.js';

const PERIODS = [
  ['all', 'Semua waktu'],
  ['month', 'Bulan ini'],
  ['week', 'Minggu ini'],
  ['today', 'Hari ini'],
];

const f = { tab: 'radar', period: 'month', part: 'now' };

const parseNames = (text) => {
  const seen = new Set();
  return String(text)
    .split(/[\n,]/)
    .map((s) => s.trim().slice(0, 80))
    .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
};

// Jam mulai/akhir dari pilihan waktu. "Jam sekarang" memakai jam ini ±1 jam.
function hours(partKey) {
  const p = DAYPARTS.find((d) => d.key === partKey) || DAYPARTS[0];
  if (p.key === 'now') {
    const h = new Date().getHours();
    return [(h + 23) % 24, (h + 1) % 24];
  }
  return [p.start, p.end];
}

function openAreaForm(area) {
  const edit = !!area;
  openSheet(
    `<form id="a-form" class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold">${edit ? 'Ubah daerah' : 'Tambah daerah mangkal'}</h2>
        <button type="button" id="a-close" class="text-slate-400 text-2xl leading-none px-2" aria-label="Tutup">×</button>
      </div>
      <div>
        <label for="a-name" class="block text-sm font-medium mb-1">Nama daerah / kawasan utama</label>
        <input id="a-name" class="field" maxlength="60" required placeholder="Contoh: Kota Lama" value="${esc(area?.name || '')}" />
      </div>
      ${
        edit && area.spots.length
          ? `<div>
              <p class="text-sm font-medium mb-2">Titik yang sudah ada</p>
              <div class="flex flex-wrap gap-2">${area.spots
                .map(
                  (s) => `<span class="chip !pr-1 flex items-center gap-1">${esc(s.name)}<button type="button" data-spot="${esc(s.id)}" class="px-2 text-slate-400" aria-label="Hapus titik ${esc(s.name)}">×</button></span>`
                )
                .join('')}</div>
            </div>`
          : ''
      }
      <div>
        <label for="a-spots" class="block text-sm font-medium mb-1">${edit ? 'Tambah titik jalan / resto' : 'Titik jalan / resto di daerah ini'}</label>
        <textarea id="a-spots" rows="4" class="field" placeholder="Satu titik per baris, atau pisahkan dengan koma"></textarea>
      </div>
      <p id="a-msg" class="text-sm text-red-600 min-h-[1.25rem]" role="alert"></p>
      <div class="${edit ? 'grid grid-cols-3 gap-3' : ''}">
        ${edit ? '<button type="button" id="a-del" class="btn-ghost text-red-600">Hapus</button>' : ''}
        <button class="btn-primary ${edit ? 'col-span-2' : 'w-full'}" type="submit">Simpan daerah</button>
      </div>
    </form>`,
    (root) => {
      $('#a-close', root).onclick = closeSheet;

      root.querySelectorAll('[data-spot]').forEach((b) =>
        b.addEventListener('click', async () => {
          try {
            await api.deleteSpot(b.dataset.spot);
            b.closest('span').remove();
            dataChanged();
          } catch (err) {
            $('#a-msg', root).textContent = errText(err);
          }
        })
      );

      if (edit)
        $('#a-del', root).onclick = async () => {
          if (!confirm(`Hapus daerah "${area.name}" beserta titiknya? Riwayat transaksi tetap aman.`)) return;
          try {
            await api.deleteArea(area.id);
            closeSheet();
            toast('Daerah dihapus');
            dataChanged();
          } catch (err) {
            $('#a-msg', root).textContent = errText(err);
          }
        };

      $('#a-form', root).addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = $('#a-name', root).value.trim();
        if (!name) return;
        const spots = parseNames($('#a-spots', root).value);
        try {
          let id = area?.id;
          if (edit) {
            if (name !== area.name) await api.renameArea(id, name);
          } else {
            id = (await api.addArea(name)).id;
          }
          if (spots.length) await api.addSpots(id, spots);
          closeSheet();
          toast('Daerah disimpan');
          dataChanged();
        } catch (err) {
          $('#a-msg', root).textContent = errText(err);
        }
      });
    }
  );
}

async function renderRadar(el) {
  const range = periodRange(f.period) || { from: '2000-01-01', to: todayStr() };
  const [hs, he] = hours(f.part);
  const rows = await api.radar(range.from, range.to, hs, he);

  const areas = new Map();
  for (const r of rows) {
    const a = areas.get(r.area) || { name: r.area, orders: 0, income: 0, spots: [] };
    a.orders += Number(r.orders);
    a.income += Number(r.income);
    a.spots.push(r);
    areas.set(r.area, a);
  }
  const ranked = [...areas.values()].sort((a, b) => b.orders - a.orders || b.income - a.income);
  const top = ranked[0];
  const maxOrders = Math.max(1, top?.orders || 1);
  const partLabel = DAYPARTS.find((d) => d.key === f.part)?.label || '';

  $('#radar-body', el).innerHTML = `
    <div class="card bg-brand-700 !text-white">
      <p class="text-xs tracking-wide text-brand-100">⚡ REKOMENDASI · ${esc(partLabel.toUpperCase())}</p>
      ${
        top
          ? `<p class="text-2xl font-extrabold mt-1">${esc(top.name)}</p>
             <p class="text-sm text-brand-100">${top.orders} order · ${rp(top.income)} · rata-rata ${rp(top.income / top.orders)} per order</p>`
          : '<p class="mt-1 text-sm">Belum ada data untuk filter ini.</p>'
      }
    </div>
    <p class="text-xs text-slate-500 px-1">Dihitung otomatis dari area jemput di pemasukan yang kamu catat.</p>
    ${
      ranked.length
        ? ranked
            .map(
              (a, i) => `<details class="card">
                <summary class="cursor-pointer list-none">
                  <div class="flex items-center gap-3">
                    <span class="w-8 h-8 rounded-full ${i === 0 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'} flex items-center justify-center text-sm font-bold">${i + 1}</span>
                    <span class="flex-1 min-w-0">
                      <span class="flex justify-between gap-2"><span class="font-semibold truncate">${esc(a.name)}</span><span class="text-sm font-semibold">${a.orders} order</span></span>
                      <span class="block h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1.5"><span class="block h-full bg-brand-600 rounded-full" style="width:${Math.round((a.orders / maxOrders) * 100)}%"></span></span>
                    </span>
                  </div>
                </summary>
                <ul class="mt-3 divide-y divide-slate-100 text-sm">${a.spots
                  .map((s) => `<li class="flex justify-between py-2"><span class="truncate pr-2">${esc(s.spot)}</span><span class="text-slate-500 whitespace-nowrap">${s.orders} order · ${rp(s.income)}</span></li>`)
                  .join('')}</ul>
              </details>`
            )
            .join('')
        : `<div class="card">${emptyState('Belum ada order dengan area jemput. Isi kolom "Area / lokasi jemput" saat mencatat pemasukan.')}</div>`
    }`;
}

async function renderManage(el) {
  const areas = await api.listAreas();
  $('#radar-body', el).innerHTML = `
    ${
      areas.length
        ? areas
            .map(
              (a) => `<div class="card">
                <div class="flex items-center justify-between gap-2">
                  <p class="font-semibold truncate">📍 ${esc(a.name)}</p>
                  <button data-area="${esc(a.id)}" class="text-sm text-brand-700 font-medium">Ubah</button>
                </div>
                ${
                  a.spots.length
                    ? `<div class="flex flex-wrap gap-2 mt-3">${a.spots.map((s) => `<span class="chip">${esc(s.name)}</span>`).join('')}</div>`
                    : '<p class="text-xs text-slate-400 mt-2">Belum ada titik.</p>'
                }
              </div>`
            )
            .join('')
        : `<div class="card">${emptyState('Belum ada daerah. Tambah daerah mangkal pertamamu.')}</div>`
    }
    <button id="area-add" class="btn-primary w-full">+ Tambah daerah baru</button>`;

  const byId = new Map(areas.map((a) => [a.id, a]));
  el.querySelectorAll('[data-area]').forEach((b) => b.addEventListener('click', () => openAreaForm(byId.get(b.dataset.area))));
  $('#area-add', el).addEventListener('click', () => openAreaForm(null));
}

export async function render({ el, setHeader }) {
  setHeader({ sub: 'Akun', title: 'Lokasi & radar mangkal', back: true });

  el.innerHTML = `
    <div class="grid grid-cols-2 gap-1 p-1 bg-slate-200/70 rounded-xl" id="pl-tabs">
      <button data-tab="radar" class="type-btn">📡 Radar gacor</button>
      <button data-tab="manage" class="type-btn">🗺️ Kelola daerah</button>
    </div>
    <div id="radar-filters" class="card space-y-3">
      <div id="pl-periods" class="flex flex-wrap gap-2"></div>
      <select id="pl-part" class="field">${DAYPARTS.map((d) => `<option value="${d.key}">${d.label}</option>`).join('')}</select>
    </div>
    <div id="radar-body" class="space-y-3"><div class="card text-sm text-slate-500">Memuat...</div></div>`;

  const drawTabs = () => {
    el.querySelectorAll('#pl-tabs .type-btn').forEach((b) => {
      b.classList.remove('active-income');
      if (b.dataset.tab === f.tab) b.classList.add('active-income');
    });
    $('#radar-filters', el).classList.toggle('hidden', f.tab !== 'radar');
    $('#pl-periods', el).innerHTML = PERIODS.map(([k, l]) => chip(l, f.period === k, `data-period="${k}"`)).join('');
    $('#pl-part', el).value = f.part;
  };

  const load = async () => {
    try {
      if (f.tab === 'radar') await renderRadar(el);
      else await renderManage(el);
    } catch (err) {
      toast(errText(err));
    }
  };

  drawTabs();
  $('#pl-tabs', el).addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    f.tab = b.dataset.tab;
    drawTabs();
    load();
  });
  $('#pl-periods', el).addEventListener('click', (e) => {
    const b = e.target.closest('[data-period]');
    if (!b) return;
    f.period = b.dataset.period;
    drawTabs();
    load();
  });
  $('#pl-part', el).addEventListener('change', (e) => {
    f.part = e.target.value;
    load();
  });

  await load();
}
