// Fungsi hitung murni (tanpa DOM / jaringan) supaya mudah diuji.
// Hanya transaksi 'income' dan 'expense' dihitung sebagai pendapatan/pengeluaran.
// Transfer dan setoran/pencairan target hanya memindahkan uang antar tempat.

export const totals = (list) => {
  let income = 0;
  let expense = 0;
  for (const t of list) {
    if (t.type === 'income') income += Number(t.amount);
    else if (t.type === 'expense') expense += Number(t.amount);
  }
  return { income, expense, net: income - expense };
};

const sortDesc = (entries) => entries.sort((a, b) => b.amount - a.amount || b.count - a.count);

export const groupIncome = (list, key) => {
  const map = new Map();
  for (const t of list) {
    if (t.type !== 'income') continue;
    const k = t[key];
    if (!k) continue;
    const cur = map.get(k) || { name: k, amount: 0, count: 0 };
    cur.amount += Number(t.amount);
    cur.count += 1;
    map.set(k, cur);
  }
  return sortDesc([...map.values()]);
};

export const spendByCategory = (list) => {
  const map = new Map();
  for (const t of list) {
    if (t.type !== 'expense') continue;
    const k = t.category_id || `n:${t.category}`;
    const cur = map.get(k) || { key: k, id: t.category_id, name: t.category, amount: 0, count: 0 };
    cur.amount += Number(t.amount);
    cur.count += 1;
    map.set(k, cur);
  }
  return sortDesc([...map.values()]);
};

export const byDay = (list) => {
  const map = new Map();
  for (const t of list) {
    const cur = map.get(t.trx_date) || { date: t.trx_date, income: 0, expense: 0, net: 0, list: [] };
    if (t.type === 'income') cur.income += Number(t.amount);
    if (t.type === 'expense') cur.expense += Number(t.amount);
    cur.net = cur.income - cur.expense;
    cur.list.push(t);
    map.set(t.trx_date, cur);
  }
  return map;
};

export const isServiceTx = (t) => {
  if (t.type !== 'expense') return false;
  const s = `${t.category} ${t.note || ''}`.toLowerCase();
  return /servis|service|oli|bengkel|ban |kampas/.test(s);
};

// Progres oli: km terkumpul dibanding batas ganti oli.
export const oilStatus = (km, interval) => {
  const lim = Number(interval) > 0 ? Number(interval) : 2000;
  const pct = Math.min(100, (Number(km) / lim) * 100);
  const level = km >= lim ? 'danger' : km >= lim * 0.75 ? 'warn' : 'ok';
  return { pct, level, limit: lim, left: Math.max(0, lim - km) };
};

// Progres target: kembalikan persen 0-100 dan sisa.
export const goalProgress = (saved, goal) => {
  const s = Math.max(0, Number(saved) || 0);
  const g = Number(goal) || 0;
  return { pct: g > 0 ? Math.min(100, Math.round((s / g) * 100)) : 0, left: Math.max(0, g - s), done: g > 0 && s >= g };
};

// Sisa plafon kategori terhadap pengeluaran bulan ini.
export const budgetState = (budget, spent) => {
  const b = Number(budget) || 0;
  if (b <= 0) return { has: false, pct: 0, left: 0, over: false };
  return { has: true, pct: Math.min(100, Math.round((spent / b) * 100)), left: b - spent, over: spent > b };
};
