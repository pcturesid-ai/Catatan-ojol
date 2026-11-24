export const rp = (n) => (n < 0 ? '-' : '') + 'Rp ' + Math.abs(Math.round(Number(n) || 0)).toLocaleString('id-ID');
export const num = (n) => Math.abs(Math.round(Number(n) || 0)).toLocaleString('id-ID');

const pad = (n) => String(n).padStart(2, '0');
export const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => toDateStr(new Date());
export const nowTime = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const parseDate = (s) => {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Minggu dimulai hari Senin
export const startOfWeek = (d) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const monthRange = (d) => ({
  from: toDateStr(new Date(d.getFullYear(), d.getMonth(), 1)),
  to: toDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
});

export const fmtDay = (s) =>
  parseDate(s).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
export const fmtShort = (d) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
export const fmtMonth = (d) => d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
export const hhmm = (t) => String(t || '').slice(0, 5);

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const digitsOnly = (s) => String(s ?? '').replace(/\D/g, '');
export const fmtThousands = (s) => {
  const d = digitsOnly(s);
  return d ? Number(d).toLocaleString('id-ID') : '';
};
export const moneyVal = (el) => Number(digitsOnly(el?.value) || 0);
export const clampPct = (v) => Math.max(0, Math.min(100, Math.round(v)));

export const errText = (e) => {
  const m = (e && e.message) || String(e);
  const code = e && e.code;
  if (code === '23503') return 'Data ini masih dipakai oleh data lain, jadi belum bisa dihapus.';
  if (code === '23505') return 'Nama ini sudah ada.';
  if (/Invalid login credentials/i.test(m)) return 'Email atau kata sandi salah.';
  if (/Email not confirmed/i.test(m)) return 'Email belum dikonfirmasi. Cek kotak masuk emailmu.';
  if (/already registered/i.test(m)) return 'Email ini sudah terdaftar. Silakan masuk.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Tidak ada koneksi internet.';
  return m;
};
