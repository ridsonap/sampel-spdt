# Sistem Pergantian Sampel DSRT 7301 (Vercel Multi-User)
### BPS Kabupaten Kepulauan Selayar — Survei Pertanian Terintegrasi

Versi ini telah dioptimalkan khusus untuk deployment di **Vercel** dengan dukungan **Multi-User Real-time Sync** menggunakan **Vercel KV / Upstash Redis Serverless**.

---

## 📋 Apa Saja yang Perlu Anda Siapkan?

Hanya 3 hal sederhana:

1. **Akun Vercel** (Gratis):
   - Daftar/Masuk di [https://vercel.com](https://vercel.com) menggunakan akun GitHub Anda.
2. **Repositori GitHub**:
   - Push folder ini ke repositori GitHub Anda (misal `sampel-spdt-multiuser` atau branch baru).
3. **Database Vercel KV / Upstash Redis** (Gratis 1-Klik di Dashboard Vercel):
   - Di dashboard project Vercel Anda, buka tab **Storage** > Klik **Create Database** > Pilih **KV**.
   - Klik **Connect** ke project Anda. Selesai! (Semua *environment variable* `KV_REST_API_URL` dan `KV_REST_API_TOKEN` terisi otomatis oleh Vercel tanpa perlu copy-paste manual).

---

## 🚀 Langkah-langkah Deploy ke Vercel (Panduan 3 Menit)

### Cara 1: Lewat Web Dashboard Vercel (Paling Mudah)
1. Buka [https://vercel.com/new](https://vercel.com/new).
2. Pilih repositori GitHub Anda (`sampel-spdt-multiuser`).
3. Klik **Deploy**.
4. Setelah build selesai, buka tab **Storage** pada project tersebut di Vercel:
   - Klik **Create Database** ➔ pilih **KV (Key-Value)**.
   - Beri nama (misal: `dsrt-kv-selayar`) ➔ pilih region terdekat (misal `Singapore` / `ap-southeast-1`).
   - Klik **Create** ➔ Klik **Connect to Project**.
5. Klik **Redeploy** (atau buka ulang website). Web sudah **100% Multi-User Live**!

---

### Cara 2: Lewat Vercel CLI (Terminal)
Jika Anda memiliki `vercel` CLI di komputer:
```bash
cd /Volumes/work/_Projects/sampel_spdt_vercel
npx vercel
```
Ikuti instruksi di layar, lalu hubungkan database KV lewat dashboard.

---

## 🔄 Cara Kerja Multi-User

1. **Koneksi Terpusat**:
   - Saat Petugas A di Lapangan memilih sampel pengganti di HP-nya, data dikirim ke `/api/replacements` dan disimpan ke Vercel KV.
   - Petugas B atau Pengawas di kantor yang membuka web akan otomatis melihat sampel tersebut telah berstatus **DIGANTI** dan sampel cadangannya berstatus **TERKUNCI / TERPAKAI**.
2. **Polling Otomatis & Tombol Sinkron**:
   - Web otomatis melakukan background sync setiap 25 detik.
   - Tersedia tombol **"Sinkron"** di header untuk memperbarui data seketika kapan pun dibutuhkan.
3. **Offline Resilience**:
   - Jika koneksi di pulau/lapangan terputus, data tetap tersimpan di `localStorage` peramban petugas dan akan diunggah kembali saat koneksi pulih.

---

## 🔐 Kredensial Login Petugas

- **Username**: `bps7301`
- **Password**: `selayar2026`
- **PIN Cepat**: `7301`

*(Informasi kredensial ini tidak ditampilkan di layar login publik untuk keamanan data).*
