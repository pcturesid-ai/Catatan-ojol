// ============================================================
// MOCATAT - BACKEND (backend.js)
// Lapisan kompatibel: fungsi bernama sama dengan Firebase Auth + Firestore,
// tetapi berjalan di atas Supabase. Dengan begitu kode aplikasi (core.js,
// fitur-*.js) tidak perlu diubah banyak.
//
//  - Auth       -> Supabase Auth (email + kata sandi)
//  - Firestore  -> tabel public.docs (path dokumen -> JSON), dijaga RLS
//  - Messaging  -> dinonaktifkan (notifikasi push FCM tidak dipakai lagi)
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Kunci "publishable" memang aman ada di sisi klien. Keamanan data dijaga
// oleh Row Level Security di database (lihat tabel public.docs).
const SUPABASE_URL = "https://yhmpqegnfvexehgebkmb.supabase.co";
const SUPABASE_KEY = "sb_publishable_JLOaynwVxf1eUsjWOVN1pA_0gLPIddY";

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

// ------------------------------------------------------------
// Pembantu
// ------------------------------------------------------------
const clean = (x) => JSON.parse(JSON.stringify(x === undefined ? {} : x));

function authError(error) {
    const msg = String((error && error.message) || error || '');
    const e = new Error(msg);
    e.code = 'auth/unknown';
    e.userMessage = null;
    if (/invalid login credentials/i.test(msg)) {
        e.code = 'auth/invalid-credential';
        e.userMessage = 'Gagal: Email atau password salah.';
    } else if (/email not confirmed/i.test(msg)) {
        e.code = 'auth/email-not-confirmed';
        e.userMessage = 'Email belum dikonfirmasi. Cek kotak masuk emailmu lalu tekan link konfirmasi.';
    } else if (/already registered|already been registered/i.test(msg)) {
        e.code = 'auth/email-already-in-use';
        e.userMessage = 'Email ini sudah terdaftar. Silakan masuk.';
    } else if (/password should be at least|weak password/i.test(msg)) {
        e.code = 'auth/weak-password';
        e.userMessage = 'Password terlalu pendek (minimal 6 karakter).';
    } else if (/rate limit|too many/i.test(msg)) {
        e.code = 'auth/too-many-requests';
        e.userMessage = 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.';
    } else if (/failed to fetch|networkerror|load failed/i.test(msg)) {
        e.code = 'auth/network-request-failed';
        e.userMessage = 'Tidak ada koneksi internet.';
    }
    return e;
}

// ------------------------------------------------------------
// AUTH
// ------------------------------------------------------------
const wrapUser = (u) => u ? ({
    uid: u.id,
    email: u.email || null,
    displayName: (u.user_metadata && (u.user_metadata.display_name || u.user_metadata.full_name || u.user_metadata.name)) || null,
    emailVerified: !!u.email_confirmed_at
}) : null;

const authObj = { currentUser: null };

export const initializeApp = () => ({});
export const getAuth = () => authObj;
export const getFirestore = () => ({ __db: true });

// Callback dipanggil hanya saat pengguna benar-benar berganti (masuk / keluar),
// bukan setiap token diperbarui, sama seperti Firebase.
export function onAuthStateChanged(_auth, cb) {
    let last;
    const { data } = sb.auth.onAuthStateChange((event, session) => {
        if (event === 'TOKEN_REFRESHED' || event === 'PASSWORD_RECOVERY') return;
        const user = wrapUser(session && session.user);
        authObj.currentUser = user;
        const uid = user ? user.uid : null;
        if (event === 'USER_UPDATED' && uid === last) return;
        if (uid === last) return;
        last = uid;
        // Tunda: memanggil Supabase langsung di dalam callback ini bisa membuntu.
        setTimeout(() => cb(user), 0);
    });
    return () => data.subscription.unsubscribe();
}

export async function signInWithEmailAndPassword(_auth, email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw authError(error);
    authObj.currentUser = wrapUser(data.user);
    return { user: authObj.currentUser };
}

// extra.displayName dikirim sebagai metadata supaya nama tersimpan walau
// pendaftaran butuh konfirmasi email dulu.
export async function createUserWithEmailAndPassword(_auth, email, password, extra) {
    const name = (extra && extra.displayName) || '';
    const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { display_name: name }, emailRedirectTo: location.origin + '/' }
    });
    if (error) throw authError(error);
    // Email sudah terdaftar: Supabase tidak memberi error, tapi daftar identitasnya kosong.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw authError('User already registered');
    }
    if (!data.session) {
        const e = new Error('Konfirmasi email diperlukan');
        e.code = 'auth/email-confirmation-required';
        e.userMessage = 'Pendaftaran berhasil! Cek emailmu dan tekan link konfirmasi, lalu masuk.';
        throw e;
    }
    authObj.currentUser = wrapUser(data.user);
    return { user: authObj.currentUser };
}

export async function updateProfile(user, { displayName }) {
    const { data, error } = await sb.auth.updateUser({ data: { display_name: displayName } });
    if (error) throw authError(error);
    if (user) user.displayName = displayName;
    authObj.currentUser = wrapUser(data.user);
}

export async function signOut() {
    const { error } = await sb.auth.signOut();
    if (error) throw authError(error);
}

export async function sendPasswordResetEmail(_auth, email) {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/' });
    if (error) throw authError(error);
}

// Apakah pengguna yang sedang masuk terdaftar sebagai admin (tabel app_admins)?
export async function isAdminUser() {
    const { data, error } = await sb.rpc('is_admin');
    return !error && data === true;
}

// Tautan "lupa password" membawa pengguna kembali ke sini; minta kata sandi baru.
sb.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') setTimeout(showRecoveryUI, 0);
});

function showRecoveryUI() {
    if (document.getElementById('recovery-overlay')) return;
    const wrap = document.createElement('div');
    wrap.id = 'recovery-overlay';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:20px;font-family:inherit;';
    wrap.innerHTML = `
        <form style="background:#fff;border-radius:20px;padding:24px;width:100%;max-width:360px;box-shadow:0 10px 40px rgba(0,0,0,.25);">
            <h3 style="margin:0 0 6px;font-size:18px;color:#1a2b3c;">Buat Password Baru</h3>
            <p style="margin:0 0 16px;font-size:13px;color:#64748b;">Masukkan password baru untuk akunmu (minimal 6 karakter).</p>
            <input id="recovery-pass" type="password" minlength="6" required autocomplete="new-password" placeholder="Password baru"
                style="width:100%;box-sizing:border-box;padding:14px;border:1px solid #cbd5e1;border-radius:12px;font-size:15px;outline:none;">
            <p id="recovery-msg" style="min-height:18px;margin:10px 0 0;font-size:13px;color:#dc2626;"></p>
            <button type="submit" style="width:100%;margin-top:8px;padding:14px;border:0;border-radius:12px;background:#249a95;color:#fff;font-weight:700;font-size:15px;cursor:pointer;">Simpan Password</button>
        </form>`;
    document.body.appendChild(wrap);
    wrap.querySelector('form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const msg = wrap.querySelector('#recovery-msg');
        const pass = wrap.querySelector('#recovery-pass').value;
        msg.textContent = 'Menyimpan...';
        msg.style.color = '#64748b';
        const { error } = await sb.auth.updateUser({ password: pass });
        if (error) {
            msg.style.color = '#dc2626';
            msg.textContent = (authError(error).userMessage) || error.message;
            return;
        }
        msg.style.color = '#2e7d32';
        msg.textContent = 'Password berhasil diganti.';
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        setTimeout(() => wrap.remove(), 1200);
    });
}

// ------------------------------------------------------------
// MESSAGING (FCM) - dinonaktifkan. Aplikasi memakai notifikasi lokal browser.
// ------------------------------------------------------------
export const getMessaging = () => null;
export const getToken = async () => null;
export const onMessage = () => () => {};
export const isSupported = () => Promise.resolve(false);

// ------------------------------------------------------------
// FIRESTORE -> tabel public.docs
// ------------------------------------------------------------
const joinPath = (segs) => segs.map(String).join('/');

export const doc = (_db, ...segs) => ({ __type: 'doc', path: joinPath(segs), id: String(segs[segs.length - 1]) });
export const collection = (_db, ...segs) => ({ __type: 'col', path: joinPath(segs) });
export const deleteField = () => ({ __delete__: true });

const makeSnap = (ref, data) => ({
    id: ref.id,
    ref,
    exists: () => data !== undefined,
    data: () => (data === undefined ? undefined : JSON.parse(JSON.stringify(data)))
});

export async function getDoc(ref) {
    const { data, error } = await sb.from('docs').select('data').eq('path', ref.path).maybeSingle();
    if (error) throw error;
    return makeSnap(ref, data ? data.data : undefined);
}

export async function getDocs(col) {
    const PAGE = 1000;
    const rows = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await sb
            .from('docs')
            .select('path,data')
            .eq('parent', col.path)
            .order('path')
            .range(from, from + PAGE - 1);
        if (error) throw error;
        rows.push(...data);
        if (data.length < PAGE) break;
    }
    const docs = rows.map((r) => makeSnap(doc(null, ...r.path.split('/')), r.data));
    return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn) => docs.forEach(fn) };
}

async function runOps(ops) {
    if (!ops.length) return;
    const { error } = await sb.rpc('docs_batch', { ops });
    if (error) throw error;
}

// Setiap user mendaftarkan dirinya ke registri lewat fungsi khusus (aman),
// karena dokumen registri dipakai bersama dan hanya boleh diubah admin.
async function touchRegistry(patch) {
    const { error } = await sb.rpc('registry_touch', { p: patch });
    if (error) throw error;
}

const isOwnRegistryPatch = (ref, data, opts) => {
    if (ref.path !== 'app_settings/user_registry' || !(opts && opts.merge)) return false;
    const me = authObj.currentUser && authObj.currentUser.uid;
    const keys = Object.keys(data || {});
    return !!me && keys.length === 1 && keys[0] === me && data[me] && data[me].__delete__ !== true;
};

export async function setDoc(ref, data, opts) {
    const payload = clean(data);
    if (isOwnRegistryPatch(ref, payload, opts)) return touchRegistry(payload);
    return runOps([{ op: opts && opts.merge ? 'merge' : 'set', path: ref.path, data: payload }]);
}

export async function updateDoc(ref, data) {
    return runOps([{ op: 'merge', path: ref.path, data: clean(data) }]);
}

export async function deleteDoc(ref) {
    return runOps([{ op: 'delete', path: ref.path }]);
}

// Operasi batch dijalankan dalam satu transaksi database (semua berhasil atau tidak sama sekali).
export function writeBatch() {
    const ops = [];
    const api = {
        set(ref, data, opts) { ops.push({ op: opts && opts.merge ? 'merge' : 'set', path: ref.path, data: clean(data) }); return api; },
        update(ref, data) { ops.push({ op: 'merge', path: ref.path, data: clean(data) }); return api; },
        delete(ref) { ops.push({ op: 'delete', path: ref.path }); return api; },
        commit: () => runOps(ops)
    };
    return api;
}

// Pengganti onSnapshot: ambil sekarang, lalu periksa berkala dan kabari hanya bila isinya berubah.
export function onSnapshot(ref, onNext, onError) {
    let stopped = false;
    let lastJson = null;
    const tick = async () => {
        if (stopped) return;
        try {
            const snap = await getDoc(ref);
            const json = JSON.stringify(snap.exists() ? snap.data() : null);
            if (json !== lastJson) {
                lastJson = json;
                onNext(snap);
            }
        } catch (err) {
            if (onError) onError(err);
        }
    };
    tick();
    const timer = setInterval(() => { if (!document.hidden) tick(); }, 30000);
    return () => { stopped = true; clearInterval(timer); };
}
