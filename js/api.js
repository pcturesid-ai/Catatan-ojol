import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

// ---------- Autentikasi ----------
export const getSession = async () => unwrap(await sb.auth.getSession()).session;
export const signIn = async (email, password) => unwrap(await sb.auth.signInWithPassword({ email, password }));
export const signUp = async (email, password) => unwrap(await sb.auth.signUp({ email, password }));
export const signOut = async () => {
  const { error } = await sb.auth.signOut();
  if (error) throw error;
};
export const onAuthChange = (cb) => sb.auth.onAuthStateChange((_event, session) => cb(session));

// ---------- Transaksi ----------
export const listTx = async (from, to) =>
  unwrap(
    await sb
      .from('transactions')
      .select('id,type,amount,category,note,trx_date,created_at')
      .gte('trx_date', from)
      .lte('trx_date', to)
      .order('trx_date', { ascending: false })
      .order('created_at', { ascending: false })
  );

export const addTx = async (tx) => unwrap(await sb.from('transactions').insert(tx).select().single());
export const deleteTx = async (id) => unwrap(await sb.from('transactions').delete().eq('id', id));

// ---------- Target harian ----------
export const getTarget = async () => {
  const row = unwrap(await sb.from('user_settings').select('daily_target').maybeSingle());
  return row ? Number(row.daily_target) : 0;
};

export const setTarget = async (userId, value) =>
  unwrap(
    await sb
      .from('user_settings')
      .upsert({ user_id: userId, daily_target: value, updated_at: new Date().toISOString() })
  );
