export function fieldLabel(field: string) {
    const labels: Record<string, string> = {
        name: 'Nama',
        username: 'Nama pengguna',
        password: 'Kata sandi',
        currentPassword: 'Kata sandi saat ini',
        newPassword: 'Kata sandi baru',
        inviteCode: 'Kode kelas',
        file: 'File Excel',
        classId: 'Kelas',
        pdf: 'File PDF',
        title: 'Judul',
        subject: 'Mata pelajaran',
        grade: 'Kelas',
        rights: 'Hak pakai',
        firstPage: 'Dari halaman',
        lastPage: 'Sampai halaman',
        competencies: 'Kompetensi',
        code: 'Kode',
        description: 'Deskripsi',
        pages: 'Halaman sumber',
        visible: 'Terlihat',
        developing: 'Berkembang',
        notEnough: 'Belum cukup bukti',
        note: 'Yang perlu diubah',
        classIds: 'Kelas',
        themes: 'Tema cerita',
        minutes: 'Batas waktu',
        options: 'Pilihan jawaban',
        groupSize: 'Jumlah siswa per kelompok',
    };
    const parts = field.split('/');
    const label = labels[parts.at(-1) ?? ''] ?? 'Isian';
    if (parts[0] === 'users')
        return `Baris Excel ${Number(parts[1]) + 2}, ${label.toLowerCase()}`;
    if (parts[0] === 'competencies' && parts.length > 2)
        return `C${Number(parts[1]) + 1}, ${label.toLowerCase()}`;
    return label;
}
export function fieldMessage(message: string, field = '') {
    if (/^Theme rule:/u.test(message))
        return 'Teks ini mengubah jawaban, angka, atau isi misi dasar.';
    if (/^Already chosen$/u.test(message)) return 'Tema ini sudah dipilih.';
    if (/^At most three themes$/u.test(message))
        return 'Paling banyak tiga tema per misi.';
    if (/^Pictures come from the base mission$/u.test(message))
        return 'Gambar mengikuti misi dasar.';
    if (field === 'themes' && /expected array to have >=1/u.test(message))
        return 'Pilih setidaknya satu minat.';
    if (field === 'themes' && /expected array to have <=3/u.test(message))
        return 'Paling banyak tiga tema per misi.';
    if (field === 'groupSize') return 'Isi 2 sampai 5 siswa per kelompok.';
    if (field === 'studentIds' && /expected array to have >=1/u.test(message))
        return 'Pilih setidaknya satu siswa.';
    if (field === 'studentIds' && /expected array to have <=60/u.test(message))
        return 'Paling banyak 60 siswa.';
    if (/Choose students of this class/u.test(message))
        return 'Pilih siswa dari kelas ini. Muat ulang halaman, lalu coba lagi.';
    if (/does not teach this competency/u.test(message))
        return 'Misi ini tidak mengajarkan kompetensi ini. Muat ulang halaman, lalu coba lagi.';
    if (field === 'options' && /expected array to have >=2/u.test(message))
        return 'Isi setidaknya dua pilihan jawaban.';
    if (/at most two sentences/u.test(message))
        return 'Satu layar siswa paling banyak dua kalimat. Pendekkan teksnya.';
    if (/answer must be one of the options/u.test(message))
        return 'Pilih jawaban benar dari pilihan yang ada.';
    if (/Keep the same options/u.test(message))
        return 'Pilihan jawaban tidak bisa ditambah atau dihapus.';
    if (/A picture can only be kept or removed/u.test(message))
        return 'Gambar hanya bisa dibiarkan atau dihapus. Muat ulang halaman untuk melihat versi terbaru.';
    if (/at least one class/u.test(message))
        return 'Pilih setidaknya satu kelas.';
    if (/at least one competency/u.test(message))
        return 'Pilih setidaknya satu kompetensi.';
    if (/competencies of this chapter/u.test(message))
        return 'Pilih kompetensi dari bab ini. Muat ulang halaman, lalu coba lagi.';
    const tooLong = /expected string to have <=(\d+)/u.exec(message);
    if (tooLong) return `Paling banyak ${tooLong[1]} karakter.`;
    const pageCount = /The material has (\d+) pages/u.exec(message);
    if (pageCount) return `Materi ini hanya ${pageCount[1]} halaman.`;
    if (/last page comes before/u.test(message))
        return 'Halaman akhir harus sama dengan atau sesudah halaman awal.';
    if (/no readable page/u.test(message))
        return 'Rentang ini tidak punya halaman yang terbaca. Pilih halaman lain.';
    if (/at most \d+ readable pages/u.test(message))
        return 'Satu modul paling banyak 20 halaman yang terbaca. Persempit rentangnya.';
    if (/readable pages inside the module/u.test(message))
        return 'Pakai nomor halaman yang terbaca di dalam rentang modul.';
    if (/its own code/u.test(message))
        return 'Setiap kompetensi perlu kode sendiri.';
    if (/expected array to have >=1/u.test(message))
        return 'Isi setidaknya satu baris.';
    if (/expected string to have >=1/u.test(message))
        return 'Isian ini belum diisi.';
    if (/not a PDF/u.test(message))
        return 'File ini bukan PDF yang bisa dibaca. Simpan ulang sebagai PDF, lalu unggah lagi.';
    if (/None of the pages/u.test(message))
        return 'Tidak ada halaman yang teksnya terbaca. PDF ini mungkin hasil pindai; unggah PDF yang teksnya bisa dipilih.';
    if (/at most \d+ pages/u.test(message))
        return 'PDF ini lebih dari 300 halaman. Unggah bagian yang Anda perlukan saja.';
    if (/application\/pdf/u.test(message)) return 'Pilih file PDF.';
    if (/Confirm the right/u.test(message))
        return 'Centang pernyataan bahwa Anda berhak memakai materi ini.';
    if (/Current password is incorrect/u.test(message))
        return 'Kata sandi saat ini belum cocok. Periksa lagi.';
    if (/Class code not found/u.test(message))
        return 'Kode kelas belum ditemukan. Periksa kode dari gurumu.';
    if (/already taken|duplicate/iu.test(message))
        return 'Nama pengguna sudah dipakai. Gunakan nama pengguna lain.';
    if (/15/iu.test(message))
        return 'Gunakan setidaknya 15 karakter untuk kata sandi baru.';
    if (/8/iu.test(message))
        return 'Kata sandi siswa perlu setidaknya 8 karakter.';
    if (/500|rows/iu.test(message))
        return 'Isi file dengan 1 sampai 500 baris akun.';
    if (/column|spreadsheet|sheet|xlsx/iu.test(message))
        return 'Gunakan file .xlsx dengan kolom Nama, Username, dan Password (opsional).';
    if (/required|expected|empty/iu.test(message))
        return 'Lengkapi isian ini dengan format yang diminta.';
    return 'Periksa format dan panjang isian ini, lalu coba lagi.';
}
