// Kunci "publishable" Supabase memang aman ada di sisi klien.
// Keamanan data dijaga oleh Row Level Security di database:
// setiap pengguna hanya bisa membaca dan mengubah datanya sendiri.
export const SUPABASE_URL = 'https://yhmpqegnfvexehgebkmb.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_JLOaynwVxf1eUsjWOVN1pA_0gLPIddY';

export const SERVICES = [
  { name: 'GrabBike', icon: '🏍️' },
  { name: 'GrabBike Hemat', icon: '🛵' },
  { name: 'GrabCar', icon: '🚗' },
  { name: 'GrabFood', icon: '🍔' },
  { name: 'GrabExpress', icon: '📦' },
  { name: 'GrabMart', icon: '🛒' },
];

export const WALLET_KINDS = {
  cash: { label: 'Tunai', icon: '💵' },
  bank: { label: 'Bank', icon: '🏦' },
  ewallet: { label: 'E-Wallet', icon: '📲' },
};

export const CATEGORY_ICONS = [
  '🏍️', '🎁', '⭐', '💰', '⛽', '🍜', '🔧', '📱', '🅿️', '🧾',
  '🏠', '🛒', '💊', '👕', '🎮', '📚', '☕', '🚿', '👨‍👩‍👧', '🛡️',
];

// Waktu dalam sehari untuk radar mangkal (jam mulai - jam akhir, inklusif)
export const DAYPARTS = [
  { key: 'all', label: 'Semua jam', start: 0, end: 23 },
  { key: 'now', label: 'Jam sekarang', start: null, end: null },
  { key: 'morning', label: 'Pagi (05:00 - 11:59)', start: 5, end: 11 },
  { key: 'noon', label: 'Siang (12:00 - 14:59)', start: 12, end: 14 },
  { key: 'evening', label: 'Sore (15:00 - 18:59)', start: 15, end: 18 },
  { key: 'night', label: 'Malam (19:00 - 04:59)', start: 19, end: 4 },
];
