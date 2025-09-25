# Credit Spend + Generator (Vite + React + TS)

POC sederhana untuk memanggil endpoint credit-spend lalu melanjutkan ke generator dummy (image/music).

## Setup

1. Salin `.env.example` ke `.env` lalu isi kunci API KEY MAYAR:

```
VITE_API_KEY=your_api_key_here_MAYAR
```

2. Install dependencies dan jalankan dev server:

```
npm install
npm run dev
```

3. Buka URL yang ditampilkan oleh Vite (default: http://localhost:5173).

## Catatan

- Aplikasi memanggil `POST https://api.mayar.club/credit/v1/credit/customer/spend` sebelum melakukan fetch ke resource generator.
- Jika CORS terhadap domain `api.mayar.club` bermasalah saat development, gunakan proxy Vite atau jalankan via backend Anda sebagai perantara.
- Gambar diambil dari `https://picsum.photos/300`. Musik contoh dari SoundHelix. Anda bisa ganti URL di `src/App.tsx`.

## Struktur

- `src/api/credit.ts` — fungsi request credit-spend + interface TypeScript.
- `src/App.tsx` — UI: input payload, tombol generate, state loading/error, dan hasil image/audio.

