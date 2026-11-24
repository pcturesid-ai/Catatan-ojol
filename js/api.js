import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

const ok = ({ data, error }) => {
  if (error) throw error;
  return data;
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
export const saveWallet = async (w) =>
  w.id
    ? ok(await sb.from('wallets').update({ name: w.name, kind: w.kind, initial_balance: w.initial_balance }).eq('id', w.id))
    : ok(await sb.from('wallets').insert({ name: w.name, kind: w.kind, initial_balance: w.initial_balance }));
export const deleteWallet = async (id) => ok(await sb.from('wallets').delete().eq('id', id));

// ---------- Kategori ----------
export const listCategories = async () =>
  ok(await sb.from('categories').select('id,type,name,icon,monthly_budget,created_at').order('created_at'));
export const saveCategory = async (c) => {
  const row = { type: c.type, name: c.name, icon: c.icon, monthly_budget: c.monthly_budget || null };
  return c.id
    ? ok(await sb.from('categories').update(row).eq('id', c.id))
    : ok(await sb.from('categories').insert(row));
};
export const deleteCategory = async (id) => ok(await sb.from('categories').delete().eq('id', id));

// ---------- Transaksi ----------
export const listTx = async (from, to, limit = 1000) =>
  ok(
    await sb
      .from('transactions')
      .select('*')
      .gte('trx_date', from)
      .lte('trx_date', to)
      .order('trx_date', { ascending: false })
      .order('trx_time', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)
  );
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
export const saveTarget = async (t) => {
  const row = {
    kind: t.kind,
    name: t.name,
    goal_amount: t.goal_amount,
    initial_amount: t.initial_amount,
    market_value: t.kind === 'investment' ? t.market_value : null,
    deadline: t.deadline || null,
  };
  return t.id ? ok(await sb.from('targets').update(row).eq('id', t.id)) : ok(await sb.from('targets').insert(row));
};
export const setMarketValue = async (id, value) => ok(await sb.from('targets').update({ market_value: value }).eq('id', id));
export const deleteTarget = async (id) => ok(await sb.from('targets').delete().eq('id', id));

// ---------- Lokasi mangkal ----------
export const listAreas = async () => ok(await sb.from('areas').select('id,name').order('created_at'));
export const listSpots = async () => ok(await sb.from('spots').select('id,area_id,name').order('created_at'));
export const addArea = async (name) => ok(await sb.from('areas').insert({ name }));
export const deleteArea = async (id) => ok(await sb.from('areas').delete().eq('id', id));
export const addSpot = async (area_id, name) => ok(await sb.from('spots').insert({ area_id, name }));
export const deleteSpot = async (id) => ok(await sb.from('spots').delete().eq('id', id));
export const radar = async (from, to, h1, h2) =>
  ok(await sb.rpc('radar_mangkal', { p_from: from, p_to: to, p_hour_start: h1, p_hour_end: h2 }));

// ---------- Kendaraan ----------
export const getVehicle = async () => {
  let row = ok(await sb.from('vehicle_settings').select('oil_interval_km,oil_reset_at').maybeSingle());
  if (!row) {
    ok(await sb.from('vehicle_settings').insert({}));
    row = ok(await sb.from('vehicle_settings').select('oil_interval_km,oil_reset_at').single());
  }
  return row;
};
export const listVehicleLogs = async (sinceIso) =>
  ok(
    await sb
      .from('vehicle_logs')
      .select('id,log_date,km,created_at')
      .gte('created_at', sinceIso)
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)
  );
export const addVehicleLog = async (km, log_date) => ok(await sb.from('vehicle_logs').insert({ km, log_date }));
export const deleteVehicleLog = async (id) => ok(await sb.from('vehicle_logs').delete().eq('id', id));
export const resetOil = async (userId) =>
  ok(await sb.from('vehicle_settings').update({ oil_reset_at: new Date().toISOString() }).eq('user_id', userId));
export const setOilInterval = async (userId, km) =>
  ok(await sb.from('vehicle_settings').update({ oil_interval_km: km }).eq('user_id', userId));

// ---------- Target harian ----------
export const getDailyTarget = async () => {
  const row = ok(await sb.from('user_settings').select('daily_target').maybeSingle());
  return row ? Number(row.daily_target) : 0;
};
export const setDailyTarget = async (userId, value) =>
  ok(await sb.from('user_settings').upsert({ user_id: userId, daily_target: value, updated_at: new Date().toISOString() }));
