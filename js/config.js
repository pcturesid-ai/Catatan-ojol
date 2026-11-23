// Kunci "publishable" Supabase memang aman ada di sisi klien.
// Keamanan data dijaga oleh Row Level Security di database:
// setiap pengguna hanya bisa membaca dan mengubah catatannya sendiri.
export const SUPABASE_URL = 'https://yhmpqegnfvexehgebkmb.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_JLOaynwVxf1eUsjWOVN1pA_0gLPIddY';

export const INCOME_CATEGORIES = ['Order', 'Tip', 'Bonus', 'Lainnya'];
export const EXPENSE_CATEGORIES = ['Bensin', 'Makan', 'Servis', 'Pulsa/Kuota', 'Parkir', 'Lainnya'];
