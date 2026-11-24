import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

const ok = ({ data, error }) => {
  if (error) throw error;
  return data;
};

const uid = async () => {
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  const id = data.session?.user?.id;
  if (!id) throw new Error('Sesi habis. Silakan masuk lagi.');
  return id;
};

// ---------- Autentikasi ----------
export const getSession = async () => ok(await sb.auth.getSession()).session;
export const signIn = async (email, password) => ok(await sb.auth.signInWithPassword({ email, password }));
export const signUp = async (email, password) => ok(await sb.auth.signUp({ email, password }));
export const signOut = async () => {
  const { error } = await sb.auth.signOut();
  if (error) throw error;
};
export const onAuthChange = (cb) => sb.auth.onAuthStateChange((_e, session) => cb(session));

// ---------- Dompet ----------
export const listWallets = async () =>
  ok(await sb.from('wallet_balances').select('id,name,kind,initial_balance,balance,created_at').order('created_at'));
export const addWallet = async (w) =>
  ok(await sb.from('wallets').insert({ name: w.name, kind: w.kind, initial_balance: w.initial_balance ?? 0 }));
export const updateWallet = async (id, patch) => ok(await sb.from('wallets').update(patch).eq('id', id));
export const deleteWallet = async (id) => ok(await sb.from('wallets').delete().eq('id', id));

// ---------- Kategori ----------
export const listCategories = async () =>
  ok(await sb.from('categories').select('id,type,name,icon,monthly_budget,created_at').order('created_at'));
export const addCategory = async (c) =>
  ok(await sb.from('categories').insert({ type: c.type, name: c.name, icon: c.icon, monthly_budget: c.monthly_budget ?? null }));
export const updateCategory = async (id, patch) => ok(await sb.from('categories').update(patch).eq('id', id));
export const deleteCategory = async (id) => ok(await sb.from('categories').delete().eq('id', id));

// ---------- Transaksi ----------
// Filter: { from, to, types, limit }. Semua opsional.
export const listTx = async ({ from, to, types, limit = 1000 } = {}) => {
  let q = sb.from('transactions').select('*');
  if (from) q = q.gte('trx_date', from);
  if (to) q = q.lte('trx_date', to);
  if (types?.length) q = q.in('type', types);
  return ok(
    await q
      .order('trx_date', { ascending: false })
      .order('trx_time', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)
  );
};
export const recentTx = async (n = 5) => listTx({ limit: n });
export const addTx = async (row) => ok(await sb.from('transactions').insert(row));
export const updateTx = async (id, row) => ok(await sb.from('transactions').update(row).eq('id', id));
export const deleteTx = async (id) => ok(await sb.from('transactions').delete().eq('id', id));

// ---------- Target keuangan ----------
export const listTargets = async () =>
  ok(
    await sb
      .from('target_progress')
      .select('id,kind,name,goal_amount,initial_amount,market_value,deadline,saved_amount,created_at')
      .order('created_at')
  );
export const addTarget = async (row) => ok(await sb.from('targets').insert(row));
export const updateTarget = async (id, patch) => ok(await sb.from('targets').update(patch).eq('id', id));
export const deleteTarget = async (id) => ok(await sb.from('targets').delete().eq('id', id));

// ---------- Lokasi mangkal ----------
// Setiap daerah membawa daftar titiknya: { id, name, spots: [{ id, name }] }
export const listAreas = async () => {
  const rows = ok(
    await sb.from('areas').select('id,name,created_at,spots(id,name,created_at)').order('created_at')
  );
  return rows.map((a) => ({
    ...a,
    spots: (a.spots || []).slice().sort((x, y) => String(x.created_at).localeCompare(String(y.created_at))),
  }));
};
export const addArea = async (name) => ok(await sb.from('areas').insert({ name }).select('id,name').single());
export const renameArea = async (id, name) => ok(await sb.from('areas').update({ name }).eq('id', id));
export const deleteArea = async (id) => ok(await sb.from('areas').delete().eq('id', id));
export const addSpots = async (area_id, names) => {
  const existing = ok(await sb.from('spots').select('name').eq('area_id', area_id));
  const have = new Set(existing.map((s) => s.name.toLowerCase()));
  const rows = names.filter((n) => !have.has(n.toLowerCase())).map((name) => ({ area_id, name }));
  if (!rows.length) return [];
  return ok(await sb.from('spots').insert(rows));
};
export const deleteSpot = async (id) => ok(await sb.from('spots').delete().eq('id', id));
export const radar = async (from, to, h1, h2) =>
  ok(await sb.rpc('radar_mangkal', { p_from: from, p_to: to, p_hour_start: h1, p_hour_end: h2 }));

// ---------- Kendaraan ----------
const VEHICLE_COLS = 'oil_interval_km,oil_reset_at';

// Hasil: { settings, logs, kmSinceReset } (log dihitung sejak terakhir ganti oli)
export const getVehicle = async () => {
  let settings = ok(await sb.from('vehicle_settings').select(VEHICLE_COLS).maybeSingle());
  if (!settings) {
    ok(await sb.from('vehicle_settings').insert({}));
    settings = ok(await sb.from('vehicle_settings').select(VEHICLE_COLS).single());
  }
  const since = settings.oil_reset_at || '1970-01-01T00:00:00Z';
  const logs = ok(
    await sb
      .from('vehicle_logs')
      .select('id,log_date,km,created_at')
      .gte('created_at', since)
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)
  );
  const kmSinceReset = logs.reduce((a, l) => a + Number(l.km), 0);
  return { settings, logs, kmSinceReset };
};
export const addKm = async (km, log_date) => ok(await sb.from('vehicle_logs').insert({ km, log_date }));
export const deleteKm = async (id) => ok(await sb.from('vehicle_logs').delete().eq('id', id));
export const resetOil = async () =>
  ok(await sb.from('vehicle_settings').update({ oil_reset_at: new Date().toISOString() }).eq('user_id', await uid()));
export const setOilInterval = async (km) =>
  ok(await sb.from('vehicle_settings').update({ oil_interval_km: km }).eq('user_id', await uid()));

// ---------- Target harian ----------
export const getDailyTarget = async () => {
  const row = ok(await sb.from('user_settings').select('daily_target').maybeSingle());
  return row ? Number(row.daily_target) : 0;
};
export const setDailyTarget = async (value) =>
  ok(await sb.from('user_settings').upsert({ user_id: await uid(), daily_target: value, updated_at: new Date().toISOString() }));

// ---------- Ekspor cadangan ----------
export const exportAll = async () => {
  const get = async (table, order = 'created_at') => ok(await sb.from(table).select('*').order(order).limit(50000));
  const [wallets, categories, targets, transactions, areas, spots, vehicle_logs] = await Promise.all([
    get('wallets'),
    get('categories'),
    get('targets'),
    get('transactions'),
    get('areas'),
    get('spots'),
    get('vehicle_logs'),
  ]);
  const user_settings = ok(await sb.from('user_settings').select('*').maybeSingle());
  const vehicle_settings = ok(await sb.from('vehicle_settings').select('*').maybeSingle());
  return {
    app: 'catatan-ojol',
    exported_at: new Date().toISOString(),
    wallets,
    categories,
    targets,
    transactions,
    areas,
    spots,
    vehicle_logs,
    user_settings,
    vehicle_settings,
  };
};
