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
    };
    const parts = field.split('/');
    const label = labels[parts.at(-1) ?? ''] ?? 'Isian';
    return parts[0] === 'users'
        ? `Baris Excel ${Number(parts[1]) + 2}, ${label.toLowerCase()}`
        : label;
}
export function fieldMessage(message: string) {
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
