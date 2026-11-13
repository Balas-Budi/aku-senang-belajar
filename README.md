# Aku Senang Belajar

Platform belajar berbasis AI untuk siswa Sekolah Dasar (SD) dan gurunya. Guru mengunggah buku atau materi, AI menyusunnya menjadi misi belajar interaktif bersama maskot **si Jalak** (burung jalak bali), lalu guru memeriksa bukti pemahaman setiap siswa per kompetensi.

> Dibuat untuk hackathon bertema **"Smart & Fun Education"**, pengumpulan MVP 14 November 2026.

---

## Latar belakang

### Masalahnya: jawaban benar belum tentu paham

Sekarang siswa bisa mengumpulkan jawaban yang benar, dengan atau tanpa bantuan AI, tetapi belum tentu benar-benar memahami konsepnya. **Jawaban benar saja tidak lagi menunjukkan pemahaman.** Di sisi lain, setiap siswa punya kebutuhan, titik awal, dan minat yang berbeda, sementara guru hanya punya sedikit bukti untuk menentukan bantuan apa yang dibutuhkan siapa.

Survei eksploratif kami (Oktober 2026, 10 guru SD/MI dan 13 siswa kelas 5–6, sampel kecil dan sukarela, jadi ini sinyal awal dan bukan klaim populasi) menunjukkan:

- **8 dari 10 guru** setidaknya kadang menemui siswa yang bisa menjawab tetapi kesulitan menjelaskan _mengapa_.
- **9 dari 13 siswa** sudah memakai AI: 7 untuk minta penjelasan materi, 2 untuk minta jawaban.
- **10 dari 13 siswa** memilih penjelasan langsung dari guru sebagai hal yang paling membantu mereka paham.
- Ditanya ingin belajar dengan cara apa, siswa paling banyak memilih **lewat cerita** (5 dari 13).
- **8 dari 10 guru** biasanya mengulang penjelasan untuk seluruh kelas, bukan per siswa.

Dari sini ada dua masalah yang saling terkait:

|                      | Masalah di sisi siswa                                                                                                             | Masalah di sisi guru                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Apa yang terjadi** | Belajar terasa pasif dan seragam. Materi sama untuk semua, latihan sekadar memilih jawaban, dan AI umum langsung memberi jawaban. | Guru hanya melihat nilai akhir, bukan proses berpikir siswa, sehingga sulit tahu siapa yang benar-benar paham dan siapa yang hanya menebak atau menyalin. |
| **Akibatnya**        | Siswa bisa "selesai" tanpa membangun pemahaman.                                                                                   | Tindak lanjut jadi umum untuk seluruh kelas, bukan tepat sasaran.                                                                                         |

### Solusinya: satu platform, dua pilar

#### 1. AI Personalized Learning: belajar aktif dan personal

**Masalah:** materi pasif dan seragam, dan AI umum langsung memberi jawaban.

**Solusi:** AI mengubah materi pilihan guru menjadi **misi belajar interaktif** yang dijalani siswa secara aktif.

- **Bercerita bersama si Jalak**: materi disampaikan sebagai cerita bersambung. Siswa menjadi tokoh utama yang disapa "kamu", di tempat yang dikenal anak Indonesia.
- **Interupsi aktif**: setelah setiap 1–3 layar cerita, siswa diminta bertindak, misalnya memilih, mengurutkan, mencocokkan, mengelompokkan, atau mengarsir.
- **Belajar dulu, baru jawaban**: kalau jawaban belum tepat, siswa mendapat petunjuk bertahap, contoh lain, lalu boleh mencoba lagi. Tidak ada jalan buntu.
- **Tantangan penerapan**: soal dalam situasi baru yang tidak bisa dijawab hanya dengan menghafal contoh. Siswa memberi alasan dengan mengetik atau bersuara.
- **Personal tanpa mengubah tujuan**: tema cerita mengikuti minat siswa, dan urutan bantuan menyesuaikan apa yang terbukti membantu dia sebelumnya. Ukuran teks, dibacakan, dan kecepatan suara bisa diatur. **Kompetensi yang diukur tetap sama untuk semua.**
- **Tetap seru**: permainan otak pembuka, kartu pengetahuan, stiker bab, "Ulang Yuk", dan "Tantangan tambahan".

#### 2. AI Learning Understanding: bukti pemahaman yang bisa diperiksa guru

**Masalah:** guru hanya melihat nilai akhir dan tidak tahu proses berpikir siswa.

**Solusi:** setiap jawaban siswa dicatat sebagai **bukti** yang terhubung ke kompetensi, lalu AI menganalisisnya dengan rubrik dan **guru yang memutuskan**.

- **Status per kompetensi, bukan satu skor**: _Belum terlihat_, _Berkembang_, _Terlihat_, atau _Perlu verifikasi_.
- **Setiap kesimpulan menunjuk buktinya**: jawaban mana, bantuan apa yang dipakai, dan kapan bukti belum cukup.
- **Guru tetap memegang kendali**: guru memeriksa, mengubah, atau mengonfirmasi status, dibantu usulan pertanyaan verifikasi per siswa.
- **Tindak lanjut tepat sasaran**: laporan per siswa dan per kelas, rencana tindak lanjut, dan tantangan kelas untuk diskusi bersama.
- **Memori belajar**: ringkasan setiap misi dipakai untuk menyesuaikan misi berikutnya, tanpa label "gaya belajar" dan tanpa kesimpulan psikologis.

Keduanya diikat oleh satu tujuan: **membantu siswa membangun pemahaman lewat pembelajaran interaktif yang personal, sambil memberi guru bukti yang bisa diverifikasi.**

---

## Siklus belajar

```
 Guru                          AI                              Siswa
 ────                          ──                              ─────
 1. Unggah buku PDF  ───────►  Membaca halaman & gambar,
                               memecah jadi bab + kompetensi
 2. Pilih bab        ───────►  Menyusun draf misi sesuai
                               kompetensi & isi buku
 3. Periksa & setujui di studio,
    lalu buka bab untuk kelas  ─────────────────────────────►  4. Menjalani misi bersama si Jalak
                               5. Menganalisis bukti      ◄──── jawaban, alasan, bantuan, refleksi
                                  per kompetensi (rubrik)
 6. Memverifikasi bukti,
    memberi tindak lanjut      7. Misi berikutnya menyesuaikan
                                  (bantuan, urutan, Ulang Yuk)
```

Prinsip AI-nya: **materi guru adalah sumber kebenaran.** AI hanya menyusun di dalam bab dan kompetensi yang dipilih guru, hasilnya diperiksa sistem, lalu disetujui guru sebelum sampai ke siswa. Isi buku diperlakukan sebagai data, bukan perintah.

---

## Arsitektur

```
┌────────────────────────────┐        ┌──────────────────────────────┐
│  Frontend (packages/frontend)│  HTTP  │  Backend (packages/backend)   │
│  React 19 + React Router 8  │ ─────► │  Fastify 5 + Zod              │
│  (SSR framework mode)       │  /api  │  Drizzle ORM                  │
│  TanStack Query, Tailwind 4 │        │  Background workers:          │
│  pdf.js (penampil buku)     │        │   · membaca buku (bab, gambar)│
└────────────────────────────┘        │   · menyusun misi & tema      │
                                      │   · analisis pemahaman        │
                                      │   · ringkasan & adaptasi      │
                                      └───────┬──────────────┬───────┘
                                              │              │
                                  ┌───────────▼───┐   ┌──────▼─────────────┐
                                  │ PostgreSQL     │   │ Penyedia AI         │
                                  │ + pgvector     │   │ (API kompatibel     │
                                  │ (data, PDF,    │   │  OpenAI: chat +     │
                                  │  embedding)    │   │  embedding)         │
                                  └────────────────┘   └────────────────────┘
```

- **Monorepo Nx** dengan dua proyek: `packages/frontend` dan `packages/backend`.
- **Frontend**: React Router 8 (framework mode, SSR dengan loader dan dehydrate), TanStack Query, Tailwind CSS v4, komponen dibuat sendiri (tanpa library UI), ikon SVG inline, dan maskot si Jalak berupa SVG beranimasi.
- **Backend**: Fastify 5, validasi Zod, Drizzle ORM ke PostgreSQL, sesi berbasis cookie, rate limit. Pekerjaan AI berjalan di latar belakang dengan status yang tersimpan, jadi bisa dicoba ulang kalau gagal.
- **AI**: penyedia apa pun yang kompatibel dengan OpenAI. Setiap prompt punya versi, setiap jawaban AI divalidasi skema dan aturan, lalu diperbaiki otomatis bila melanggar aturan. Embedding (pgvector) dipakai untuk mencari potongan buku yang relevan.
- **Peran**: `admin` (akun, kelas, mata pelajaran), `teacher` (materi, studio misi, kelas, verifikasi), `student` (misi, jalur belajar).

### Struktur folder

```
packages/
├── backend/
│   ├── drizzle/              # migrasi database (SQL)
│   ├── src/
│   │   ├── routes/           # endpoint API per fitur (auth, classes, materials, studio, student, ...)
│   │   ├── studio/           # penyusunan misi & tema oleh AI
│   │   ├── materials/        # membaca PDF, bab, gambar
│   │   ├── analysis/         # analisis pemahaman per kompetensi
│   │   ├── memory/           # ringkasan, adaptasi, laporan
│   │   ├── learning/         # skema blok misi, aktivitas, diagram
│   │   ├── db/               # skema Drizzle
│   │   └── scripts/          # create-admin, seed, dan lainnya
│   └── tests/                # tes node:test (dengan AI tiruan)
└── frontend/
    └── src/
        ├── routes/           # halaman (guru, siswa, admin, akun)
        ├── features/         # fitur per domain (materials, studio, path, results, ...)
        └── components/       # komponen bersama, ikon, si Jalak
```

---

## Menjalankan secara lokal

**Kebutuhan:** Node.js 26 (`.nvmrc`), PostgreSQL dengan ekstensi **pgvector**, dan kunci API penyedia AI yang kompatibel dengan OpenAI (opsional; tanpa AI, fitur penyusunan dan analisis tidak berjalan).

```bash
# 1. Pasang dependensi
nvm use
npm install

# 2. Siapkan environment
cp .env.example .env
# isi DATABASE_URL, TEST_DATABASE_URL, AI_BASE_URL, AI_API_KEY, AI_MODEL,
# dan AI_EMBED_* untuk embedding

# 3. Buat database lalu jalankan migrasi
createdb aku_senang_belajar
npm run db:migrate

# 4. Buat akun admin pertama (kata sandi ditampilkan sekali)
npm exec nx run backend:create-admin -- admin "Admin Sekolah"

# 5. Jalankan backend (port 3000) dan frontend (port 4200)
npm run dev
```

Buka `http://127.0.0.1:4200` lalu masuk sebagai admin.

| Perintah              | Fungsi                                     |
| --------------------- | ------------------------------------------ |
| `npm run dev`         | Menjalankan backend dan frontend sekaligus |
| `npm run check`       | Format, typecheck, seluruh tes, dan build  |
| `npm test`            | Tes backend (butuh `TEST_DATABASE_URL`)    |
| `npm run db:generate` | Membuat migrasi baru dari perubahan skema  |
| `npm run db:migrate`  | Menjalankan migrasi                        |

---

## Cara pakai

### Admin sekolah

1. Masuk, lalu buat **akun guru** dan **akun siswa**, satu per satu atau impor dari Excel (template tersedia). Kata sandi bisa dibuat otomatis dan dicetak.
2. Atur **Mata pelajaran**: tambah mapel baru dengan warna dan ikon. Mapel yang masih dipakai buku tidak bisa dihapus.
3. Tempatkan siswa ke kelas dan atur ulang kata sandi bila perlu.

### Guru

1. **Kelas**: buat kelas, lalu bagikan **kode undangan** ke siswa.
2. **Materi**: tekan **Unggah buku PDF** (hingga 200 MB / 300 halaman). AI membaca halaman dan gambarnya, lalu memecah buku menjadi **bab** beserta **kompetensinya**. Buku aslinya bisa dibaca di tab **Buku** seperti membalik halaman.
3. **Susun misi**: di bab yang diinginkan, pilih kompetensi dan panjang misi. AI menyusun draf di **Studio misi**. Periksa setiap layar, ubah teks, minta AI merevisi, atau tambahkan tema cerita, lalu tandai **siap**.
4. **Buka bab** untuk kelas di tab **Bab** halaman kelas. Siswa langsung melihat misinya.
5. **Pantau dan verifikasi**: lihat hasil per misi, buka **bukti siswa** per kompetensi, lalu konfirmasi atau ubah status dari AI. Gunakan laporan bab dan laporan siswa, rencana **tindak lanjut**, sesi langsung, dan **tantangan kelas** untuk diskusi.

### Siswa

1. Masuk dengan akun dari sekolah, lalu gabung kelas dengan **kode undangan**.
2. Isi **Minatku** (opsional), yang dipakai untuk tema cerita.
3. Pilih mata pelajaran, lalu ikuti **jalur misi**: permainan pembuka, cerita bersama si Jalak, aktivitas, tantangan, dan refleksi.
4. Kumpulkan **kartu pengetahuan**, latihan lagi lewat **Ulang Yuk**, dan coba **Tantangan tambahan** setelah kompetensinya terlihat.

---

## Prinsip dan data anak

- **Guru di dalam lingkaran keputusan**: AI mengusulkan, guru memverifikasi dan memutuskan.
- **Bukti, bukan skor buram**: setiap status punya bukti, rubrik, dan alasan, serta tanda kalau bukti belum cukup.
- **Data minimal**: hanya data yang dibutuhkan untuk belajar. Data yang dikirim ke AI tidak memuat nama, username, kelas, atau sekolah. Tidak ada diagnosis psikologis.
- **Aman untuk anak**: konten ramah anak, layar siswa tidak menampilkan nama guru ("Bapak/Ibu Guru"), dan rekaman suara tidak disimpan.
- **Tanpa klaim efektivitas**: hasil survei adalah sinyal awal. Efek pada pemahaman perlu diuji di uji coba sekolah.

## Lisensi

MIT
