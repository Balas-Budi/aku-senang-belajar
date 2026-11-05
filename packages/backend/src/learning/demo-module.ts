import type { PreparedModule } from './seed-module.ts';

export const demoModule: PreparedModule = {
    subject: 'mathematics',
    material: 'Modul Pecahan Kelas 4',
    module: 'Mengenal pecahan',
    competencies: [
        {
            code: 'C1',
            description:
                'Mengenali 1/4 pada gambar: menunjuk satu dari empat bagian yang sama besar pada dua bentuk berbeda.',
            rubric: {
                visible: [
                    'Memilih roti B, yang dipotong menjadi empat bagian sama besar, pada percobaan pertama tanpa petunjuk.',
                ],
                developing: [
                    'Memilih roti B setelah memakai petunjuk atau contoh lain.',
                    'Memilih roti A atau C: belum memastikan rotinya dibagi menjadi empat bagian yang sama besar.',
                    'Jawaban yang tepat baru tampil setelah tiga percobaan.',
                ],
                notEnough: ['Soal roti bundar belum dijawab.'],
            },
        },
        {
            code: 'C2',
            description:
                'Menjelaskan arti 1/4: satu dari empat bagian yang sama besar.',
            rubric: {
                visible: [
                    'Menjawab "Bukan seperempat" dan alasannya menyebut bahwa potongannya tidak sama besar, dengan kata-kata sendiri, sependek apa pun.',
                    'Di tantangan, alasannya memakai gagasan bagian yang sama besar.',
                ],
                developing: [
                    'Memilih "Bukan seperempat", tetapi alasannya belum menyebut ukuran yang sama besar, misalnya hanya "karena dipotong empat".',
                    'Masih mengira empat potong yang tidak sama besar tetap seperempat, atau baru tepat setelah petunjuk.',
                ],
                notEnough: [
                    'Alasan kosong, tidak berkaitan dengan soal, atau tidak bisa dipahami.',
                ],
            },
        },
        {
            code: 'C3',
            description:
                'Menerapkan 1/4 pada situasi baru: membandingkan 1/4 dengan 1/2 dan memberi alasan.',
            rubric: {
                visible: [
                    'Memilih Budi dan alasannya masuk akal, misalnya 1/2 lebih banyak karena roti dibagi menjadi lebih sedikit bagian yang sama besar.',
                ],
                developing: [
                    'Memilih Budi, tetapi alasannya belum menjelaskan mengapa 1/2 lebih banyak.',
                    'Memilih Ani karena 4 lebih besar dari 2.',
                    'Memilih "Sama banyak" karena keduanya sama-sama mengambil satu bagian.',
                ],
                notEnough: ['Tantangan belum dijawab, atau alasannya kosong.'],
            },
        },
    ],
    session: {
        title: 'Pecahan: bagian yang sama besar',
        summary:
            'Kancil membagi satu roti untuk empat temannya. Kapan satu potong disebut seperempat?',
    },
    blocks: [
        {
            kind: 'brain_game',
            content: { game: 'memory_pairs' },
            competencies: [],
        },
        {
            kind: 'hook',
            content: {
                prompt: 'Kancil mau membagi 1 roti untuk 4 temannya. Cara mana yang adil?',
                illustration: 'loaf-whole',
                options: [
                    { id: 'a', label: 'A', illustration: 'loaf-quarters' },
                    {
                        id: 'b',
                        label: 'B',
                        illustration: 'loaf-quarters-unequal',
                    },
                    { id: 'c', label: 'C', illustration: 'loaf-halves' },
                ],
            },
            competencies: ['C1'],
        },
        {
            kind: 'story',
            content: {
                text: 'Kancil memotong roti menjadi 4 bagian yang sama besar. Setiap teman mendapat satu bagian.',
                illustration: 'loaf-quarters',
            },
            competencies: ['C1'],
        },
        {
            kind: 'story',
            content: {
                text: 'Satu dari 4 bagian yang sama besar disebut seperempat. Seperempat ditulis 1/4.',
                illustration: 'loaf-quarter-marked',
                fraction: {
                    numerator: 1,
                    denominator: 4,
                    numeratorNote: 'bagian yang diambil',
                    denominatorNote: 'bagian yang sama besar',
                },
            },
            competencies: ['C1', 'C2'],
        },
        {
            kind: 'check',
            content: {
                prompt: 'Roti ini dipotong jadi 4, tapi ukurannya beda-beda. Apakah satu potongnya seperempat?',
                illustration: 'loaf-quarters-unequal',
                options: [
                    { id: 'a', label: 'Ya, seperempat' },
                    { id: 'b', label: 'Bukan seperempat' },
                ],
                answer: 'b',
                reason: {
                    prompt: 'Kenapa?',
                    starters: ['Karena ...', 'Bagiannya ...'],
                },
                praise: 'Tepat! Bagiannya memang harus sama besar.',
                hints: [
                    {
                        text: 'Seperempat artinya 1 dari 4 bagian yang sama besar.',
                    },
                    {
                        text: 'Bandingkan dengan roti ini, yang potongannya sama besar. Apakah potongan roti tadi juga sama besar?',
                        illustration: 'loaf-quarters',
                    },
                    {
                        text: 'Kalau potongannya beda-beda, ada teman yang mendapat lebih banyak. Apakah itu adil?',
                    },
                ],
                example: {
                    text: 'Kertas ini dilipat jadi 4 bagian yang sama besar. Satu bagiannya adalah seperempat kertas.',
                    illustration: 'paper-quarters',
                },
                reveal: 'Jawabannya bukan seperempat, karena keempat potongnya tidak sama besar.',
            },
            competencies: ['C2'],
        },
        {
            kind: 'story',
            content: {
                text: 'Kancil juga punya roti bundar. Ia memotongnya menjadi 4 bagian yang sama besar, jadi tiap potongnya juga 1/4.',
                illustration: 'round-quarter-marked',
            },
            competencies: ['C1'],
        },
        {
            kind: 'check',
            content: {
                prompt: 'Di dapur Kancil ada tiga roti bundar. Pilih roti yang tiap potongnya seperempat.',
                options: [
                    { id: 'a', label: 'A', illustration: 'round-thirds' },
                    { id: 'b', label: 'B', illustration: 'round-quarters' },
                    {
                        id: 'c',
                        label: 'C',
                        illustration: 'round-quarters-unequal',
                    },
                ],
                answer: 'b',
                praise: 'Tepat! Roti B dipotong jadi 4 bagian yang sama besar.',
                hints: [
                    {
                        text: 'Hitung potongan setiap roti. Roti mana yang punya 4 potong?',
                    },
                    {
                        text: 'Ada dua roti yang punya 4 potong. Mana yang potongannya sama besar?',
                    },
                    {
                        text: 'Roti A hanya punya 3 potong. Sekarang bandingkan ukuran potongan roti B dan roti C.',
                    },
                ],
                example: {
                    text: 'Ingat roti bundar Kancil tadi. Ia memotongnya silang tepat di tengah, jadi 4 potongnya sama besar.',
                    illustration: 'round-quarter-marked',
                },
                reveal: 'Jawabannya roti B, karena hanya roti B yang dipotong jadi 4 bagian yang sama besar.',
            },
            competencies: ['C1'],
        },
        {
            kind: 'challenge',
            content: {
                prompt: 'Ani dan Budi punya roti yang sama besar. Ani mengambil 1/4 roti, sedangkan Budi mengambil 1/2 roti.',
                question:
                    'Siapa yang mendapat lebih banyak? Jelaskan alasanmu.',
                illustration: 'loaf-pair',
                options: [
                    { id: 'a', label: 'Ani' },
                    { id: 'b', label: 'Budi' },
                    { id: 'c', label: 'Sama banyak' },
                ],
                answer: 'b',
                reasonStarter: 'Menurutku ... karena ...',
            },
            competencies: ['C2', 'C3'],
        },
        {
            kind: 'reflection',
            content: {
                topics: [
                    'Arti 1/4',
                    'Bagiannya harus sama besar',
                    'Membandingkan 1/4 dan 1/2',
                ],
                takeaways: [
                    '1/4 artinya 1 dari 4 bagian yang sama besar.',
                    'Potongan yang tidak sama besar bukan seperempat.',
                ],
            },
            competencies: ['C1', 'C2', 'C3'],
        },
    ],
};
