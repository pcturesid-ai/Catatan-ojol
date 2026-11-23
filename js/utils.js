export const rp = (n) => (n < 0 ? '-' : '') + 'Rp ' + Math.abs(Math.round(n)).toLocaleString('id-ID');

const pad = (n) => String(n).padStart(2, '0');
export const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => toDateStr(new Date());

export const parseDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
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

export const fmtDay = (s) =>
  parseDate(s).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });

export const fmtShort = (d) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const totals = (list) => {
  let income = 0;
  let expense = 0;
  for (const t of list) {
    if (t.type === 'income') income += Number(t.amount);
    else expense += Number(t.amount);
  }
  return { income, expense, net: income - expense };
};

export const digitsOnly = (s) => String(s).replace(/\D/g, '');
export const fmtThousands = (s) => {
  const d = digitsOnly(s);
  return d ? Number(d).toLocaleString('id-ID') : '';
};
