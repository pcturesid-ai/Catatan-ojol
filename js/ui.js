export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let toastTimer;
export function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}

export const errText = (e) => {
  const m = (e && e.message) || String(e);
  if (/Invalid login credentials/i.test(m)) return 'Email atau kata sandi salah.';
  if (/Email not confirmed/i.test(m)) return 'Email belum dikonfirmasi. Cek kotak masuk emailmu.';
  if (/already registered/i.test(m)) return 'Email ini sudah terdaftar. Silakan masuk.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Tidak ada koneksi internet.';
  if (/violates foreign key constraint/i.test(m)) return 'Data ini masih dipakai di catatan lain, jadi belum bisa dihapus.';
  if (/duplicate key/i.test(m)) return 'Nama ini sudah dipakai.';
  return m;
};

// ---------- Lembar (bottom sheet) ----------
export function openSheet(html, onMount) {
  const sheet = $('#sheet');
  $('#sheet-body').innerHTML = html;
  sheet.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  if (onMount) onMount($('#sheet-body'));
  return $('#sheet-body');
}

export function closeSheet() {
  $('#sheet').classList.add('hidden');
  $('#sheet-body').innerHTML = '';
  document.body.classList.remove('overflow-hidden');
}

export function initSheet() {
  $('#sheet-backdrop').addEventListener('click', closeSheet);
}

// Beri tahu layar aktif bahwa data berubah supaya dimuat ulang
export const dataChanged = () => document.dispatchEvent(new CustomEvent('data-changed'));
export const navigate = (name) => document.dispatchEvent(new CustomEvent('navigate', { detail: name }));

// Gaya pil pilihan (chip) yang dipakai ulang
export const chip = (label, active, attrs = '') =>
  `<button type="button" ${attrs} class="chip ${active ? 'active' : ''}">${label}</button>`;

export const emptyState = (text) => `<p class="text-sm text-slate-500 py-6 text-center">${text}</p>`;

export const progressBar = (value, color = 'bg-brand-600') =>
  `<div class="h-2.5 rounded-full bg-slate-100 overflow-hidden"><div class="h-full rounded-full ${color}" style="width:${value}%"></div></div>`;
