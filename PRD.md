# PRODUCT REQUIREMENT DOCUMENT (PRD)
## SISTEM INFORMASI PERGANTIAN SAMPEL RUMAH TANGGA PERTANIAN (DSRT 7301)
### KABUPATEN KEPULAUAN SELAYAR — BPS SULAWESI SELATAN

---

## 1. DOKUMEN KONTROL & RINGKASAN EKSEKUTIF

| Parameter | Keterangan |
| :--- | :--- |
| **Nama Produk** | Web Pergantian Sampel DSRT (Daftar Sampel Rumah Tangga) |
| **Nomor Dokumen** | PRD-BPS7301-SAMPEL-2026-V1.0 |
| **Wilayah Cakupan** | Kabupaten Kepulauan Selayar (Kode BPS: 7301), 11 Kecamatan |
| **Total Sampel** | 1.643 Unit (267 Sampel Utama, 1.376 Sampel Pengganti) |
| **Dataset Sumber** | [Google Spreadsheet DSRT 7301](https://docs.google.com/spreadsheets/d/1ghTRL9t-fjj7Cclu_KIB6HXnScEI9yIr1jo9khocYzQ/edit?usp=sharing) |
| **Target Deployment** | GitHub Pages (Static Web App, Zero-Config Hosting) |
| **Keamanan** | Login Gate (Sesi terproteksi, client-side authentication) |
| **Target Pengguna** | PCL (Pencacah Lapangan), PML (Pengawas Lapangan), Admin Sampling BPS Kabupaten |

### 1.1 Ringkasan Eksekutif
Dalam pelaksanaan survei/sensus pertanian Badan Pusat Statistik (BPS) di tingkat lapangan, petugas sering menghadapi kendala di mana unit sampel utama tidak dapat dicacah (misalnya responden menolak, pindah domisili ke luar wilayah, meninggal dunia tanpa pengganti, alih usaha non-pertanian, atau responden tidak ditemukan setelah 3 kali kunjungan).

Untuk menjaga validitas estimasi statistik dan keterwakilan populasi tanpa merusak kaidah probabilitas penarikan sampel, pergantian sampel harus mengikuti hierarki spasial dan kesesuaian karakteristik ekonomi. Dokumen ini mendefinisikan kebutuhan sistem web aplikasi mandiri, responsif, minimalis, dan aman untuk mengelola alur pergantian sampel utama dengan 4 pilihan ruang lingkup:
1. **Dalam 1 SLS (Satuan Lingkungan Setempat) yang sama**
2. **Dalam 1 Desa yang sama**
3. **Dalam 1 Kecamatan yang sama**
4. **Lintas Kecamatan (dalam Kabupaten Kepulauan Selayar)**

---

## 2. LATAR BELAKANG & TUJUAN BISNIS

### 2.1 Latar Belakang Masalah
1. **Pencarian Manual Memakan Waktu**: Saat ini petugas di lapangan mencocokkan sampel pengganti dari dokumen fisik atau spreadsheet besar berisi ribuan baris, yang rentan salah pilih dan memakan waktu.
2. **Risiko Pelanggaran Metodologi**: Pemilihan sampel pengganti yang salah (misal: petani hortikultura diganti dengan nelayan tangkap, atau strata ukuran usaha berbeda) menyebabkan bias statistik.
3. **Risiko Pengganti Ganda (Double Allocation)**: Tanpa sistem yang mencatat status 'terpakai', satu sampel pengganti dapat dipakai oleh dua petugas berbeda.
4. **Kebutuhan Berita Acara Transparan**: Setiap pergantian sampel wajib memiliki alasan jelas dan rekam jejak untuk penyusunan Berita Acara Pergantian Sampel (BAPS).

### 2.2 Tujuan Produk
1. Menyediakan antarmuka web yang **minimalis, bersih, dan responsif** (dapat diakses nyaman dari HP petugas di lapangan maupun laptop pengawas).
2. Menyediakan **rekomendasi otomatis kandidat pengganti** berdasarkan hierarki 4 ruang lingkup dan kesesuaian Subsektor serta Strata.
3. Mengunci sampel pengganti yang sudah digunakan secara instan agar tidak terjadi duplikasi.
4. Memberikan fitur **Rollback/Undo** jika terjadi pembatalan atau kekeliruan pemilihan di lapangan.
5. Menghasilkan **ekspor Berita Acara dan DSRT Mutakhir** dalam format CSV/Excel dengan satu klik.
6. Memproteksi akses data dengan sistem **Login Otentikasi** sebelum dapat melihat atau memanipulasi sampel.

---

## 3. PENGGUNA & PERSONA (USER PERSONAS)

### Persona 1: Petugas Pencacah Lapangan (PCL)
- **Karakteristik**: Mengakses via smartphone di lapangan dengan koneksi internet bervariasi.
- **Kebutuhan**: Membuka aplikasi dengan cepat, mencari sampel utama yang gagal dicacah, memilih alasan pergantian, melihat rekomendasi pengganti di SLS yang sama terlebih dahulu, lalu menetapkan pengganti.

### Persona 2: Pengawas Lapangan (PML) / Koseka
- **Karakteristik**: Mengakses via tablet atau laptop.
- **Kebutuhan**: Memeriksa apakah sampel utama yang diganti oleh PCL sudah sesuai kaidah (subsektor sama, strata sesuai), menyetujui pergantian, dan memeriksa rekapitulasi desa.

### Persona 3: Admin Sampling / Tim Pengolahan BPS Kabupaten
- **Karakteristik**: Mengakses via komputer kantor di BPS Kab. Kepulauan Selayar.
- **Kebutuhan**: Melihat rasio pergantian sampel se-kabupaten, mengunduh Berita Acara Pergantian Sampel (BAPS), dan mengekspor dataset DSRT termutakhir untuk sinkronisasi ke sistem pengolahan/CAPI (FASIH).

---

## 4. METODOLOGI & LOGIKA BISNIS PERGANTIAN SAMPEL

### 4.1 Pemicu Pergantian Sampel (Standard Operating Procedure)
Pengguna wajib memilih salah satu alasan baku saat mengganti sampel:
1. **Responden Menolak (Refusal)**: Responden tidak bersedia diwawancarai setelah pendekatan persuasif.
2. **Pindah Domisili (Relocation)**: Responden telah pindah ke luar wilayah tugas/wilayah kabupaten.
3. **Responden Meninggal Dunia**: Tidak ada anggota rumah tangga lain yang mengelola usaha pertanian tersebut.
4. **Bukan Usaha Pertanian (Alih Usaha / Tutup)**: Lahan beralih fungsi atau sudah tidak beroperasi sebagai unit pertanian.
5. **Tidak Dapat Ditemui**: Telah dikunjungi minimal 3 kali pada waktu berbeda tanpa hasil.
6. **Sampel Ganda / Anomali Data Lapangan**: Terdapat duplikasi identitas responden pada kerangka sampel.
7. **Lainnya**: Alasan khusus lapangan dengan wajib menyertakan catatan tertulis.

### 4.2 Hierarki 4 Ruang Lingkup Spasial
Sistem menyediakan 4 tab/opsi ruang lingkup pemilihan:

| Tingkat Ruang Lingkup | Syarat Identitas Wilayah | Prioritas | Keterangan |
| :--- | :--- | :---: | :--- |
| **1. Dalam 1 SLS** | `Kode Kec` SAMA, `Kode Desa` SAMA, `Kode SLS` SAMA | Prioritas 1 (Utama) | Pengganti berada di lingkungan rukun tetangga/dusun yang sama persis. |
| **2. 1 Desa** | `Kode Kec` SAMA, `Kode Desa` SAMA (SLS boleh beda) | Prioritas 2 | Digunakan jika cadangan dalam SLS habis. |
| **3. 1 Kecamatan** | `Kode Kec` SAMA (Desa & SLS boleh beda) | Prioritas 3 | Digunakan jika cadangan dalam 1 desa tidak tersedia. |
| **4. Lintas Kecamatan** | `Kode Kec` BEDA (kecamatan asal tidak termasuk), dalam Kab. Kepulauan Selayar | Prioritas 4 (Darurat) | Digunakan jika seluruh cadangan di kecamatan asal telah habis/tidak sesuai. |

### 4.3 Aturan Kesesuaian Karakteristik (Matching Rules)
1. **Kesesuaian Subsektor (Wajib / Strict Match by Default)**:
   - Sampel Utama Subsektor `HORTIKULTURA` hanya boleh diganti oleh kandidat `HORTIKULTURA`.
   - Tersedia toggle "Wajib Subsektor Sama" (default: Aktif). Jika dimatikan oleh supervisor dengan otorisasi khusus, sistem menampilkan peringatan deviasi metodologi.
2. **Kesesuaian Strata (Wajib / Strict Match by Default)**:
   - Sampel Utama Strata `1` hanya boleh diganti oleh Strata `1`, Strata `2` dengan Strata `2`.
   - Tersedia toggle "Wajib Strata Sama" (default: Aktif). Jika dimatikan oleh supervisor dengan otorisasi khusus, sistem menampilkan peringatan deviasi metodologi; kandidat dengan strata identik tetap diberi skor lebih tinggi dan ditempatkan di urutan teratas.
3. **Kesesuaian KBLI 5-Digit (Nice to Have)**:
   - Menampilkan badge "KBLI Identik" jika kode 5 digit (misal `01220` Pertanian Buah Tropis) sama persis.

### 4.4 Skor Algoritma Rekomendasi (Smart Match Score)
Setiap kandidat dihitung skor relevansinya:
$$\text{Score} = S_{\text{wilayah}} + S_{\text{subsektor}} + S_{\text{strata}} + S_{\text{kbli}}$$
- $S_{\text{wilayah}}$: SLS Sama (+40 poin), Desa Sama (+30 poin), Kecamatan Sama (+20 poin), Lintas Kec (+10 poin).
- $S_{\text{subsektor}}$: Subsektor Sama (+50 poin).
- $S_{\text{strata}}$: Strata Sama (+20 poin).
- $S_{\text{kbli}}$: Kode KBLI Sama (+10 poin).
Kandidat teratas adalah yang memiliki skor tertinggi (100–120 poin).

### 4.5 Siklus Hidup Status Sampel
```
[SAMPEL UTAMA] ──(Belum Diganti)──> Status: AKTIF (Hijau)
      │
      ├──(Diproses Ganti)─────────> Status: DIGANTI (Kuning) ──(Undo)──> Status: AKTIF
      
[SAMPEL CADANGAN] ──(Belum Terpilih)──> Status: TERSEDIA (Biru)
      │
      ├──(Dipilih sebagai pengganti)──> Status: TERPAKAI (Abu/Terkunci) ──(Undo)──> Status: TERSEDIA
```

---

## 5. PERSYARATAN FUNGSIONAL (FUNCTIONAL REQUIREMENTS)

### FR-1: Autentikasi Pengguna, Tingkatan Peran (RBAC) & Keamanan Sesi
- **FR-1.1**: Tampilan Login Gate modern sebelum masuk ke modul utama.
- **FR-1.2**: Tingkatan Peran & Kredensial Pengguna (Role-Based Access Control):
  1. **Administrator Sampling (`admin`)**:
     - Username: `admin`
     - Password: `akunadmin`
     - Hak Akses: Penuh (Input/Undo pergantian sampel, Sinkronisasi Cloud, Reset Data Awal, dan **Eksklusif Hak Unduh Ekspor Berita Acara & DSRT Mutakhir**).
  2. **Petugas Lapangan (`petugas`)**:
     - Username: `petugas`
     - Password: `1234`
     - Hak Akses: Input & Undo pergantian sampel lapangan, pencarian kandidat, sinkronisasi cloud. Akses unduh ekspor file CSV dibatasi dengan proteksi sistem.
- **FR-1.3**: Sesi disimpan di `sessionStorage` sehingga sesi aktif terjaga selama tab terbuka dan otomatis keluar saat browser ditutup.
- **FR-1.4**: Tombol Logout jelas di header untuk mengakhiri sesi seketika.

### FR-2: Dashboard Metrik & Indikator Kunci (KPI)
- Menampilkan 4 kartu ringkasan real-time:
  1. **Total Sampel Utama**: 267 sampel.
  2. **Sampel Telah Diganti**: Jumlah dan persentase penggantian.
  3. **Sampel Aktif (Belum Diganti)**: Sisa sampel utama asli yang berjalan.
  4. **Cadangan Tersedia**: Jumlah cadangan yang belum terpakai (dari 1.376 unit).

### FR-3: Filter & Pencarian Cepat
- **Pencarian Bebas (Live Search)**: Nama Kepala Keluarga, Kode Identitas (misal `7301010 - U - 94`), atau Alamat.
- **Filter Dropdown**:
  - Filter Kecamatan, **multi-pilih** (11 Kecamatan: Benteng, Bontoharu, Bontomanai, Bontomatene, Bontosikuyu, Buki, Pasilambena, Pasimarannu, Pasimassunggu, Pasimassunggu Timur, Takabonerate).
  - Filter Desa, **multi-pilih** (dinamis sesuai kecamatan yang dipilih, dikelompokkan per kecamatan).
  - Aturan gabungan: beberapa kecamatan digabung dengan OR; desa terpilih hanya mempersempit kecamatan asalnya, sehingga kecamatan terpilih yang tidak memiliki desa terpilih tetap ditampilkan seluruhnya.
  - Filter Subsektor (Hortikultura, Kehutanan, Perikanan Budidaya, Perikanan Tangkap, Perkebunan, Peternakan).
  - Filter Status Pergantian (Semua / Belum Diganti / Sudah Diganti / Sudah Dicek Admin / Belum Dicek Admin).

### FR-4: Tabel Sampel Utama Interaktif
- Menampilkan daftar unit sampel utama lengkap dengan:
  - Kode Identitas & No.
  - Nama Kepala Keluarga.
  - Wilayah (Kecamatan, Desa, SLS).
  - Subsektor, KBLI, & Strata.
  - Status Badge: `AKTIF` atau `DIGANTI`.
  - **Cek Admin (Checklist Verifikasi)**:
    - Checkbox interaktif untuk Administrator guna menandai verifikasi sampel yang telah diganti.
    - Status verifikasi tersimpan permanen di cloud Redis/KV (`verified: true/false`, timestamp, verifikator).
    - Mode *read-only* bagi akun petugas lapangan.
  - Tombol Aksi:
    - Jika Belum Diganti: Tombol **"Ganti Sampel"** (Warna Biru/Primer).
    - Jika Sudah Diganti: Tombol **"Detail / Undo"** (Warna Oranye/Peringatan).

### FR-5: Modal Interaktif Pergantian Sampel
Saat tombol "Ganti Sampel" diklik:
- **Panel Info Sampel Utama**: Menampilkan ringkasan identitas sampel yang akan diganti.
- **Form Input Alasan**:
  - Dropdown alasan pergantian baku BPS.
  - Textarea catatan keterangan lapangan (opsional/wajib jika memilih 'Lainnya').
- **Tab Pemilihan Ruang Lingkup (4 Pilihan)**:
  1. Tab `Dalam 1 SLS` (Jumlah kandidat yang memenuhi syarat ditampilkan di badge tab).
  2. Tab `1 Desa`.
  3. Tab `1 Kecamatan`.
  4. Tab `Lintas Kecamatan`.
- **Filter Wilayah Pengganti Dinamis (Kecamatan & Desa)**:
  - Pada tab `1 Kecamatan`: Dropdown desa **multi-pilih** untuk mempersempit kandidat ke satu atau beberapa desa dalam kecamatan tersebut.
  - Pada tab `Lintas Kecamatan`: Dropdown kecamatan **multi-pilih** (10 kecamatan lain, tanpa kecamatan asal) dan desa **multi-pilih** untuk memilih wilayah pengganti secara spesifik (aturan gabungan sama dengan FR-3).
  - Setiap opsi kecamatan/desa menampilkan jumlah kandidat yang memenuhi syarat (mengikuti toggle subsektor & strata).
- **Pengaturan Kesesuaian**:
  - Checkbox toggle "Wajib Subsektor Sama" (default checked).
  - Checkbox toggle "Wajib Strata Sama" (default checked).
- **Daftar Rekomendasi Kandidat**:
  - Kartu/baris kandidat menampilkan: Nama KK, Kode Identitas, Alamat SLS/Desa, Subsektor, Strata, KBLI.
  - Badge kesesuaian: `Subsektor Cocok`, `Strata Cocok`, `SLS Cocok`.
  - Tombol **"Pilih Pengganti Ini"**.
- **Konfirmasi Aksi**: Modal konfirmasi sebelum pergantian diterapkan permanen ke state aplikasi.

### FR-6: Penguncian Status & Pencegahan Duplikasi
- Sampel pengganti yang telah dipilih langsung berstatus `TERPAKAI`.
- Sampel berstatus `TERPAKAI` otomatis dihilangkan dari daftar rekomendasi untuk sampel utama mana pun.

### FR-7: Manajemen Riwayat, Detail Pengganti, Ganti Ulang (Tidak Eligible) & Rollback (Undo)
- Klik pada sampel berstatus `DIGANTI` akan membuka modal detail yang menampilkan:
  - Data Sampel Utama asal.
  - Data Sampel Pengganti terpilih (beserta label tingkat urutan pengganti, misal `Pengganti Ke-2`).
  - Alasan pergantian dan waktu transaksi pergantian.
  - Ruang lingkup yang digunakan (1 SLS / 1 Desa / 1 Kecamatan / Lintas Kecamatan).
  - Status Cek Admin dan tombol verifikasi bagi Administrator.
  - **Riwayat Pengganti Gugur di Lapangan**: Daftar seluruh sampel pengganti sebelumnya yang dinyatakan tidak eligible di lapangan ($P_1, P_2, \dots$), lengkap dengan alasan gugur, catatan, waktu, dan petugas.
  - Tombol **"Ganti Ulang (Tidak Eligible)"**:
    - Digunakan saat sampel pengganti terpilih di lapangan ternyata tidak eligible (menolak, pindah domisili, meninggal dunia, alih usaha, dll.).
    - Membuka modal konfirmasi diskualifikasi untuk mencatat alasan gugur dan catatan lapangan.
    - Sampel yang digugurkan **dikunci permanen** dari pool cadangan (tidak bisa dipilih oleh petugas mana pun).
    - Membuka kembali modal pemilihan pengganti dengan banner notifikasi tingkat pergantian baru ($P_{k+1}$).
  - Tombol **"Batalkan Pergantian (Undo)"**: Mengembalikan sampel utama ke status AKTIF dan mengembalikan sampel cadangan ke pool TERSEDIA.

### FR-8: Ekspor Laporan & Berita Acara Excel .xlsx (Eksklusif Administrator)
Fitur pengunduhan laporan file dibatasi secara ketat hanya untuk pengguna ber-peran **Administrator (`admin`)**. Petugas non-admin yang mencoba mengunduh akan menerima penolakan otorisasi.
Tersedia 2 format ekspor berkas Excel asli (`.xlsx`) via pustaka SheetJS:
1. **Ekspor Berita Acara Pergantian Sampel (BAPS) (.xlsx)**:
   - Memuat riwayat pergantian lengkap per baris (baik sampel pengganti yang telah gugur maupun pengganti aktif).
   - Kolom meliputi: No, Waktu Penetapan, Petugas Lapangan, Status Cek Admin, Waktu Cek Admin, Verifikator Admin, Tingkat Pergantian (`Ke-1 (Gugur)`, `Ke-2 (Aktif)`), Status Pengganti (`GUGUR DI LAPANGAN` / `PENGGANTI AKTIF`), ID Utama, Kode Identitas Utama, Nama KK Utama, Subsektor Utama, Strata Utama, Wilayah Utama, ID Pengganti, Kode Identitas Pengganti, Nama KK Pengganti, Subsektor Pengganti, Strata Pengganti, Wilayah Pengganti, Ruang Lingkup, Alasan Pergantian / Gugur, Catatan Lapangan.
   - Dilengkapi lebar kolom (*column width*) yang telah diatur rapi untuk siap cetak/arsip.
2. **Ekspor DSRT Termutakhir (Full Dataset) (.xlsx)**:
   - Memuat 1.643 data lengkap dengan kolom tambahan: `Status Terkini` (`AKTIF (TETAP)`, `DIGANTI`, `PENGGANTI (TERSEDIA)`, `PENGGANTI (AKTIF)`, `PENGGANTI (GUGUR DI LAPANGAN)`), `Tingkat Pergantian`, `Status Cek Admin`, `ID Pasangan`, `Kode Pasangan`, `Nama Pasangan`, `Alasan Pergantian`, `Ruang Lingkup`.

### FR-9: Persistensi Data Lokal (Offline Resilience)
- Semua transaksi pergantian tersimpan di `localStorage` peramban.
- Jika halaman di-refresh atau koneksi terputus, seluruh data pergantian tetap tersimpan aman.
- Tersedia tombol **"Reset ke Awal"** dengan konfirmasi ganda jika pengguna ingin memulai ulang simulasi.

---

## 6. PERSYARATAN NON-FUNGSIONAL (NON-FUNCTIONAL REQUIREMENTS)

| Kategori | Spesifikasi |
| :--- | :--- |
| **Antarmuka (UI)** | Minimalis, clean, tipografi rapi, palet warna profesional BPS (Navy Blue, Slate, Emerald, Amber). |
| **Responsivitas** | 100% responsif pada layar ponsel (360px+), tablet (768px+), hingga monitor desktop (1920px). |
| **Performa** | Loading awal < 1 detik. Pencarian dan filter real-time tanpa delay (< 50ms) menggunakan in-memory state. |
| **Ketergantungan** | Zero heavy build tool / Zero backend server requirement. Siap dijalankan langsung di GitHub Pages. |
| **Aksesibilitas** | Kontras warna tinggi, label form jelas, tombol sentuh ramah jari (min tap target 44x44px). |
| **Penyimpanan** | Format state JSON terkompresi di `localStorage` (< 100 KB). |

---

## 7. STRUKTUR & SKEMA DATA

Dataset bersumber dari Google Sheet `DSRT 7301` dengan pemetaan skema:

```typescript
interface SampleRecord {
  no: number;             // Nomor urut (1 - 1643)
  id: string;             // UUID assignment BPS (e.g. 70fb23d7-4eb6-4a18-...)
  kode: string;           // Kode Identitas (e.g. "7301010 - U - 94" / "7301010 - P - 99")
  status: "UTAMA" | "PENGGANTI";
  nama: string;           // Nama Kepala Keluarga
  kd_kec: string;         // Kode Kecamatan (3 digit, e.g. "010")
  kec: string;            // Nama Kecamatan (e.g. "PASIMARANNU")
  kd_desa: string;        // Kode Desa (3 digit, e.g. "005")
  desa: string;           // Nama Desa (e.g. "BATU BINGKUNG")
  kd_sls: string;         // Kode SLS (6 digit, e.g. "000202")
  sls: string;            // Nama SLS (e.g. "DUSUN LIMBO UTARA")
  alamat: string;         // Keterangan alamat
  sub: string;            // Subsektor (e.g. "HORTIKULTURA", "PETERNAKAN", dll.)
  kd_kbli: string;        // Kode KBLI (5 digit, e.g. "01442")
  kbli: string;           // Uraian KBLI 2025
  strata: string;         // "1" atau "2"
}

interface ReplacementRecord {
  utamaId: string;
  penggantiId: string;
  penggantiKode: string;
  penggantiNama: string;
  penggantiWilayah: string;
  alasan: string;
  catatan: string;
  scope: "sls" | "desa" | "kecamatan" | "lintas_kecamatan";
  timestamp: string;      // ISO String
}
```

---

## 8. ARSITEKTUR & STRUKTUR REPOSITORI

```
sampel_spdt/
├── PRD.md                 # Dokumen Product Requirement Document ini
├── README.md              # Petunjuk penggunaan, demo login, dan deployment
├── index.html             # Single-page application responsif (Login + App UI)
├── app.js                 # Logika bisnis: auth, filter, matching algorithm, modal, export
├── data.js                # Data DSRT 7301 lengkap (1.643 unit sampel)
└── data_sample.csv        # Dataset asli dari Google Spreadsheet (backup source)
```

---

## 9. KRITERIA PENERIMAAN (ACCEPTANCE CRITERIA)

| ID | Skenario | Hasil yang Diharapkan |
| :---: | :--- | :--- |
| **AC-01** | Pengguna membuka situs tanpa login | Halaman menampilkan login form; dashboard terkunci. |
| **AC-02** | Pengguna memasukkan username `petugas` & password `1234` | Login berhasil, redirect ke dashboard, metrik menampilkan data akurat (267 Utama). |
| **AC-03** | Pengguna memilih sampel utama lalu membuka modal ganti | Tab "1 SLS" menampilkan kandidat dalam SLS yang sama dengan subsektor yang cocok. |
| **AC-04** | Pengguna berpindah ke tab "1 Desa", "1 Kecamatan", atau "Lintas Kecamatan" | Daftar kandidat diperbarui secara instan sesuai batas spasial yang dipilih. |
| **AC-05** | Pengguna memilih salah satu pengganti dan mengonfirmasi | Sampel utama berubah menjadi "DIGANTI"; pengganti terkunci dan tidak muncul lagi di pencarian lain. |
| **AC-06** | Pengguna melakukan refresh halaman | Seluruh pergantian yang telah dilakukan tetap tersimpan (persist via `localStorage`). |
| **AC-07** | Pengguna menekan tombol "Detail & Batalkan" pada sampel yang diganti | Pengguna dapat melakukan Undo; status sampel kembali menjadi AKTIF dan pengganti kembali TERSEDIA. |
| **AC-08** | Pengguna mengklik "Ekspor Berita Acara" | File CSV terunduh memuat seluruh histori pemetaan pergantian sampel secara rapi. |
| **AC-09** | Tampilan diakses via smartphone (lebar layar < 480px) | Layout adaptif, tabel atau card ramah layar sentuh, modal full-screen responsif. |

---

## 10. ROADMAP & PENGEMBANGAN LANJUTAN
1. **Fase 1 (Saat ini)**: Client-side Responsive Web App, Otentikasi Sesi, 4 Ruang Lingkup, Smart Score, LocalStorage, Ekspor CSV, GitHub Pages Deploy.
2. **Fase 2**: Integrasi API langsung ke backend FASIH-SM BPS untuk sinkronisasi mutasi assignment secara live.
3. **Fase 3**: Geotagging & peta sebaran spasial sampel utama vs sampel pengganti menggunakan leaflet/MapLibre.
