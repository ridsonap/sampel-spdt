# Sistem Pergantian Sampel DSRT 7301
### BPS Kabupaten Kepulauan Selayar — Survei Pertanian Terintegrasi

Aplikasi web responsif dan minimalis untuk mempermudah petugas lapangan dan pengawas dalam melakukan pergantian sampel rumah tangga pertanian (DSRT 7301) sesuai kaidah metodologi BPS.

🌐 **Demo Live di GitHub Pages**: [https://ridsonap.github.io/sampel-spdt/](https://ridsonap.github.io/sampel-spdt/)  
📄 **Product Requirement Document**: [Baca Dokumen PRD Lengkap (PRD.md)](./PRD.md)  
📊 **Sumber Data Asli**: [Google Spreadsheet DSRT 7301](https://docs.google.com/spreadsheets/d/1ghTRL9t-fjj7Cclu_KIB6HXnScEI9yIr1jo9khocYzQ/edit?usp=sharing)

---

## 🔐 Kredensial Login (Default)

Untuk keamanan data operasional, aplikasi dilengkapi dengan Login Gate:
- **Username**: `bps7301`
- **Password**: `selayar2026`
- **PIN Cepat**: `7301`
- *Tersedia tombol "Isi Otomatis Kredensial Demo" pada layar login untuk akses cepat.*

---

## ✨ Fitur Utama

1. **4 Pilihan Ruang Lingkup Pergantian Sampel**:
   - 🟢 **Dalam 1 SLS**: Prioritas utama, pengganti berasal dari SLS/RT/Dusun yang sama persis.
   - 🔵 **1 Desa**: Pengganti berasal dari desa yang sama (antar SLS).
   - 🟣 **1 Kecamatan**: Pengganti berasal dari kecamatan yang sama (antar desa).
   - 🟠 **Lintas Kecamatan**: Pengganti berasal dari seluruh kecamatan di Kab. Kepulauan Selayar.

2. **Smart Matching & Relevansi Karakteristik**:
   - Pemfilteran ketat kesesuaian **Subsektor** (Hortikultura, Peternakan, Perikanan Tangkap, Perikanan Budidaya, Perkebunan, Kehutanan).
   - Prioritas kesesuaian **Strata** (Strata 1 / Strata 2).
   - Penanda kecocokan **KBLI 5-Digit Identik**.

3. **Integritas Data & Pencegahan Duplikasi**:
   - Sampel cadangan yang sudah terpilih otomatis berstatus `TERPAKAI` dan tidak akan muncul di rekomendasi sampel lain.
   - Pelacakan alasan pergantian baku BPS (Responden Menolak, Pindah Domisili, Meninggal, dsb.).

4. **Rollback & Pembatalan (Undo)**:
   - Sampel yang sudah diganti dapat ditinjau detailnya dan dibatalkan (undo) kapan saja untuk mengembalikan status cadangan ke pool tersedia.

5. **Ekspor Data Sekali Klik**:
   - **Ekspor Berita Acara (CSV)**: Berita Acara Pergantian Sampel (BAPS) siap lapor.
   - **Ekspor DSRT Mutakhir (CSV)**: Dataset lengkap 1.643 unit dengan status termutakhir dan pemetaan pasangan pengganti.

6. **Desain Minimalis & 100% Responsif**:
   - Nyaman digunakan di smartphone Android/iOS petugas lapangan maupun laptop/PC pengawas.
   - Bekerja secara offline-resilient dengan sinkronisasi `localStorage`.

---

## 🛠️ Struktur Berkas

```
sampel_spdt/
├── PRD.md              # Product Requirement Document (PRD) Lengkap
├── README.md           # Dokumentasi & Panduan Aplikasi
├── index.html          # Antarmuka Responsif (Login + Dashboard + Modals)
├── app.js              # State management, matching algorithm, filtering, & export
├── data.js             # Dataset DSRT 7301 terkompresi (1.643 baris sampel)
└── data_sample.csv     # File CSV referensi cadangan
```

---

## 🚀 Menjalankan Secara Lokal

Cukup buka berkas `index.html` langsung di peramban (Chrome, Edge, Firefox, Safari) atau gunakan server lokal:
```bash
python3 -m http.server 8000
```
Buka `http://localhost:8000` pada peramban Anda.
